import { readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
}

const projectId = env.FIREBASE_PROJECT_ID;
const source = readFileSync('firestore.rules', 'utf8');

const auth = new GoogleAuth({
  credentials: {
    client_email: env.FIREBASE_CLIENT_EMAIL,
    private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/firebase'],
});
const client = await auth.getClient();
const base = 'https://firebaserules.googleapis.com/v1';

// 1) ruleset 作成
const created = await client.request({
  url: `${base}/projects/${projectId}/rulesets`,
  method: 'POST',
  data: {
    source: { files: [{ name: 'firestore.rules', content: source }] },
  },
});
const rulesetName = created.data.name;
console.log('新しい ruleset 作成:', rulesetName);

// 2) release 更新（本番に反映）
await client.request({
  url: `${base}/projects/${projectId}/releases/cloud.firestore`,
  method: 'PATCH',
  data: {
    release: {
      name: `projects/${projectId}/releases/cloud.firestore`,
      rulesetName,
    },
    updateMask: 'rulesetName',
  },
});
console.log('本番リリースを更新しました（cloud.firestore）');

process.exit(0);
