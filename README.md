# UKPLUS Admin - 管理者・教師用Webアプリケーション

UKPLUS Osakaの管理者・教師向け予約・学習管理システムです。

## 📋 概要

このWebアプリケーションは、UKPLUS OsakaのiOSアプリ（ukplus）と連携し、管理者と教師がプライベートレッスンの予約管理、生徒管理、授業管理、お知らせ配信などを行うためのシステムです。

## 🚀 技術スタック

- **Next.js 16** - React フレームワーク（App Router）
- **React 19** - UI ライブラリ
- **TypeScript** - 型安全性
- **Tailwind CSS v4** - スタイリング
- **Firebase** - バックエンド（Auth, Firestore, Storage）
- **Vercel** - ホスティング

## ✨ 主な機能

### 管理者機能
- ✅ **ダッシュボード** - 予約状況や統計の一覧表示
- ✅ **予約カレンダー** - Googleカレンダー風の週表示インターフェース
- ✅ **生徒管理** - 生徒情報と受講状況の管理
- ✅ **教師管理** - 教師プロフィールと稼働状況の管理
- ✅ **授業管理** - クラスとセッションの作成・編集
- ✅ **お知らせ配信** - 生徒・教師へのお知らせ作成
- ✅ **受講管理** - 回数券・有効期限の管理
- ✅ **設定** - システム全体の設定

### 教師機能
- ✅ **予約カレンダー** - 自分の予約スケジュールの確認
- ✅ **空き枠管理** - プライベートレッスン枠の開放/クローズ
- ✅ **授業管理** - 担当セッションの確認
- 🔄 **サマリー作成** - レッスンサマリーの作成・編集（予定）
- 🔄 **語彙リスト** - 語彙リストの作成（予定）
- 🔄 **宿題管理** - 宿題の登録・管理（予定）

## 📂 プロジェクト構造

```
ukplusad/
├── app/                      # Next.js App Router
│   ├── admin/               # 管理者画面
│   │   ├── page.tsx        # ダッシュボード
│   │   ├── calendar/       # 予約カレンダー
│   │   ├── students/       # 生徒管理
│   │   ├── teachers/       # 教師管理
│   │   ├── sessions/       # 授業管理
│   │   ├── announcements/  # お知らせ管理
│   │   ├── enrollments/    # 受講管理
│   │   └── settings/       # 設定
│   ├── teacher/            # 教師画面（予定）
│   ├── auth/               # 認証関連
│   │   └── login/          # ログインページ
│   └── layout.tsx          # ルートレイアウト
├── lib/
│   ├── firebase/           # Firebase設定
│   │   ├── client.ts      # Client SDK
│   │   └── admin.ts       # Admin SDK
│   ├── hooks/              # Reactフック
│   │   └── useAuth.tsx    # 認証フック
│   ├── components/         # 共通コンポーネント
│   │   ├── ProtectedRoute.tsx
│   │   └── AdminLayout.tsx
│   ├── types/              # TypeScript型定義
│   │   └── index.ts       # すべての型定義
│   ├── auth.ts            # 認証ヘルパー関数
│   └── utils.ts           # ユーティリティ関数
├── .env.local              # 環境変数（Gitにコミットしない）
├── .env.local.example      # 環境変数テンプレート
└── FIREBASE_SETUP.md       # Firebaseセットアップガイド
```

## 🔧 セットアップ手順

### 1. リポジトリのクローン

```bash
cd /Users/huwasi/Documents/plus/ukplusad
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Firebaseプロジェクトの設定

詳細は [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) を参照してください。

#### 簡易手順:

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. Webアプリを追加
3. Authentication、Firestore Database、Storageを有効化
4. サービスアカウントキーを生成

### 4. 環境変数の設定

`.env.local` ファイルがすでに作成されています：

```bash
# Firebase Client SDK（すでに設定済み）
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyBHnIlw-OxnfXKRKRiLtMCZHidcMclywSI"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="ukplus-9e119.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="ukplus-9e119"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="ukplus-9e119.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="382684713650"
NEXT_PUBLIC_FIREBASE_APP_ID="1:382684713650:web:5a9383d7c897737a492fab"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-PQJXG8PT4G"

