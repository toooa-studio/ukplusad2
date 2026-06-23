import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { isFirebaseAdminReady, requireAdminDb } from '@/lib/firebase/admin';
import { resolveTeacherId } from '@/lib/api/resolveTeacherId';
import { BOOKING_DURATION_STEP_MINUTES } from '@/lib/utils';

const ACTIVE_BOOKING_STATUSES = ['booked', 'completed', 'no_show_consumed'];

async function getOwnedSlot(teacherId: string, slotId: string) {
  const db = requireAdminDb();
  const ref = db.collection('privateSlots').doc(slotId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.teacherId !== teacherId) return null;
  return { ref, data };
}

async function hasActiveBooking(slotId: string): Promise<boolean> {
  const db = requireAdminDb();
  const snap = await db.collection('privateBookings')
    .where('slotId', '==', slotId)
    .get();
  return snap.docs.some((d) => {
    const status = d.data().status as string;
    return ACTIVE_BOOKING_STATUSES.includes(status);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slotId: string }> },
) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK が未設定です' }, { status: 503 });
    }

    const teacherId = await resolveTeacherId(req);
    if (!teacherId) {
      return NextResponse.json({ error: '講師権限が必要です' }, { status: 403 });
    }

    const { slotId } = await params;
    const owned = await getOwnedSlot(teacherId, slotId);
    if (!owned) {
      return NextResponse.json({ error: '空き枠が見つかりません' }, { status: 404 });
    }

    if (owned.data.status === 'booked' || await hasActiveBooking(slotId)) {
      return NextResponse.json({ error: '予約済みの枠は変更できません' }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.status === 'closed' || body.status === 'open') {
      updates.status = body.status;
    }
    if (body.title !== undefined) {
      updates.title = body.title?.trim() || null;
    }
    if (body.startAt && body.endAt) {
      updates.startAt = Timestamp.fromDate(new Date(body.startAt));
      updates.endAt = Timestamp.fromDate(new Date(body.endAt));
    }
    if (body.weekKey) {
      updates.weekKey = body.weekKey;
    }
    if (body.weekCellBg !== undefined && body.weekCellText !== undefined) {
      if (body.weekCellBg && body.weekCellText) {
        updates.weekCellBg = body.weekCellBg;
        updates.weekCellText = body.weekCellText;
      } else {
        updates.weekCellBg = FieldValue.delete();
        updates.weekCellText = FieldValue.delete();
      }
    }
    if (body.note !== undefined) {
      updates.note = body.note;
    }

    await owned.ref.update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating teacher slot:', error);
    const message = error instanceof Error ? error.message : '空き枠の更新に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slotId: string }> },
) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK が未設定です' }, { status: 503 });
    }

    const teacherId = await resolveTeacherId(req);
    if (!teacherId) {
      return NextResponse.json({ error: '講師権限が必要です' }, { status: 403 });
    }

    const { slotId } = await params;
    const owned = await getOwnedSlot(teacherId, slotId);
    if (!owned) {
      return NextResponse.json({ error: '空き枠が見つかりません' }, { status: 404 });
    }

    if (owned.data.status === 'booked' || await hasActiveBooking(slotId)) {
      return NextResponse.json({ error: '予約済みの枠は削除できません' }, { status: 400 });
    }

    await owned.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting teacher slot:', error);
    const message = error instanceof Error ? error.message : '空き枠の削除に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
