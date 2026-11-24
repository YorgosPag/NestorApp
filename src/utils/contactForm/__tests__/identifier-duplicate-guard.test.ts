/**
 * ADR-944 §9 — ο φρουρός διπλού ΑΦΜ / email τη στιγμή της αποθήκευσης.
 *
 * Τι φυλάει: (α) ρωτά **μόνο** για ό,τι αλλάζει σε αυτή την αποθήκευση — παλιό διπλότυπο δεν κλειδώνει την επαφή·
 * (β) δύο φυσικά πρόσωπα με το ίδιο ΑΦΜ ⇒ `block`· κάθε άλλη συνύπαρξη και κάθε διπλό email ⇒ `confirm`·
 * (γ) η ίδια η επαφή εξαιρείται· (δ) χωρίς χώρο (`companyId`) δεν γίνεται καμία ερώτηση.
 */

import type { Contact, EmailInfo } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';

const mockFindVatHolders = jest.fn();
const mockFindEmailDuplicates = jest.fn();

// Το `vat-validation` αρχικοποιεί τον client της Firebase στην εισαγωγή — εδώ μόνο οι καθαρές συναρτήσεις του.
jest.mock('@/lib/validation/vat-validation', () => ({
  ...jest.requireActual('@/lib/validation/greek-vat-number'),
  findVatHolders: (...args: unknown[]) => mockFindVatHolders(...args),
}));
jest.mock('@/lib/validation/contact-email-uniqueness', () => ({
  findEmailDuplicates: (...args: unknown[]) => mockFindEmailDuplicates(...args),
}));

import { addedEmailKeysOf, changedVatOf, detectIdentifierDuplicates } from '../identifier-duplicate-guard';

/** Δύο ΑΦΜ που περνούν το ψηφίο ελέγχου. */
const OWN_VAT = '040817944';
const OTHER_VAT = '077030866';

function email(address: string): EmailInfo {
  return { email: address, type: 'personal', isPrimary: false };
}

function individual(overrides: Record<string, unknown> = {}): Contact {
  return { id: 'cont_self', type: 'individual', companyId: 'comp_1', firstName: 'Γεώργιος', lastName: 'Παγώνης', vatNumber: OWN_VAT, emails: [], ...overrides } as Contact;
}

function company(overrides: Record<string, unknown> = {}): Contact {
  return { id: 'cont_co', type: 'company', companyId: 'comp_1', companyName: 'Παγώνης ΙΚΕ', vatNumber: OWN_VAT, emails: [], ...overrides } as Contact;
}

function form(fields: Partial<ContactFormData>): ContactFormData {
  return { emails: [], ...fields } as ContactFormData;
}

const holder = (type: Contact['type'], id = `cont_${type}_other`) => ({ id, name: id, type });

beforeEach(() => {
  mockFindVatHolders.mockReset().mockResolvedValue([]);
  mockFindEmailDuplicates.mockReset().mockResolvedValue([]);
});

describe('changedVatOf — ρωτάμε μόνο όταν το ΑΦΜ αλλάζει', () => {
  it('ίδιο ΑΦΜ (και με κενά) ⇒ null', () => {
    expect(changedVatOf(individual(), form({ vatNumber: OWN_VAT }))).toBeNull();
    expect(changedVatOf(individual(), form({ vatNumber: ' 040 817 944 ' }))).toBeNull();
  });

  it('νέο έγκυρο ΑΦΜ ⇒ το κανονικοποιημένο ΑΦΜ', () => {
    expect(changedVatOf(individual(), form({ vatNumber: OTHER_VAT }))).toBe(OTHER_VAT);
    expect(changedVatOf(individual({ vatNumber: '' }), form({ vatNumber: OWN_VAT }))).toBe(OWN_VAT);
  });

  it('άδειασμα ή άκυρο ΑΦΜ ⇒ null — δεν υπάρχει τίποτα να ρωτηθεί', () => {
    expect(changedVatOf(individual(), form({ vatNumber: '' }))).toBeNull();
    expect(changedVatOf(individual(), form({ vatNumber: '123456789' }))).toBeNull();
  });

  it('η εταιρεία διαβάζεται από το `companyVatNumber` της φόρμας και το αποθηκευμένο `vatNumber`', () => {
    expect(changedVatOf(company(), form({ companyVatNumber: OWN_VAT }))).toBeNull();
    expect(changedVatOf(company(), form({ companyVatNumber: OTHER_VAT }))).toBe(OTHER_VAT);
  });
});

