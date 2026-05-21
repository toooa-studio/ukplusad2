import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { BOOKING_DURATION_STEP_MINUTES } from '@/lib/utils';
import { DEFAULT_LESSON_MINUTES } from '@/lib/types';

const SETTINGS_DOC = 'general';

async function getBufferMinutes(): Promise<number> {
  const snap = await adminDb.doc(`settings/${SETTINGS_DOC}`).get();
  if (snap.exists) {
    return snap.data()?.breakBufferMinutesDefault ?? 10;
  }
  return 10;
}

interface AttendeeInput {
  studentId: string;
  enrollmentId: string;
}

/**
 * 予約作成エンドポイント。
 *
 * 受け付ける body 形式:
 *   - プライベート（互換・1人）:
 *       { slotId, studentId, enrollmentId, lessonStartAt, lessonEndAt, ... }
 *   - セミプライベート（複数人）:
 *       { slotId, lessonStartAt, lessonEndAt, groupId?, attendees: [{studentId, enrollmentId}, ...], ... }
 *
 * セミプライベートの場合は attendees 全員ぶんの enrollment を同時にチェック・更新します。
 * 1人でも残数不足や登録切れがあれば、トランザクションで全体を巻き戻します。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      slotId,
      studentId: legacyStudentId,
      enrollmentId: legacyEnrollmentId,
      bookedBy,
      lessonStartAt,
      lessonEndAt,
      zoomURL,
      groupId,
      attendees: rawAttendees,
    } = body;

    if (!slotId || !lessonStartAt || !lessonEndAt) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています（slotId / lessonStartAt / lessonEndAt）' },
        { status: 400 },
      );
    }

    // 予約時間は BOOKING_DURATION_STEP_MINUTES の倍数のみ許可（最小単位 30 分）。
    {
      const start = new Date(lessonStartAt);
      const end = new Date(lessonEndAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'lessonStartAt / lessonEndAt の日時形式が正しくありません' },
          { status: 400 },
        );
      }
      const durationMinutes = (end.getTime() - start.getTime()) / 60000;
      if (durationMinutes <= 0) {
        return NextResponse.json(
          { error: 'lessonEndAt は lessonStartAt より後の時刻にしてください' },
          { status: 400 },
        );
      }
      if (durationMinutes % BOOKING_DURATION_STEP_MINUTES !== 0) {
        return NextResponse.json(
          {
            error: `レッスン時間は ${BOOKING_DURATION_STEP_MINUTES} 分単位で指定してください`,
          },
          { status: 400 },
        );
      }
      if (
        start.getMinutes() % BOOKING_DURATION_STEP_MINUTES !== 0 ||
        start.getSeconds() !== 0 ||
        start.getMilliseconds() !== 0
      ) {
        return NextResponse.json(
          {
            error: `開始時刻は ${BOOKING_DURATION_STEP_MINUTES} 分単位で指定してください`,
          },
          { status: 400 },
        );
      }
      if (
        end.getMinutes() % BOOKING_DURATION_STEP_MINUTES !== 0 ||
        end.getSeconds() !== 0 ||
        end.getMilliseconds() !== 0
      ) {
        return NextResponse.json(
          {
            error: `終了時刻は ${BOOKING_DURATION_STEP_MINUTES} 分単位で指定してください`,
          },
          { status: 400 },
        );
      }
    }

    // 入力を正規化: attendees があればそれを使う。無ければ studentId/enrollmentId から1名作る。
    let attendees: AttendeeInput[] = [];
    if (Array.isArray(rawAttendees) && rawAttendees.length > 0) {
      attendees = rawAttendees as AttendeeInput[];
    } else if (legacyStudentId && legacyEnrollmentId) {
      attendees = [{ studentId: legacyStudentId, enrollmentId: legacyEnrollmentId }];
    }

    if (attendees.length === 0) {
      return NextResponse.json(
        { error: '参加者情報（attendees もしくは studentId+enrollmentId）が必要です' },
        { status: 400 },
      );
    }

    // 重複参加者チェック（同じ生徒が複数回入っていたら不正）
    const uniqueStudentIds = new Set(attendees.map((a) => a.studentId));
    if (uniqueStudentIds.size !== attendees.length) {
      return NextResponse.json(
        { error: '同じ生徒が複数回参加者として指定されています' },
        { status: 400 },
      );
    }

    for (const a of attendees) {
      if (!a?.studentId || !a?.enrollmentId) {
        return NextResponse.json(
          { error: 'attendees の各要素には studentId と enrollmentId が必要です' },
          { status: 400 },
        );
      }
    }

    const bookingType: 'private' | 'semi_private' =
      attendees.length >= 2 ? 'semi_private' : 'private';
    const representativeStudentId = attendees[0].studentId;
    const representativeEnrollmentId = attendees[0].enrollmentId;

    const bufferMinutes = await getBufferMinutes();

    const result = await adminDb.runTransaction(async (transaction) => {
      const slotRef = adminDb.doc(`privateSlots/${slotId}`);

      // ---- READS ----
      // Firestore のトランザクションは「全 read を全 write より先」に行う必要がある。

      const slotSnap = await transaction.get(slotRef);
      if (!slotSnap.exists) {
        throw new Error('指定された空き枠が見つかりません');
      }

      const slotData = slotSnap.data()!;
      if (slotData.status !== 'open') {
        throw new Error('この空き枠は予約できません');
      }

      // セミプライベート時、グループの整合性をチェック
      let groupData: FirebaseFirestore.DocumentData | null = null;
      if (groupId) {
        const groupSnap = await transaction.get(adminDb.doc(`studentGroups/${groupId}`));
        if (!groupSnap.exists) {
          throw new Error('指定されたグループが見つかりません');
        }
        groupData = groupSnap.data()!;
        if (groupData.status && groupData.status !== 'active') {
          throw new Error('このグループは現在利用できません');
        }
        const memberIds: string[] = Array.isArray(groupData.memberIds)
          ? groupData.memberIds
          : [];
        for (const a of attendees) {
          if (!memberIds.includes(a.studentId)) {
            throw new Error('参加者にグループメンバー以外が含まれています');
          }
        }
        if (attendees.length !== memberIds.length) {
          throw new Error(
            'セミプライベート予約はグループ全員ぶんの参加者を指定してください',
          );
        }
      }

      // 各参加者の enrollment を read（残数・有効期限チェックのため）
      const enrollmentSnaps = await Promise.all(
        attendees.map((a) =>
          transaction.get(adminDb.doc(`enrollments/${a.enrollmentId}`)),
        ),
      );

      // 共通設定 read
      const settingsSnap = await transaction.get(adminDb.doc(`settings/${SETTINGS_DOC}`));

      // ---- VALIDATIONS ----

      const slotStart = (slotData.startAt as Timestamp).toDate();
      const slotEnd = (slotData.endAt as Timestamp).toDate();
      const lessonStart = new Date(lessonStartAt);
      const lessonEnd = new Date(lessonEndAt);

      if (lessonStart < slotStart || lessonEnd > slotEnd) {
        throw new Error('予約時間が空き枠の範囲外です');
      }

      const now = new Date();

      const requestedLessonMinutes = Math.round(
        (lessonEnd.getTime() - lessonStart.getTime()) / 60000,
      );

      enrollmentSnaps.forEach((snap, idx) => {
        const a = attendees[idx];
        if (!snap.exists) {
          throw new Error(`enrollment が見つかりません (${a.enrollmentId})`);
        }
        const e = snap.data()!;
        if (e.studentId !== a.studentId) {
          throw new Error('enrollment と studentId の組み合わせが正しくありません');
        }
        if (e.status && e.status !== 'active') {
          throw new Error(`受講登録が無効です (studentId=${a.studentId})`);
        }
        if (e.validUntil) {
          const validUntil = (e.validUntil as Timestamp).toDate();
          if (validUntil.getTime() < lessonEnd.getTime()) {
            throw new Error(
              `受講登録の有効期限を過ぎています (studentId=${a.studentId})`,
            );
          }
        }
        const remaining =
          typeof e.remainingCount === 'number'
            ? e.remainingCount
            : (e.registeredCount ?? 0) - (e.usedCount ?? 0);
        if (remaining <= 0) {
          throw new Error(`受講残数が不足しています (studentId=${a.studentId})`);
        }
        // レッスン時間と enrollment.lessonMinutes の整合チェック（案③）。
        // 一致する受講登録（チケット）からのみ消費可能。
        const enrollmentLessonMinutes =
          typeof e.lessonMinutes === 'number' && e.lessonMinutes > 0
            ? e.lessonMinutes
            : DEFAULT_LESSON_MINUTES;
        if (enrollmentLessonMinutes !== requestedLessonMinutes) {
          throw new Error(
            `予約時間（${requestedLessonMinutes}分）に一致する受講登録が見つかりません`
              + `（指定された受講登録は${enrollmentLessonMinutes}分用です。studentId=${a.studentId}）`,
          );
        }
      });

      // ---- WRITES ----

      const settings = settingsSnap.exists ? settingsSnap.data() : {};

      // 予約用のスロットを更新（時間を授業時間に変更、status を booked）
      transaction.update(slotRef, {
        startAt: Timestamp.fromDate(lessonStart),
        endAt: Timestamp.fromDate(lessonEnd),
        status: 'booked',
        updatedAt: FieldValue.serverTimestamp(),
      });

      const bookingRef = adminDb.collection('privateBookings').doc();
      const bookedByValue = bookedBy || representativeStudentId;

      const attendeeStudentIds = attendees.map((a) => a.studentId);
      const attendeeConsumptions = attendees.map((a) => ({
        studentId: a.studentId,
        enrollmentId: a.enrollmentId,
        consumed: false,
        consumedAt: null,
        consumedReason: null,
      }));

      transaction.set(bookingRef, {
        id: bookingRef.id,
        slotId,
        teacherId: slotData.teacherId,
        type: bookingType,
        groupId: groupId || null,
        studentId: representativeStudentId,
        enrollmentId: representativeEnrollmentId,
        lessonMinutes: requestedLessonMinutes,
        attendeeStudentIds,
        attendeeConsumptions,
        status: 'booked',
        bookedAt: FieldValue.serverTimestamp(),
        bookedBy: bookedByValue,
        zoomURL: zoomURL || null,
        rescheduledFromBookingId: null,
        rescheduleRequestedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        consumption: {
          enrollmentId: representativeEnrollmentId,
          consumed: false,
          consumedAt: null,
          consumedReason: null,
        },
        policySnapshot: {
          rescheduleDeadlineHours: settings?.rescheduleDeadlineHours ?? 24,
          breakBufferMinutes: bufferMinutes,
          weekStartsOn: settings?.weekStartsOn ?? 'monday',
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 各参加者の enrollment を1つずつ消費
      enrollmentSnaps.forEach((snap, idx) => {
        const a = attendees[idx];
        const e = snap.data()!;
        const usedCount = (e.usedCount ?? 0) + 1;
        const registeredCount = e.registeredCount ?? 0;
        const remainingCount = Math.max(0, registeredCount - usedCount);
        transaction.update(adminDb.doc(`enrollments/${a.enrollmentId}`), {
          usedCount,
          remainingCount,
          status: remainingCount <= 0 ? 'depleted' : e.status || 'active',
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      const newSlots: { before?: boolean; after?: boolean } = {};

      // 授業前に残りの空き時間がある場合 → 新しい空き枠を作成
      if (lessonStart.getTime() > slotStart.getTime()) {
        const beforeSlotRef = adminDb.collection('privateSlots').doc();
        transaction.set(beforeSlotRef, {
          id: beforeSlotRef.id,
          teacherId: slotData.teacherId,
          title: slotData.title || null,
          startAt: Timestamp.fromDate(slotStart),
          endAt: Timestamp.fromDate(lessonStart),
          status: 'open',
          source: slotData.source,
          note: null,
          weekKey: slotData.weekKey,
          ...(slotData.weekCellBg && slotData.weekCellText
            ? { weekCellBg: slotData.weekCellBg, weekCellText: slotData.weekCellText }
            : {}),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        newSlots.before = true;
      }

      // 授業後に残りの空き時間がある場合 → バッファ時間を確保して新しい空き枠を作成
      const bufferEnd = new Date(lessonEnd.getTime() + bufferMinutes * 60000);

      if (bufferEnd.getTime() < slotEnd.getTime()) {
        const afterSlotRef = adminDb.collection('privateSlots').doc();
        transaction.set(afterSlotRef, {
          id: afterSlotRef.id,
          teacherId: slotData.teacherId,
          title: slotData.title || null,
          startAt: Timestamp.fromDate(bufferEnd),
          endAt: Timestamp.fromDate(slotEnd),
          status: 'open',
          source: slotData.source,
          note: null,
          weekKey: slotData.weekKey,
          ...(slotData.weekCellBg && slotData.weekCellText
            ? { weekCellBg: slotData.weekCellBg, weekCellText: slotData.weekCellText }
            : {}),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        newSlots.after = true;
      }

      // 念のため、用意した参考情報。レスポンス用。
      void now;

      return {
        bookingId: bookingRef.id,
        bufferMinutes,
        newSlots,
        type: bookingType,
        attendeeStudentIds,
      };
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      bufferMinutes: result.bufferMinutes,
      newSlots: result.newSlots,
      type: result.type,
      attendeeStudentIds: result.attendeeStudentIds,
    });
  } catch (error: unknown) {
    console.error('Error creating booking:', error);
    const message = error instanceof Error ? error.message : '予約の作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
