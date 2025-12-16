// Δημιουργία εταιρειών μέσω API endpoint
// Χρησιμοποιούμε το built-in fetch του Node.js 18+

// Πραγματικές ελληνικές κατασκευαστικές εταιρείες
const realCompanies = [
  {
    companyName: 'ΑΚΤΩΡ ΑΤΕ',
    type: 'company',
    status: 'active',
    firstName: '',
    lastName: '',
    profession: 'Κατασκευές',
    industry: 'Κατασκευαστική',
    phones: [{
      countryCode: '+30',
      number: '2106968000',
      type: 'business',
      isPrimary: true
    }],
    emails: [{
      email: process.env.AKTOR_EMAIL || 'info@aktor.gr',
      type: 'business',
      isPrimary: true
    }],
    workAddress: 'Λεωφ. Μεσογείων 2-4, Αθήνα 11527',
    vatNumber: '094066960',
    tags: ['κατασκευές', 'μεγάλα έργα'],
    notes: 'Μία από τις μεγαλύτερες κατασκευαστικές εταιρείες της Ελλάδας',
    websites: ['www.aktor.gr']
  },
  {
    companyName: 'J&P ΑΒΑΞ ΑΕ',
    type: 'company',
    status: 'active',
    firstName: '',
    lastName: '',
    profession: 'Κατασκευές',
    industry: 'Κατασκευαστική',
    phones: [{
      countryCode: '+30',
      number: '2106505000',
      type: 'business',
      isPrimary: true
    }],
    emails: [{
      email: process.env.JPAVAX_EMAIL || 'info@jpavax.gr',
      type: 'business',
      isPrimary: true
    }],
    workAddress: 'Μεσογείων 322, Αθήνα 15451',
    vatNumber: '094018270',
    tags: ['κατασκευές', 'οδικά έργα', 'υποδομές'],
    notes: 'Εξειδίκευση σε υποδομές και μεγάλα έργα',
    websites: ['www.avax.gr']
  },
  {
    companyName: 'ΤΕΡΝΑ ΑΕ',
    type: 'company',
    status: 'active',
    firstName: '',
    lastName: '',
    profession: 'Κατασκευές & Ενέργεια',
    industry: 'Κατασκευαστική',
    phones: [{
      countryCode: '+30',
      number: '2106968300',
      type: 'business',
      isPrimary: true
    }],
    emails: [{
      email: 'construction@terna.gr',
      type: 'business',
      isPrimary: true
    }],
    workAddress: 'Μεσογείων 85, Αθήνα 11526',
    vatNumber: '094018403',
    tags: ['κατασκευές', 'ενέργεια', 'παραδοσιακή'],
    notes: 'Παραδοσιακή εταιρεία με πολυετή εμπειρία από το 1949',
    websites: ['www.terna.gr']
  },
  {
    companyName: 'ΜΥΤΙΛΗΝΑΙΟΣ ΑΕ',
    type: 'company',
    status: 'active',
    firstName: '',
    lastName: '',
    profession: 'Μεταλλουργία & Κατασκευές',
    industry: 'Βιομηχανική',
    phones: [{
      countryCode: '+30',
      number: '2106877300',
      type: 'business',
      isPrimary: true
    }],
    emails: [{
      email: 'construction@mytilineos.gr',
      type: 'business',
      isPrimary: true
    }],
    workAddress: 'Αμαρουσίου-Χαλανδρίου 8, Μαρούσι 15125',
    vatNumber: '094259644',
    tags: ['μεταλλουργία', 'κατασκευές', 'ιστορική'],
    notes: 'Ιστορική εταιρεία από το 1908 με ευρύ φάσμα δραστηριοτήτων',
    websites: ['www.mytilineos.gr']
  },
  {
    companyName: 'ΑΛΥΣΙΔΑ ΑΕ',
    type: 'company',
    status: 'active',
    firstName: '',
    lastName: '',
    profession: 'Κτιριακές Κατασκευές',
    industry: 'Κατασκευαστική',
    phones: [{
      countryCode: '+30',
      number: '2106851200',
      type: 'business',
      isPrimary: true
    }],
    emails: [{
      email: 'info@alysida.gr',
      type: 'business',
      isPrimary: true
    }],
    workAddress: 'Κηφισίας 87, Αθήνα 11523',
    vatNumber: '094765432',
    tags: ['κτίρια', 'οικιστικά', 'εμπορικά'],
    notes: 'Εξειδίκευση σε οικιστικά και εμπορικά κτίρια από το 1985',
    websites: ['www.alysida.gr']
  },
  {
    companyName: process.env.COMPANY_NAME || 'Default Construction Company',
    type: 'company',
    status: 'active',
    firstName: '',
    lastName: '',
    profession: 'Πολυκατοικίες & Ιδιωτικές Κατασκευές',
    industry: 'Κατασκευαστική',
    phones: [{
      countryCode: '+30',
      number: '2105551234',
      type: 'business',
      isPrimary: true
    }],
    emails: [{
      email: process.env.COMPANY_EMAIL || 'info@company.gr',
      type: 'business',
      isPrimary: true
    }],
    workAddress: 'Πατησίων 125, Αθήνα 11251',
    vatNumber: '800123456',
    tags: ['πολυκατοικίες', 'ιδιωτικές κατασκευές', 'οικογενειακή'],
    notes: 'Οικογενειακή εταιρεία με έμφαση στην ποιότητα από το 1995',
    websites: [process.env.COMPANY_WEBSITE || 'www.company.gr']
  }
];

async function createCompaniesViaAPI() {
  try {
    console.log('🏗️ Ξεκινάω τη δημιουργία πραγματικών εταιρειών μέσω API...');

    const response = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/contacts/add-real-contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contacts: realCompanies
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`\n🎉 Επιτυχής δημιουργία ${result.contactsCount} εταιρειών!`);
      console.log(`📋 Added contact IDs:`, result.addedContactIds);
      console.log('✨ Οι εταιρείες είναι έτοιμες για χρήση στο navigation!');
    } else {
      console.error('❌ Σφάλμα από το API:', result.error);
    }

  } catch (error) {
    console.error('❌ Σφάλμα κατά την κλήση του API:', error);
  }
}

// Εκτέλεση
createCompaniesViaAPI();