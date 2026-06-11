import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | undefined;
let _adminAuth: Auth | undefined;
let _adminDb: Firestore | undefined;
let _adminStorage: Storage | undefined;
let initError: string | null = null;

/** Vercel 等で改行が崩れた private key を復元する */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

const hasValidConfig =
  Boolean(process.env.FIREBASE_PROJECT_ID) &&
  Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
  Boolean(process.env.FIREBASE_PRIVATE_KEY) &&
  process.env.FIREBASE_PROJECT_ID !== 'your-project-id';

if (hasValidConfig) {
  try {
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } else {
      adminApp = getApps()[0];
    }

    _adminAuth = getAuth(adminApp);
    _adminDb = getFirestore(adminApp);
    _adminStorage = getStorage(adminApp);
  } catch (err) {
    initError =
      err instanceof Error ? err.message : 'Firebase Admin SDK の初期化に失敗しました';
    console.error('Firebase Admin SDK initialization failed:', err);
  }
} else {
  initError =
    'Firebase Admin の環境変数（FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY）が未設定です';
}

const adminAuth = _adminAuth as Auth;
const adminDb = _adminDb as Firestore;
const adminStorage = _adminStorage as Storage;

function isFirebaseAdminReady(): boolean {
  return Boolean(_adminDb && _adminAuth);
}

/** API ルート用: 未初期化なら分かりやすいエラーを投げる */
function requireAdminDb(): Firestore {
  if (!_adminDb) {
    throw new Error(
      initError ||
        'Firebase Admin SDK が初期化されていません。Vercel の環境変数を確認してください。',
    );
  }
  return _adminDb;
}

export {
  adminApp,
  adminAuth,
  adminDb,
  adminStorage,
  isFirebaseAdminReady,
  requireAdminDb,
};
