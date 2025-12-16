// Προσθήκη εταιρειών στη navigation μέσω API endpoint

// 🏢 ENTERPRISE: Load company IDs από environment configuration
const companyIds = (process.env.NAVIGATION_COMPANY_IDS ||
  'company1,company2,company3,company4,company5,company6'
).split(',').map(id => id.trim());

async function addCompaniesToNavigationAPI() {
  try {
    console.log('🧭 Ξεκινάω την προσθήκη εταιρειών στη navigation μέσω API...');

    const response = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/navigation/add-companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        companyIds: companyIds
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`\n🎉 Επιτυχής προσθήκη ${result.navigationCount} εταιρειών στη navigation!`);
      console.log(`📋 Added navigation IDs:`, result.addedNavigationIds);
      console.log('✨ Οι εταιρείες πρέπει να εμφανιστούν τώρα στο navigation!');
    } else {
      console.error('❌ Σφάλμα από το API:', result.error);
    }

  } catch (error) {
    console.error('❌ Σφάλμα κατά την κλήση του API:', error);
  }
}

// Εκτέλεση
addCompaniesToNavigationAPI();