#!/bin/bash

# 既存のユーザーに管理者ロールを設定するスクリプト

echo "🔐 既存のユーザーに管理者ロールを設定します..."
echo ""

curl -X POST http://localhost:3000/api/dev/set-admin-role \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ukplus-osaka.jp"
  }'

echo ""
echo ""
echo "✅ 完了しました！"
echo ""
echo "ログインページ: http://localhost:3000/auth/login"
echo "メールアドレス: admin@ukplus-osaka.jp"
