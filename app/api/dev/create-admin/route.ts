import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * 開発環境専用：テスト管理者アカウントを作成するAPI
 * 本番環境では無効化してください
 */
export async function POST(request: NextRequest) {
  // 本番環境では無効化
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'この機能は本番環境では利用できません' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email, password, displayName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードは必須です' },
        { status: 400 }
      );
    }

    // ユーザーを作成
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || '管理者',
    });

    // カスタムクレームを設定
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'admin' });

    // Firestoreにユーザー情報を保存
    await adminDb.collection('users').doc(userRecord.uid).set({
      role: 'admin',
      displayName: displayName || '管理者',
      email,
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
      message: '管理者アカウントを作成しました',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
      },
    });
  } catch (error: any) {
    console.error('Error creating admin account:', error);
    return NextResponse.json(
      { error: error.message || 'アカウントの作成に失敗しました' },
      { status: 500 }
    );
  }
}
