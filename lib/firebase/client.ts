import { initializeApp, getApps, FirebaseApp, deleteApp } from 'firebase/app';
import { getAuth, Auth, createUserWithEmailAndPassword, updateProfile, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, Firestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { UserRole } from '@/lib/types';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let _db: Firestore | undefined;
let _storage: FirebaseStorage | undefined;
let analytics: Analytics | null = null;

const hasValidConfig = 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'your-api-key';

if (typeof window !== 'undefined' && hasValidConfig) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  _db = getFirestore(app);
  _storage = getStorage(app);
  
  if (process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
    analytics = getAnalytics(app);
  }
}

const db = _db as Firestore;
const storage = _storage as FirebaseStorage;

/**
 * セカンダリFirebaseアプリでユーザーを作成する。
 * メインアプリの認証状態（管理者のログイン）に影響しない。
 */
export async function createUserWithoutSignIn(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  createdBy?: string,
) {
  if (!db) throw new Error('Firestore is not initialized');

  const secondaryApp = initializeApp(firebaseConfig, 'user-creation');
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCredential.user;

    await updateProfile(newUser, { displayName });

    await setDoc(doc(db, 'users', newUser.uid), {
      id: newUser.uid,
      role,
      displayName,
      email,
      photoURL: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // 生徒の場合は自動的に初期受講登録を作成
    if (role === 'student' && createdBy) {
      const enrollmentRef = doc(db, 'enrollments', `${newUser.uid}_initial`);
      const now = Timestamp.now();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 3); // 3ヶ月後

      await setDoc(enrollmentRef, {
        id: enrollmentRef.id,
        studentId: newUser.uid,
        type: 'ticket_bundle',
        registeredCount: 8,
        usedCount: 0,
        remainingCount: 8,
        validFrom: null,
        validUntil: Timestamp.fromDate(validUntil),
        rescheduleAllowedCount: 2, // 8回 ÷ 4 = 2回
        rescheduleUsedCount: 0,
        status: 'active',
        createdBy: createdBy,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 教師の場合は teacherProfiles を同時に作成する。
    // 教師管理の「追加」は users のみ作っていたため、編集保存をしないと
    // teacherProfiles が無い教師が発生していた。
    if (role === 'teacher') {
      const now = Timestamp.now();
      await setDoc(doc(db, 'teacherProfiles', newUser.uid), {
        id: newUser.uid,
        name: displayName,
        bio: '',
        specialties: [],
        photoPath: null,
        updatedAt: now,
      });
    }

    await firebaseSignOut(secondaryAuth);
    return newUser.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export { app, auth, db, storage, analytics };
