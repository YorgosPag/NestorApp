import { NextResponse } from 'next/server';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * 🔧 FIREBASE COLLECTIONS SETUP API
 *
 * Δημιουργεί τα απαραίτητα Firebase collections για το Contact Relationships system
 *
 * @route POST /api/setup/firebase-collections
 */
export async function POST() {
  try {
    console.log('🔧 Setting up Firebase collections...');

    // 1. Δημιουργία collection 'contact_relationships'
    const testRelationshipRef = doc(collection(db, 'contact_relationships'), 'setup-test-doc');

    const testRelationship = {
      sourceContactId: 'setup-test-source',
      targetContactId: 'setup-test-target',
      relationshipType: 'employee',
      status: 'active',
      position: 'Test Employee',
      department: 'Setup Department',
      notes: 'Auto-created document για collection initialization',
      createdAt: serverTimestamp(),
      createdBy: 'system-setup',
      lastModifiedAt: serverTimestamp(),
      lastModifiedBy: 'system-setup'
    };

    console.log('📝 Creating test relationship document...');
    await setDoc(testRelationshipRef, testRelationship);

    // 2. Διαγραφή του test document (το collection παραμένει)
    console.log('🗑️ Removing test document (collection remains)...');
    await deleteDoc(testRelationshipRef);

    console.log('✅ Firebase collections setup completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Firebase collections created successfully',
      collections: [
        {
          name: 'contact_relationships',
          status: 'created',
          description: 'Collection για contact relationships - ready for use'
        }
      ]
    });

  } catch (error) {
    console.error('❌ Firebase collections setup failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to setup Firebase collections',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}