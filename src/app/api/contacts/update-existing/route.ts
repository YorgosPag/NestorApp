import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { contactAssignments } = await request.json();

    console.log('🔄 Starting existing contacts update via API...');
    console.log(`📝 Processing ${Object.keys(contactAssignments).length} contacts`);

    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin SDK not initialized'
      }, { status: 500 });
    }

    const updatedContacts: string[] = [];
    const errors: { contactId: string; error: string }[] = [];

    for (const [contactId, assignment] of Object.entries(contactAssignments)) {
      try {
        const updateData = {
          tags: (assignment as any).tags,
          role: (assignment as any).role,
          updatedAt: new Date()
        };

        await adminDb.collection('contacts').doc(contactId).update(updateData);
        updatedContacts.push(contactId);

        console.log(`✅ Updated contact: ${contactId} → ${(assignment as any).role} (${(assignment as any).tags.join(', ')})`);

      } catch (contactError) {
        const errorMessage = contactError instanceof Error ? contactError.message : 'Unknown error';
        console.error(`❌ Error updating contact ${contactId}:`, errorMessage);

        errors.push({
          contactId,
          error: errorMessage
        });
      }
    }

    console.log(`✅ Successfully updated ${updatedContacts.length}/${Object.keys(contactAssignments).length} contacts`);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedContacts.length} existing contacts`,
      updatedContacts,
      contactsCount: updatedContacts.length,
      requestedCount: Object.keys(contactAssignments).length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Error in update-existing API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to update existing contacts'
    }, { status: 500 });
  }
}