describe('addedEmailKeysOf — μόνο όσα προστίθενται', () => {
  it('ίδιο email με άλλα κεφαλαία ⇒ δεν προστέθηκε', () => {
    expect(addedEmailKeysOf(individual({ emails: [email('a@x.gr')] }), form({ emails: [email(' A@X.gr ')] }))).toEqual([]);
  });

  it('νέο email ⇒ το κλειδί του· το παλιό (και το αποθηκευμένο `emailKeys`) όχι', () => {
    const contact = individual({ emails: [email('a@x.gr')], emailKeys: ['old@x.gr'] });
    expect(addedEmailKeysOf(contact, form({ emails: [email('a@x.gr'), email('old@x.gr'), email('New@x.gr')] }))).toEqual(['new@x.gr']);
  });
});

describe('detectIdentifierDuplicates', () => {
  it('τίποτα δεν αλλάζει ⇒ null, και ΚΑΜΙΑ ερώτηση στη βάση (παλιό διπλότυπο δεν κλειδώνει)', async () => {
    mockFindVatHolders.mockResolvedValue([holder('individual')]);
    expect(await detectIdentifierDuplicates(individual(), form({ vatNumber: OWN_VAT }))).toBeNull();
    expect(mockFindVatHolders).not.toHaveBeenCalled();
    expect(mockFindEmailDuplicates).not.toHaveBeenCalled();
  });

  it('νέο ΑΦΜ χωρίς άλλο κάτοχο ⇒ null· ρωτήθηκε ο χώρος της επαφής, εξαιρώντας την ίδια', async () => {
    expect(await detectIdentifierDuplicates(individual(), form({ vatNumber: OTHER_VAT }))).toBeNull();
    expect(mockFindVatHolders).toHaveBeenCalledWith(OTHER_VAT, 'comp_1', 'cont_self');
  });

  it('φυσικό πρόσωπο που γράφει ΑΦΜ άλλου φυσικού προσώπου ⇒ block, με τον κάτοχο', async () => {
    const other = holder('individual');
    mockFindVatHolders.mockResolvedValue([other]);
    expect(await detectIdentifierDuplicates(individual(), form({ vatNumber: OTHER_VAT }))).toEqual({
      decision: 'block',
      vat: { value: OTHER_VAT, holders: [other] },
      emails: [],
    });
  });

  it('φυσικό πρόσωπο που γράφει ΑΦΜ εταιρείας (ατομική επιχείρηση) ⇒ confirm', async () => {
    mockFindVatHolders.mockResolvedValue([holder('company')]);
    const result = await detectIdentifierDuplicates(individual(), form({ vatNumber: OTHER_VAT }));
    expect(result?.decision).toBe('confirm');
  });

  it('εταιρεία που γράφει ΑΦΜ φυσικού προσώπου ⇒ confirm, ποτέ block', async () => {
    mockFindVatHolders.mockResolvedValue([holder('individual')]);
    const result = await detectIdentifierDuplicates(company(), form({ companyVatNumber: OTHER_VAT }));
    expect(result?.decision).toBe('confirm');
  });

  it('νέο email που υπάρχει αλλού ⇒ confirm· ρωτήθηκαν ΜΟΝΟ τα email που προστέθηκαν', async () => {
    const other = holder('individual');
    mockFindEmailDuplicates.mockResolvedValue([{ email: 'info@x.gr', contacts: [other] }]);
    const contact = individual({ emails: [email('a@x.gr')] });
    const result = await detectIdentifierDuplicates(contact, form({ vatNumber: OWN_VAT, emails: [email('a@x.gr'), email('info@x.gr')] }));
    expect(mockFindEmailDuplicates).toHaveBeenCalledWith(['info@x.gr'], 'comp_1', 'cont_self');
    expect(result).toEqual({ decision: 'confirm', vat: null, emails: [{ value: 'info@x.gr', holders: [other] }] });
  });

  it('απαγορευμένο ΑΦΜ ΚΑΙ διπλό email μαζί ⇒ block (η αυστηρότερη), με όλα τα ευρήματα', async () => {
    mockFindVatHolders.mockResolvedValue([holder('individual')]);
    mockFindEmailDuplicates.mockResolvedValue([{ email: 'info@x.gr', contacts: [holder('company')] }]);
    const result = await detectIdentifierDuplicates(individual(), form({ vatNumber: OTHER_VAT, emails: [email('info@x.gr')] }));
    expect(result?.decision).toBe('block');
    expect(result?.emails).toHaveLength(1);
  });

  it('επαφή χωρίς χώρο (`companyId`) ⇒ null, καμία ερώτηση', async () => {
    expect(await detectIdentifierDuplicates(individual({ companyId: undefined }), form({ vatNumber: OTHER_VAT }))).toBeNull();
    expect(mockFindVatHolders).not.toHaveBeenCalled();
  });
});
