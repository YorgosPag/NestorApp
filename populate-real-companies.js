// Χρησιμοποιούμε την υπάρχουσα Firebase config της εφαρμογής
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, updateDoc, serverTimestamp } = require('firebase/firestore');

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

// Πραγματικές ελληνικές κατασκευαστικές εταιρείες
const realCompanies = [
  {
    companyName: 'ΑΚΤΩΡ ΑΤΕ',
    type: 'company',
    status: 'active',
    contactPerson: 'Διευθυντής Έργων',
    phoneNumber: '+30 210 6968000',
    email: 'info@aktor.gr',
    address: 'Λεωφ. Μεσογείων 2-4, Αθήνα 11527',
    website: 'www.aktor.gr',
    specialty: 'Μεγάλα κατασκευαστικά έργα',
    yearEstablished: 1977,
    notes: 'Μία από τις μεγαλύτερες κατασκευαστικές εταιρείες της Ελλάδας'
  },
  {
    companyName: 'J&P ΑΒΑΞ ΑΕ',
    type: 'company',
    status: 'active',
    contactPerson: 'Τμήμα Έργων',
    phoneNumber: '+30 210 6505000',
    email: 'info@jpavax.gr',
    address: 'Μεσογείων 322, Αθήνα 15451',
    website: 'www.avax.gr',
    specialty: 'Οδικά έργα και κατασκευές',
    yearEstablished: 1978,
    notes: 'Εξειδίκευση σε υποδομές και μεγάλα έργα'
  },
  {
    companyName: 'ΤΕΡΝΑ ΑΕ',
    type: 'company',
    status: 'active',
    contactPerson: 'Διεύθυνση Κατασκευών',
    phoneNumber: '+30 210 6968300',
    email: 'construction@terna.gr',
    address: 'Μεσογείων 85, Αθήνα 11526',
    website: 'www.terna.gr',
    specialty: 'Κατασκευές και ενέργεια',
    yearEstablished: 1949,
    notes: 'Παραδοσιακή εταιρεία με πολυετή εμπειρία'
  },
  {
    companyName: 'ΜΥΤΙΛΗΝΑΙΟΣ ΑΕ',
    type: 'company',
    status: 'active',
    contactPerson: 'Κατασκευαστικό Τμήμα',
    phoneNumber: '+30 210 6877300',
    email: 'construction@mytilineos.gr',
    address: 'Αμαρουσίου-Χαλανδρίου 8, Μαρούσι 15125',
    website: 'www.mytilineos.gr',
    specialty: 'Μεταλλουργία και κατασκευές',
    yearEstablished: 1908,
    notes: 'Ιστορική εταιρεία με ευρύ φάσμα δραστηριοτήτων'
  },
  {
    companyName: 'ΑΛΥΣΙΔΑ ΑΕ',
    type: 'company',
    status: 'active',
    contactPerson: 'Διευθυντής Κατασκευών',
    phoneNumber: '+30 210 6851200',
    email: 'info@alysida.gr',
    address: 'Κηφισίας 87, Αθήνα 11523',
    website: 'www.alysida.gr',
    specialty: 'Κτιριακές κατασκευές',
    yearEstablished: 1985,
    notes: 'Εξειδίκευση σε οικιστικά και εμπορικά κτίρια'
  },
  {
    companyName: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    type: 'company',
    status: 'active',
    contactPerson: 'Νέστωρ Παγώνης',
    phoneNumber: '+30 210 5551234',
    email: 'info@pagonis-construction.gr',
    address: 'Πατησίων 125, Αθήνα 11251',
    website: 'www.pagonis-construction.gr',
    specialty: 'Πολυκατοικίες και ιδιωτικές κατασκευές',
    yearEstablished: 1995,
    notes: 'Οικογενειακή εταιρεία με έμφαση στην ποιότητα'
  }
];

async function populateCompanies() {
  try {
    console.log('🏗️ Ξεκινάω τη δημιουργία πραγματικών εταιρειών...');

    const contactsCollection = collection(db, 'contacts');

    for (let i = 0; i < realCompanies.length; i++) {
      const company = realCompanies[i];

      const companyData = {
        ...company,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'system'
      };

      const docRef = await addDoc(contactsCollection, companyData);

      // Προσθέτουμε το ID στα δεδομένα
      await updateDoc(docRef, { id: docRef.id });

      console.log(`✅ Προστέθηκε: ${company.companyName} (ID: ${docRef.id})`);
    }

    console.log(`\n🎉 Επιτυχής δημιουργία ${realCompanies.length} εταιρειών!`);
    console.log('📋 Οι εταιρείες προστέθηκαν στη contacts collection');

  } catch (error) {
    console.error('❌ Σφάλμα κατά τη δημιουργία εταιρειών:', error);
  }
}

// Εκτέλεση
populateCompanies().then(() => {
  console.log('\n✨ Ολοκλήρωση! Οι εταιρείες είναι έτοιμες για χρήση.');
  process.exit(0);
});