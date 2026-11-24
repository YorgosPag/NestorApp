/**
 * @jest-environment node
 *
 * ADR-951 — **ο ΕΝΑΣ γραφέας του δεσμού «χώρος ↔ επαφή»**, πάνω στο επαληθευμένο ψεύτικο Firestore.
 *
 * Τι κρίνεται: κάθε άρνηση (ξένος χώρος · όχι εταιρεία · ανενεργή · ήδη συνδεδεμένος) · ιδεμποτία · «όλα ή τίποτα» με
 * την εικόνα (καμία αλλαγή λογοτύπου για σύνδεση που αρνείται) · δημιουργία επαφής ΚΑΙ δεσμού μαζί · βλάβη ανάγνωσης
 * προφίλ ≠ «χωρίς επωνυμία» · αποσύνδεση. Ο `buildContactDocument` και η κρίση `isInactiveContact` τρέχουν ΑΛΗΘΙΝΟΙ.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { userPerformer } from '@/lib/audit/audit-performer';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import {
  createSelfContactFromWorkspace,
  linkSelfContact,
  unlinkSelfContact,
} from '../self-contact-store.server';

const fake = new FakeFirestore();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): Firestore => fake as unknown as Firestore,
  FieldValue: jest.requireActual('firebase-admin/firestore').FieldValue,
}));

const recordChange = jest.fn(async () => 'audit_1');
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (...a: unknown[]) => recordChange(...(a as [])) },
  resolveUserDisplayName: async () => 'Διαχειριστής',
}));

const readTax = jest.fn();
const readChannels = jest.fn();
jest.mock('@/services/company/company-legal-identity', () => ({
  readCompanyTaxDeclaration: (...a: unknown[]) => readTax(...a),
  readCompanyContactDeclaration: (...a: unknown[]) => readChannels(...a),
}));

const recordBirth = jest.fn(async () => undefined);
jest.mock('@/services/contact/account-contact-resolver', () => ({
  recordAccountContactBirth: (...a: unknown[]) => recordBirth(...(a as [])),
}));

const setBrandLogo = jest.fn();
jest.mock('../brand-logo-store.server', () => ({ setCompanyBrandLogo: (...a: unknown[]) => setBrandLogo(...a) }));

const readImageBytes = jest.fn();
jest.mock('../contact-image-bytes.server', () => ({ readContactImageBytes: (...a: unknown[]) => readImageBytes(...a) }));

jest.mock('@/services/enterprise-id-convenience', () => ({ generateContactId: () => 'cont_new' }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));

const COMPANY = 'comp_a';
const OTHER_COMPANY = 'comp_b';
const ADMIN = userPerformer('u_admin', 'admin@example.com');
const IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/x/o/companies%2Fcomp_a%2Fimg.png?alt=media';
const IMAGE_BYTES = Buffer.from([1, 2, 3]);

const companyDoc = () => fake.getData(COLLECTIONS.COMPANIES, COMPANY) as Record<string, unknown> | undefined;
const selfContactField = () => companyDoc()?.selfContact as Record<string, unknown> | undefined;

function seedContact(id: string, overrides: Record<string, unknown> = {}): void {
  // Ρεαλιστικό σχήμα: οι επαφές-εταιρείες κρατούν το όνομα στο `companyName` (ADR-951 §4.1).
  fake.seed(COLLECTIONS.CONTACTS, id, { companyId: COMPANY, type: 'company', companyName: `Επαφή ${id}`, status: 'active', ...overrides });
}

const PROFILE_TAX = {
  kind: 'present',
  declaration: { entityType: null, businessName: '  Παγώνης Κατασκευαστική ΑΕ ', gemiNumber: null },
  taxId: ' 094 012 345 ',
};
const PROFILE_CHANNELS = { kind: 'present', declaration: { phone: null, mobile: '6912345678', email: 'info@example.com' } };

beforeEach(() => {
  fake.reset();
  fake.seed(COLLECTIONS.COMPANIES, COMPANY, { name: 'A' });
  seedContact('cont_a');
  jest.clearAllMocks();
  readTax.mockResolvedValue(PROFILE_TAX);
  readChannels.mockResolvedValue(PROFILE_CHANNELS);
});

describe('Λ — σύνδεση υπάρχουσας επαφής', () => {
  it('Λ1 συνδέει επαφή-εταιρεία του χώρου, με φορέα και Ιστορικό στον χώρο', async () => {
    const outcome = await linkSelfContact(COMPANY, 'cont_a', 'keep-workspace-logo', ADMIN);
    expect(outcome).toMatchObject({ kind: 'linked', selfContact: { contactId: 'cont_a', linkedBy: 'u_admin' } });
    expect(selfContactField()).toMatchObject({ contactId: 'cont_a', linkedBy: 'u_admin' });
    expect(companyDoc()?._lastModifiedBy).toBe('u_admin');
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityId: COMPANY,
      changes: [expect.objectContaining({ field: 'selfContact', oldValue: null, newValue: 'cont_a' })],
    }));
  });

  it('Λ2 ιδεμποτία: δεύτερη σύνδεση με την ΙΔΙΑ επαφή δεν γράφει τίποτα και δεν αφήνει δεύτερη γραμμή Ιστορικού', async () => {
    const first = await linkSelfContact(COMPANY, 'cont_a', 'keep-workspace-logo', ADMIN);
    const writesAfterFirst = fake.writes;
    const second = await linkSelfContact(COMPANY, 'cont_a', 'keep-workspace-logo', ADMIN);
    expect(second).toEqual(first);
    expect(fake.writes).toBe(writesAfterFirst);
    expect(recordChange).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['επαφή άλλου χώρου', () => seedContact('cont_x', { companyId: OTHER_COMPANY }), 'cont_x', 'contact-not-found'],
    ['επαφή που δεν υπάρχει', () => undefined, 'cont_missing', 'contact-not-found'],
    ['φυσικό πρόσωπο', () => seedContact('cont_x', { type: 'individual' }), 'cont_x', 'not-a-company'],
    ['αρχειοθετημένη', () => seedContact('cont_x', { status: 'archived' }), 'cont_x', 'contact-inactive'],
    ['διαγραμμένη', () => seedContact('cont_x', { status: 'deleted' }), 'cont_x', 'contact-inactive'],
  ])('Λ3 άρνηση: %s ⇒ καμία εγγραφή', async (_label, arrange, contactId, refusal) => {
    arrange();
    const writesBefore = fake.writes;
    const outcome = await linkSelfContact(COMPANY, contactId, 'keep-workspace-logo', ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal });
    expect(fake.writes).toBe(writesBefore);
    expect(selfContactField()).toBeUndefined();
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Λ4 ο χώρος δείχνει ήδη ΑΛΛΗ επαφή ⇒ already-linked, ο δεσμός μένει ως ήταν', async () => {
    seedContact('cont_b');
    await linkSelfContact(COMPANY, 'cont_a', 'keep-workspace-logo', ADMIN);
    const outcome = await linkSelfContact(COMPANY, 'cont_b', 'keep-workspace-logo', ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal: 'already-linked' });
    expect(selfContactField()).toMatchObject({ contactId: 'cont_a' });
  });

  it('Λ5 συναγωνισμός: άλλος συνδέει ανάμεσα στην ανάγνωση και στο commit ⇒ already-linked, καμία αντικατάσταση', async () => {
    seedContact('cont_b');
    fake.interfere = () => {
      fake.write(COLLECTIONS.COMPANIES, COMPANY, {
        name: 'A', selfContact: { contactId: 'cont_b', linkedAt: '2026-11-24T00:00:00.000Z', linkedBy: 'u_other' },
      });
    };
    const outcome = await linkSelfContact(COMPANY, 'cont_a', 'keep-workspace-logo', ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal: 'already-linked' });
    expect(selfContactField()).toMatchObject({ contactId: 'cont_b', linkedBy: 'u_other' });
  });

  it('Λ6 ο χώρος δεν υπάρχει ⇒ absent', async () => {
    expect(await linkSelfContact('comp_missing', 'cont_a', 'keep-workspace-logo', ADMIN)).toEqual({ kind: 'absent' });
  });
});

describe('Ε — «η εικόνα της επαφής γίνεται λογότυπο»: όλα ή τίποτα', () => {
  it('Ε1 επιτυχία: τα bytes περνούν από τον ΕΝΑ γραφέα λογοτύπου, και μετά γίνεται ο δεσμός', async () => {
    seedContact('cont_a', { logoURL: IMAGE_URL });
    readImageBytes.mockResolvedValue(IMAGE_BYTES);
    setBrandLogo.mockResolvedValue({ kind: 'set', brandLogo: {} });
    const outcome = await linkSelfContact(COMPANY, 'cont_a', 'use-contact-image', ADMIN);
    expect(readImageBytes).toHaveBeenCalledWith(IMAGE_URL, COMPANY);
    expect(setBrandLogo).toHaveBeenCalledWith(COMPANY, IMAGE_BYTES, ADMIN);
    expect(outcome).toMatchObject({ kind: 'linked', selfContact: { contactId: 'cont_a' } });
  });

  it('Ε2 η επαφή δεν έχει εικόνα ⇒ contact-image-unavailable, ούτε λογότυπο ούτε δεσμός', async () => {
    const outcome = await linkSelfContact(COMPANY, 'cont_a', 'use-contact-image', ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal: 'contact-image-unavailable' });
    expect(readImageBytes).not.toHaveBeenCalled();
    expect(setBrandLogo).not.toHaveBeenCalled();
    expect(selfContactField()).toBeUndefined();
  });

  it('Ε3 η εικόνα δεν διαβάστηκε (ξένος χώρος · ξένος κάδος · μέγεθος) ⇒ contact-image-unavailable, κανένας δεσμός', async () => {
    seedContact('cont_a', { logoURL: IMAGE_URL });
    readImageBytes.mockResolvedValue(null);
    const outcome = await linkSelfContact(COMPANY, 'cont_a', 'use-contact-image', ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal: 'contact-image-unavailable' });
    expect(setBrandLogo).not.toHaveBeenCalled();
    expect(selfContactField()).toBeUndefined();
  });

  it('Ε4 η κανονικοποίηση αρνήθηκε την εικόνα ⇒ contact-image-refused, κανένας δεσμός', async () => {
    seedContact('cont_a', { logoURL: IMAGE_URL });
    readImageBytes.mockResolvedValue(IMAGE_BYTES);
    setBrandLogo.mockResolvedValue({ kind: 'refused', refusal: 'format' });
    const outcome = await linkSelfContact(COMPANY, 'cont_a', 'use-contact-image', ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal: 'contact-image-refused' });
    expect(selfContactField()).toBeUndefined();
  });

  it('Ε5 σύνδεση που θα αρνηθεί ΔΕΝ αγγίζει το λογότυπο (ο προέλεγχος προηγείται της εικόνας)', async () => {
    seedContact('cont_x', { companyId: OTHER_COMPANY, logoURL: IMAGE_URL });
    const outcome = await linkSelfContact(COMPANY, 'cont_x', 'use-contact-image', ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal: 'contact-not-found' });
    expect(readImageBytes).not.toHaveBeenCalled();
    expect(setBrandLogo).not.toHaveBeenCalled();
  });

  it('Ε6 «μένει το τρέχον λογότυπο» δεν διαβάζει καν την εικόνα της επαφής', async () => {
    seedContact('cont_a', { logoURL: IMAGE_URL });
    await linkSelfContact(COMPANY, 'cont_a', 'keep-workspace-logo', ADMIN);
    expect(readImageBytes).not.toHaveBeenCalled();
    expect(setBrandLogo).not.toHaveBeenCalled();
  });
});

describe('Δ — δημιουργία επαφής από τα στοιχεία του χώρου', () => {
  it('Δ1 επαφή ΚΑΙ δεσμός μαζί, από τα στοιχεία του προφίλ, με γέννηση και Ιστορικό', async () => {
    const outcome = await createSelfContactFromWorkspace(COMPANY, ADMIN);
    expect(outcome).toMatchObject({ kind: 'linked', selfContact: { contactId: 'cont_new', linkedBy: 'u_admin' } });
    expect(fake.getData(COLLECTIONS.CONTACTS, 'cont_new')).toMatchObject({
      type: 'company',
      companyId: COMPANY,
      companyName: 'Παγώνης Κατασκευαστική ΑΕ',
      displayName: 'Παγώνης Κατασκευαστική ΑΕ',
      vatNumber: '094012345',
      createdBy: 'u_admin',
    });
    expect(selfContactField()).toMatchObject({ contactId: 'cont_new' });
    expect(recordBirth).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'cont_new', companyId: COMPANY, performedBy: 'u_admin' }));
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      changes: [expect.objectContaining({ field: 'selfContact', oldValue: null, newValue: 'cont_new' })],
    }));
  });

  it('Δ2 ο χώρος δείχνει ήδη επαφή ⇒ already-linked και ΚΑΜΙΑ νέα επαφή (ποτέ ορφανή)', async () => {
    await linkSelfContact(COMPANY, 'cont_a', 'keep-workspace-logo', ADMIN);
    const outcome = await createSelfContactFromWorkspace(COMPANY, ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal: 'already-linked' });
    expect(fake.getData(COLLECTIONS.CONTACTS, 'cont_new')).toBeUndefined();
    expect(recordBirth).not.toHaveBeenCalled();
  });

  it('Δ3 το προφίλ δεν έχει επωνυμία ⇒ profile-nameless, τίποτα δεν γράφεται', async () => {
    readTax.mockResolvedValue({ ...PROFILE_TAX, declaration: { ...PROFILE_TAX.declaration, businessName: '   ' } });
    const outcome = await createSelfContactFromWorkspace(COMPANY, ADMIN);
    expect(outcome).toEqual({ kind: 'refused', refusal: 'profile-nameless' });
    expect(fake.getData(COLLECTIONS.CONTACTS, 'cont_new')).toBeUndefined();
  });

  it.each([
    ['ΑΦΜ/επωνυμία', () => readTax.mockResolvedValue({ kind: 'unavailable' })],
    ['στοιχεία επικοινωνίας', () => readChannels.mockResolvedValue({ kind: 'unavailable' })],
  ])('Δ4 βλάβη ανάγνωσης προφίλ (%s) ⇒ unavailable, ΟΧΙ «χωρίς επωνυμία», τίποτα δεν γράφεται', async (_label, arrange) => {
    arrange();
    const writesBefore = fake.writes;
    expect(await createSelfContactFromWorkspace(COMPANY, ADMIN)).toEqual({ kind: 'unavailable' });
    expect(fake.writes).toBe(writesBefore);
  });

  it('Δ5 το έγγραφο του χώρου δεν υπάρχει ⇒ absent και καμία επαφή', async () => {
    expect(await createSelfContactFromWorkspace('comp_missing', ADMIN)).toEqual({ kind: 'absent' });
    expect(fake.getData(COLLECTIONS.CONTACTS, 'cont_new')).toBeUndefined();
  });
});

describe('Φ — φραγμός διπλού ΑΦΜ στη δημιουργία (ADR-951 §4.1 · ADR-944 §9)', () => {
  /** Το ΑΦΜ του προφίλ, κανονικοποιημένο (`' 094 012 345 '`). */
  const PROFILE_VAT = '094012345';

  const expectNothingWritten = () => {
    expect(fake.getData(COLLECTIONS.CONTACTS, 'cont_new')).toBeUndefined();
    expect(selfContactField()).toBeUndefined();
    expect(recordBirth).not.toHaveBeenCalled();
    expect(recordChange).not.toHaveBeenCalled();
  };

  it('Φ1 ενεργή επαφή του χώρου με το ίδιο ΑΦΜ ⇒ tax-id-taken με τον κάτοχο, ΤΙΠΟΤΑ δεν γράφεται (το ζωντανό σφάλμα)', async () => {
    seedContact('cont_dup', { vatNumber: PROFILE_VAT });
    const outcome = await createSelfContactFromWorkspace(COMPANY, ADMIN);
    expect(outcome).toEqual({
      kind: 'tax-id-taken',
      holders: [{ contactId: 'cont_dup', displayName: 'Επαφή cont_dup', type: 'company', archived: false }],
    });
    expectNothingWritten();
  });

  it('Φ2 κάτοχος στο ΑΡΧΕΙΟ μετρά (μοτίβο Odoo active_test=False), σημαδεμένος archived', async () => {
    seedContact('cont_old', { vatNumber: PROFILE_VAT, status: 'archived' });
    expect(await createSelfContactFromWorkspace(COMPANY, ADMIN)).toEqual({
      kind: 'tax-id-taken',
      holders: [{ contactId: 'cont_old', displayName: 'Επαφή cont_old', type: 'company', archived: true }],
    });
    expectNothingWritten();
  });

  it('Φ2β επαφή στον ΚΑΔΟ δεν είναι κάτοχος (ADR-944 §9.7) ⇒ η δημιουργία περνά χωρίς επιβεβαίωση', async () => {
    seedContact('cont_trashed', { vatNumber: PROFILE_VAT, status: 'deleted' });
    expect(await createSelfContactFromWorkspace(COMPANY, ADMIN)).toMatchObject({ kind: 'linked' });
    expect(fake.getData(COLLECTIONS.CONTACTS, 'cont_new')).toMatchObject({ vatNumber: PROFILE_VAT });
  });

  it('Φ3 και φυσικό πρόσωπο με το ίδιο ΑΦΜ (ατομική επιχείρηση) ⇒ confirm ⇒ tax-id-taken', async () => {
    seedContact('cont_person', { type: 'individual', vatNumber: PROFILE_VAT, companyName: null, firstName: 'Γιώργος', lastName: 'Π' });
    expect(await createSelfContactFromWorkspace(COMPANY, ADMIN)).toMatchObject({
      kind: 'tax-id-taken', holders: [{ contactId: 'cont_person', displayName: 'Γιώργος Π', type: 'individual' }],
    });
  });

  it('Φ4 ρητή επιβεβαίωση ⇒ η επαφή ΚΑΙ ο δεσμός γράφονται παρά τον κάτοχο', async () => {
    seedContact('cont_dup', { vatNumber: PROFILE_VAT });
    const outcome = await createSelfContactFromWorkspace(COMPANY, ADMIN, true);
    expect(outcome).toMatchObject({ kind: 'linked', selfContact: { contactId: 'cont_new' } });
    expect(fake.getData(COLLECTIONS.CONTACTS, 'cont_new')).toMatchObject({ vatNumber: PROFILE_VAT });
    expect(recordBirth).toHaveBeenCalledTimes(1);
  });

  it('Φ5 ίδιο ΑΦΜ σε ΑΛΛΟ χώρο δεν μετρά (απομόνωση μισθωτή) ⇒ δημιουργία', async () => {
    seedContact('cont_foreign', { companyId: OTHER_COMPANY, vatNumber: PROFILE_VAT });
    expect(await createSelfContactFromWorkspace(COMPANY, ADMIN)).toMatchObject({ kind: 'linked' });
  });

  it('Φ6 προφίλ χωρίς έγκυρο ΑΦΜ ⇒ τίποτα να συγκρουστεί ⇒ δημιουργία', async () => {
    seedContact('cont_dup', { vatNumber: PROFILE_VAT });
    readTax.mockResolvedValue({ ...PROFILE_TAX, taxId: null });
    expect(await createSelfContactFromWorkspace(COMPANY, ADMIN)).toMatchObject({ kind: 'linked' });
  });

  it('Φ7 ο δεσμός κρίνεται ΠΡΙΝ από το ΑΦΜ: συνδεδεμένος χώρος ⇒ already-linked, όχι tax-id-taken', async () => {
    seedContact('cont_dup', { vatNumber: PROFILE_VAT });
    await linkSelfContact(COMPANY, 'cont_dup', 'keep-workspace-logo', ADMIN);
    expect(await createSelfContactFromWorkspace(COMPANY, ADMIN)).toEqual({ kind: 'refused', refusal: 'already-linked' });
  });
});

