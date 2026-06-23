import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import {
  getFirestore, collection, query, where, orderBy, getDocs,
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

// ペアの非代表メンバー（常に attendeeStudentIds の2番目）
const STUDENT_UID = 'gkO95Nwl6uYEQz2wYm4AJEzwpwm1';

initAdmin({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const customToken = await getAdminAuth().createCustomToken(STUDENT_UID);

const clientApp = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const clientAuth = getAuth(clientApp);
await signInWithCustomToken(clientAuth, customToken);
console.log('サインイン成功:', STUDENT_UID);

const db = getFirestore(clientApp);

async function run(label, q) {
  try {
    const snap = await getDocs(q);
    console.log(`\n[OK] ${label} → ${snap.size} 件`);
    snap.docs.forEach((d) => {
      const b = d.data();
      console.log('   ', d.id, b.type || 'private', b.status);
    });
  } catch (e) {
    console.log(`\n[NG] ${label} → ${e.code || ''} ${e.message}`);
  }
}

await run(
  'A: studentId == uid',
  query(collection(db, 'privateBookings'), where('studentId', '==', STUDENT_UID)),
);
await run(
  'B: attendeeStudentIds array-contains uid',
  query(collection(db, 'privateBookings'), where('attendeeStudentIds', 'array-contains', STUDENT_UID)),
);
await run(
  'C: attendeeStudentIds array-contains uid + orderBy bookedAt desc',
  query(
    collection(db, 'privateBookings'),
    where('attendeeStudentIds', 'array-contains', STUDENT_UID),
    orderBy('bookedAt', 'desc'),
  ),
);

process.exit(0);
