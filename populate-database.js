/**
 * 🏗️ DATABASE POPULATION SCRIPT
 *
 * Προσθέτει νέες επαφές, δημιουργεί σχέσεις και χαρακτηρίζει μονάδες
 * με το νέο Property Status System
 *
 * ΧΡΗΣΗ: node populate-database.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, 'nestor-app-firebase-adminsdk-l11o0-6d1c89acdf.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'nestor-app'
  });
}

const db = admin.firestore();

// ============================================================================
// ΝΕΕΣ ΕΠΑΦΕΣ - ΡΕΑΛΙΣΤΙΚΑ ΔΕΔΟΜΕΝΑ
// ============================================================================

const NEW_CONTACTS = [
  // Οικοπεδούχοι
  {
    type: 'individual',
    firstName: 'Ελένη',
    lastName: 'Παπαδόπουλος',
    tags: ['οικοπεδούχος', 'αντιπαροχή'],
    status: 'active',
    isFavorite: false,
    emails: [{
      email: 'eleni.papadopoulos@gmail.com',
      type: 'personal',
      isPrimary: true
    }],
    phones: [{
      phone: '+30 6973456789',
      type: 'mobile',
      isPrimary: true
    }],
    addresses: [{
      address: 'Λεωφόρος Νίκης 45, Θεσσαλονίκη',
      type: 'home',
      isPrimary: true
    }],
    profession: 'Συνταξιούχος',
    notes: 'Οικοπεδούχος με αντιπαροχή 3 διαμερισμάτων'
  },

  {
    type: 'individual',
    firstName: 'Γιάννης',
    lastName: 'Κωνσταντίνου',
    tags: ['οικοπεδούχος', 'αντιπαροχή'],
    status: 'active',
    isFavorite: false,
    emails: [{
      email: 'giannis.kon@outlook.com',
      type: 'personal',
      isPrimary: true
    }],
    phones: [{
      phone: '+30 6945123456',
      type: 'mobile',
      isPrimary: true
    }],
    addresses: [{
      address: 'Οδός Κομνηνών 23, Θεσσαλονίκη',
      type: 'home',
      isPrimary: true
    }],
    profession: 'Μηχανικός',
    notes: 'Οικοπεδούχος με αντιπαροχή 2 διαμερισμάτων'
  },

  // Αγοραστές
  {
    type: 'individual',
    firstName: 'Μαρία',
    lastName: 'Αλεξάνδρου',
    tags: ['αγοραστής', 'πελάτης'],
    status: 'active',
    isFavorite: true,
    emails: [{
      email: 'maria.alexandrou@yahoo.gr',
      type: 'personal',
      isPrimary: true
    }],
    phones: [{
      phone: '+30 6987654321',
      type: 'mobile',
      isPrimary: true
    }],
    addresses: [{
      address: 'Τσιμισκή 78, Θεσσαλονίκη',
      type: 'home',
      isPrimary: true
    }],
    profession: 'Ιατρός',
    notes: 'Αγόρασε διαμέρισμα 85τμ στον 4ο όροφο'
  },

  {
    type: 'individual',
    firstName: 'Κώστας',
    lastName: 'Νικολάου',
    tags: ['αγοραστής', 'πελάτης'],
    status: 'active',
    isFavorite: true,
    emails: [{
      email: 'kostas.nikolaou@gmail.com',
      type: 'personal',
      isPrimary: true
    }],
    phones: [{
      phone: '+30 6912345678',
      type: 'mobile',
      isPrimary: true
    }],
    profession: 'Δικηγόρος',
    notes: 'Αγόρασε μεζονέτα 120τμ'
  },

  // Ενοικιαστές
  {
    type: 'individual',
    firstName: 'Σοφία',
    lastName: 'Γεωργίου',
    tags: ['ενοικιαστής', 'μακροχρόνια μίσθωση'],
    status: 'active',
    isFavorite: false,
    emails: [{
      email: 'sofia.georgiou@hotmail.com',
      type: 'personal',
      isPrimary: true
    }],
    phones: [{
      phone: '+30 6934567890',
      type: 'mobile',
      isPrimary: true
    }],
    profession: 'Φαρμακοποιός',
    notes: 'Ενοικιάζει διαμέρισμα 65τμ, συμβόλαιο 2 ετών'
  },

  {
    type: 'individual',
    firstName: 'Νίκος',
    lastName: 'Δημητρίου',
    tags: ['ενοικιαστής', 'βραχυχρόνια μίσθωση'],
    status: 'active',
    isFavorite: false,
    emails: [{
      email: 'nikos.dimitriou@gmail.com',
      type: 'personal',
      isPrimary: true
    }],
    phones: [{
      phone: '+30 6956789012',
      type: 'mobile',
      isPrimary: true
    }],
    profession: 'Φοιτητής',
    notes: 'Ενοικιάζει στούντιο για 6 μήνες (φοιτητικό έτος)'
  },

  // Εταιρεία
  {
    type: 'company',
    companyName: 'TechStart Solutions',
    tags: ['εταιρεία', 'ενοικιαστής', 'γραφεία'],
    status: 'active',
    isFavorite: true,
    emails: [{
      email: 'info@techstart.gr',
      type: 'business',
      isPrimary: true
    }],
    phones: [{
      phone: '+30 2310123456',
      type: 'business',
      isPrimary: true
    }],
    addresses: [{
      address: 'Εγνατία 154, Θεσσαλονίκη',
      type: 'business',
      isPrimary: true
    }],
    industry: 'Τεχνολογία',
    vatNumber: '999888777',
    notes: 'Ενοικιάζει γραφειακό χώρο 150τμ'
  }
];

// ============================================================================
// PROPERTY STATUSES - ΝΕΟ ΣΥΣΤΗΜΑ
// ============================================================================

const PROPERTY_STATUSES = [
  // Βασικά statuses
  'sold', 'pending', 'withdrawn', 'expired',
  // Essential Rental Statuses
  'long-term-rental', 'short-term-rental', 'long-term-rented', 'short-term-rented',
  // Essential Reservation Statuses
  'reserved',
  // Role-Based Ownership Statuses
  'company-owned', 'owner-compensation',
  // Essential από το παλιό σύστημα
  'for-sale', 'coming-soon'
];

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Προσθέτει νέες επαφές στη βάση
 */
