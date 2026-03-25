/**
 * ATTACHMENT HANDLER TESTS
 *
 * Tests file attachment to contacts: profile photo, gallery photo, document.
 * Verifies RBAC, FileRecord validation, company isolation, Firestore writes.
 *
 * @see ADR-055 (Enterprise Attachment Ingestion)
 * @module __tests__/handlers/attachment-handler
 */

import '../setup';

import { AttachmentHandler } from '../../handlers/attachment-handler';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';
import { createMockFirestore } from '../test-utils/mock-firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: {
    CONTACTS: 'contacts',
    FILES: 'files',
  },
}));

jest.mock('@/config/domain-constants', () => ({
  FILE_STATUS: { READY: 'ready' },
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    arrayUnion: jest.fn((...items: unknown[]) => ({ _arrayUnion: items })),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const COMPANY_ID = 'test-company-001';

function setupFirestore(
  files: Record<string, Record<string, unknown>> = {},
  contacts: Record<string, Record<string, unknown>> = {},
) {
  const kit = createMockFirestore();
  kit.seedCollection('files', files);
  kit.seedCollection('contacts', contacts);
  (getAdminFirestore as jest.Mock).mockReturnValue(kit.instance);
  return kit;
}

const VALID_FILE = {
  downloadUrl: 'https://storage.example.com/photo.jpg',
  originalFilename: 'photo.jpg',
  contentType: 'image/jpeg',
};

const VALID_CONTACT = {
  companyId: COMPANY_ID,
  displayName: 'Δημήτριος',
  firstName: 'Δημήτριος',
};

// ============================================================================
// TESTS
// ============================================================================

describe('AttachmentHandler', () => {
  let handler: AttachmentHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new AttachmentHandler();
  });

  // ==========================================================================
  // RBAC
  // ==========================================================================

  describe('RBAC', () => {
    it('should BLOCK non-admin users', async () => {
      setupFirestore({ file_001: VALID_FILE }, { cont_001: VALID_CONTACT });
      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'profile_photo' },
        createCustomerContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin-only');
    });

    it('should ALLOW admin users', async () => {
      setupFirestore({ file_001: VALID_FILE }, { cont_001: VALID_CONTACT });
      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'profile_photo' },
        createAdminContext(),
      );
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('Validation', () => {
    it('should reject unknown tool name', async () => {
      const result = await handler.execute(
        'unknown_tool',
        {},
        createAdminContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown');
    });

    it('should reject missing contactId', async () => {
      const result = await handler.execute(
        'attach_file_to_contact',
        { fileRecordId: 'file_001', purpose: 'profile_photo' },
        createAdminContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('contactId');
    });

    it('should reject missing fileRecordId', async () => {
      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', purpose: 'profile_photo' },
        createAdminContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('fileRecordId');
    });

    it('should reject invalid purpose', async () => {
      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'invalid' },
        createAdminContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('purpose');
    });
  });

  // ==========================================================================
  // FILE RECORD VERIFICATION
  // ==========================================================================

  describe('FileRecord verification', () => {
    it('should reject when FileRecord not found', async () => {
      setupFirestore({}, { cont_001: VALID_CONTACT });
      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'nonexistent', purpose: 'profile_photo' },
        createAdminContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('FileRecord not found');
    });

    it('should reject FileRecord without downloadUrl', async () => {
      setupFirestore(
        { file_001: { originalFilename: 'test.jpg' } },
        { cont_001: VALID_CONTACT },
      );
      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'profile_photo' },
        createAdminContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('no downloadUrl');
    });
  });

  // ==========================================================================
  // CONTACT VERIFICATION
  // ==========================================================================

  describe('Contact verification', () => {
    it('should reject when contact not found', async () => {
      setupFirestore({ file_001: VALID_FILE }, {});
      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'nonexistent', fileRecordId: 'file_001', purpose: 'profile_photo' },
        createAdminContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Contact not found');
    });

    it('should reject cross-company contact', async () => {
      setupFirestore(
        { file_001: VALID_FILE },
        { cont_001: { ...VALID_CONTACT, companyId: 'other_company' } },
      );
      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'profile_photo' },
        createAdminContext(),
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Contact not found');
    });
  });

  // ==========================================================================
  // PURPOSE-SPECIFIC BEHAVIOR
  // ==========================================================================

  describe('Profile photo', () => {
    it('should set photoURL and add to multiplePhotoURLs', async () => {
      const kit = setupFirestore({ file_001: VALID_FILE }, { cont_001: VALID_CONTACT });

      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'profile_photo' },
        createAdminContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        purpose: 'profile_photo',
        photoURL: 'https://storage.example.com/photo.jpg',
      });

      // Verify contact was updated
      const updated = kit.getData('contacts', 'cont_001');
      expect(updated!.photoURL).toBe('https://storage.example.com/photo.jpg');
    });
  });

  describe('Gallery photo', () => {
    it('should add to multiplePhotoURLs without setting photoURL', async () => {
      setupFirestore({ file_001: VALID_FILE }, { cont_001: VALID_CONTACT });

      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'gallery_photo' },
        createAdminContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ purpose: 'gallery_photo' });
    });
  });

  describe('Document', () => {
    it('should promote FileRecord and return filename', async () => {
      setupFirestore(
        { file_001: { ...VALID_FILE, originalFilename: 'contract.pdf' } },
        { cont_001: VALID_CONTACT },
      );

      const result = await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'document' },
        createAdminContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        purpose: 'document',
        filename: 'contract.pdf',
      });
    });
  });

  // ==========================================================================
  // FILE RECORD PROMOTION
  // ==========================================================================

  describe('FileRecord promotion', () => {
    it('should update FileRecord with entity info and status', async () => {
      const kit = setupFirestore({ file_001: VALID_FILE }, { cont_001: VALID_CONTACT });

      await handler.execute(
        'attach_file_to_contact',
        { contactId: 'cont_001', fileRecordId: 'file_001', purpose: 'profile_photo' },
        createAdminContext(),
      );

      const promoted = kit.getData('files', 'file_001');
      expect(promoted!.entityType).toBe('contact');
      expect(promoted!.entityId).toBe('cont_001');
      expect(promoted!.category).toBe('photos');
      expect(promoted!.status).toBe('ready');
    });
  });
});
