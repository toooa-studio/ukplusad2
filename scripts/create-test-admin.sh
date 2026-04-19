#!/bin/bash

# テスト管理者アカウントを作成するスクリプト

echo "🔐 テスト管理者アカウントを作成します..."

curl -X POST http://localhost:3000/api/dev/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ukplus-osaka.jp",
    "password": "Admin123!",
    "displayName": "UKPLUS 管理者"
  }'

echo ""
echo ""
echo "✅ 完了しました！"
echo ""
echo "ログイン情報:"
echo "  メールアドレス: admin@ukplus-osaka.jp"
echo "  パスワード: Admin123!"
echo ""
echo "ログインページ: http://localhost:3000/auth/login"
