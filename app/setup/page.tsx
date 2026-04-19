'use client';

import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkExistingAdmin = async () => {
      if (!db) {
        setChecking(false);
        return;
      }
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setAlreadyExists(true);
        }
      } catch {
        // Firestoreが未設定の場合はセットアップを許可
      }
      setChecking(false);
    };
    checkExistingAdmin();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!auth || !db) {
      setError('Firebaseの接続設定が正しくありません。.env.localを確認してください。');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        role: 'admin',
        displayName: name,
        email: email,
        photoURL: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      setSuccess('管理者アカウントを作成しました。ログインページに移動します...');
      
      await auth.signOut();

      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err: unknown) {
      console.error('Setup error:', err);
      if (err instanceof Error && 'code' in err) {
        const firebaseError = err as { code: string };
        if (firebaseError.code === 'auth/email-already-in-use') {
          setError('このメールアドレスは既に使用されています。');
        } else if (firebaseError.code === 'auth/weak-password') {
          setError('パスワードが弱すぎます。6文字以上で入力してください。');
        } else if (firebaseError.code === 'auth/invalid-email') {
          setError('メールアドレスの形式が正しくありません。');
        } else {
          setError(`エラーが発生しました: ${firebaseError.code}`);
        }
      } else {
        setError('予期しないエラーが発生しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (alreadyExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-none border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 text-center">セットアップ完了済み</h2>
          <p className="mt-4 text-sm text-gray-600 text-center">
            管理者アカウントは既に作成されています。
          </p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-6 w-full py-3 px-4 text-sm font-medium rounded-[6px] text-white bg-blue-600 hover:bg-blue-700 transition-colors min-h-[44px]"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-none border border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 text-center">
            初期セットアップ
          </h2>
          <p className="mt-2 text-sm text-gray-600 text-center">
            最初の管理者アカウントを作成してください
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              名前
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              placeholder="例：山田太郎"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              placeholder="例：xxxx@gmail.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード（6文字以上）
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              パスワード（確認）
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 text-sm font-medium rounded-[6px] text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {loading ? '作成中...' : '管理者アカウントを作成'}
          </button>
        </form>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500 text-left">
            Firebase Consoleで「Authentication」→「Sign-in method」→「メール/パスワード」を有効にしてから実行してください。
          </p>
        </div>
      </div>
    </div>
  );
}
