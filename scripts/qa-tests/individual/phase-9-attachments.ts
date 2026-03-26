/**
 * PHASE 8: ATTACHMENTS — Profile photo, gallery photo, document upload via AI agent
 *
 * Google Test Matrix: Tests attach_file_to_contact tool.
 * Pre-seeds FileRecords in Firestore, then sends text messages with [Συνημμένο]
 * metadata so the AI agent calls attach_file_to_contact.
 *
 * Tests:
 *   A-01: Profile photo → photoURL + multiplePhotoURLs
 *   A-02: Gallery photo → multiplePhotoURLs only
 *   A-03: Document → AI auto-classification + file promotion
 *   A-04: No fileRecordId → graceful rejection
 */

import {
  db,
  seedFileRecord,
  assertExists,
  type QATestCase,
} from '../qa-test-runner';

const FIRST = 'Δημήτριος';
const FULL = `${FIRST} Τεστίδης`;

// File IDs for pre-seeded records (must match enterprise-id prefix 'file_')
const PROFILE_PHOTO_ID = 'file_qa_profile_001';
const GALLERY_PHOTO_ID = 'file_qa_gallery_001';
const DOCUMENT_ID = 'file_qa_document_001';

async function getContact(ctx: { state: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
  const id = ctx.state.contactId as string | undefined;
  if (!id) return null;
  const snap = await db.collection('contacts').doc(id).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

async function getFileRecord(fileId: string): Promise<Record<string, unknown> | null> {
  const snap = await db.collection('files').doc(fileId).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

export const attachmentTests: QATestCase[] = [
  // ── Pre-seed FileRecords ────────────────────────────────────────────
  {
    id: 'A-00', name: 'Pre-seed FileRecords',
    userMessage: `Πες μου τι στοιχεία έχει ο ${FIRST}`,
    assertions: async (ctx) => {
      // Get the contact's companyId to match FileRecords
      const contact = await getContact(ctx);
      const companyId = String(contact?.companyId ?? 'pagonis-87766');

      // Seed 3 FileRecords for the remaining tests
      await seedFileRecord({
        fileId: PROFILE_PHOTO_ID,
        filename: 'profile-photo.jpg',
        contentType: 'image/jpeg',
        companyId,
      });
      await seedFileRecord({
        fileId: GALLERY_PHOTO_ID,
        filename: 'gallery-photo.jpg',
        contentType: 'image/jpeg',
        companyId,
      });
      await seedFileRecord({
        fileId: DOCUMENT_ID,
        filename: 'tautotita-scan.pdf',
        contentType: 'application/pdf',
        companyId,
      });

      // Verify seeds
      const f1 = await getFileRecord(PROFILE_PHOTO_ID);
      const f2 = await getFileRecord(GALLERY_PHOTO_ID);
      const f3 = await getFileRecord(DOCUMENT_ID);
      return [
        assertExists('profile FileRecord', f1),
        assertExists('gallery FileRecord', f2),
        assertExists('document FileRecord', f3),
      ];
    },
  },

  // ── A-01: Profile Photo ─────────────────────────────────────────────
  {
    id: 'A-01', name: 'Profile Photo',
    userMessage: `[Συνημμένο Φωτογραφία: profile-photo.jpg, fileRecordId: ${PROFILE_PHOTO_ID}]\n\nΒάλε αυτή τη φωτογραφία ως φωτογραφία προφίλ στον ${FULL}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const photoURL = d.photoURL as string | undefined;
      const multiplePhotos = d.multiplePhotoURLs as string[] | undefined;
      return [
        { label: 'photoURL set', passed: !!photoURL && photoURL.includes('profile-photo'), expected: 'contains profile-photo', actual: String(photoURL ?? 'null') },
        { label: 'multiplePhotoURLs includes profile', passed: !!multiplePhotos && multiplePhotos.length >= 1, expected: '>= 1 photo', actual: `${multiplePhotos?.length ?? 0} photos` },
      ];
    },
  },

  // ── A-02: Gallery Photo ─────────────────────────────────────────────
  {
    id: 'A-02', name: 'Gallery Photo',
    userMessage: `[Συνημμένο Φωτογραφία: gallery-photo.jpg, fileRecordId: ${GALLERY_PHOTO_ID}]\n\nΠρόσθεσε αυτή τη φωτογραφία στη γκαλερί του ${FULL}`,
    assertions: async (ctx) => {
      const d = await getContact(ctx);
      if (!d) return [{ label: 'Contact', passed: false, expected: 'exists', actual: 'null' }];
      const multiplePhotos = d.multiplePhotoURLs as string[] | undefined;
      return [
        { label: 'multiplePhotoURLs >= 2', passed: !!multiplePhotos && multiplePhotos.length >= 2, expected: '>= 2 photos', actual: `${multiplePhotos?.length ?? 0} photos` },
        { label: 'gallery photo in array', passed: !!multiplePhotos?.some((u) => u.includes('gallery-photo')), expected: 'gallery-photo URL', actual: JSON.stringify(multiplePhotos?.slice(-1)) },
      ];
    },
  },

  // ── A-03: Document (auto-classify) ──────────────────────────────────
  {
    id: 'A-03', name: 'Document (auto-classify)',
    userMessage: `[Συνημμένο Έγγραφο: tautotita-scan.pdf, fileRecordId: ${DOCUMENT_ID}]\n\nΑυτό είναι η ταυτότητα του ${FULL}, αποθήκευσέ την`,
    assertions: async (ctx) => {
      // Check that the FileRecord was promoted (entityId set to contact)
      const fileRecord = await getFileRecord(DOCUMENT_ID);
      if (!fileRecord) return [{ label: 'FileRecord', passed: false, expected: 'exists', actual: 'null' }];
      const contactId = ctx.state.contactId as string;
      return [
        { label: 'entityId → contact', passed: String(fileRecord.entityId ?? '') === contactId, expected: contactId, actual: String(fileRecord.entityId ?? 'null') },
        { label: 'entityType → contacts', passed: String(fileRecord.entityType ?? '') === 'contacts', expected: 'contacts', actual: String(fileRecord.entityType ?? 'null') },
        assertExists('status updated', fileRecord.status),
      ];
    },
  },

  // ── A-04: No fileRecordId → graceful handling ───────────────────────
  {
    id: 'A-04', name: 'No fileRecordId → graceful rejection',
    userMessage: `Βάλε φωτογραφία προφίλ στον ${FULL}`,
    assertions: async (ctx) => {
      // Without [Συνημμένο], the AI should NOT hallucinate a file attachment
      // It should ask for a photo or say it can't proceed
      const response = ctx.aiResponse.toLowerCase();
      const noHallucination = !ctx.toolCalls.some((tc) => tc.name === 'attach_file_to_contact');
      return [
        { label: 'no attach_file_to_contact call', passed: noHallucination, expected: 'no attachment tool call', actual: ctx.toolCalls.map((t) => t.name).join(', ') || 'none' },
        { label: 'AI asks for photo', passed: response.includes('φωτογραφ') || response.includes('αρχείο') || response.includes('στείλ') || response.includes('συνημμένο'), expected: 'mentions photo/file needed', actual: ctx.aiResponse.substring(0, 100) },
      ];
    },
  },
];
