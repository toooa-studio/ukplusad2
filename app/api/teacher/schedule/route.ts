import { NextRequest, NextResponse } from 'next/server';
import { isFirebaseAdminReady, requireAdminDb } from '@/lib/firebase/admin';
import { resolveTeacherId } from '@/lib/api/resolveTeacherId';
import { serializeFirestoreDoc } from '@/lib/firebase/serializeFirestore';

/**
 * 講師スケジュール用データ取得（Admin SDK 経由）。
 * クライアント Firestore ルールに依存せず、本番でも確実に読めるようにする。
 */
export async function GET(req: NextRequest) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK が未設定です' },
        { status: 503 },
      );
    }

    const teacherId = await resolveTeacherId(req);
    if (!teacherId) {
      return NextResponse.json({ error: '講師権限が必要です' }, { status: 403 });
    }

    const db = requireAdminDb();

    const [slotsSnap, bookingsSnap, studentsSnap] = await Promise.all([
      db.collection('privateSlots').where('teacherId', '==', teacherId).get(),
      db.collection('privateBookings').where('teacherId', '==', teacherId).get(),
      db.collection('users').where('role', '==', 'student').get(),
    ]);

    return NextResponse.json({
      slots: slotsSnap.docs.map((d) => serializeFirestoreDoc(d.id, d.data())),
      bookings: bookingsSnap.docs.map((d) => serializeFirestoreDoc(d.id, d.data())),
      students: studentsSnap.docs.map((d) => serializeFirestoreDoc(d.id, d.data())),
    });
  } catch (error) {
    console.error('Error loading teacher schedule via API:', error);
    const message = error instanceof Error ? error.message : 'スケジュールの取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
