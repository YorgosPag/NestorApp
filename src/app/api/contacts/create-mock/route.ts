import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

const mockContacts = [
  {
    firstName: 'Γιώργος',
    lastName: 'Παπαδόπουλος',
    phone: '+30 6974123456',
    email: 'giorgos.papadopoulos@example.com',
    type: 'individual',
    profession: 'Μηχανικός',
    city: 'Θεσσαλονίκη'
  },
  {
    firstName: 'Μαρία',
    lastName: 'Νικολάου',
    phone: '+30 6975234567',
    email: 'maria.nikolaou@example.com',
    type: 'individual',
    profession: 'Λογίστρια',
    city: 'Αθήνα'
  },
  {
    firstName: 'Δημήτρης',
    lastName: 'Κωνσταντίνου',
    phone: '+30 6976345678',
    email: 'dimitris.konstantinou@example.com',
    type: 'individual',
    profession: 'Επιχειρηματίας',
    city: 'Πάτρα'
  },
  {
    firstName: 'Άννα',
    lastName: 'Παπαγιάννη',
    phone: '+30 6977456789',
    email: 'anna.papagianni@example.com',
    type: 'individual',
    profession: 'Γιατρός',
    city: 'Θεσσαλονίκη'
  },
  {
    firstName: 'Νίκος',
    lastName: 'Αθανασίου',
    phone: '+30 6978567890',
    email: 'nikos.athanasiou@example.com',
    type: 'individual',
    profession: 'Δικηγόρος',
    city: 'Λάρισα'
  },
  {
    firstName: 'Ελένη',
    lastName: 'Μιχαηλίδου',
    phone: '+30 6979678901',
    email: 'eleni.michailidou@example.com',
    type: 'individual',
    profession: 'Αρχιτέκτονας',
    city: 'Βόλος'
  },
  {
    firstName: 'Κώστας',
    lastName: 'Δημητρίου',
    phone: '+30 6980789012',
    email: 'kostas.dimitriou@example.com',
    type: 'individual',
    profession: 'Εκπαιδευτικός',
    city: 'Ιωάννινα'
  },
  {
    firstName: 'Σοφία',
    lastName: 'Γεωργίου',
    phone: '+30 6981890123',
    email: 'sofia.georgiou@example.com',
    type: 'individual',
    profession: 'Φαρμακοποιός',
    city: 'Κομοτηνή'
  }
];

// Function to generate Firestore-style random IDs
function generateFirestoreId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST() {
  try {
    console.log('📇 Creating real contacts with proper random IDs...');

    if (!adminDb) {
      return NextResponse.json({
        error: 'Firebase Admin SDK not initialized'
      }, { status: 500 });
    }

    // 1. First, delete old customer_xxx contacts
    console.log('🗑️ Cleaning up old customer_xxx contacts...');
    const oldContactIds = [
      'customer_001', 'customer_002', 'customer_003', 'customer_004',
      'customer_005', 'customer_006', 'customer_007', 'customer_008'
    ];

    for (const oldId of oldContactIds) {
      try {
        await adminDb.collection('contacts').doc(oldId).delete();
        console.log(`🗑️ Deleted old contact: ${oldId}`);
      } catch (error) {
        console.log(`⚠️ Contact ${oldId} not found (already deleted)`);
      }
    }

    // 2. Generate proper random IDs like other contacts in the database
    const createdContacts = [];
    const contactIds = Array.from({ length: 8 }, () => generateFirestoreId());

    for (let i = 0; i < mockContacts.length; i++) {
      const contact = mockContacts[i];
      const contactId = contactIds[i];

      try {
        const contactData = {
          ...contact,
          id: contactId,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'active',
          isFavorite: false,
          serviceType: 'individual',
          // Προσθέτω όλα τα απαραίτητα fields
          phones: [
            {
              countryCode: '+30',
              number: contact.phone.replace('+30 ', '').replace(/\s/g, ''),
              type: 'mobile',
              label: 'Προσωπικό',
              isPrimary: true
            }
          ],
          emails: [
            {
              email: contact.email,
              type: 'personal',
              label: 'Προσωπικό',
              isPrimary: true
            }
          ],
          serviceAddress: {
            city: contact.city,
            street: '',
            number: '',
            postalCode: ''
          },
          workAddress: '',
          notes: `Δημιουργήθηκε αυτόματα για development - Πελάτης ${i + 1}`,
          // Άλλα default fields
          companyName: '',
          companyVatNumber: '',
          vatNumber: '',
          amka: '',
          birthDate: '',
          fatherName: '',
          motherName: '',
          documents: {},
          multiplePhotos: [],
          multiplePhotoURLs: [],
          socialMedia: {
            facebook: '',
            instagram: '',
            linkedin: '',
            twitter: ''
          },
          websites: []
        };

        // Δημιουργώ το contact με το ID που χρησιμοποιούν τα units
        await adminDb.collection('contacts').doc(contactId).set(contactData);

        createdContacts.push({
          id: contactId,
          name: `${contact.firstName} ${contact.lastName}`,
          phone: contact.phone,
          email: contact.email,
          city: contact.city,
          profession: contact.profession
        });

        console.log(`✅ Created contact: ${contact.firstName} ${contact.lastName} (${contactId})`);

      } catch (error) {
        console.error(`❌ Error creating contact ${i + 1}:`, error);
      }
    }

    // 3. Update units to use new random IDs
    console.log('🔗 Updating units with new contact IDs...');

    // Get all sold units that currently use old customer_xxx IDs
    const unitsSnapshot = await adminDb.collection('units')
      .where('status', '==', 'sold')
      .get();

    let updatedUnits = 0;
    const oldToNewMapping: { [oldId: string]: string } = {};

    // Create mapping from old IDs to new IDs
    for (let i = 0; i < oldContactIds.length; i++) {
      oldToNewMapping[oldContactIds[i]] = contactIds[i];
    }

    for (const unitDoc of unitsSnapshot.docs) {
      const unitData = unitDoc.data();
      const currentSoldTo = unitData.soldTo;

      // If unit uses old customer_xxx ID, update it to new random ID
      if (currentSoldTo && oldToNewMapping[currentSoldTo]) {
        const newContactId = oldToNewMapping[currentSoldTo];

        try {
          await adminDb.collection('units').doc(unitDoc.id).update({
            soldTo: newContactId
          });

          console.log(`🔗 Updated unit ${unitDoc.id}: ${currentSoldTo} → ${newContactId}`);
          updatedUnits++;
        } catch (error) {
          console.error(`❌ Failed to update unit ${unitDoc.id}:`, error);
        }
      }
    }

    console.log(`✅ Updated ${updatedUnits} units with new contact IDs`);
    console.log(`✅ Successfully created ${createdContacts.length} real contacts with proper random IDs!`);

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdContacts.length} real contacts with proper IDs and updated ${updatedUnits} units`,
      contacts: createdContacts,
      contactsCount: createdContacts.length,
      updatedUnits: updatedUnits,
      mapping: oldToNewMapping
    });

  } catch (error) {
    console.error('❌ Error creating mock contacts:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to create contacts in database'
    }, { status: 500 });
  }
}