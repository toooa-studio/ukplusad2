import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const SETTINGS_DOC = 'general';

async function getBufferMinutes(): Promise<number> {
  const snap = await adminDb.doc(`settings/${SETTINGS_DOC}`).get();
  if (snap.exists) {
    return snap.data()?.breakBufferMinutesDefault ?? 10;
  }
  return 10;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      slotId,
      studentId,
      enrollmentId,
      bookedBy,
      lessonStartAt,
      lessonEndAt,
      zoomURL,
    } = body;

    if (!slotId || !studentId || !enrollmentId || !lessonStartAt || !lessonEndAt) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
        { status: 400 }
      );
    }

    const bufferMinutes = await getBufferMinutes();

    const result = await adminDb.runTransaction(async (transaction) => {
      const slotRef = adminDb.doc(`privateSlots/${slotId}`);
      const slotSnap = await transaction.get(slotRef);

      if (!slotSnap.exists) {
        throw new Error('指定された空き枠が見つかりません');
      }

      const slotData = slotSnap.data()!;

      if (slotData.status !== 'open') {
        throw new Error('この空き枠は予約できません');
      }

      const slotStart = slotData.startAt.toDate() as Date;
      const slotEnd = slotData.endAt.toDate() as Date;
      const lessonStart = new Date(lessonStartAt);
      const lessonEnd = new Date(lessonEndAt);

      if (lessonStart < slotStart || lessonEnd > slotEnd) {
        throw new Error('予約時間が空き枠の範囲外です');
      }

      // 予約用のスロットを更新（時間を授業時間に変更、statusをbooked）
      transaction.update(slotRef, {
        startAt: Timestamp.fromDate(lessonStart),
        endAt: Timestamp.fromDate(lessonEnd),
        status: 'booked',
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 予約レコードを作成
      const bookingRef = adminDb.collection('privateBookings').doc();
      const settingsSnap = await adminDb.doc(`settings/${SETTINGS_DOC}`).get();
      const settings = settingsSnap.exists ? settingsSnap.data() : {};

      transaction.set(bookingRef, {
        id: bookingRef.id,
        slotId,
        teacherId: slotData.teacherId,
        studentId,
        enrollmentId,
        status: 'booked',
        bookedAt: FieldValue.serverTimestamp(),
        bookedBy: bookedBy || studentId,
        zoomURL: zoomURL || null,
        rescheduledFromBookingId: null,
        rescheduleRequestedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        consumption: {
          enrollmentId,
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

      return {
        bookingId: bookingRef.id,
        bufferMinutes,
        newSlots,
      };
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      bufferMinutes: result.bufferMinutes,
      newSlots: result.newSlots,
    });
  } catch (error: unknown) {
    console.error('Error creating booking:', error);
    const message = error instanceof Error ? error.message : '予約の作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
