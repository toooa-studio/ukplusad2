import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminDb } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import {
  getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc,
  deleteDoc, query, where, Timestamp,
} from 'firebase/firestore';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
}

const STUDENT_UID = 'gkO95Nwl6uYEQz2wYm4AJEzwpwm1';

initAdmin({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const adminDb = getAdminDb();
const customToken = await getAdminAuth().createCustomToken(STUDENT_UID);

const clientApp = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
await signInWithCustomToken(getAuth(clientApp), customToken);
const db = getFirestore(clientApp);
console.log('生徒としてサインイン:', STUDENT_UID, '\n');

// --- 1. privateBookings 作成テスト（作成→即削除） ---
let createdBookingId = null;
try {
  const ref = await addDoc(collection(db, 'privateBookings'), {
    type: 'private',
    studentId: STUDENT_UID,
    attendeeStudentIds: [STUDENT_UID],
    status: 'booked',
    teacherId: 'TEST',
    bookedAt: Timestamp.now(),
  });
  createdBookingId = ref.id;
  console.log('[OK] privateBookings 作成 →', ref.id);
} catch (e) {
  console.log('[NG] privateBookings 作成 →', e.code, e.message);
}
if (createdBookingId) {
  await adminDb.collection('privateBookings').doc(createdBookingId).delete();
  console.log('   (テストドキュメント削除済み)');
}

// --- 2. privateSlots 更新テスト（open スロットを探して updatedAt のみ更新を試行） ---
try {
  const slotsSnap = await getDocs(
    query(collection(db, 'privateSlots'), where('status', '==', 'open')),
  );
  if (slotsSnap.empty) {
    console.log('\n[--] privateSlots: open スロットなし（テストスキップ）');
  } else {
    const slotDoc = slotsSnap.docs[0];
    try {
      await updateDoc(doc(db, 'privateSlots', slotDoc.id), {
        status: 'booked',
      });
      console.log('\n[OK] privateSlots 更新（status→booked）→', slotDoc.id);
      // 元に戻す
      await adminDb.collection('privateSlots').doc(slotDoc.id).update({ status: 'open' });
      console.log('   (元の status=open に戻した)');
    } catch (e) {
      console.log('\n[NG] privateSlots 更新 →', e.code, e.message);
    }
  }
} catch (e) {
  console.log('\n[NG] privateSlots 読取 →', e.code, e.message);
}

// --- 3. enrollments 更新テスト（自分の enrollment の残数更新を試行） ---
try {
  const enrSnap = await getDocs(
    query(collection(db, 'enrollments'), where('studentId', '==', STUDENT_UID)),
  );
  if (enrSnap.empty) {
    console.log('\n[--] enrollments: 自分の受講登録なし（テストスキップ）');
  } else {
    const enrDoc = enrSnap.docs[0];
    const cur = enrDoc.data();
    try {
      await updateDoc(doc(db, 'enrollments', enrDoc.id), {
        usedCount: (cur.usedCount ?? 0),
      });
      console.log('\n[OK] enrollments 更新 →', enrDoc.id);
    } catch (e) {
      console.log('\n[NG] enrollments 更新 →', e.code, e.message);
    }
  }
} catch (e) {
  console.log('\n[NG] enrollments 読取 →', e.code, e.message);
}

process.exit(0);