describe('Α — αποσύνδεση', () => {
  it('Α1 σβήνει μόνο τον δεσμό· η επαφή μένει· Ιστορικό παλιό → κενό', async () => {
    await linkSelfContact(COMPANY, 'cont_a', 'keep-workspace-logo', ADMIN);
    recordChange.mockClear();
    expect(await unlinkSelfContact(COMPANY, ADMIN)).toEqual({ kind: 'unlinked' });
    expect(selfContactField()).toBeUndefined();
    expect(fake.getData(COLLECTIONS.CONTACTS, 'cont_a')).toBeDefined();
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      changes: [expect.objectContaining({ field: 'selfContact', oldValue: 'cont_a', newValue: null })],
    }));
  });

  it('Α2 ιδεμποτία: αποσύνδεση χωρίς δεσμό ⇒ unlinked, καμία εγγραφή, κανένα Ιστορικό', async () => {
    const writesBefore = fake.writes;
    expect(await unlinkSelfContact(COMPANY, ADMIN)).toEqual({ kind: 'unlinked' });
    expect(fake.writes).toBe(writesBefore);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Α3 ο χώρος δεν υπάρχει ⇒ absent', async () => {
    expect(await unlinkSelfContact('comp_missing', ADMIN)).toEqual({ kind: 'absent' });
  });
});
