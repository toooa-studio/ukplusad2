import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { adminAuth, requireAdminDb } from '@/lib/firebase/admin';
import { UserRole } from '@/lib/types';

/** 講師 API 用: セッション Cookie または Bearer トークンから teacher uid を解決（サーバー専用） */
export async function resolveTeacherId(req: NextRequest): Promise<string | null> {
  const sessionUser = await getCurrentUser();
  if (sessionUser?.uid && sessionUser.role === 'teacher') {
    return sessionUser.uid;
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ') && adminAuth) {
    try {
      const idToken = authHeader.slice(7);
      const decoded = await adminAuth.verifyIdToken(idToken);
      const db = requireAdminDb();
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      const role = userDoc.data()?.role as UserRole | undefined;
      if (role === 'teacher') {
        return decoded.uid;
      }
    } catch {
      return null;
    }
  }

  return null;
}
