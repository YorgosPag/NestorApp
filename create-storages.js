/**
 * 📦 STORAGE UNITS DATA SEEDER
 *
 * Δημιουργεί ρεαλιστικές αποθήκες στο Firestore collection 'storage_units'
 * Χρησιμοποιεί το κεντρικοποιημένο Enterprise ID System για random IDs
 *
 * Run with: node create-storages.js
 */

// Import Firebase client SDK με CommonJS
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');
const { randomUUID } = require('crypto');

// Firebase config (same as in your app)
const firebaseConfig = {
  apiKey: "AIzaSyBXeJkJnGtLa7QhTwGb_hBUqBsM-QZcMqg",
  authDomain: "pagonis-87766.firebaseapp.com",
  databaseURL: "https://pagonis-87766-default-rtdb.firebaseio.com",
  projectId: "pagonis-87766",
  storageBucket: "pagonis-87766.firebasestorage.app",
  messagingSenderId: "901506134354",
  appId: "1:901506134354:web:85b3ad8b66d9e1e69a0b5b",
  measurementId: "G-V06Y10DMWS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enterprise ID Generator (simplified για Node.js)
function generateStorageId() {
  return `stor_${randomUUID()}`;
}

// Realistic storage data
const storageData = [
  {
    name: 'Αποθήκη Υπογείου Α1',
    type: 'large',
    status: 'available',
    building: 'ΚΤΙΡΙΟ Α',
    floor: 'Υπόγειο -1',
    area: 35.5,
    price: 28500,
    description: 'Μεγάλη αποθήκη με άμεση πρόσβαση από γκαράζ. Ιδανική για μεγάλα αντικείμενα.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Παλαιολόγου Πολυκατοικία',
    features: ['Ηλεκτρικό ρεύμα', 'Φωτισμός', 'Αεροθάλαμος', 'Ασφάλεια'],
    coordinates: { x: 15, y: 8 },
    linkedProperty: null,
    notes: 'Εξαιρετική κατάσταση, πρόσφατα ανακαινισμένη'
  },
  {
    name: 'Storage Μεσαίας Επιφάνειας Β2',
    type: 'basement',
    status: 'occupied',
    building: 'ΚΤΙΡΙΟ Β',
    floor: 'Υπόγειο -2',
    area: 18.3,
    price: 15800,
    description: 'Υπόγεια αποθήκη με ελεγχόμενη υγρασία. Κατάλληλη για ευαίσθητα αντικείμενα.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Μεγάλου Αλεξάνδρου Συγκρότημα',
    features: ['Ηλεκτρικό ρεύμα', 'Αφυγραντήρας', 'Συναγερμός'],
    coordinates: { x: 22, y: 12 },
    linkedProperty: 'Β2.3',
    owner: 'ΚΩΝΣΤΑΝΤΙΝΟΣ ΔΗΜΗΤΡΙΟΥ',
    notes: 'Συνδεδεμένη με διαμέρισμα Β2.3'
  },
  {
    name: 'Μικρή Αποθήκη Γ1',
    type: 'small',
    status: 'available',
    building: 'ΚΤΙΡΙΟ Γ',
    floor: 'Ισόγειο',
    area: 8.7,
    price: 7200,
    description: 'Συμπαγής αποθήκη ισογείου, εύκολη πρόσβαση.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Τσιμισκή Εμπορικό Κέντρο',
    features: ['Ηλεκτρικό ρεύμα', 'Φωτισμός'],
    coordinates: { x: 8, y: 5 },
    linkedProperty: null,
    notes: 'Ιδανική για προσωπικά είδη'
  },
  {
    name: 'Premium Storage Δ3',
    type: 'special',
    status: 'reserved',
    building: 'ΚΤΙΡΙΟ Δ',
    floor: 'Υπόγειο -1',
    area: 42.8,
    price: 35600,
    description: 'Αποθήκη υψηλών προδιαγραφών με κλιματισμό και συστήματα ασφαλείας.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Παλαιολόγου Πολυκατοικία',
    features: ['Κλιματισμός', '24ωρη Φύλαξη', 'CCTV', 'Πυρασφάλεια', 'Ηλεκτρικό ρεύμα'],
    coordinates: { x: 30, y: 18 },
    linkedProperty: null,
    notes: 'Κρατημένη για υψηλής αξίας αντικείμενα'
  },
  {
    name: 'Αποθήκη Ισογείου Ε1',
    type: 'ground',
    status: 'available',
    building: 'ΚΤΙΡΙΟ Ε',
    floor: 'Ισόγειο',
    area: 25.4,
    price: 19900,
    description: 'Αποθήκη ισογείου με άμεση πρόσβαση από την κεντρική είσοδο.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Μεγάλου Αλεξάνδρου Συγκρότημα',
    features: ['Ηλεκτρικό ρεύμα', 'Φυσικός φωτισμός', 'Εύκολη πρόσβαση'],
    coordinates: { x: 12, y: 10 },
    linkedProperty: null,
    notes: 'Πολύ βολική τοποθεσία'
  },
  {
    name: 'Compact Storage ΣΤ2',
    type: 'small',
    status: 'maintenance',
    building: 'ΚΤΙΡΙΟ ΣΤ',
    floor: 'Υπόγειο -1',
    area: 12.1,
    price: 9800,
    description: 'Μικρή αποθήκη σε διαδικασία αναβάθμισης.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Τσιμισκή Εμπορικό Κέντρο',
    features: ['Ηλεκτρικό ρεύμα'],
    coordinates: { x: 6, y: 15 },
    linkedProperty: null,
    notes: 'Υπό συντήρηση - διαθέσιμη σε 2 εβδομάδες'
  },
  {
    name: 'Αποθήκη Διπλής Χρήσης Ζ4',
    type: 'large',
    status: 'occupied',
    building: 'ΚΤΙΡΙΟ Ζ',
    floor: 'Υπόγειο -2',
    area: 48.9,
    price: 42000,
    description: 'Μεγάλη αποθήκη με δυνατότητα διαχωρισμού σε δύο τμήματα.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Παλαιολόγου Πολυκατοικία',
    features: ['Ηλεκτρικό ρεύμα', 'Φωτισμός', 'Αεροθάλαμος', 'Διαχωριστικός τοίχος'],
    coordinates: { x: 35, y: 22 },
    linkedProperty: 'Ζ4.1',
    owner: 'ΜΑΡΙΑ ΠΑΠΑΔΟΠΟΥΛΟΥ',
    notes: 'Χρησιμοποιείται ως workshop και αποθήκη'
  },
  {
    name: 'Mini Storage Η1',
    type: 'small',
    status: 'available',
    building: 'ΚΤΙΡΙΟ Η',
    floor: 'Υπόγειο -1',
    area: 6.3,
    price: 5400,
    description: 'Πολύ μικρή αποθήκη, οικονομική επιλογή.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Τσιμισκή Εμπορικό Κέντρο',
    features: ['Ηλεκτρικό ρεύμα'],
    coordinates: { x: 4, y: 8 },
    linkedProperty: null,
    notes: 'Ιδανική για έγγραφα και μικροαντικείμενα'
  },
  {
    name: 'Αποθήκη Γωνιακή Θ3',
    type: 'basement',
    status: 'reserved',
    building: 'ΚΤΙΡΙΟ Θ',
    floor: 'Υπόγειο -1',
    area: 29.7,
    price: 24300,
    description: 'Γωνιακή αποθήκη με άριστη αξιοποίηση χώρου.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Μεγάλου Αλεξάνδρου Συγκρότημα',
    features: ['Ηλεκτρικό ρεύμα', 'Φωτισμός', 'Ειδικός εξαερισμός'],
    coordinates: { x: 28, y: 16 },
    linkedProperty: null,
    notes: 'Κρατημένη από ενδιαφερόμενο - αναμένεται υπογραφή'
  },
  {
    name: 'Luxury Storage Ι5',
    type: 'special',
    status: 'available',
    building: 'ΚΤΙΡΙΟ Ι',
    floor: 'Ισόγειο',
    area: 38.2,
    price: 39500,
    description: 'Αποθήκη πολυτελείας με όλες τις σύγχρονες ανέσεις.',
    company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    project: 'Παλαιολόγου Πολυκατοικία',
    features: ['Κλιματισμός', 'Smart Lock', 'LED Φωτισμός', 'Συναγερμός', 'Ηλεκτρικό ρεύμα'],
    coordinates: { x: 25, y: 20 },
    linkedProperty: null,
    notes: 'Τελευταία τεχνολογία σε συστήματα ασφαλείας'
  }
];

async function createStorages() {
  console.log('🚀 Starting storage creation process...');

  try {
    for (const storage of storageData) {
      // Generate unique enterprise ID
      const storageId = generateStorageId();

      // Add timestamps
      const now = Timestamp.now();
      const storageDoc = {
        ...storage,
        id: storageId,
        createdAt: now,
        updatedAt: now,
        lastUpdated: now
      };

      // Add document with custom ID
      const docRef = await addDoc(collection(db, 'storage_units'), storageDoc);
      console.log(`📦 Created storage: ${storage.name} (${storageId})`);
    }

    console.log('✅ SUCCESS! All storages created successfully!');
    console.log(`📊 Total storages added: ${storageData.length}`);

    // Summary statistics
    const stats = {
      total: storageData.length,
      byType: {},
      byStatus: {},
      totalArea: 0,
      totalValue: 0
    };

    storageData.forEach(storage => {
      stats.byType[storage.type] = (stats.byType[storage.type] || 0) + 1;
      stats.byStatus[storage.status] = (stats.byStatus[storage.status] || 0) + 1;
      stats.totalArea += storage.area;
      stats.totalValue += storage.price;
    });

    console.log('\n📈 STATISTICS:');
    console.log('By Type:', stats.byType);
    console.log('By Status:', stats.byStatus);
    console.log(`Total Area: ${stats.totalArea.toFixed(1)} m²`);
    console.log(`Total Value: €${stats.totalValue.toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error creating storages:', error);
    process.exit(1);
  }

  console.log('\n🎉 Storage seeding completed! Ready to test the application.');
  process.exit(0);
}

// Run the seeder
createStorages();