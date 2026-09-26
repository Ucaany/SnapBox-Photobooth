import process from 'node:process';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.env.CEO_EMAIL?.trim();

if (!email) {
  throw new Error('CEO_EMAIL wajib diisi.');
}

initializeApp({ credential: applicationDefault() });

async function setCeo() {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const claims = {
    ...user.customClaims,
    role: 'authenticated',
    app_role: 'CEO',
    tenant_id: null,
    parent_tenant_id: null,
  };

  await auth.setCustomUserClaims(user.uid, claims);

  console.log('================================');
  console.log('SUCCESS');
  console.log('Email :', user.email);
  console.log('UID   :', user.uid);
  console.log('Role  : CEO');
  console.log('================================');
}

setCeo().catch((error) => {
  console.error('ERROR:', error);
  process.exitCode = 1;
});
