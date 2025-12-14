// Προσθήκη εταιρειών στη navigation μέσω API endpoint

// Company IDs που δημιουργήθηκαν από το προηγούμενο script
const companyIds = [
  'XRh6PJG1lbkpVFQD0TXo', // ΑΚΤΩΡ ΑΤΕ
  'JQ2eU1MwmtqHXxsuujrK', // J&P ΑΒΑΞ ΑΕ
  'VdqPobCgzGqaEJULEyoJ', // ΤΕΡΝΑ ΑΕ
  'SLw9O6yys0Lf6Ql3yw5g', // ΜΥΤΙΛΗΝΑΙΟΣ ΑΕ
  'HZ1anF4UaYEzqhpU2ilM', // ΑΛΥΣΙΔΑ ΑΕ
  'pzNUy8ksddGCtcQMqumR'  // Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.
];

async function addCompaniesToNavigationAPI() {
  try {
    console.log('🧭 Ξεκινάω την προσθήκη εταιρειών στη navigation μέσω API...');

    const response = await fetch('http://localhost:3000/api/navigation/add-companies', {
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