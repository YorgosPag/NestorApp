/**
 * List all Firebase Auth users and their claims
 */

const admin = require('firebase-admin');
const { initAdminApp } = require('./_shared/firebaseAdminOps');
async function main() {
  console.log('🔍 Listing all Firebase Auth users...\n');

  const { auth } = initAdminApp(admin);

  try {
    const listResult = await auth.listUsers(1000);

    console.log(`📊 Total users: ${listResult.users.length}\n`);
    console.log('=' .repeat(80));

    listResult.users.forEach((user, index) => {
      const claims = user.customClaims || {};
      const isSuperAdmin = claims.globalRole === 'super_admin';

      console.log(`\n${index + 1}. ${isSuperAdmin ? '👑 ' : ''}${user.email || 'NO EMAIL'}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Display Name: ${user.displayName || 'N/A'}`);
      console.log(`   Claims: ${JSON.stringify(claims)}`);

      if (isSuperAdmin) {
        console.log(`   ⭐ THIS IS THE SUPER_ADMIN!`);
      }
    });

    console.log('\n' + '=' .repeat(80));

    // Find super_admin
    const superAdmin = listResult.users.find(u => u.customClaims?.globalRole === 'super_admin');
    if (superAdmin) {
      console.log(`\n👑 SUPER_ADMIN: ${superAdmin.email} (${superAdmin.uid})`);
    } else {
      console.log('\n⚠️ NO SUPER_ADMIN FOUND!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

main();
