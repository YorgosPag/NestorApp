/**
 * CONTACT HANDLER — Unit Tests (Google-level)
 *
 * Covers:
 * - create_contact: validation, admin-only, duplicate detection
 * - append_contact_info: FINDING-004 (admin blocked), customer positive path
 * - update_contact_field: FINDING-001 (documentNumber prefix), ESCO protection
 *
 * @see QA_AGENT_FINDINGS.md
 */

// ── Shared mocks (must be before handler imports) ──
import '../setup';

import { ContactHandler } from '../../handlers/contact-handler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createMockFirestore, type MockFirestoreKit } from '../test-utils/mock-firestore';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

// ── Mocked modules for assertions ──
const mockCreateContactServerSide = jest.requireMock(
  '@/services/ai-pipeline/shared/contact-lookup'
).createContactServerSide as jest.Mock;

const mockUpdateContactField = jest.requireMock(
  '@/services/ai-pipeline/shared/contact-lookup'
).updateContactField as jest.Mock;

// ============================================================================
// SETUP
// ============================================================================

describe('ContactHandler', () => {
  let handler: ContactHandler;
  let mockDb: MockFirestoreKit;

  beforeEach(() => {
    handler = new ContactHandler();
    mockDb = createMockFirestore();
    (getAdminFirestore as jest.Mock).mockReturnValue(mockDb.instance);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // create_contact
  // ==========================================================================

  describe('create_contact', () => {
    test('should create individual contact with valid data', async () => {
      const ctx = createAdminContext();
      mockCreateContactServerSide.mockResolvedValue({
        contactId: 'cont_new_001',
        displayName: 'Δημήτριος Οικονόμου',
      });

      const result = await handler.execute('create_contact', {
        contactType: 'individual',
        firstName: 'Δημήτριος',
        lastName: 'Οικονόμου',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        contactId: 'cont_new_001',
        displayName: 'Δημήτριος Οικονόμου',
      }));
    });

    test('should reject creation when not admin', async () => {
      const ctx = createCustomerContext();

      const result = await handler.execute('create_contact', {
        contactType: 'individual',
        firstName: 'Test',
        lastName: 'User',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    test('should reject individual without firstName and lastName', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('create_contact', {
        contactType: 'individual',
        firstName: '',
        lastName: '',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('firstName');
    });

    test('should reject invalid phone format', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('create_contact', {
        contactType: 'individual',
        firstName: 'Test',
        lastName: 'User',
        phone: '123', // Too short
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('τηλέφωνο');
    });

    test('should reject invalid email format', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('create_contact', {
        contactType: 'individual',
        firstName: 'Test',
        lastName: 'User',
        email: 'not-an-email',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    test('should handle duplicate contact detection', async () => {
      const ctx = createAdminContext();
      mockCreateContactServerSide.mockRejectedValue(
        new Error('DUPLICATE_CONTACT|||[{"contactId":"cont_existing","displayName":"Δημήτριος Οικονόμου"}]')
      );

      const result = await handler.execute('create_contact', {
        contactType: 'individual',
        firstName: 'Δημήτριος',
        lastName: 'Οικονόμου',
      }, ctx);

      expect(result.success).toBe(false);
      const data = result.data as Record<string, unknown>;
      expect(data.duplicateDetected).toBe(true);
      expect(data.matches).toHaveLength(1);
    });
  });

  // ==========================================================================
  // append_contact_info — FINDING-004 regression tests
  // ==========================================================================

  describe('append_contact_info', () => {
    /**
     * FINDING-004 REGRESSION: Admin cannot append phone/email.
     * append_contact_info checks ctx.contactMeta?.contactId — admin has null contactMeta.
     * This is the ROOT CAUSE of "❌ Απαιτείται αναγνώριση χρήστη".
     */
    test('should reject append when contactMeta is null (admin) — FINDING-004', async () => {
      const ctx = createAdminContext({ contactMeta: null });

      const result = await handler.execute('append_contact_info', {
        fieldType: 'phone',
        value: '6974050026',
        label: 'κινητό',
      }, ctx);

      expect(result.success).toBe(false);
      // This is the exact error message from AI_ERRORS.UNRECOGNIZED_USER
      expect(result.error).toContain('αναγνωρισμένος');
    });

    test('should reject append when contactId is missing — FINDING-004', async () => {
      const ctx = createCustomerContext({
        contactMeta: { contactId: '', displayName: '', linkedUnitIds: [], projectRoles: [] },
      });

      const result = await handler.execute('append_contact_info', {
        fieldType: 'phone',
        value: '6974050026',
      }, ctx);

      expect(result.success).toBe(false);
    });

    test('should append phone to customer contact', async () => {
      const ctx = createCustomerContext();
      // Seed the contact document
      mockDb.seedCollection('contacts', {
        'cont_test_001': {
          companyId: 'test-company-001',
          firstName: 'Δημήτριος',
          lastName: 'Οικονόμου',
          phones: [],
          emails: [],
        },
      });

      const result = await handler.execute('append_contact_info', {
        fieldType: 'phone',
        value: '6974050026',
        label: 'κινητό',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        fieldType: 'phone',
        value: '6974050026',
        added: true,
      }));

      // Verify Firestore was updated with correct phone entry
      const updatedDoc = mockDb.getData('contacts', 'cont_test_001');
      expect(updatedDoc?.phones).toEqual([
        expect.objectContaining({ number: '6974050026', type: 'mobile' }),
      ]);
    });

    test('should append email to customer contact', async () => {
      const ctx = createCustomerContext();
      mockDb.seedCollection('contacts', {
        'cont_test_001': {
          companyId: 'test-company-001',
          emails: [],
          phones: [],
        },
      });

      const result = await handler.execute('append_contact_info', {
        fieldType: 'email',
        value: 'dimitrios@example.com',
        label: 'προσωπικό',
      }, ctx);

      expect(result.success).toBe(true);
      const updatedDoc = mockDb.getData('contacts', 'cont_test_001');
      expect(updatedDoc?.emails).toEqual([
        expect.objectContaining({ email: 'dimitrios@example.com', type: 'personal' }),
      ]);
    });

    test('should reject duplicate phone', async () => {
      const ctx = createCustomerContext();
      mockDb.seedCollection('contacts', {
        'cont_test_001': {
          companyId: 'test-company-001',
          phones: [{ number: '6974050026', type: 'mobile', isPrimary: false }],
        },
      });

      const result = await handler.execute('append_contact_info', {
        fieldType: 'phone',
        value: '6974050026',
        label: 'κινητό',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('υπάρχει ήδη');
    });

    test('should reject duplicate email', async () => {
      const ctx = createCustomerContext();
      mockDb.seedCollection('contacts', {
        'cont_test_001': {
          companyId: 'test-company-001',
          emails: [{ email: 'test@example.com', type: 'personal', isPrimary: false }],
        },
      });

      const result = await handler.execute('append_contact_info', {
        fieldType: 'email',
        value: 'test@example.com',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('υπάρχει ήδη');
    });

    test('should resolve Greek phone labels to English', async () => {
      const ctx = createCustomerContext();
      mockDb.seedCollection('contacts', {
        'cont_test_001': {
          companyId: 'test-company-001',
          phones: [],
        },
      });

      const result = await handler.execute('append_contact_info', {
        fieldType: 'phone',
        value: '2310123456',
        label: 'σπίτι',
      }, ctx);

      expect(result.success).toBe(true);
      const updatedDoc = mockDb.getData('contacts', 'cont_test_001');
      expect(updatedDoc?.phones).toEqual([
        expect.objectContaining({ number: '2310123456', type: 'home' }),
      ]);
    });

    test('should reject invalid phone format in append', async () => {
      const ctx = createCustomerContext();
      mockDb.seedCollection('contacts', {
        'cont_test_001': { companyId: 'test-company-001', phones: [] },
      });

      const result = await handler.execute('append_contact_info', {
        fieldType: 'phone',
        value: '123',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('τηλέφωνο');
    });
  });

  // ==========================================================================
  // update_contact_field — FINDING-001 + ESCO protection
  // ==========================================================================

  describe('update_contact_field', () => {
    /**
     * FINDING-001 REGRESSION: documentNumber prefix must be preserved.
     * The handler passes value as-is via updateContactField() — the stripping
     * in production happens at AI level, not handler level. This test documents
     * that the handler does NOT strip the prefix.
     */
    test('should preserve documentNumber prefix — FINDING-001', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'cont_001': { companyId: 'test-company-001', documentNumber: '' },
      });
      mockUpdateContactField.mockResolvedValue(undefined);

      const result = await handler.execute('update_contact_field', {
        contactId: 'cont_001',
        field: 'documentNumber',
        value: 'ΑΚ 582946',
      }, ctx);

      expect(result.success).toBe(true);
      // Verify the EXACT value was passed to updateContactField (no stripping)
      expect(mockUpdateContactField).toHaveBeenCalledWith(
        'cont_001',
        'documentNumber',
        'ΑΚ 582946',
        expect.any(String),
      );
    });

    test('should block ESCO-protected fields in update', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'cont_001': { companyId: 'test-company-001' },
      });

      // 'profession' is in CONTACT_UPDATABLE_FIELDS but blocked by ESCO protection
      const result = await handler.execute('update_contact_field', {
        contactId: 'cont_001',
        field: 'profession',
        value: 'test',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('set_contact_esco');
    });

    test('should allow non-ESCO fields in update (vatNumber, employer)', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'cont_001': { companyId: 'test-company-001' },
      });
      mockUpdateContactField.mockResolvedValue(undefined);

      const result = await handler.execute('update_contact_field', {
        contactId: 'cont_001',
        field: 'vatNumber',
        value: '123456789',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        field: 'vatNumber',
        value: '123456789',
        updated: true,
      }));
    });

    test('should reject update when not admin', async () => {
      const ctx = createCustomerContext();

      const result = await handler.execute('update_contact_field', {
        contactId: 'cont_001',
        field: 'vatNumber',
        value: '123',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    test('should reject update when contact not found', async () => {
      const ctx = createAdminContext();
      // No contacts seeded — doc doesn't exist

      const result = await handler.execute('update_contact_field', {
        contactId: 'cont_nonexistent',
        field: 'vatNumber',
        value: '123',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('δεν βρέθηκε');
    });

    test('should reject invalid field name', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('update_contact_field', {
        contactId: 'cont_001',
        field: 'invalidField',
        value: 'test',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('field must be one of');
    });
  });
});
