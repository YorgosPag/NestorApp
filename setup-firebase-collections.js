/**
 * 🔧 SETUP FIREBASE COLLECTIONS SCRIPT
 *
 * Δημιουργεί τα απαραίτητα Firebase collections για το Contact Relationships system
 * Καλεί το API endpoint που δημιούργησα για να κάνει το setup
 */

const setupFirebaseCollections = async () => {
  console.log(`
🔧 FIREBASE COLLECTIONS SETUP

🎯 ΣΤΟΧΟΣ: Δημιουργία collection 'contact_relationships'
🔧 ΜΕΘΟΔΟΣ: Next.js API call
🚀 ΑΠΟΤΕΛΕΣΜΑ: OrganizationTree & Relationships θα δουλεύουν

Ξεκινάω σε 2 δευτερόλεπτα...
`);

  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    console.log('📞 Calling Firebase setup API...');

    const response = await fetch(`${process.env.APP_URL || 'http://localhost:3001'}/api/setup/firebase-collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      console.log(`
✅ FIREBASE COLLECTIONS SETUP ΟΛΟΚΛΗΡΩΘΗΚΕ!

📋 Τι δημιουργήθηκε:
${result.collections.map(col =>
  `   ✅ ${col.name} - ${col.description}`
).join('\n')}

🎉 ΑΠΟΤΕΛΕΣΜΑ:
   - Το OrganizationTree θα δουλεύει τώρα
   - Τα relationships θα αποθηκεύονται
   - Τα στατιστικά θα εμφανίζονται σωστά
   - Η διαγραφή εργαζομένων θα λειτουργεί

🔄 ΕΠΟΜΕΝΟ ΒΗΜΑ: Refresh την εφαρμογή και δοκίμασε να προσθέσεις εργαζόμενο!
`);
    } else {
      console.error(`
❌ ΣΦΑΛΜΑ SETUP:
   ${result.error}
   ${result.details || ''}

🔧 ΛΥΣΗ: Ελέγξε ότι:
   1. Η εφαρμογή τρέχει στο ${process.env.APP_URL || 'localhost:3001'}
   2. Το Firebase είναι configured σωστά
   3. Υπάρχουν τα απαραίτητα permissions
`);
    }

  } catch (error) {
    console.error(`
❌ ΣΦΑΛΜΑ ΚΛΗΣΗΣ API:
   ${error.message}

🔧 ΛΥΣΗ: Ελέγξε ότι η εφαρμογή τρέχει στο ${process.env.APP_URL || 'localhost:3001'}
   npm run dev
`);
  }
};

// Εκτέλεση αν καλείται απευθείας
if (require.main === module) {
  setupFirebaseCollections();
}

module.exports = { setupFirebaseCollections };