/**
 * @jest-environment node
 *
 * @fileoverview **ΤΑ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ ΑΠΟ ΤΟ ΔΙΚΟ ΜΑΣ MAILER** (ADR-851 Φ2) — άγκυρες.
 * @related server/auth/auth-action-mail.ts
 *
 * - **Α** — απαρίθμηση: άγνωστο/απενεργοποιημένο email ⇒ **καμία** αποστολή.
 * - **Γ** — γλώσσα: η **δηλωμένη** κερδίζει την οθόνη· χωρίς δήλωση ⇒ η οθόνη.
 * - **Σ** — σύνδεσμος: **ποτέ** της κονσόλας· χωρίς δημόσια διεύθυνση ⇒ **κανένα** email.
 * - **Ε** — επιβεβαίωση: ήδη επιβεβαιωμένος ⇒ τίποτα.
 */

jest.mock('server-only', () => ({}));

const getUserByEmailMock = jest.fn();
const getUserMock = jest.fn();
const resetLinkMock = jest.fn(async () => 'https://nestor-pagonis.vercel.app/auth/action?mode=resetPassword&oobCode=R1&apiKey=k');
const verifyLinkMock = jest.fn(async () => 'https://nestor-pagonis.vercel.app/auth/action?mode=verifyEmail&oobCode=V1&apiKey=k');

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    getUserByEmail: (...args: unknown[]) => getUserByEmailMock(...args),
    getUser: (...args: unknown[]) => getUserMock(...args),
    generatePasswordResetLink: () => resetLinkMock(),
    generateEmailVerificationLink: () => verifyLinkMock(),
  }),
}));

const declaredLanguageMock = jest.fn(async (): Promise<string | null> => null);
jest.mock('@/server/notifications/user-notification-settings-store', () => ({
  loadDeclaredEmailLanguage: () => declaredLanguageMock(),
}));

const sendMock = jest.fn(async (..._args: unknown[]) => ({ success: true }));
jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: (...args: unknown[]) => sendMock(...args),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const quotaMock = jest.fn(async (..._args: unknown[]) => ({ allowed: true }));
jest.mock('@/lib/middleware/rate-limiter', () => ({
  checkQuota: (...args: unknown[]) => quotaMock(...args),
}));

import { sendEmailVerificationMail, sendPasswordResetMail } from '../auth-action-mail';

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';
});
afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

function account(overrides: Record<string, unknown> = {}) {
  return { uid: 'uid_1', email: 'maria@example.com', emailVerified: false, disabled: false, ...overrides };
}

function sentMail(): { to: string; subject: string; textBody: string; htmlBody: string } {
  return sendMock.mock.calls[0][0] as { to: string; subject: string; textBody: string; htmlBody: string };
}

