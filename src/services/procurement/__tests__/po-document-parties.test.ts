/**
 * ADR-923 §5.11 «3γ» Α11 — τα μέρη του εγγράφου παραγγελίας από ΕΝΑ SSoT.
 *
 * Τι κλειδώνει: (α) ο αποστολέας είναι ο φορέας του προφίλ, όχι καρφωμένη επωνυμία· (β) ο παραλήπτης είναι η
 * επαφή του προμηθευτή, όχι το ωμό id της· (γ) χωρίς προφίλ ή χωρίς (δική μας) επαφή ⇒ καμία επινόηση.
 */

import type { DocumentData } from 'firebase-admin/firestore';

import type { CompanyProfile } from '@/subapps/accounting/types/company';

const mockGetCompanySetup = jest.fn();
const mockReadOwnedContactDocs = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('@/subapps/accounting/services/repository/accounting-repo-company-setup', () => ({
  getCompanySetup: (...args: unknown[]) => mockGetCompanySetup(...args),
}));
jest.mock('@/server/lib/owned-contact-docs', () => ({
  readOwnedContactDocs: (...args: unknown[]) => mockReadOwnedContactDocs(...args),
}));
jest.mock('@/services/sales-accounting/sales-accounting-helpers', () => ({
  buildIssuer: (profile: CompanyProfile) => ({
    name: profile.businessName,
    vatNumber: profile.vatNumber,
    taxOffice: profile.taxOffice,
    address: profile.address,
    city: profile.city,
    postalCode: profile.postalCode,
    phone: profile.phone,
    mobile: profile.mobile ?? null,
    email: profile.email,
  }),
}));

import {
  companyInfoFromProfile,
  resolvePODocumentParties,
  supplierInfoFromContactDoc,
} from '../po-document-parties';

const COMPANY = 'comp_a';
const CALLER = { companyId: COMPANY, uid: 'user_1' };

const PROFILE = {
  businessName: 'ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.',
  vatNumber: '801832652',
  taxOffice: 'ΦΑΕ Θεσσαλονίκης',
  address: 'Σαμοθράκης 16',
  city: 'Θεσσαλονίκη',
  postalCode: '56334',
  phone: '2310559595',
  mobile: null,
  email: 'info@example.gr',
} as unknown as CompanyProfile;

const SUPPLIER_DOC: DocumentData = {
  type: 'individual',
  firstName: 'Γεωργία',
  lastName: 'Ζέρβα',
  vatNumber: '123456789',
  emails: [{ email: 'old@example.gr', isPrimary: false }, { email: 'g.zerva@example.gr', isPrimary: true }],
  phones: [{ number: '6900000000', isPrimary: true }],
  addresses: [{ street: 'Εγνατίας', number: '10', city: 'Θεσσαλονίκη', postalCode: '54630', isPrimary: true }],
  companyId: COMPANY,
};

beforeEach(() => {
  mockGetCompanySetup.mockReset();
  mockReadOwnedContactDocs.mockReset();
});

describe('companyInfoFromProfile', () => {
  it('ο αποστολέας είναι ο φορέας του προφίλ, με διεύθυνση ΕΛΤΑ', () => {
    expect(companyInfoFromProfile(PROFILE)).toEqual({
      name: 'ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.',
      vatNumber: '801832652',
      address: 'Σαμοθράκης 16, Θεσσαλονίκη, 563 34',
      phone: '2310559595',
      email: 'info@example.gr',
    });
  });

  it('χωρίς σταθερό τηλέφωνο ⇒ το κινητό', () => {
    const profile = { ...PROFILE, phone: null, mobile: '6911111111' } as unknown as CompanyProfile;
    expect(companyInfoFromProfile(profile).phone).toBe('6911111111');
  });
});

describe('supplierInfoFromContactDoc', () => {
  it('ο παραλήπτης είναι η επαφή: όνομα, ΑΦΜ, κύρια διεύθυνση/email/τηλέφωνο', () => {
    expect(supplierInfoFromContactDoc(SUPPLIER_DOC)).toEqual({
      name: 'Γεωργία Ζέρβα',
      vatNumber: '123456789',
      address: 'Εγνατίας 10, Θεσσαλονίκη, 546 30',
      phone: '6900000000',
      email: 'g.zerva@example.gr',
    });
  });

  it('επαφή χωρίς στοιχεία ⇒ μόνο όνομα, κανένα κενό πεδίο', () => {
    expect(supplierInfoFromContactDoc({ type: 'individual', firstName: 'Γεωργία', lastName: 'Ζέρβα' }))
      .toEqual({ name: 'Γεωργία Ζέρβα' });
  });

  it('παλιά εταιρεία με μόνο διακριτικό τίτλο ⇒ ο τίτλος (legacy εφεδρεία του ωμού εγγράφου)', () => {
    expect(supplierInfoFromContactDoc({ type: 'company', tradeName: 'ΚΑΛΩΔΙΑ ΑΕ', vatNumber: '999999999' }))
      .toEqual({ name: 'ΚΑΛΩΔΙΑ ΑΕ', vatNumber: '999999999' });
  });

  it('επαφή χωρίς αναγνώσιμο όνομα ⇒ null', () => {
    expect(supplierInfoFromContactDoc({ type: 'individual' })).toBeNull();
  });
});

describe('resolvePODocumentParties', () => {
  it('διαβάζει το προφίλ του φορέα και την επαφή του προμηθευτή μέσα στον ίδιο μισθωτή', async () => {
    mockGetCompanySetup.mockResolvedValue(PROFILE);
    mockReadOwnedContactDocs.mockResolvedValue(new Map([['cont_1', SUPPLIER_DOC]]));

    const result = await resolvePODocumentParties(CALLER, { supplierId: 'cont_1' });

    expect(mockGetCompanySetup).toHaveBeenCalledWith({ companyId: COMPANY, userId: 'user_1' });
    expect(mockReadOwnedContactDocs).toHaveBeenCalledWith(expect.anything(), COMPANY, ['cont_1']);
    expect(result).toEqual({
      ok: true,
      companyInfo: expect.objectContaining({ name: PROFILE.businessName, vatNumber: '801832652' }),
      supplierInfo: expect.objectContaining({ name: 'Γεωργία Ζέρβα', vatNumber: '123456789' }),
    });
  });

  it('χωρίς προφίλ φορέα ⇒ άρνηση, όχι καρφωμένη επωνυμία', async () => {
    mockGetCompanySetup.mockResolvedValue(null);
    mockReadOwnedContactDocs.mockResolvedValue(new Map([['cont_1', SUPPLIER_DOC]]));
    await expect(resolvePODocumentParties(CALLER, { supplierId: 'cont_1' }))
      .resolves.toEqual({ ok: false, reason: 'company_profile_missing' });
  });

  it('ξένη ή ανύπαρκτη επαφή ⇒ άρνηση, όχι το ωμό id ως όνομα', async () => {
    mockGetCompanySetup.mockResolvedValue(PROFILE);
    mockReadOwnedContactDocs.mockResolvedValue(new Map());
    await expect(resolvePODocumentParties(CALLER, { supplierId: 'cont_foreign' }))
      .resolves.toEqual({ ok: false, reason: 'supplier_missing' });
  });

  it('χωρίς προμηθευτή ⇒ καμία ανάγνωση επαφής, άρνηση', async () => {
    mockGetCompanySetup.mockResolvedValue(PROFILE);
    await expect(resolvePODocumentParties(CALLER, { supplierId: '' }))
      .resolves.toEqual({ ok: false, reason: 'supplier_missing' });
    expect(mockReadOwnedContactDocs).not.toHaveBeenCalled();
  });
});