# Firebase Admin SDK（要設定）
FIREBASE_PROJECT_ID="ukplus-9e119"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@ukplus-9e119.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"
```

**重要**: `FIREBASE_CLIENT_EMAIL` と `FIREBASE_PRIVATE_KEY` をFirebase Consoleから取得した値に置き換えてください。

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 🔐 認証とロール

### ロール一覧

- **admin** - 管理者（すべての機能にアクセス可能）
- **teacher** - 教師（予約カレンダー、空き枠管理、授業管理）
- **student** - 生徒（iOSアプリのみ）

### 初回ログイン用アカウントの作成

Firebase Consoleで管理者アカウントを作成し、カスタムクレームを設定する必要があります：

```javascript
// Firebase Admin SDKで実行
admin.auth().setCustomUserClaims(uid, { role: 'admin' });
```

または、Firestoreの `users` コレクションに以下のドキュメントを作成：

```json
{
  "role": "admin",
  "displayName": "管理者名",
  "email": "admin@ukplus-osaka.jp",
  "createdAt": "2026-02-22T00:00:00Z",
  "updatedAt": "2026-02-22T00:00:00Z"
}
```

## 📊 データモデル

### 主要なコレクション

- **users** - ユーザー情報（student, teacher, admin）
- **teacherProfiles** - 教師プロフィール
- **classes** - クラス情報
- **sessions** - 授業セッション
- **privateSlots** - プライベートレッスン空き枠
- **privateBookings** - プライベートレッスン予約
- **enrollments** - 受講管理（回数券・有効期限）
- **announcements** - お知らせ
- **lessonSummaries** - レッスンサマリー
- **vocabularyLists** - 語彙リスト
- **homework** - 宿題
- **threads** - メッセージスレッド

詳細なデータモデルは `lib/types/index.ts` を参照してください。

## 🎨 UIコンポーネント

### カレンダーコンポーネント

Googleカレンダー風の週表示カレンダーを実装：

- 週単位での表示（月曜始まり）
- 時間軸表示（9:00〜21:00）
- スロットのステータス表示（空き/予約済み/クローズ）
- 教師別フィルタリング
- レスポンシブデザイン

### レイアウトコンポーネント

- **AdminLayout** - サイドバーナビゲーション付きの管理画面レイアウト
- **ProtectedRoute** - ロールベースのアクセス制御

## 🚀 デプロイ

### Vercelへのデプロイ

```bash
# Vercel CLIのインストール
npm install -g vercel

# デプロイ
vercel

# 本番環境へのデプロイ
vercel --prod
```

### 環境変数の設定

Vercel Dashboardで以下の環境変数を設定：

- `NEXT_PUBLIC_FIREBASE_*` - すべてのクライアント側環境変数
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## 📝 開発ガイドライン

### コーディング規約

- **TypeScript** - 型安全性を重視
- **Server Actions** - データ操作はServer Actionsを使用
- **Client Components** - インタラクティブなUIは'use client'で実装
- **Firestore** - リアルタイムデータはFirestoreのリスナーを使用

### ディレクトリ規約

```
- app/            → ページとルーティング
- lib/            → ビジネスロジックとユーティリティ
- lib/components/ → 再利用可能なコンポーネント
- lib/types/      → TypeScript型定義
- lib/firebase/   → Firebase設定
```

## 🔄 今後の実装予定

- [ ] 教師用ダッシュボード
- [ ] レッスンサマリー作成機能
- [ ] 語彙リスト作成機能
- [ ] 宿題管理機能
- [ ] メッセージング機能
- [ ] 代行予約機能
- [ ] 予約確認メール送信
- [ ] プッシュ通知機能
- [ ] レポート・分析機能

## 🐛 トラブルシューティング

### Firebase接続エラー

```
Error: Firebase Admin SDK initialization failed
```

→ `.env.local` の `FIREBASE_PRIVATE_KEY` が正しく設定されているか確認してください。改行(`\n`)が含まれている必要があります。

### 認証エラー

```
Error: User does not have admin role
```

→ Firebase ConsoleでユーザーにカスタムクレームまたはFirestoreの `users` コレクションでロールが設定されているか確認してください。

### 開発サーバーが起動しない

```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 📚 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## 📄 ライセンス

このプロジェクトはUKPLUS Osaka専用です。

---

**開発者向けメモ**:
- Firebase Admin SDKの秘密鍵は絶対にGitにコミットしないこと
- 本番環境ではFirestoreセキュリティルールを必ず設定すること
- 定期的にFirebase使用量を確認すること
