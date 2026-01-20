/**
 * Check FileRecord metadata to debug permissions
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const FILE_ID = 'file_1768895874172_u06atn';

function loadServiceAccount() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
  if (!match) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found');
  return JSON.parse(match[1].trim());
}

async function main() {
  console.log('🔍 Checking FileRecord metadata...\n');

  const serviceAccount = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();

  try {
    // Get the file record
    const fileRef = db.collection('files').doc(FILE_ID);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      console.log(`❌ FileRecord NOT FOUND: ${FILE_ID}`);
      console.log('\n   The file may have been deleted from Firestore already,');
      console.log('   but still exists in Storage.');
      process.exit(1);
    }

    const data = fileDoc.data();
    console.log('📄 FileRecord found:\n');
    console.log('=' .repeat(60));
    console.log(`ID:          ${FILE_ID}`);
    console.log(`companyId:   ${data.companyId || 'NULL/UNDEFINED'}`);
    console.log(`createdBy:   ${data.createdBy || 'NULL/UNDEFINED'}`);
    console.log(`status:      ${data.status || 'NULL/UNDEFINED'}`);
    console.log(`entityType:  ${data.entityType || 'NULL/UNDEFINED'}`);
    console.log(`entityId:    ${data.entityId || 'NULL/UNDEFINED'}`);
    console.log(`storagePath: ${data.storagePath || 'NULL/UNDEFINED'}`);
    console.log(`displayName: ${data.displayName || 'NULL/UNDEFINED'}`);
    console.log('=' .repeat(60));

    // Compare with user
    const USER_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';
    const USER_UID = 'ITjmw0syn7WiYuskqaGtzLPuN852';

    console.log('\n🔐 PERMISSION CHECK:');
    console.log(`   User companyId:     ${USER_COMPANY_ID}`);
    console.log(`   File companyId:     ${data.companyId}`);
    console.log(`   Match:              ${data.companyId === USER_COMPANY_ID ? '✅ YES' : '❌ NO'}`);
    console.log(`   User UID:           ${USER_UID}`);
    console.log(`   File createdBy:     ${data.createdBy}`);
    console.log(`   Is Creator:         ${data.createdBy === USER_UID ? '✅ YES' : '❌ NO'}`);

    if (data.companyId !== USER_COMPANY_ID) {
      console.log('\n⚠️  PROBLEM: companyId MISMATCH!');
      console.log('   The Firestore rule requires: resource.data.companyId == getUserCompanyId()');
      console.log('   This check happens BEFORE the super_admin bypass.');
    }

    console.log('\n📋 Full FileRecord data:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

main();
