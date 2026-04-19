import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * 既存のユーザーに管理者ロールを設定するAPI（開発環境専用）
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'この機能は本番環境では利用できません' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスは必須です' },
        { status: 400 }
      );
    }

    // メールアドレスからユーザーを検索
    const userRecord = await adminAuth.getUserByEmail(email);

    // カスタムクレームを設定
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'admin' });

    // Firestoreにユーザー情報を保存
    await adminDb.collection('users').doc(userRecord.uid).set({
      role: 'admin',
      displayName: userRecord.displayName || '管理者',
      email: userRecord.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      notificationPrefs: {
        lessonReminders: true,
        announcements: true,
        messages: true,
        homework: true,
        summaries: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: '管理者ロールを設定しました',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
      },
    });
  } catch (error: any) {
    console.error('Error setting admin role:', error);
    return NextResponse.json(
      { error: error.message || 'ロールの設定に失敗しました' },
      { status: 500 }
    );
  }
}
