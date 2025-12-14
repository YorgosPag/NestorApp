/**
 * Create More Projects for All Companies
 * Δημιουργεί projects για όλες τις εταιρείες που έχουμε στη βάση
 */

// Use Client SDK like other seed scripts
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, addDoc, doc, setDoc } = require('firebase/firestore');

// Firebase configuration (same as client)
const firebaseConfig = {
  apiKey: "AIzaSyCcOlFWq8lWQqZjjf9EfebWKZVfV3jzuoc",
  authDomain: "nestor-pagonis.firebaseapp.com",
  projectId: "nestor-pagonis",
  storageBucket: "nestor-pagonis.firebasestorage.app",
  messagingSenderId: "83258530013",
  appId: "1:83258530013:web:a30b0b35d7fd6ad2d59c57"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const projectTemplates = [
  {
    name: "Κέντρο Εμπορίου Αθήνας",
    title: "Ανέγερση σύγχρονου εμπορικού κέντρου στο κέντρο της Αθήνας",
    address: "Πανεπιστημίου 42, Αθήνα",
    city: "Αθήνα",
    status: "planning",
    progress: 15,
    startDate: "2024-01-15",
    completionDate: "2026-12-30",
    totalValue: 2500000,
    totalArea: 3500.5,
    buildings: [
      {
        id: "building_1_commercial",
        name: "ΚΤΙΡΙΟ Α - Καταστήματα",
        description: "Κύριο κτίριο με 24 καταστήματα και χώρους εστίασης",
        status: "planning",
        totalArea: 2800.5,
        units: 24,
        floors: [
          { id: "floor_0", name: "Ισόγειο", number: 0, units: 12 },
          { id: "floor_1", name: "1ος Όροφος", number: 1, units: 8 },
          { id: "floor_2", name: "2ος Όροφος", number: 2, units: 4 }
        ]
      },
      {
        id: "building_2_parking",
        name: "ΚΤΙΡΙΟ Β - Πάρκινγκ",
        description: "Υπόγειο πάρκινγκ 3 επιπέδων",
        status: "planning",
        totalArea: 700,
        units: 150,
        floors: [
          { id: "floor_-1", name: "Υπόγειο 1", number: -1, units: 50 },
          { id: "floor_-2", name: "Υπόγειο 2", number: -2, units: 50 },
          { id: "floor_-3", name: "Υπόγειο 3", number: -3, units: 50 }
        ]
      }
    ]
  },
  {
    name: "Βιομηχανικό Πάρκο Θεσσαλονίκης",
    title: "Ανάπτυξη σύγχρονου βιομηχανικού πάρκου στη Θεσσαλονίκη",
    address: "ΒΙΠΕ Σίνδου, Θεσσαλονίκη",
    city: "Θεσσαλονίκη",
    status: "in_progress",
    progress: 45,
    startDate: "2023-06-01",
    completionDate: "2025-10-15",
    totalValue: 1800000,
    totalArea: 5200.75,
    buildings: [
      {
        id: "building_1_factory",
        name: "ΚΤΙΡΙΟ Α - Κύρια Παραγωγή",
        description: "Κύριο βιομηχανικό κτίριο παραγωγής",
        status: "construction",
        totalArea: 3500.5,
        units: 12,
        floors: [
          { id: "floor_0", name: "Ισόγειο", number: 0, units: 8 },
          { id: "floor_1", name: "1ος Όροφος", number: 1, units: 4 }
        ]
      },
      {
        id: "building_2_warehouse",
        name: "ΚΤΙΡΙΟ Β - Αποθήκες",
        description: "Αποθηκευτικοί χώροι και logistics",
        status: "construction",
        totalArea: 1700.25,
        units: 6,
        floors: [
          { id: "floor_0", name: "Ισόγειο", number: 0, units: 6 }
        ]
      }
    ]
  },
  {
    name: "Πολυκατοικία Κολωνάκι",
    title: "Ανακαίνιση ιστορικού κτιρίου στο Κολωνάκι",
    address: "Σκουφά 25, Κολωνάκι",
    city: "Αθήνα",
    status: "completed",
    progress: 100,
    startDate: "2022-03-20",
    completionDate: "2024-08-15",
    totalValue: 1200000,
    totalArea: 850.5,
    buildings: [
      {
        id: "building_1_kolonaki",
        name: "Ιστορικό Κτίριο Σκουφά",
        description: "Ανακαινισμένη πολυκατοικία με διαμερίσματα υψηλών προδιαγραφών",
        status: "active",
        totalArea: 850.5,
        units: 6,
        floors: [
          { id: "floor_0", name: "Ισόγειο", number: 0, units: 1 },
          { id: "floor_1", name: "1ος Όροφος", number: 1, units: 2 },
          { id: "floor_2", name: "2ος Όροφος", number: 2, units: 2 },
          { id: "floor_3", name: "3ος Όροφος", number: 3, units: 1 }
        ]
      }
    ]
  }
];

async function createProjectsForAllCompanies() {
  try {
    console.log('🏗️ Creating projects for all companies...');

    // 1. Πάρε όλες τις εταιρείες
    const contactsQuery = query(
      collection(db, 'contacts'),
      where('type', '==', 'company'),
      where('status', '==', 'active')
    );
    const contactsSnapshot = await getDocs(contactsQuery);

    if (contactsSnapshot.docs.length === 0) {
      console.log('❌ No companies found!');
      return;
    }

    console.log(`🏢 Found ${contactsSnapshot.docs.length} companies`);

    const companies = contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 2. Δημιούργησε projects για κάθε εταιρεία
    let projectIndex = 1002; // Starting from 1002 since 1001 exists

    for (const company of companies) {
      console.log(`\n🏢 Creating projects for: ${company.companyName}`);

      // Δημιούργησε 1 project για κάθε εταιρεία (από τα templates)
      for (let i = 0; i < Math.min(projectTemplates.length, 1); i++) {
        const template = projectTemplates[i % projectTemplates.length];
        const projectId = `${projectIndex}`;

        const project = {
          ...template,
          companyId: company.id, // ΣΩΣΤΟ company ID!
          company: company.companyName,
          lastUpdate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Customize based on company
          name: `${template.name} - ${company.companyName}`,
        };

        try {
          await setDoc(doc(db, 'projects', projectId), project);
          console.log(`✅ Created project: ${project.name} (ID: ${projectId})`);
          projectIndex++;
        } catch (error) {
          console.error(`❌ Failed to create project for ${company.companyName}:`, error);
        }
      }
    }

    console.log('\n🎉 All projects created successfully!');

    // 3. Επαλήθευση
    console.log('\n📊 Final verification:');
    const allProjectsSnapshot = await getDocs(collection(db, 'projects'));

    console.log(`🏗️ Total projects in database: ${allProjectsSnapshot.docs.length}`);

    allProjectsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`🏗️ Project: ${data.name} -> Company: ${data.company} -> CompanyId: ${data.companyId}`);
    });

  } catch (error) {
    console.error('❌ Error creating projects:', error);
    throw error;
  }
}

// Run the script
createProjectsForAllCompanies()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });