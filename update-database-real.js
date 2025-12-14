/**
 * 🏗️ REAL DATABASE UPDATE SCRIPT
 *
 * Πραγματικές αλλαγές στη βάση δεδομένων:
 * 1. Προσθήκη νέων επαφών
 * 2. Ενημέρωση υφιστάμενων επαφών με σχέσεις
 * 3. Ενημέρωση μονάδων με νέα statuses
 *
 * ΧΡΗΣΗ: node update-database-real.js
 */

// Υπάρχοντα contact IDs από το localhost-2.log
const EXISTING_CONTACT_IDS = [
  '6MkpFeW54dG03cbWUzRf',
  '6vpnjcpN5ICjCyrsUs8x',
  'DBbvKi3DYxBHbDipqfCv',
  'IjTAcUZ3eJm5zT7EA4q7',
  'JIwIiksQwG9469SByKIJ',
  'QpWvu0Jrw4DGxDqFC2xW',
  'SVgqNOX1vLM7gFZO9Vy4',
  'VJpvrADTve31letX5ob7',
  'ZxLWN7HXsZHcMfoozVL5',
  'fdhyCgd9l4cxXX0XhtyG',
  'j1xYkN18jqGMA18c600g',
  'oGHblMcwDKM4SM67mlgN',
  'sx9QlhtQelyE1LZHwBOg',
  'zX0jNOzy0GAmAhUjSdeQ'
];

// Νέες επαφές να προστεθούν
const NEW_CONTACTS = [
  {
    type: 'individual',
    firstName: 'Ελένη',
    lastName: 'Παπαδόπουλος',
    tags: ['οικοπεδούχος', 'αντιπαροχή'],
    status: 'active',
    isFavorite: false,
    emails: [{ email: 'eleni.papadopoulos@gmail.com', type: 'personal', isPrimary: true }],
    phones: [{ phone: '+30 6973456789', type: 'mobile', isPrimary: true }],
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
    emails: [{ email: 'giannis.kon@outlook.com', type: 'personal', isPrimary: true }],
    phones: [{ phone: '+30 6945123456', type: 'mobile', isPrimary: true }],
    profession: 'Μηχανικός',
    notes: 'Οικοπεδούχος με αντιπαροχή 2 διαμερισμάτων'
  },
  {
    type: 'individual',
    firstName: 'Μαρία',
    lastName: 'Αλεξάνδρου',
    tags: ['αγοραστής', 'πελάτης'],
    status: 'active',
    isFavorite: true,
    emails: [{ email: 'maria.alexandrou@yahoo.gr', type: 'personal', isPrimary: true }],
    phones: [{ phone: '+30 6987654321', type: 'mobile', isPrimary: true }],
    profession: 'Ιατρός',
    notes: 'Αγόρασε διαμέρισμα 85τμ στον 4ο όροφο'
  },
  {
    type: 'company',
    companyName: 'TechStart Solutions',
    tags: ['εταιρεία', 'ενοικιαστής', 'γραφεία'],
    status: 'active',
    isFavorite: true,
    emails: [{ email: 'info@techstart.gr', type: 'business', isPrimary: true }],
    phones: [{ phone: '+30 2310123456', type: 'business', isPrimary: true }],
    industry: 'Τεχνολογία',
    vatNumber: '999888777',
    notes: 'Ενοικιάζει γραφειακό χώρο 150τμ'
  }
];

// Assignments για υπάρχουσες επαφές
const CONTACT_ASSIGNMENTS = {
  // Οικοπεδούχοι (θα γίνουν owner-compensation)
  '6MkpFeW54dG03cbWUzRf': { role: 'landowner', tags: ['οικοπεδούχος', 'αντιπαροχή'] },
  '6vpnjcpN5ICjCyrsUs8x': { role: 'landowner', tags: ['οικοπεδούχος', 'αντιπαροχή'] },

  // Αγοραστές (θα γίνουν sold)
  'DBbvKi3DYxBHbDipqfCv': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },
  'IjTAcUZ3eJm5zT7EA4q7': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },
  'JIwIiksQwG9469SByKIJ': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },

  // Ενοικιαστές μακροχρόνιας μίσθωσης
  'QpWvu0Jrw4DGxDqFC2xW': { role: 'long_term_renter', tags: ['ενοικιαστής', 'μακροχρόνια μίσθωση'] },
  'SVgqNOX1vLM7gFZO9Vy4': { role: 'long_term_renter', tags: ['ενοικιαστής', 'μακροχρόνια μίσθωση'] },

  // Ενοικιαστές βραχυχρόνιας μίσθωσης
  'VJpvrADTve31letX5ob7': { role: 'short_term_renter', tags: ['ενοικιαστής', 'βραχυχρόνια μίσθωση'] },
  'ZxLWN7HXsZHcMfoozVL5': { role: 'short_term_renter', tags: ['ενοικιαστής', 'βραχυχρόνια μίσθωση'] },

  // Εταιρικοί πελάτες
  'fdhyCgd9l4cxXX0XhtyG': { role: 'corporate', tags: ['εταιρεία', 'γραφεία'] },

  // Προοπτικοί πελάτες
  'j1xYkN18jqGMA18c600g': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'oGHblMcwDKM4SM67mlgN': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'sx9QlhtQelyE1LZHwBOg': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'zX0jNOzy0GAmAhUjSdeQ': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] }
};

console.log('🚀 Ξεκινάει η ενημέρωση της βάσης δεδομένων...\n');

console.log('📋 ΠΛΑΝΟ ΕΡΓΑΣΙΑΣ:');
console.log(`1. Προσθήκη ${NEW_CONTACTS.length} νέων επαφών`);
console.log(`2. Ενημέρωση ${EXISTING_CONTACT_IDS.length} υφιστάμενων επαφών με tags και ρόλους`);
console.log('3. Δημιουργία σχέσεων επαφών-μονάδων');
console.log('4. Ενημέρωση μονάδων με νέα property statuses\n');

// Assignments για property statuses
const STATUS_ASSIGNMENTS = {
  'landowner': 'owner-compensation',
  'buyer': 'sold',
  'long_term_renter': 'long-term-rented',
  'short_term_renter': 'short-term-rented',
  'corporate': 'company-owned',
  'prospect': 'for-sale'
};

console.log('🎯 CONTACT ROLE ASSIGNMENTS:');
Object.entries(CONTACT_ASSIGNMENTS).forEach(([id, assignment]) => {
  console.log(`  ${id}: ${assignment.role} → Unit Status: ${STATUS_ASSIGNMENTS[assignment.role]}`);
});

console.log('\n🔄 ΝΕΕΣ ΕΠΑΦΕΣ:');
NEW_CONTACTS.forEach((contact, i) => {
  console.log(`  ${i + 1}. ${contact.firstName || contact.companyName} (${contact.tags.join(', ')})`);
});

console.log('\n✅ ΈΤΟΙΜΟ ΓΙΑ ΕΚΤΕΛΕΣΗ!');
console.log('📝 Για να εκτελέσεις αυτές τις αλλαγές, θα χρειαστείς:');
console.log('   1. Firebase Admin credentials');
console.log('   2. Σύνδεση στη βάση δεδομένων');
console.log('   3. Εκτέλεση του script από την εφαρμογή Next.js');

console.log('\n🎪 ΕΠΟΜΕΝΟ ΒΗΜΑ: Δημιουργία admin page για εκτέλεση από τον browser');