describe('Α — καμία απαρίθμηση', () => {
  it('🔒 Α1 — άγνωστο email: ΚΑΜΙΑ αποστολή, ΚΑΝΕΝΑ σφάλμα προς τα πάνω', async () => {
    getUserByEmailMock.mockRejectedValue({ code: 'auth/user-not-found' });
    await expect(sendPasswordResetMail({ email: 'nobody@example.com', requestedLanguage: 'el' })).resolves.toBe('skipped');
    expect(sendMock).not.toHaveBeenCalled();
    expect(resetLinkMock).not.toHaveBeenCalled();
  });

  it('Α2 — απενεργοποιημένος λογαριασμός: τίποτα (ο αποκλεισμός δεν ξεκλειδώνεται με reset)', async () => {
    getUserByEmailMock.mockResolvedValue(account({ disabled: true }));
    await expect(sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' })).resolves.toBe('skipped');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('Α3 — άλλο σφάλμα της Firebase ΠΕΤΑ (ο καλών το καταγράφει· «δεν μάθαμε» ≠ «δεν υπάρχει»)', async () => {
    getUserByEmailMock.mockRejectedValue({ code: 'auth/internal-error' });
    await expect(sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' })).rejects.toBeDefined();
  });
});

describe('Γ — η γλώσσα του παραλήπτη', () => {
  it('🔑 Γ1 — η ΔΗΛΩΜΕΝΗ γλώσσα κερδίζει την οθόνη', async () => {
    getUserByEmailMock.mockResolvedValue(account());
    declaredLanguageMock.mockResolvedValueOnce('en');

    await sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' });

    expect(sentMail().subject).toBe('Set a new password — Nestor');
    expect(sentMail().htmlBody).toContain('<html lang="en">');
  });

  it('Γ2 — χωρίς δήλωση ⇒ η γλώσσα της οθόνης που ζήτησε', async () => {
    getUserByEmailMock.mockResolvedValue(account());

    await sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'en' });

    expect(sentMail().htmlBody).toContain('<html lang="en">');
  });

  it('Γ3 — η ανάγνωση της δήλωσης απέτυχε ⇒ η οθόνη, και το email ΦΕΥΓΕΙ', async () => {
    getUserByEmailMock.mockResolvedValue(account());
    declaredLanguageMock.mockRejectedValueOnce(new Error('firestore down'));

    await expect(sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' })).resolves.toBe('sent');
  });
});

describe('Σ — ο σύνδεσμος', () => {
  it('🔴 Σ1 — ΠΟΤΕ η διεύθυνση της κονσόλας (νεκρό Vercel) · ΠΟΤΕ το apiKey', async () => {
    getUserByEmailMock.mockResolvedValue(account());

    await sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' });

    expect(sentMail().textBody).toContain('https://nestorconstruct.gr/auth/action?mode=resetPassword&oobCode=R1');
    expect(sentMail().textBody).not.toContain('vercel');
    expect(sentMail().textBody).not.toContain('apiKey');
    expect(sentMail().to).toBe('maria@example.com');
  });

  it('🔴 Σ2 — χωρίς δημόσια διεύθυνση: ΚΑΝΕΝΑ email (ποτέ σχετικός ή μαντεμένος σύνδεσμος)', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    getUserByEmailMock.mockResolvedValue(account());

    await expect(sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' })).resolves.toBe('failed');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('Σ3 — ο αποστολέας αρνήθηκε ⇒ `failed`, όχι σιωπηλό «εντάξει»', async () => {
    getUserByEmailMock.mockResolvedValue(account());
    sendMock.mockResolvedValueOnce({ success: false });
    await expect(sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' })).resolves.toBe('failed');
  });
});

describe('Ο — το όριο ανά ΠΑΡΑΛΗΠΤΗ', () => {
  it('🔒 Ο1 — εξαντλημένο όριο: ΚΑΝΕΝΑ email, ούτε κωδικός παράγεται', async () => {
    getUserByEmailMock.mockResolvedValue(account());
    quotaMock.mockResolvedValueOnce({ allowed: false });

    await expect(sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' })).resolves.toBe('throttled');
    expect(resetLinkMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔒 Ο2 — το κλειδί ΔΕΝ περιέχει το email (κατακερματισμένο) · ίδιο για κεφαλαία/μικρά', async () => {
    getUserByEmailMock.mockResolvedValue(account({ email: 'Maria@Example.com' }));
    await sendPasswordResetMail({ email: 'Maria@Example.com', requestedLanguage: 'el' });
    getUserByEmailMock.mockResolvedValue(account({ email: 'maria@example.com' }));
    await sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' });

    const [first, second] = quotaMock.mock.calls.map(([key]) => key as string);
    expect(first).not.toContain('maria');
    expect(first).toBe(second);
  });

  it('Ο3 — το store ορίων έπεσε ⇒ επιτρέπεται (η επαναφορά δεν εξαρτάται από το Redis)', async () => {
    getUserByEmailMock.mockResolvedValue(account());
    quotaMock.mockRejectedValueOnce(new Error('redis down'));
    await expect(sendPasswordResetMail({ email: 'maria@example.com', requestedLanguage: 'el' })).resolves.toBe('sent');
  });
});

describe('Ε — η επιβεβαίωση', () => {
  it('Ε1 — ανεπιβεβαίωτος: στέλνεται, στη ΔΙΚΗ του διεύθυνση, με δικό μας σύνδεσμο', async () => {
    getUserMock.mockResolvedValue(account());

    await expect(sendEmailVerificationMail({ uid: 'uid_1', requestedLanguage: 'el' })).resolves.toBe('sent');
    expect(sentMail().textBody).toContain('https://nestorconstruct.gr/auth/action?mode=verifyEmail&oobCode=V1');
  });

  it('Ε2 — ήδη επιβεβαιωμένος: ΤΙΠΟΤΑ (ούτε κωδικός δεν παράγεται)', async () => {
    getUserMock.mockResolvedValue(account({ emailVerified: true }));

    await expect(sendEmailVerificationMail({ uid: 'uid_1', requestedLanguage: 'el' })).resolves.toBe('skipped');
    expect(verifyLinkMock).not.toHaveBeenCalled();
  });
});
