// Προσθήκη εταιρειών στη navigation_companies collection
// Χρησιμοποιούμε το built-in fetch του Node.js 18+

// Company IDs που δημιουργήθηκαν από το προηγούμενο script
const companyIds = [
  'XRh6PJG1lbkpVFQD0TXo', // ΑΚΤΩΡ ΑΤΕ
  'JQ2eU1MwmtqHXxsuujrK', // J&P ΑΒΑΞ ΑΕ
  'VdqPobCgzGqaEJULEyoJ', // ΤΕΡΝΑ ΑΕ
  'SLw9O6yys0Lf6Ql3yw5g', // ΜΥΤΙΛΗΝΑΙΟΣ ΑΕ
  'HZ1anF4UaYEzqhpU2ilM', // ΑΛΥΣΙΔΑ ΑΕ
  'pzNUy8ksddGCtcQMqumR'  // Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.
];

async function addCompaniesToNavigation() {
  try {
    console.log('🧭 Ξεκινάω την προσθήκη εταιρειών στη navigation...');

    // Χρησιμοποιούμε την υπάρχουσα Firebase config της εφαρμογής
    const { initializeApp } = require('firebase/app');
    const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

    const firebaseConfig = {
      apiKey: "AIzaSyAXnmBhlPvUX89FmbYqvJdh7VLNKVBwx0Y",
      authDomain: "pagonis-87766.firebaseapp.com",
      projectId: "pagonis-87766",
      storageBucket: "pagonis-87766.firebasestorage.app",
      messagingSenderId: "280326053749",
      appId: "1:280326053749:web:e69a2c31c8a2e0e7c1dcd4"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const navigationCollection = collection(db, 'navigation_companies');

    for (let i = 0; i < companyIds.length; i++) {
      const contactId = companyIds[i];

      const navigationEntry = {
        contactId: contactId,
        addedAt: serverTimestamp(),
        addedBy: 'system'
      };

      const docRef = await addDoc(navigationCollection, navigationEntry);
      console.log(`✅ Added to navigation: Company ${contactId} (Entry ID: ${docRef.id})`);
    }

    console.log(`\n🎉 Επιτυχής προσθήκη ${companyIds.length} εταιρειών στη navigation!`);
    console.log('🧭 Οι εταιρείες πρέπει να εμφανιστούν τώρα στο navigation!');

  } catch (error) {
    console.error('❌ Σφάλμα κατά την προσθήκη στη navigation:', error);
  }
}

// Εκτέλεση
addCompaniesToNavigation().then(() => {
  console.log('\n✨ Ολοκλήρωση! Ανανεώστε το navigation page!');
  process.exit(0);
});