/**
 * CONTACT LOOKUP TESTS
 *
 * Tests the centralized contact search/CRUD module used by all UC modules.
 * Uses in-memory MockFirestore for deterministic tests.
 *
 * @see ADR-145 (Super Admin AI Assistant)
 * @module __tests__/contact-lookup
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Standalone setup (does NOT import shared setup.ts to avoid self-mock) ──

// server-only: resolved via moduleNameMapper
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/lib/telemetry/sentry', () => ({
  captureMessage: jest.fn(),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateContactId: jest.fn(() => 'cont_gen_001'),
  generateCompanyId: jest.fn(() => 'comp_gen_001'),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { CONTACTS: 'contacts', CONFIG: 'config' },
  SYSTEM_DOCS: { UI_SYNC_SIGNAL: 'ui_sync_signal' },
}));

jest.mock('@/config/firestore-field-constants', () => ({
  FIELDS: { COMPANY_ID: 'companyId' },
}));

jest.mock('../greek-text-utils', () => ({
  fuzzyGreekMatch: jest.fn((name: string, search: string) => {
    return name.toLowerCase().includes(search.toLowerCase());
  }),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    arrayUnion: jest.fn((...items: unknown[]) => ({ _arrayUnion: items })),
  },
}));

jest.mock('@/services/realtime/types', () => ({
  SYNC_SOURCE_AI_AGENT: 'ai_agent',
}));

import { createMockFirestore } from '../../tools/__tests__/test-utils/mock-firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  findContactByEmail,
  findContactByPhone,
  findContactByName,
  listContacts,
  getContactById,
  updateContactField,
  removeContactField,
  getContactMissingFields,
  createContactServerSide,
  checkContactDuplicates,
} from '../contact-lookup';

// ============================================================================
// HELPERS
// ============================================================================

const COMPANY_ID = 'comp_test_001';

function setupFirestore(contacts: Record<string, Record<string, unknown>>) {
  const kit = createMockFirestore();
  kit.seedCollection('contacts', contacts);
  (getAdminFirestore as jest.Mock).mockReturnValue(kit.instance);
  return kit;
}

const DIMITRIS = {
  companyId: COMPANY_ID,
  displayName: 'Δημήτριος Οικονόμου',
  firstName: 'Δημήτριος',
  lastName: 'Οικονόμου',
  emails: [{ email: 'dimitris@example.com', type: 'work', isPrimary: true }],
  phones: [{ number: '6974050026', type: 'mobile', isPrimary: true }],
  type: 'individual',
  vatNumber: '123456789',
  profession: 'Αρχιτέκτονας',
  taxOffice: 'Καλαμαριάς',
  fatherName: 'Αθανάσιος',
  birthDate: '1990-03-15',
};

const MARIA = {
  companyId: COMPANY_ID,
  displayName: 'Μαρία Παπαδοπούλου',
  firstName: 'Μαρία',
  lastName: 'Παπαδοπούλου',
  emails: [{ email: 'maria@example.com', type: 'personal' }],
  phones: [{ number: '6988111222', type: 'mobile' }],
  type: 'individual',
};

const ACME_COMPANY = {
  companyId: COMPANY_ID,
  displayName: 'ACME ΑΕ',
  companyName: 'ACME ΑΕ',
  type: 'company',
  emails: [{ email: 'info@acme.gr', type: 'work' }],
  phones: [{ number: '2310123456', type: 'office' }],
  registrationNumber: '12345',
  legalForm: 'ΑΕ',
  taxOffice: 'ΦΑΕ Θεσσαλονίκης',
};

const OTHER_COMPANY_CONTACT = {
  companyId: 'comp_other',
  displayName: 'Ξένος',
  firstName: 'Ξένος',
  lastName: 'Εξωτερικός',
  emails: [{ email: 'xenos@other.com' }],
};

// ============================================================================
// TESTS
// ============================================================================

describe('contact-lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // findContactByEmail
  // ==========================================================================

  describe('findContactByEmail', () => {
    it('should find contact by email in emails array', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByEmail('dimitris@example.com', COMPANY_ID);

      expect(result).not.toBeNull();
      expect(result!.contactId).toBe('cont_001');
      expect(result!.name).toBe('Δημήτριος Οικονόμου');
    });

    it('should find contact by email case-insensitively', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByEmail('DIMITRIS@Example.COM', COMPANY_ID);
      expect(result).not.toBeNull();
    });

    it('should find contact by flat email field', async () => {
      setupFirestore({
        cont_flat: {
          companyId: COMPANY_ID,
          email: 'flat@example.com',
          displayName: 'Flat Contact',
        },
      });

      const result = await findContactByEmail('flat@example.com', COMPANY_ID);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Flat Contact');
    });

    it('should return null when email not found', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByEmail('nobody@example.com', COMPANY_ID);
      expect(result).toBeNull();
    });

    it('should respect company isolation', async () => {
      setupFirestore({
        cont_001: DIMITRIS,
        cont_other: OTHER_COMPANY_CONTACT,
      });

      // Search in other company — should not find dimitris
      const result = await findContactByEmail('dimitris@example.com', 'comp_other');
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // findContactByPhone
  // ==========================================================================

  describe('findContactByPhone', () => {
    it('should find contact by phone in phones array', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByPhone('6974050026', COMPANY_ID);

      expect(result).not.toBeNull();
      expect(result!.contactId).toBe('cont_001');
      expect(result!.name).toBe('Δημήτριος Οικονόμου');
    });

    it('should normalize +30 prefix', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByPhone('+306974050026', COMPANY_ID);
      expect(result).not.toBeNull();
    });

    it('should normalize 0030 prefix', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByPhone('00306974050026', COMPANY_ID);
      expect(result).not.toBeNull();
    });

    it('should strip spaces and dashes', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByPhone('697 405-0026', COMPANY_ID);
      expect(result).not.toBeNull();
    });

    it('should find contact by flat phone field', async () => {
      setupFirestore({
        cont_flat: {
          companyId: COMPANY_ID,
          phone: '2310999888',
          displayName: 'Flat Phone',
        },
      });

      const result = await findContactByPhone('2310999888', COMPANY_ID);
      expect(result).not.toBeNull();
    });

    it('should return null when phone not found', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByPhone('6999999999', COMPANY_ID);
      expect(result).toBeNull();
    });

    it('should extract email and phone for context', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await findContactByPhone('6974050026', COMPANY_ID);
      expect(result!.email).toBe('dimitris@example.com');
      expect(result!.phone).toBe('6974050026');
    });
  });

  // ==========================================================================
  // findContactByName
  // ==========================================================================

  describe('findContactByName', () => {
    it('should find contact by display name', async () => {
      setupFirestore({ cont_001: DIMITRIS, cont_002: MARIA });

      const results = await findContactByName('Δημήτριος', COMPANY_ID);

      expect(results).toHaveLength(1);
      expect(results[0].contactId).toBe('cont_001');
    });

    it('should find multiple matches', async () => {
      setupFirestore({ cont_001: DIMITRIS, cont_002: MARIA });

      // fuzzyGreekMatch mock: name.toLowerCase().includes(search)
      // Both have Greek names but only matching ones return
      const results = await findContactByName('ου', COMPANY_ID);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no match', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const results = await findContactByName('Ανύπαρκτος', COMPANY_ID);
      expect(results).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      setupFirestore({ cont_001: DIMITRIS, cont_002: MARIA });

      const results = await findContactByName('ου', COMPANY_ID, 1);
      expect(results).toHaveLength(1);
    });

    it('should return empty for empty collection', async () => {
      setupFirestore({});

      const results = await findContactByName('test', COMPANY_ID);
      expect(results).toHaveLength(0);
    });
  });

  // ==========================================================================
  // listContacts
  // ==========================================================================

  describe('listContacts', () => {
    it('should list all contacts for a company', async () => {
      setupFirestore({
        cont_001: DIMITRIS,
        cont_002: MARIA,
        cont_003: ACME_COMPANY,
      });

      const results = await listContacts(COMPANY_ID, 'all');
      expect(results).toHaveLength(3);
    });

    it('should filter individual contacts', async () => {
      setupFirestore({
        cont_001: DIMITRIS,
        cont_003: ACME_COMPANY,
      });

      const results = await listContacts(COMPANY_ID, 'individual');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Δημήτριος Οικονόμου');
    });

    it('should filter company contacts', async () => {
      setupFirestore({
        cont_001: DIMITRIS,
        cont_003: ACME_COMPANY,
      });

      const results = await listContacts(COMPANY_ID, 'company');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ACME ΑΕ');
    });

    it('should respect limit', async () => {
      setupFirestore({
        cont_001: DIMITRIS,
        cont_002: MARIA,
        cont_003: ACME_COMPANY,
      });

      const results = await listContacts(COMPANY_ID, 'all', 2);
      expect(results).toHaveLength(2);
    });
  });

  // ==========================================================================
  // getContactById
  // ==========================================================================

  describe('getContactById', () => {
    it('should return contact by ID', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await getContactById('cont_001');

      expect(result).not.toBeNull();
      expect(result!.contactId).toBe('cont_001');
      expect(result!.name).toBe('Δημήτριος Οικονόμου');
      expect(result!.email).toBe('dimitris@example.com');
      expect(result!.phone).toBe('6974050026');
    });

    it('should return null for non-existent ID', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await getContactById('cont_nonexistent');
      expect(result).toBeNull();
    });

    it('should use companyName as fallback name', async () => {
      setupFirestore({ cont_acme: ACME_COMPANY });

      const result = await getContactById('cont_acme');
      expect(result!.name).toBe('ACME ΑΕ');
    });
  });

  // ==========================================================================
  // updateContactField
  // ==========================================================================

  describe('updateContactField', () => {
    it('should update scalar field directly', async () => {
      const kit = setupFirestore({ cont_001: DIMITRIS });

      await updateContactField('cont_001', 'vatNumber', '999888777', 'Admin');

      const updated = kit.getData('contacts', 'cont_001');
      expect(updated!.vatNumber).toBe('999888777');
      expect(updated!.lastModifiedBy).toBe('Admin');
    });

    it('should update phone field using arrayUnion pattern', async () => {
      const kit = setupFirestore({ cont_001: DIMITRIS });

      await updateContactField('cont_001', 'phone', '6999111222', 'Admin');

      const updated = kit.getData('contacts', 'cont_001');
      // FieldValue.arrayUnion is mocked, so the phones field gets the mock value
      expect(updated!.phones).toBeDefined();
    });

    it('should update email field using arrayUnion pattern', async () => {
      const kit = setupFirestore({ cont_001: DIMITRIS });

      await updateContactField('cont_001', 'email', 'New@Example.Com', 'Admin');

      const updated = kit.getData('contacts', 'cont_001');
      expect(updated!.emails).toBeDefined();
    });
  });

  // ==========================================================================
  // removeContactField
  // ==========================================================================

  describe('removeContactField', () => {
    it('should clear scalar field to null', async () => {
      const kit = setupFirestore({ cont_001: DIMITRIS });

      await removeContactField('cont_001', 'vatNumber', 'Admin');

      const updated = kit.getData('contacts', 'cont_001');
      expect(updated!.vatNumber).toBeNull();
    });

    it('should clear phone array', async () => {
      const kit = setupFirestore({ cont_001: DIMITRIS });

      await removeContactField('cont_001', 'phone', 'Admin');

      const updated = kit.getData('contacts', 'cont_001');
      expect(updated!.phones).toEqual([]);
    });

    it('should clear email array', async () => {
      const kit = setupFirestore({ cont_001: DIMITRIS });

      await removeContactField('cont_001', 'email', 'Admin');

      const updated = kit.getData('contacts', 'cont_001');
      expect(updated!.emails).toEqual([]);
    });
  });

  // ==========================================================================
  // getContactMissingFields
  // ==========================================================================

  describe('getContactMissingFields', () => {
    it('should return empty for complete individual contact', async () => {
      setupFirestore({
        cont_001: {
          ...DIMITRIS,
          addresses: [{ street: 'Test' }],
        },
      });

      const missing = await getContactMissingFields('cont_001', 'individual');
      expect(missing).toHaveLength(0);
    });

    it('should detect missing fields for individual', async () => {
      setupFirestore({
        cont_bare: {
          companyId: COMPANY_ID,
          displayName: 'Bare Contact',
        },
      });

      const missing = await getContactMissingFields('cont_bare', 'individual');
      expect(missing).toContain('Τηλέφωνο');
      expect(missing).toContain('Email');
      expect(missing).toContain('ΑΦΜ');
      expect(missing).toContain('Διεύθυνση');
      expect(missing).toContain('Επάγγελμα');
      expect(missing).toContain('Πατρώνυμο');
    });

    it('should detect missing fields for company', async () => {
      setupFirestore({
        cont_bare: {
          companyId: COMPANY_ID,
          companyName: 'Bare Company',
        },
      });

      const missing = await getContactMissingFields('cont_bare', 'company');
      expect(missing).toContain('Αριθμός ΓΕΜΗ');
      expect(missing).toContain('Νομική μορφή');
      expect(missing).toContain('ΔΟΥ');
    });

    it('should return empty for non-existent contact', async () => {
      setupFirestore({});

      const missing = await getContactMissingFields('cont_nope', 'individual');
      expect(missing).toHaveLength(0);
    });
  });

  // ==========================================================================
  // checkContactDuplicates
  // ==========================================================================

  describe('checkContactDuplicates', () => {
    it('should detect email duplicate', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await checkContactDuplicates(
        { email: 'dimitris@example.com', phone: null, firstName: 'Νέος', lastName: 'Χρήστης' },
        COMPANY_ID,
      );

      expect(result.hasDuplicate).toBe(true);
      expect(result.matches[0].type).toBe('email');
      expect(result.matches[0].confidence).toBe('exact');
    });

    it('should detect phone duplicate', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await checkContactDuplicates(
        { email: null, phone: '6974050026', firstName: 'Νέος', lastName: 'Χρήστης' },
        COMPANY_ID,
      );

      expect(result.hasDuplicate).toBe(true);
      expect(result.matches[0].type).toBe('phone');
    });

    it('should detect name duplicate when no email/phone match', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await checkContactDuplicates(
        { email: null, phone: null, firstName: 'Δημήτριος', lastName: 'Οικονόμου' },
        COMPANY_ID,
      );

      expect(result.hasDuplicate).toBe(true);
      expect(result.matches[0].type).toBe('name');
      expect(result.matches[0].confidence).toBe('fuzzy');
    });

    it('should not duplicate entry when same contact matches email AND phone', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await checkContactDuplicates(
        { email: 'dimitris@example.com', phone: '6974050026', firstName: 'test', lastName: 'test' },
        COMPANY_ID,
      );

      // Same contact matched by both — should appear only once
      expect(result.matches).toHaveLength(1);
    });

    it('should return no duplicates for unique contact', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await checkContactDuplicates(
        { email: 'unique@test.com', phone: '6999000111', firstName: 'Unique', lastName: 'Person' },
        COMPANY_ID,
      );

      expect(result.hasDuplicate).toBe(false);
      expect(result.matches).toHaveLength(0);
    });
  });

  // ==========================================================================
  // createContactServerSide
  // ==========================================================================

  describe('createContactServerSide', () => {
    it('should create individual contact with enterprise ID', async () => {
      const kit = setupFirestore({});

      const result = await createContactServerSide({
        firstName: 'Νίκος',
        lastName: 'Τεστ',
        email: 'nikos@test.com',
        phone: '6971111111',
        type: 'individual',
        companyId: COMPANY_ID,
        createdBy: 'Admin',
      });

      expect(result.contactId).toBeDefined();
      expect(result.displayName).toBe('Νίκος Τεστ');

      // Verify document was written
      const allDocs = kit.getAllDocs('contacts');
      expect(Object.keys(allDocs).length).toBe(1);
    });

    it('should throw DUPLICATE_CONTACT when duplicate found', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      await expect(
        createContactServerSide({
          firstName: 'Δημήτριος',
          lastName: 'Οικονόμου',
          email: 'dimitris@example.com',
          phone: null,
          type: 'individual',
          companyId: COMPANY_ID,
          createdBy: 'Admin',
        }),
      ).rejects.toThrow('DUPLICATE_CONTACT');
    });

    it('should skip duplicate check when skipDuplicateCheck is true', async () => {
      setupFirestore({ cont_001: DIMITRIS });

      const result = await createContactServerSide({
        firstName: 'Δημήτριος',
        lastName: 'Οικονόμου',
        email: 'dimitris@example.com',
        phone: null,
        type: 'individual',
        companyId: COMPANY_ID,
        createdBy: 'Admin',
        skipDuplicateCheck: true,
      });

      expect(result.contactId).toBeDefined();
    });

    it('should create company contact with companyName as displayName', async () => {
      setupFirestore({});

      const result = await createContactServerSide({
        firstName: '',
        lastName: '',
        email: null,
        phone: null,
        type: 'company',
        companyId: COMPANY_ID,
        companyName: 'Test ΑΕ',
        createdBy: 'Admin',
      });

      expect(result.displayName).toBe('Test ΑΕ');
    });
  });
});
