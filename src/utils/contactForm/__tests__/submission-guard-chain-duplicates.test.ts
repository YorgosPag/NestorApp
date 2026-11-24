/**
 * ADR-944 §9 — ο φρουρός 0 της αλυσίδας αποθήκευσης (διπλό ΑΦΜ / email).
 *
 * Τι φυλάει: (α) `block` ⇒ καμία εγγραφή, καμία «συνέχεια», και ο καλών ξέρει ότι το μήνυμα ειπώθηκε ήδη
 * (`announced`)· (β) `confirm` ⇒ η πράξη **δεν** τρέχει πριν από την επιβεβαίωση· (γ) μετά την επιβεβαίωση η αλυσίδα
 * **ξανατρέχει** — η επιβεβαίωση ενός διπλοτύπου δεν προσπερνά τους υπόλοιπους φρουρούς· (δ) χωρίς εύρημα, περνά.
 */

import type { Contact, EmailInfo } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { IdentifierDuplicateDialogState } from '@/types/contact-submission-dialog.types';

const mockDetect = jest.fn();
const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('../identifier-duplicate-guard', () => ({
  detectIdentifierDuplicates: (...args: unknown[]) => mockDetect(...args),
}));
jest.mock('@/services/contacts.service', () => ({
  ContactsService: { getDisplayName: () => 'Γεώργιος Παγώνης' },
}));
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
}));

import { runGuardChain, type IdentifierDuplicateResume } from '../submission-guard-chain';

type ChainDeps = Parameters<typeof runGuardChain>[0];

function email(address: string): EmailInfo {
  return { email: address, type: 'personal', isPrimary: true };
}

const CONTACT = { id: 'cont_self', type: 'individual', companyId: 'comp_1', firstName: 'Γεώργιος', lastName: 'Παγώνης', emails: [email('a@x.gr')] } as Contact;

const BLOCK: IdentifierDuplicateDialogState = {
  decision: 'block',
  vat: { value: '077030866', holders: [{ id: 'cont_other', name: 'Άλλος', type: 'individual' }] },
  emails: [],
};
const CONFIRM: IdentifierDuplicateDialogState = { ...BLOCK, decision: 'confirm' };

function setup(formEmails: EmailInfo[] = [email('a@x.gr')]) {
  const ref = <T,>(current: T) => ({ current });
  const action = jest.fn().mockResolvedValue(undefined);
  const setIdentifierDuplicateDialog = jest.fn();
  const notifications = { success: jest.fn(), error: jest.fn() };
  const identifierDuplicateResumeRef = ref<IdentifierDuplicateResume | null>(null);
  const deps: ChainDeps = {
    editContact: CONTACT,
    editContactId: 'cont_self',
    contactData: {},
    formData: { emails: formEmails, phones: [] } as unknown as ContactFormData,
    action,
    identifierDuplicateConfirmedRef: ref(false),
    identifierDuplicateResumeRef,
    setIdentifierDuplicateDialog,
    nameCascadeConfirmedRef: ref(false),
    addressImpactConfirmedRef: ref(false),
    companyIdentityConfirmedRef: ref(false),
    communicationImpactConfirmedRef: ref(false),
    deferredSubmitRef: ref<(() => Promise<void>) | null>(null),
    deferredAddressSubmitRef: ref<(() => Promise<void>) | null>(null),
    deferredIdentitySubmitRef: ref<(() => Promise<void>) | null>(null),
    deferredCommunicationSubmitRef: ref<(() => Promise<void>) | null>(null),
    setNameCascadeDialog: jest.fn(),
    setAddressImpactDialog: jest.fn(),
    setCompanyIdentityDialog: jest.fn(),
    setCommunicationImpactDialog: jest.fn(),
    notifications,
  };
  return { deps, action, setIdentifierDuplicateDialog, notifications, identifierDuplicateResumeRef };
}

beforeEach(() => {
  mockDetect.mockReset().mockResolvedValue(null);
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('φρουρός 0 — διπλό ΑΦΜ / email', () => {
  it('κανένα εύρημα ⇒ η αλυσίδα περνά (η πράξη είναι του καλούντα)', async () => {
    const { deps, setIdentifierDuplicateDialog } = setup();
    expect(await runGuardChain(deps)).toEqual({ blocked: false, deferred: false });
    expect(mockDetect).toHaveBeenCalledWith(CONTACT, deps.formData);
    expect(setIdentifierDuplicateDialog).not.toHaveBeenCalled();
  });

  it('block ⇒ διάλογος, `announced`, ΚΑΜΙΑ συνέχεια και καμία εγγραφή', async () => {
    mockDetect.mockResolvedValue(BLOCK);
    const { deps, action, setIdentifierDuplicateDialog, identifierDuplicateResumeRef } = setup();
    const result = await runGuardChain(deps);
    expect(result).toMatchObject({ blocked: true, announced: true });
    expect(setIdentifierDuplicateDialog).toHaveBeenCalledWith(BLOCK);
    expect(identifierDuplicateResumeRef.current).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it('confirm ⇒ διάλογος και αναμονή· η πράξη ΔΕΝ τρέχει πριν από την επιβεβαίωση', async () => {
    mockDetect.mockResolvedValue(CONFIRM);
    const { deps, action, setIdentifierDuplicateDialog, identifierDuplicateResumeRef } = setup();
    expect(await runGuardChain(deps)).toEqual({ blocked: false, deferred: true, guardType: 'identifierDuplicate' });
    expect(setIdentifierDuplicateDialog).toHaveBeenCalledWith(CONFIRM);
    expect(identifierDuplicateResumeRef.current).not.toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it('επιβεβαίωση ⇒ η αλυσίδα ξανατρέχει ΧΩΡΙΣ να ξαναρωτήσει για το διπλότυπο, και η επαφή γράφεται μία φορά', async () => {
    mockDetect.mockResolvedValue(CONFIRM);
    const { deps, action, identifierDuplicateResumeRef } = setup();
    await runGuardChain(deps);
    const resume = identifierDuplicateResumeRef.current as IdentifierDuplicateResume;
    expect(await resume()).toBe(true);
    expect(mockDetect).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(deps.identifierDuplicateConfirmedRef.current).toBe(false);
  });

  it('επιβεβαίωση ΔΕΝ προσπερνά τον φραγμό email-άγκυρας: ο επόμενος φρουρός μπλοκάρει, καμία εγγραφή', async () => {
    mockDetect.mockResolvedValue(CONFIRM);
    mockPost.mockResolvedValue({ anchoredEmailKeys: ['a@x.gr'], totalAffected: 1 });
    // Η φόρμα αφαιρεί το email της επαφής ⇒ ο φρουρός επικοινωνίας ρωτά τον διακομιστή.
    const { deps, action, notifications, identifierDuplicateResumeRef } = setup([]);
    await runGuardChain(deps);
    const resume = identifierDuplicateResumeRef.current as IdentifierDuplicateResume;
    expect(await resume()).toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith('common-shared.contacts.communicationImpact.accountAnchorRemoval');
  });
});
