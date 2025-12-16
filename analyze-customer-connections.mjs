// Ανάλυση συνδέσεων πελατών με πωληθέντα/δεσμευμένα ακίνητα
// Χρησιμοποιεί Firebase Client SDK για άμεση πρόσβαση στα δεδομένα

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

// 🏢 ENTERPRISE: Collections configuration (ES6 module version)
const COLLECTIONS = {
  CONTACTS: process.env.NEXT_PUBLIC_CONTACTS_COLLECTION || 'contacts',
  UNITS: process.env.NEXT_PUBLIC_UNITS_COLLECTION || 'units',
  PROJECTS: process.env.NEXT_PUBLIC_PROJECTS_COLLECTION || 'projects',
  BUILDINGS: process.env.NEXT_PUBLIC_BUILDINGS_COLLECTION || 'buildings'
};

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function analyzeCustomerConnections() {
  console.log('🔍 Ξεκινώ ανάλυση συνδέσεων πελατών...');

  try {
    // 1. Βρες τα κτίρια του project 1001
    console.log('\n🏢 Αναζήτηση κτιρίων για project 1001...');

    // Δοκίμασε με string ID πρώτα
    let buildingsQuery = query(collection(db, COLLECTIONS.BUILDINGS), where('projectId', '==', '1001'));
    let buildingsSnapshot = await getDocs(buildingsQuery);

    if (buildingsSnapshot.docs.length === 0) {
      console.log('🔄 Δοκιμάζω με number projectId...');
      buildingsQuery = query(collection(db, COLLECTIONS.BUILDINGS), where('projectId', '==', 1001));
      buildingsSnapshot = await getDocs(buildingsQuery);
    }

    console.log(`✅ Βρέθηκαν ${buildingsSnapshot.docs.length} κτίρια`);

    if (buildingsSnapshot.docs.length === 0) {
      console.log('❌ Δεν βρέθηκαν κτίρια για το project');
      return;
    }

    // 2. Βρες όλα τα units από αυτά τα κτίρια
    console.log('\n🏠 Αναζήτηση units...');
    const allUnits = [];

    for (const buildingDoc of buildingsSnapshot.docs) {
      const buildingId = buildingDoc.id;
      console.log(`🔍 Ψάχνω units για buildingId: ${buildingId}`);

      const unitsQuery = query(collection(db, COLLECTIONS.UNITS), where('buildingId', '==', buildingId));
      const unitsSnapshot = await getDocs(unitsQuery);

      const units = unitsSnapshot.docs.map(unitDoc => ({
        id: unitDoc.id,
        ...unitDoc.data()
      }));

      console.log(`   📦 Βρέθηκαν ${units.length} units στο κτίριο ${buildingId}`);
      allUnits.push(...units);
    }

    console.log(`✅ Σύνολο units: ${allUnits.length}`);

    // 3. Φιλτράρισμα sold και reserved units
    console.log('\n💰 Ανάλυση status units...');

    const soldUnits = allUnits.filter(unit => unit.status === 'sold');
    const reservedUnits = allUnits.filter(unit => unit.status === 'reserved');
    const availableUnits = allUnits.filter(unit => unit.status === 'available');
    const otherStatusUnits = allUnits.filter(unit => !['sold', 'reserved', 'available'].includes(unit.status));

    console.log(`   🟢 Πωληθέντα (sold): ${soldUnits.length}`);
    console.log(`   🟡 Δεσμευμένα (reserved): ${reservedUnits.length}`);
    console.log(`   ⚪ Διαθέσιμα (available): ${availableUnits.length}`);
    console.log(`   🔴 Άλλα status: ${otherStatusUnits.length}`);

    if (otherStatusUnits.length > 0) {
      console.log('   📋 Άλλα status που βρέθηκαν:');
      const statusCounts = {};
      otherStatusUnits.forEach(unit => {
        const status = unit.status || 'undefined';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`      - ${status}: ${count}`);
      });
    }

    // 4. Ελέγχω units με πελάτες (soldTo field)
    console.log('\n👥 Ανάλυση πελατών...');

    const unitsWithCustomers = allUnits.filter(unit => unit.soldTo);
    console.log(`   📊 Units με soldTo field: ${unitsWithCustomers.length}`);

    if (unitsWithCustomers.length > 0) {
      // Μέτρηση πελατών ανά status
      const customersByStatus = {};
      unitsWithCustomers.forEach(unit => {
        const status = unit.status || 'undefined';
        if (!customersByStatus[status]) {
          customersByStatus[status] = { count: 0, customerIds: new Set() };
        }
        customersByStatus[status].count++;
        customersByStatus[status].customerIds.add(unit.soldTo);
      });

      console.log('   📋 Κατανομή πελατών ανά status:');
      Object.entries(customersByStatus).forEach(([status, data]) => {
        console.log(`      - ${status}: ${data.count} units, ${data.customerIds.size} μοναδικοί πελάτες`);
      });

      // 5. Έλεγχος ότι τα customer IDs υπάρχουν στο contacts
      console.log('\n🔗 Έλεγχος συνδέσεων με contacts...');

      const uniqueCustomerIds = [...new Set(unitsWithCustomers.map(unit => unit.soldTo))];
      console.log(`   🎯 Μοναδικοί πελάτες προς έλεγχο: ${uniqueCustomerIds.length}`);

      const validCustomers = [];
      const invalidCustomers = [];

      // Ελέγχω κάθε customer ID
      for (const customerId of uniqueCustomerIds) {
        try {
          const contactDoc = await getDoc(doc(db, COLLECTIONS.CONTACTS, customerId));
          if (contactDoc.exists()) {
            const contactData = contactDoc.data();
            validCustomers.push({
              id: customerId,
              name: contactData.firstName && contactData.lastName
                ? `${contactData.firstName} ${contactData.lastName}`
                : contactData.companyName || contactData.email || 'Άγνωστο όνομα',
              email: contactData.email,
              phone: contactData.phones?.[0] || null,
              unitsCount: unitsWithCustomers.filter(unit => unit.soldTo === customerId).length
            });
          } else {
            invalidCustomers.push({
              id: customerId,
              unitsCount: unitsWithCustomers.filter(unit => unit.soldTo === customerId).length
            });
          }
        } catch (error) {
          console.error(`❌ Σφάλμα κατά τον έλεγχο customer ${customerId}:`, error.message);
          invalidCustomers.push({
            id: customerId,
            error: error.message,
            unitsCount: unitsWithCustomers.filter(unit => unit.soldTo === customerId).length
          });
        }
      }

      // 6. Αποτελέσματα
      console.log('\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ ΑΝΑΛΥΣΗΣ:');
      console.log('==========================================');

      console.log(`✅ ΕΓΚΥΡΕΣ ΣΥΝΔΕΣΕΙΣ: ${validCustomers.length} πελάτες`);
      if (validCustomers.length > 0) {
        validCustomers.forEach(customer => {
          console.log(`   👤 ${customer.name} (${customer.id})`);
          console.log(`      📧 Email: ${customer.email || 'Μη διαθέσιμο'}`);
          console.log(`      📞 Τηλέφωνο: ${customer.phone || 'Μη διαθέσιμο'}`);
          console.log(`      🏠 Μονάδες: ${customer.unitsCount}`);
          console.log('');
        });
      }

      console.log(`❌ ΠΡΟΒΛΗΜΑΤΙΚΕΣ ΣΥΝΔΕΣΕΙΣ: ${invalidCustomers.length} πελάτες`);
      if (invalidCustomers.length > 0) {
        invalidCustomers.forEach(customer => {
          console.log(`   🚫 Customer ID: ${customer.id}`);
          console.log(`      🏠 Μονάδες: ${customer.unitsCount}`);
          if (customer.error) {
            console.log(`      ❌ Σφάλμα: ${customer.error}`);
          }
          console.log('');
        });
      }

      console.log('==========================================');
      console.log(`📈 ΣΥΝΟΛΙΚΑ ΣΤΑΤΙΣΤΙΚΑ:`);
      console.log(`   🏠 Σύνολο μονάδων: ${allUnits.length}`);
      console.log(`   💰 Πωληθέντες: ${soldUnits.length}`);
      console.log(`   🟡 Δεσμευμένες: ${reservedUnits.length}`);
      console.log(`   👥 Μονάδες με πελάτες: ${unitsWithCustomers.length}`);
      console.log(`   ✅ Έγκυρες συνδέσεις: ${validCustomers.length} πελάτες`);
      console.log(`   ❌ Προβληματικές: ${invalidCustomers.length} πελάτες`);

      if (invalidCustomers.length > 0) {
        console.log('\n🔧 ΠΡΟΤΑΣΕΙΣ ΔΙΟΡΘΩΣΗΣ:');
        console.log('- Ελέγξτε αν τα contact IDs είναι σωστά');
        console.log('- Δημιουργήστε τα contacts που λείπουν');
        console.log('- Διορθώστε τα soldTo fields στις units');
      }

    } else {
      console.log('⚠️ Δεν βρέθηκαν units με πελάτες (soldTo field)');
    }

  } catch (error) {
    console.error('❌ Σφάλμα κατά την ανάλυση:', error);
  }
}

// Τρέξε την ανάλυση
analyzeCustomerConnections()
  .then(() => {
    console.log('\n✅ Ανάλυση ολοκληρώθηκε!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Σφάλμα:', error);
    process.exit(1);
  });