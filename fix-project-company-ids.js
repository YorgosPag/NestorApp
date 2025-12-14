/**
 * Fix Project Company IDs
 * Ενημερώνει τα projects να χρησιμοποιούν τα σωστά companyIds από τη contacts collection
 */

// Use Client SDK like other seed scripts
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, updateDoc, writeBatch } = require('firebase/firestore');

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

async function fixProjectCompanyIds() {
  try {
    console.log('🔧 Starting to fix project company IDs...');

    // 1. Πάρε όλες τις εταιρείες από contacts
    const contactsQuery = query(
      collection(db, 'contacts'),
      where('type', '==', 'company'),
      where('status', '==', 'active')
    );
    const contactsSnapshot = await getDocs(contactsQuery);

    console.log(`📁 Found ${contactsSnapshot.docs.length} companies in contacts`);

    const companyMapping = {};
    contactsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`🏢 Company: ${data.companyName} -> ID: ${doc.id}`);
      companyMapping[data.companyName] = doc.id;
    });

    // 2. Πάρε όλα τα projects
    const projectsSnapshot = await getDocs(collection(db, 'projects'));
    console.log(`🏗️ Found ${projectsSnapshot.docs.length} projects`);

    // 3. Διόρθωσε τα companyIds
    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const projectDoc of projectsSnapshot.docs) {
      const projectData = projectDoc.data();
      const companyName = projectData.company;
      const currentCompanyId = projectData.companyId;
      const correctCompanyId = companyMapping[companyName];

      if (correctCompanyId && currentCompanyId !== correctCompanyId) {
        console.log(`🔄 Updating project "${projectData.name}"`);
        console.log(`   Company: ${companyName}`);
        console.log(`   Old companyId: ${currentCompanyId}`);
        console.log(`   New companyId: ${correctCompanyId}`);

        const projectRef = doc(db, 'projects', projectDoc.id);
        batch.update(projectRef, {
          companyId: correctCompanyId,
          updatedAt: new Date().toISOString()
        });
        updatedCount++;
      } else if (!correctCompanyId) {
        console.log(`⚠️  No matching company found for: ${companyName}`);
      } else {
        console.log(`✅ Project "${projectData.name}" already has correct companyId`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Updated ${updatedCount} projects successfully!`);
    } else {
      console.log('ℹ️  No projects needed updating');
    }

    // 4. Επαλήθευση - δείξε τα τελικά αποτελέσματα
    console.log('\n📊 Final verification:');
    const finalProjectsSnapshot = await getDocs(collection(db, 'projects'));

    for (const projectDoc of finalProjectsSnapshot.docs) {
      const data = projectDoc.data();
      console.log(`🏗️ Project: ${data.name} -> Company: ${data.company} -> CompanyId: ${data.companyId}`);
    }

    console.log('\n🎉 Script completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing project company IDs:', error);
    throw error;
  }
}

// Run the script
fixProjectCompanyIds()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });