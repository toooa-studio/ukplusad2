// このスクリプトでFirebase Admin SDKを使用してユーザーにロールを設定します
// 使用方法: node scripts/setAdminRole.js <USER_UID>

const admin = require('firebase-admin');
const serviceAccount = require('../path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = process.argv[2];

if (!uid) {
  console.error('使用方法: node scripts/setAdminRole.js <USER_UID>');
  process.exit(1);
}

async function setAdminRole() {
  try {
    // カスタムクレームを設定
    await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
    
    // Firestoreにも保存
    await admin.firestore().collection('users').doc(uid).set({
      role: 'admin',
      displayName: '管理者',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    
    console.log('✅ 管理者ロールを設定しました！');
    console.log(`UID: ${uid}`);
    
    // ユーザー情報を確認
    const user = await admin.auth().getUser(uid);
    console.log('ユーザー情報:', {
      email: user.email,
      customClaims: user.customClaims
    });
    
    process.exit(0);
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

setAdminRole();
