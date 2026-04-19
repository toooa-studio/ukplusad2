import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | undefined;
let _adminAuth: Auth | undefined;
let _adminDb: Firestore | undefined;
let _adminStorage: Storage | undefined;

const hasValidConfig = 
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_CLIENT_EMAIL && 
  process.env.FIREBASE_PRIVATE_KEY &&
  process.env.FIREBASE_PROJECT_ID !== 'your-project-id';

if (hasValidConfig) {
  if (getApps().length === 0) {
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    adminApp = getApps()[0];
  }

  _adminAuth = getAuth(adminApp);
  _adminDb = getFirestore(adminApp);
  _adminStorage = getStorage(adminApp);
}

const adminAuth = _adminAuth as Auth;
const adminDb = _adminDb as Firestore;
const adminStorage = _adminStorage as Storage;

export { adminApp, adminAuth, adminDb, adminStorage };
