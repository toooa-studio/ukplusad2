import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { isFirebaseAdminReady, requireAdminDb } from '@/lib/firebase/admin';
import { resolveTeacherId } from '@/lib/api/resolveTeacherId';
import { BOOKING_DURATION_STEP_MINUTES } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK が未設定です' }, { status: 503 });
    }

    const teacherId = await resolveTeacherId(req);
    if (!teacherId) {
      return NextResponse.json({ error: '講師権限が必要です' }, { status: 403 });
    }

    const body = await req.json();
    const { title, startAt, endAt, weekKey, weekCellBg, weekCellText } = body;

    if (!startAt || !endAt || !weekKey) {
      return NextResponse.json({ error: 'startAt, endAt, weekKey が必要です' }, { status: 400 });
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

    if (durationMin <= 0 || durationMin % BOOKING_DURATION_STEP_MINUTES !== 0) {
      return NextResponse.json(
        { error: `枠の長さは ${BOOKING_DURATION_STEP_MINUTES} 分単位で指定してください` },
        { status: 400 },
      );
    }
    if (startDate.getMinutes() % BOOKING_DURATION_STEP_MINUTES !== 0) {
      return NextResponse.json(
        { error: `開始時刻は ${BOOKING_DURATION_STEP_MINUTES} 分単位で指定してください` },
        { status: 400 },
      );
    }

    const db = requireAdminDb();
    const ref = db.collection('privateSlots').doc();

    const colorFields =
      weekCellBg && weekCellText
        ? { weekCellBg, weekCellText }
        : {};

    await ref.set({
      id: ref.id,
      teacherId,
      title: title?.trim() || null,
      startAt: Timestamp.fromDate(startDate),
      endAt: Timestamp.fromDate(endDate),
      status: 'open',
      source: 'teacher_managed',
      note: null,
      weekKey,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...colorFields,
    });

    return NextResponse.json({ success: true, slotId: ref.id });
  } catch (error) {
    console.error('Error creating teacher slot:', error);
    const message = error instanceof Error ? error.message : '空き枠の作成に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
