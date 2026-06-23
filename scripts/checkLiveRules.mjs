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
const auth = new GoogleAuth({
  credentials: {
    client_email: env.FIREBASE_CLIENT_EMAIL,
    private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/firebase'],
});

const client = await auth.getClient();
const base = 'https://firebaserules.googleapis.com/v1';

// 本番リリース（cloud.firestore）を取得
const rel = await client.request({
  url: `${base}/projects/${projectId}/releases/cloud.firestore`,
});
const rulesetName = rel.data.rulesetName;
console.log('現在の本番 ruleset:', rulesetName);

const rs = await client.request({ url: `${base}/${rulesetName}` });
const source = rs.data.source.files[0].content;
console.log('\n=== 本番にデプロイされているルール全文 ===\n');
console.log(source);

process.exit(0);
