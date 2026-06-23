import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// .env.local を簡易パース
const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
}

initializeApp({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

const bookingsSnap = await db.collection('privateBookings').get();
console.log(`\n=== privateBookings: ${bookingsSnap.size} 件 ===`);
bookingsSnap.docs.forEach((d) => {
  const b = d.data();
  console.log(JSON.stringify({
    id: d.id,
    type: b.type,
    status: b.status,
    studentId: b.studentId,
    attendeeStudentIds: b.attendeeStudentIds,
    groupId: b.groupId,
    teacherId: b.teacherId,
  }));
});

const groupsSnap = await db.collection('studentGroups').get();
console.log(`\n=== studentGroups: ${groupsSnap.size} 件 ===`);
groupsSnap.docs.forEach((d) => {
  const g = d.data();
  console.log(JSON.stringify({
    id: d.id,
    name: g.name,
    memberIds: g.memberIds,
    status: g.status,
  }));
});

process.exit(0);
