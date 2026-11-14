/**
 * ADR-915 §39 — **το βήμα λογαριασμού**: νέος ⇒ `create`, υπάρχων ⇒ `sign-in`, σφάλμα ⇒ `sign-in` (ποτέ δεν πετά),
 * και η διεύθυνση βγαίνει **μόνο καλυμμένη**.
 */

jest.mock('server-only', () => ({}));

const getUserByEmail = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminAuth: () => ({ getUserByEmail }) }));

import { invitationAccountStepOf, pageAccountStepOf } from '../invitation-account-step';

const notFound = Object.assign(new Error('no user'), { code: 'auth/user-not-found' });

describe('invitationAccountStepOf', () => {
  beforeEach(() => getUserByEmail.mockReset());

  it('κανένας λογαριασμός ⇒ create, με καλυμμένη διεύθυνση και πρόταση Google για Gmail', async () => {
    getUserByEmail.mockRejectedValue(notFound);
    await expect(invitationAccountStepOf(' Georgios.Pagonis+arch1@Gmail.com ')).resolves.toEqual({
      kind: 'create',
      maskedEmail: 'g***1@gmail.com',
      googleSuggested: true,
    });
    expect(getUserByEmail).toHaveBeenCalledWith('georgios.pagonis+arch1@gmail.com');
  });

  it('υπάρχων λογαριασμός με κωδικό ⇒ sign-in, χωρίς πρόταση Google', async () => {
    getUserByEmail.mockResolvedValue({ providerData: [{ providerId: 'password' }] });
    await expect(invitationAccountStepOf('maria@office.gr')).resolves.toEqual({
      kind: 'sign-in',
      maskedEmail: 'm***a@office.gr',
      googleSuggested: false,
    });
  });

  it('υπάρχων λογαριασμός Google ⇒ sign-in με πρόταση Google, ακόμη και σε μη-Gmail domain', async () => {
    getUserByEmail.mockResolvedValue({ providerData: [{ providerId: 'google.com' }] });
    await expect(invitationAccountStepOf('nikos@workspace.gr')).resolves.toMatchObject({ kind: 'sign-in', googleSuggested: true });
  });

  it('άλλο σφάλμα του Firebase ⇒ sign-in (ασφαλής προεπιλογή), ποτέ δεν πετά', async () => {
    getUserByEmail.mockRejectedValue(new Error('network'));
    await expect(invitationAccountStepOf('maria@office.gr')).resolves.toMatchObject({ kind: 'sign-in' });
  });

  it('το πλήρες email δεν εμφανίζεται ΠΟΥΘΕΝΑ στο αποτέλεσμα', async () => {
    getUserByEmail.mockRejectedValue(notFound);
    const step = await invitationAccountStepOf('georgios.pagonis+arch1@gmail.com');
    expect(JSON.stringify(step)).not.toContain('georgios.pagonis');
  });
});

describe('pageAccountStepOf — η ΜΙΑ απάντηση «χρειάζεται βήμα;» για όλες τις σελίδες πρόσκλησης (ADR-915 §39.6)', () => {
  const step = { kind: 'create', maskedEmail: 'm***a@office.gr', googleSuggested: false } as const;

  it('καμία όψη (άρνηση/μη διαθέσιμο) ⇒ κανένα βήμα', async () => {
    await expect(pageAccountStepOf(null)).resolves.toBeUndefined();
  });

  it('ο θεατής ΕΙΝΑΙ ο παραλήπτης ⇒ κανένα βήμα, και το Firebase δεν ρωτιέται καν', async () => {
    const accountStep = jest.fn().mockResolvedValue(step);
    await expect(pageAccountStepOf({ addressedToViewer: true, accountStep })).resolves.toBeUndefined();
    expect(accountStep).not.toHaveBeenCalled();
  });

  it.each([
    ['ανώνυμος', null],
    ['άλλος λογαριασμός', false],
  ] as const)('%s ⇒ το βήμα του παραλήπτη', async (_who, addressedToViewer) => {
    const accountStep = jest.fn().mockResolvedValue(step);
    await expect(pageAccountStepOf({ addressedToViewer, accountStep })).resolves.toEqual(step);
    expect(accountStep).toHaveBeenCalledTimes(1);
  });
});