async function addNewContacts() {
  console.log('🔄 Προσθέτοντας νέες επαφές...');

  const addedContacts = [];

  for (const contact of NEW_CONTACTS) {
    try {
      const now = admin.firestore.Timestamp.now();
      const contactData = {
        ...contact,
        createdAt: now,
        updatedAt: now,
        createdBy: 'database-populate-script',
        lastModifiedBy: 'database-populate-script'
      };

      const docRef = await db.collection('contacts').add(contactData);
      addedContacts.push({ id: docRef.id, ...contactData });

      console.log(`  ✅ Προστέθηκε: ${contact.firstName || contact.companyName} (${docRef.id})`);
    } catch (error) {
      console.error(`  ❌ Σφάλμα προσθήκης επαφής:`, error);
    }
  }

  return addedContacts;
}

/**
 * Ενημερώνει υφιστάμενες επαφές με tags
 */
async function updateExistingContacts() {
  console.log('🔄 Ενημερώνοντας υφιστάμενες επαφές...');

  try {
    // Παίρνουμε όλες τις υπάρχουσες επαφές
    const contactsSnapshot = await db.collection('contacts').limit(10).get();

    for (const doc of contactsSnapshot.docs) {
      const contactData = doc.data();
      const contactId = doc.id;

      // Προσθέτουμε random tags βάση του τύπου
      let newTags = [];

      if (contactData.type === 'individual') {
        // Random assignment σε υπάρχουσες επαφές
        const possibleTags = ['πελάτης', 'προοπτικός', 'συνεργάτης'];
        newTags = [possibleTags[Math.floor(Math.random() * possibleTags.length)]];
      } else if (contactData.type === 'company') {
        newTags = ['εταιρεία', 'συνεργάτης'];
      }

      await db.collection('contacts').doc(contactId).update({
        tags: admin.firestore.FieldValue.arrayUnion(...newTags),
        updatedAt: admin.firestore.Timestamp.now(),
        lastModifiedBy: 'database-populate-script'
      });

      console.log(`  ✅ Ενημερώθηκε: ${contactData.firstName || contactData.companyName} με tags: ${newTags.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Σφάλμα ενημέρωσης επαφών:', error);
  }
}

/**
 * Χαρακτηρίζει μονάδες με νέα statuses
 */
async function updateUnitsWithNewStatuses() {
  console.log('🔄 Ενημερώνοντας μονάδες με νέα statuses...');

  try {
    // Παίρνουμε όλες τις μονάδες
    const unitsSnapshot = await db.collection('units').limit(20).get();

    for (const doc of unitsSnapshot.docs) {
      const unitData = doc.data();
      const unitId = doc.id;

      // Επιλέγουμε ένα random status από το νέο σύστημα
      const randomStatus = PROPERTY_STATUSES[Math.floor(Math.random() * PROPERTY_STATUSES.length)];

      // Ειδική λογική για realistic assignment
      let finalStatus = randomStatus;

      // Αν είναι παλιό status, αντικαθιστούμε με νέο
      if (unitData.status === 'for-rent') {
        finalStatus = Math.random() > 0.5 ? 'long-term-rental' : 'short-term-rental';
      } else if (unitData.status === 'rented') {
        finalStatus = Math.random() > 0.5 ? 'long-term-rented' : 'short-term-rented';
      }

      await db.collection('units').doc(unitId).update({
        status: finalStatus,
        updatedAt: admin.firestore.Timestamp.now()
      });

      console.log(`  ✅ Μονάδα ${unitData.name || unitId}: ${unitData.status || 'N/A'} → ${finalStatus}`);
    }
  } catch (error) {
    console.error('❌ Σφάλμα ενημέρωσης μονάδων:', error);
  }
}

/**
 * Δημιουργεί σχέσεις μεταξύ επαφών και μονάδων
 */
async function createContactUnitRelationships(addedContacts) {
  console.log('🔄 Δημιουργώντας σχέσεις επαφών-μονάδων...');

  try {
    // Παίρνουμε κάποιες μονάδες
    const unitsSnapshot = await db.collection('units').limit(10).get();
    const units = unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Δημιουργούμε σχέσεις για τις νέες επαφές
    for (let i = 0; i < Math.min(addedContacts.length, units.length); i++) {
      const contact = addedContacts[i];
      const unit = units[i];

      // Ενημερώνουμε τη μονάδα να δείχνει στην επαφή
      let updateData = {};

      if (contact.tags?.includes('αγοραστής')) {
        updateData.soldTo = contact.id;
        updateData.saleDate = new Date().toISOString();
        updateData.status = 'sold';
      } else if (contact.tags?.includes('οικοπεδούχος')) {
        updateData.status = 'owner-compensation';
        updateData.ownerId = contact.id;
      } else if (contact.tags?.includes('ενοικιαστής')) {
        updateData.tenantId = contact.id;
        if (contact.tags?.includes('μακροχρόνια μίσθωση')) {
          updateData.status = 'long-term-rented';
        } else {
          updateData.status = 'short-term-rented';
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = admin.firestore.Timestamp.now();

        await db.collection('units').doc(unit.id).update(updateData);

        console.log(`  ✅ Σχέση: ${contact.firstName || contact.companyName} ↔ Μονάδα ${unit.name || unit.id}`);
      }
    }
  } catch (error) {
    console.error('❌ Σφάλμα δημιουργίας σχέσεων:', error);
  }
}

/**
 * Κύρια συνάρτηση εκτέλεσης
 */
async function main() {
  console.log('🚀 Ξεκινάει η συμπλήρωση της βάσης δεδομένων...\n');

  try {
    // 1. Προσθήκη νέων επαφών
    const addedContacts = await addNewContacts();
    console.log(`\n✅ Προστέθηκαν ${addedContacts.length} νέες επαφές\n`);

    // 2. Ενημέρωση υφιστάμενων επαφών
    await updateExistingContacts();
    console.log('\n✅ Ενημερώθηκαν υφιστάμενες επαφές\n');

    // 3. Ενημέρωση μονάδων με νέα statuses
    await updateUnitsWithNewStatuses();
    console.log('\n✅ Ενημερώθηκαν μονάδες με νέα statuses\n');

    // 4. Δημιουργία σχέσεων
    await createContactUnitRelationships(addedContacts);
    console.log('\n✅ Δημιουργήθηκαν σχέσεις επαφών-μονάδων\n');

    console.log('🎉 Η συμπλήρωση της βάσης δεδομένων ολοκληρώθηκε επιτυχώς!');

  } catch (error) {
    console.error('💥 Σφάλμα κατά την εκτέλεση:', error);
  }
}

// Εκτέλεση του script
if (require.main === module) {
  main().then(() => {
    console.log('\n📊 Script ολοκληρώθηκε. Ελέγξτε τη βάση δεδομένων για τις αλλαγές.');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}