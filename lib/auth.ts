'use server';

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { UserRole } from '@/lib/types';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole | null;
}

/**
 * セッションクッキーからユーザーを取得
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    if (!adminAuth || !adminDb) {
      return null;
    }

    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;

    if (!session) {
      return null;
    }

    const decodedClaims = await adminAuth.verifySessionCookie(session, true);
    
    const userDoc = await adminDb.collection('users').doc(decodedClaims.uid).get();
    const userData = userDoc.data();

    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email || null,
      displayName: userData?.displayName || null,
      role: (userData?.role as UserRole) || null,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * ロールをチェック
 */
export async function checkRole(allowedRoles: UserRole[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !user.role) return false;
  return allowedRoles.includes(user.role);
}

/**
 * 管理者チェック
 */
export async function isAdmin(): Promise<boolean> {
  return checkRole(['admin']);
}

/**
 * 教師または管理者チェック
 */
export async function isTeacherOrAdmin(): Promise<boolean> {
  return checkRole(['teacher', 'admin']);
}

/**
 * セッションクッキーを作成
 */
export async function createSession(idToken: string) {
  try {
    if (!adminAuth) {
      console.warn('Admin Auth is not configured. Skipping session cookie creation.');
      return { success: true };
    }

    const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    
    const cookieStore = await cookies();
    cookieStore.set('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating session:', error);
    return { success: false, error: 'セッションの作成に失敗しました' };
  }
}

/**
 * セッションを削除（ログアウト）
 */
export async function destroySession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    return { success: true };
  } catch (error) {
    console.error('Error destroying session:', error);
    return { success: false, error: 'ログアウトに失敗しました' };
  }
}

/**
 * Firebase Authからユーザーを削除
 */
export async function deleteAuthUser(uid: string) {
  try {
    if (!adminAuth) {
      console.warn('Admin Auth is not configured. Cannot delete auth user.');
      return { success: false, error: 'Admin SDKが設定されていません' };
    }

    await adminAuth.deleteUser(uid);
    return { success: true };
  } catch (error) {
    console.error('Error deleting auth user:', error);
    return { success: false, error: 'ユーザーの削除に失敗しました' };
  }
}

/**
 * ユーザーのカスタムクレームを設定
 */
export async function setUserRole(uid: string, role: UserRole) {
  try {
    if (!adminAuth || !adminDb) {
      console.warn('Admin SDK is not configured. Skipping custom claims.');
      return { success: false, error: 'Admin SDKが設定されていません' };
    }

    await adminAuth.setCustomUserClaims(uid, { role });
    
    await adminDb.collection('users').doc(uid).set(
      { role, updatedAt: new Date() },
      { merge: true }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error setting user role:', error);
    return { success: false, error: 'ロールの設定に失敗しました' };
  }
}
