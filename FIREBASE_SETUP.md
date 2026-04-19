# UK Plus Admin - Firebaseセットアップガイド

このガイドでは、管理者・教師用Webアプリケーション（ukplusad）をFirebaseに接続するための手順を説明します。

## 📋 前提条件

- Googleアカウント
- Node.js (v18以上)
- npm または yarn

## 🔥 ステップ1: Firebaseプロジェクトの作成

### 1-1. Firebase Consoleにアクセス

[Firebase Console](https://console.firebase.google.com/) を開き、Googleアカウントでログインします。

### 1-2. 新しいプロジェクトを作成

1. **「プロジェクトを追加」** ボタンをクリック
2. プロジェクト名を入力（例: `ukplus-admin`）
3. Google Analyticsは **任意** で有効化（推奨: 有効化）
4. Analyticsアカウントを選択（または新規作成）
5. **「プロジェクトを作成」** をクリック

プロジェクトの作成には数秒かかります。

## 🌐 ステップ2: Webアプリの追加

### 2-1. Webアプリを登録

1. Firebase Consoleのプロジェクトページで **⚙️（設定）** > **「プロジェクトの設定」** をクリック
2. **「アプリを追加」** をクリック
3. **Web（</>）アイコン** を選択
4. アプリのニックネームを入力（例: `ukplusad-web`）
5. **Firebase Hostingの設定は「今は設定しない」を選択** (Vercelを使用するため)
6. **「アプリを登録」** をクリック

### 2-2. 設定情報をコピー

以下のような設定コードが表示されます。この情報を **メモ帳などに保存** しておきます：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "ukplus-admin.firebaseapp.com",
  projectId: "ukplus-admin",
  storageBucket: "ukplus-admin.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

## 🔐 ステップ3: Firebase Authentication の有効化

### 3-1. Authenticationを開く

1. 左サイドバーの **「構築」** > **「Authentication」** をクリック
2. **「始める」** ボタンをクリック

### 3-2. ログイン方法を有効化

管理者・教師用アプリで使用するログイン方法を有効化します：

#### メール/パスワード認証（必須）

1. **「Sign-in method」** タブをクリック
2. **「メール/パスワード」** をクリック
3. **「有効にする」** トグルをON
4. **「保存」** をクリック

#### Google認証（オプション・推奨）

1. **「Google」** をクリック
2. **「有効にする」** トグルをON
3. プロジェクトのサポートメールを選択
4. **「保存」** をクリック

## 📊 ステップ4: Firestore Database の有効化

### 4-1. Firestoreを作成

1. 左サイドバーの **「構築」** > **「Firestore Database」** をクリック
2. **「データベースを作成」** をクリック

### 4-2. セキュリティルールを選択

開発段階では **「テストモードで開始」** を選択（後でセキュリティルールを設定します）

### 4-3. ロケーションを選択

- **推奨**: `asia-northeast1`（東京）
- または `asia-northeast2`（大阪）

**注意**: ロケーションは後から変更できません。

### 4-4. データベース構造の準備

Firestoreに以下のコレクションを作成します（後でアプリから自動作成されます）：

```
ukplus-admin (database)
├── users (管理者・教師情報)
├── students (生徒情報)
├── sessions (授業セッション)
├── bookings (予約情報)
├── announcements (お知らせ)
└── attendance (出席記録)
```

## 📦 ステップ5: Firebase Storage の有効化

### 5-1. Storageを作成

1. 左サイドバーの **「構築」** > **「Storage」** をクリック
2. **「始める」** ボタンをクリック

### 5-2. セキュリティルールを選択

**「本番環境モードで開始」** を選択

### 5-3. ロケーションを選択

Firestoreと同じロケーション（`asia-northeast1`または`asia-northeast2`）を選択

## 🔑 ステップ6: サービスアカウントキーの取得

Server Actions（サーバー側）でFirebaseを使用するために必要です。

### 6-1. サービスアカウントページを開く

1. Firebase Console > **⚙️（設定）** > **「プロジェクトの設定」**
2. **「サービスアカウント」** タブをクリック

### 6-2. 秘密鍵を生成

1. **「新しい秘密鍵の生成」** ボタンをクリック
2. 確認ダイアログで **「キーを生成」** をクリック
3. **JSONファイルがダウンロード** されます（例: `ukplus-admin-firebase-adminsdk-xxxxx.json`）

### 6-3. JSONファイルから情報を取得

ダウンロードしたJSONファイルを開き、以下の値を確認：

```json
{
  "type": "service_account",
  "project_id": "ukplus-admin",              // ← これをコピー
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",  // ← これをコピー
  "client_email": "firebase-adminsdk-xxxxx@ukplus-admin.iam.gserviceaccount.com",  // ← これをコピー
  ...
}
```

**⚠️ 重要**: このJSONファイルには機密情報が含まれています。**絶対にGitにコミットしないでください**。

## 🌍 ステップ7: 環境変数の設定

### 7-1. `.env.local` ファイルを作成

プロジェクトルート（`ukplusad`フォルダ）に `.env.local` ファイルを作成します：

```bash
cd /Users/huwasi/Documents/plus/ukplusad
touch .env.local
```

### 7-2. 環境変数を記入

`.env.local` ファイルに以下の内容を記入します：

```bash
# Firebase Client SDK（クライアント側で使用可能）
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="ukplus-admin.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="ukplus-admin"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="ukplus-admin.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:abcdef123456"

# Firebase Admin SDK（サーバー側のみで使用）
FIREBASE_PROJECT_ID="ukplus-admin"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@ukplus-admin.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

**置き換える値**:
- `NEXT_PUBLIC_FIREBASE_*`: ステップ2-2でコピーした値
- `FIREBASE_PROJECT_ID`: ステップ6-3の`project_id`
- `FIREBASE_CLIENT_EMAIL`: ステップ6-3の`client_email`
- `FIREBASE_PRIVATE_KEY`: ステップ6-3の`private_key`（**改行を含めたままコピー**）

### 7-3. 開発サーバーを再起動

環境変数を読み込むため、開発サーバーを再起動します：

```bash
npm run dev
```

## ✅ ステップ8: 接続の確認

### 8-1. Firebaseが正しく初期化されているか確認

ブラウザで `http://localhost:3000` を開き、コンソールエラーがないか確認します。

### 8-2. テスト用のページを作成（オプション）

`app/test-firebase/page.tsx` を作成してFirebase接続をテスト：

```typescript
'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase/client';
import { collection, getDocs } from 'firebase/firestore';

export default function TestFirebasePage() {
  const [status, setStatus] = useState('接続中...');

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Authの確認
        if (auth) {
          console.log('✅ Firebase Auth 初期化成功');
        }
        
        // Firestoreの確認
        const testCollection = collection(db, 'test');
        await getDocs(testCollection);
        console.log('✅ Firebase Firestore 接続成功');
        
        setStatus('✅ Firebase接続成功！');
      } catch (error) {
        console.error('❌ Firebase接続エラー:', error);
        setStatus('❌ Firebase接続失敗');
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Firebase接続テスト</h1>
      <p className="text-lg">{status}</p>
    </div>
  );
}
```

ブラウザで `http://localhost:3000/test-firebase` にアクセスして確認します。

## 📝 ステップ9: Firestoreセキュリティルールの設定（重要）

本プロジェクトでは **`firestore.rules`** にアプリ用のルールをまとめています。  
古いサンプルルールのままだと **`enrollments` や `privateSlots` が未定義で拒否** され、生徒追加や `users` の更新で **`permission-denied`** になります。

### 9-1. ルールの内容

リポジトリ直下の **`firestore.rules`** を開き、内容を確認してください（`users` / `enrollments` / `privateSlots` / `privateBookings` など）。

### 9-2. 反映方法（どちらか一方）

**A. Firebase Console（手軽）**

1. [Firebase Console](https://console.firebase.google.com/) → 対象プロジェクト → **Firestore Database** → **ルール**
2. エディタの内容をすべて削除し、ローカルの **`firestore.rules` の全文** をコピーして貼り付け
3. **公開** をクリック

**B. Firebase CLI**

```bash
# 初回のみ: npm i -g firebase-tools && firebase login
firebase deploy --only firestore:rules
```

（`firebase.json` がルールファイルを指しています。）

### 9-3. `permission-denied` のときの確認

1. **ログイン中の UID** に対応する **`users/{そのUID}` ドキュメント** が Firestore に存在するか
2. そのドキュメントの **`role` フィールド** が **`admin`** か（管理者で生徒追加・教師割り当て保存が必要）
3. ルール公開後、ブラウザを **再読み込み** してから再度操作する

認証はできているが Firestore だけ失敗する場合は、ほぼ **ルール未設定・古いルール・`role` が `admin` でない** のいずれかです。

## 🚀 次のステップ

Firebase接続が完了しました！次は以下の機能を実装していきます：

1. **認証システム**: ログイン・ログアウト機能
2. **管理者ダッシュボード**: 生徒・教師・授業の管理
3. **授業スケジュール管理**: セッションの作成・編集
4. **予約システム**: 生徒の予約を管理
5. **お知らせ機能**: 生徒へのお知らせを作成・配信

## 🔗 参考リンク

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Firestore セキュリティルール](https://firebase.google.com/docs/firestore/security/get-started)

---

**注意事項**:
- `.env.local` ファイルは **絶対にGitにコミットしない**
- サービスアカウントのJSONファイルは **安全な場所に保管**
- 本番環境では必ず **セキュリティルールを設定**
