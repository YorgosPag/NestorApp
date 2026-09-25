/**
 * ADR-866 §5.2 σημείο 7 · §2.6.8 Β3 — **έλεγχος ανεβάσματος για κάτοχο «εταιρεία Ή άνθρωπος»**.
 *
 * - Άνθρωπος: **κανένα** claim εταιρείας (ο ιδιώτης δεν έχει και δεν αποκτά — ADR-787 Ε-3 §3)·
 *   ο κάτοχος **πρέπει** να είναι ο συνδεδεμένος· **καμία** παράκαμψη super admin.
 * - Εταιρεία: ό,τι ίσχυε — **ο ίδιος** `validateUploadAuth` (claim + ταύτιση εταιρείας).
 *
 * Μετάλλαξη που πρέπει να πιάσει: αφαίρεση του ελέγχου `userId === uid`.
 */

jest.mock('@/services/file-folder.service', () => ({ FileFolderService: {} }));
jest.mock('@/services/document-template.service', () => ({ DocumentTemplateService: {} }));
jest.mock('@/services/file-comment.service', () => ({ FileCommentService: {} }));
jest.mock('@/services/file-approval.service', () => ({ FileApprovalService: {} }));
jest.mock('@/services/file-record.service', () => ({ FileRecordService: {} }));
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { request: jest.fn() } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

interface FakeUser {
  uid: string;
  getIdTokenResult: jest.Mock;
}

const mockAuth: { currentUser: FakeUser | null } = { currentUser: null };
// Getter: το `jest.mock` ανεβαίνει πάνω από το `const` — η τιμή διαβάζεται όταν ρωτηθεί, όχι στη δήλωση.
jest.mock('@/lib/firebase', () => ({
  get auth() {
    return mockAuth;
  },
}));

import { validateCustodyUploadAuth } from '../file-mutation-gateway';

function signIn(uid: string, claims: Record<string, unknown>): FakeUser {
  const user = { uid, getIdTokenResult: jest.fn().mockResolvedValue({ claims }) };
  mockAuth.currentUser = user;
  return user;
}

beforeEach(() => {
  mockAuth.currentUser = null;
});

describe('validateCustodyUploadAuth — άνθρωπος', () => {
  test('ο κάτοχος είναι ο συνδεδεμένος, ΧΩΡΙΣ claim εταιρείας ⇒ επιτρέπεται, διαμέρισμα personal', async () => {
    const user = signIn('uid_1', {});

    await expect(validateCustodyUploadAuth({ userId: 'uid_1' })).resolves.toEqual({ uid: 'uid_1', custody: 'personal' });
    // Κανένας έλεγχος claim για τον ιδιώτη — ούτε καν ανανέωση token.
    expect(user.getIdTokenResult).not.toHaveBeenCalled();
  });

  test('ξένο userId ⇒ UPLOAD_AUTH_CUSTODY_MISMATCH', async () => {
    signIn('uid_1', {});
    await expect(validateCustodyUploadAuth({ userId: 'uid_other' })).rejects.toThrow('UPLOAD_AUTH_CUSTODY_MISMATCH');
  });

  test('ούτε ο super admin γράφει στον χώρο άλλου ανθρώπου', async () => {
    signIn('uid_admin', { globalRole: 'super_admin', companyId: 'comp_1' });
    await expect(validateCustodyUploadAuth({ userId: 'uid_1' })).rejects.toThrow('UPLOAD_AUTH_CUSTODY_MISMATCH');
  });

  test('κανένας συνδεδεμένος ⇒ UPLOAD_AUTH_REQUIRED', async () => {
    await expect(validateCustodyUploadAuth({ userId: 'uid_1' })).rejects.toThrow('UPLOAD_AUTH_REQUIRED');
  });
});

describe('validateCustodyUploadAuth — εταιρεία (αμετάβλητο)', () => {
  test('claim ίδιας εταιρείας ⇒ επιτρέπεται, διαμέρισμα company', async () => {
    signIn('uid_1', { companyId: 'comp_1' });
    await expect(validateCustodyUploadAuth({ companyId: 'comp_1' })).resolves.toEqual({ uid: 'uid_1', custody: 'company' });
  });

  test('χωρίς claim εταιρείας ⇒ UPLOAD_AUTH_MISSING_COMPANY (ο ιδιώτης δεν περνά από εδώ)', async () => {
    signIn('uid_1', {});
    await expect(validateCustodyUploadAuth({ companyId: 'comp_1' })).rejects.toThrow('UPLOAD_AUTH_MISSING_COMPANY');
  });

  test('άλλη εταιρεία ⇒ UPLOAD_AUTH_COMPANY_MISMATCH', async () => {
    signIn('uid_1', { companyId: 'comp_2' });
    await expect(validateCustodyUploadAuth({ companyId: 'comp_1' })).rejects.toThrow('UPLOAD_AUTH_COMPANY_MISMATCH');
  });
});
