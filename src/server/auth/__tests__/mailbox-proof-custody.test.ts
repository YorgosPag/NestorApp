/**
 * @jest-environment node
 *
 * @fileoverview **Η ΦΥΛΑΞΗ ΜΕΤΑ ΑΠΟ ΑΠΟΔΕΙΞΗ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟΥ** (ADR-844 §13 · §13.8).
 * @related server/auth/mailbox-proof-custody.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΡΩΤΟΥΝ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **Κ** — η κρίση: τρεις ετυμηγορίες, και ποτέ «ίδιο email = ίδιος άνθρωπος».
 * - **Δ** — η πράξη: η διεκδίκηση **ξαναχτίζει** τον λογαριασμό (όχι «αφαιρεί κωδικό»),
 *   **το κόστος** (ο κάτοχος δεν ρωτιέται για επιβεβαιωμένο λογαριασμό), και **το email**
 *   μόνο όταν αφαιρέθηκε κάτι.
 *
 * ⚠️ Η επαναδημιουργία ζει στο `account-reprovision.ts` και εκεί είναι οι δικές της άγκυρες
 * (σειρά, ημερολόγιο, σφετεριστής). Εδώ είναι **πλαστή** και ρωτάμε **αν** καλείται και **με τι**.
 */

jest.mock('server-only', () => ({}));

const adminLog: string[] = [];
const updateUserMock = jest.fn(async (..._args: unknown[]) => { adminLog.push('updateUser'); });
const resetLinkMock = jest.fn(async (..._args: unknown[]) => 'https://console.example/__/auth/action?mode=resetPassword&oobCode=1');
const reprovisionMock = jest.fn(async (..._args: unknown[]) => {
  adminLog.push('reprovision');
  return { removedProviders: ['password'] as readonly string[] };
});

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    updateUser: (...args: unknown[]) => updateUserMock(...args),
    generatePasswordResetLink: (...args: unknown[]) => resetLinkMock(...args),
  }),
}));

jest.mock('../account-reprovision', () => ({
  reprovisionAuthAccount: (...args: unknown[]) => reprovisionMock(...args),
}));

const ownedLinkMock = jest.fn((link: string): string | null => link.replace('https://console.example/__', 'https://nestorconstruct.gr'));
jest.mock('../auth-action-link', () => ({
  ownedActionLink: (link: string) => ownedLinkMock(link),
}));

const sentryMock = jest.fn();
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  sentryCaptureMessage: (...args: unknown[]) => sentryMock(...args),
}));

const sendMock = jest.fn();
jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: (...args: unknown[]) => sendMock(...args),
}));

import {
  mailboxProofMaySignIn,
  mailboxProofVerdict,
  settleProvenMailbox,
  type ProvenMailboxAccount,
} from '../mailbox-proof-custody';

const MAILBOX = { email: 'maria@example.com', recipientName: 'Μαρία Δ.' } as const;

function account(overrides: Partial<ProvenMailboxAccount> = {}): ProvenMailboxAccount {
  return {
    uid: 'uid_account',
    emailVerified: false,
    secondFactorEnrolled: false,
    ...overrides,
  };
}

/** Κάτοχος συνεδρίας — πλαστός, και **μετρά** πόσες φορές ρωτήθηκε. */
function holder(uid: string | null): jest.Mock<Promise<string | null>, []> {
  return jest.fn(async () => uid);
}

beforeEach(() => {
  jest.clearAllMocks();
  adminLog.length = 0;
  sendMock.mockResolvedValue({ success: true, messageId: 'm_1' });
});

// =============================================================================
// Κ — Η ΚΡΙΣΗ (καθαρή)
// =============================================================================

describe('Κ — τρεις ετυμηγορίες, κριμένες από το uid, ποτέ από το email', () => {
  it('Κ1 — επιβεβαιωμένος λογαριασμός: τίποτα, όποιος κι αν αποδεικνύει', () => {
    expect(mailboxProofVerdict({ uid: 'u1', emailVerified: true }, null)).toBe('already-verified');
    expect(mailboxProofVerdict({ uid: 'u1', emailVerified: true }, 'u2')).toBe('already-verified');
  });

  it('🔑 Κ2 — ανεπιβεβαίωτος + συνεδρία του ΙΔΙΟΥ uid ⇒ ο κάτοχος (κωδικός ΚΑΙ γραμματοκιβώτιο)', () => {
    expect(mailboxProofVerdict({ uid: 'u1', emailVerified: false }, 'u1')).toBe('verified-by-holder');
  });

  it('🔴 Κ3 — ανεπιβεβαίωτος + ανώνυμος ⇒ διεκδίκηση (το σενάριο της επίθεσης)', () => {
    expect(mailboxProofVerdict({ uid: 'u1', emailVerified: false }, null)).toBe('claimed');
  });

  it('🔴 Κ4 — ανεπιβεβαίωτος + ΑΛΛΟΣ uid ⇒ διεκδίκηση, ποτέ «σχεδόν κάτοχος»', () => {
    expect(mailboxProofVerdict({ uid: 'u1', emailVerified: false }, 'u2')).toBe('claimed');
  });

  it('🔐 Κ5 — λογαριασμός με 2ο παράγοντα: η απόδειξη email ΔΕΝ δίνει συνεδρία', () => {
    expect(mailboxProofMaySignIn({ secondFactorEnrolled: true })).toBe(false);
    expect(mailboxProofMaySignIn({ secondFactorEnrolled: false })).toBe(true);
  });
});

// =============================================================================
// Δ — Η ΠΡΑΞΗ
// =============================================================================

describe('Δ — η διεκδίκηση, το κόστος, και το email', () => {
  it('🔑 Δ1 — επιβεβαιωμένος: ΜΗΔΕΝ γραφές, και ο κάτοχος ΔΕΝ ρωτιέται (κόστος)', async () => {
    const probe = holder('uid_account');

    const receipt = await settleProvenMailbox(account({ emailVerified: true }), MAILBOX, probe);

    expect(receipt).toEqual({ verdict: 'already-verified', removedProviders: [] });
    expect(probe).not.toHaveBeenCalled();
    expect(adminLog).toEqual([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔑 Δ2 — ο κάτοχος: ΜΟΝΟ `emailVerified` — τίποτα δεν ξαναχτίζεται, καμία αποσύνδεση', async () => {
    const receipt = await settleProvenMailbox(account(), MAILBOX, holder('uid_account'));

    expect(receipt).toEqual({ verdict: 'verified-by-holder', removedProviders: [] });
    expect(updateUserMock).toHaveBeenCalledWith('uid_account', { emailVerified: true });
    expect(reprovisionMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔴 Δ3 — Η ΕΠΙΘΕΣΗ: ο λογαριασμός ΞΑΝΑΧΤΙΖΕΤΑΙ (ίδιο uid, αποδεδειγμένο email), και email με τον δρόμο πίσω', async () => {
    const receipt = await settleProvenMailbox(account(), MAILBOX, holder(null));

    expect(receipt).toEqual({ verdict: 'claimed', removedProviders: ['password'] });
    expect(reprovisionMock).toHaveBeenCalledWith('uid_account', 'maria@example.com');
    // ⛔ Η παλιά «θεραπεία» (αφαίρεση κωδικού) άφηνε ζωντανό τον εκκρεμή κωδικό αλλαγής
    //    email ΚΑΙ τον πάροχο του επιτιθέμενου — μετρημένο στην παραγωγή.
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(adminLog).toEqual(['reprovision']);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const mail = sendMock.mock.calls[0][0] as { to: string; textBody: string };
    expect(mail.to).toBe('maria@example.com');
    expect(sentryMock).toHaveBeenCalledTimes(1);
  });

  it('🔴 Δ4 — ο σύνδεσμος του email είναι στη ΔΙΚΗ ΜΑΣ διεύθυνση, ποτέ της κονσόλας', async () => {
    await settleProvenMailbox(account(), MAILBOX, holder(null));

    const mail = sendMock.mock.calls[0][0] as { textBody: string };
    expect(mail.textBody).toContain('https://nestorconstruct.gr/auth/action?mode=resetPassword&oobCode=1');
    expect(mail.textBody).not.toContain('console.example');
  });

  it('🔴 Δ5 — Trojan identifier: ΚΑΘΕ τρόπος σύνδεσης που δεν αποδείχθηκε φεύγει — και το λέμε', async () => {
    reprovisionMock.mockResolvedValueOnce({ removedProviders: ['password', 'google.com'] });

    const receipt = await settleProvenMailbox(account(), MAILBOX, holder(null));

    expect(receipt.removedProviders).toEqual(['password', 'google.com']);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('Δ6 — διεκδίκηση λογαριασμού ΧΩΡΙΣ τρόπο σύνδεσης: ξαναχτίζεται, αλλά ΚΑΝΕΝΑ email', async () => {
    reprovisionMock.mockResolvedValueOnce({ removedProviders: [] });

    const receipt = await settleProvenMailbox(account(), MAILBOX, holder(null));

    expect(receipt).toEqual({ verdict: 'claimed', removedProviders: [] });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔑 Δ7 — το email που αποτυγχάνει ΔΕΝ αναιρεί την ασφάλεια (ούτε πετά)', async () => {
    sendMock.mockResolvedValue({ success: false, error: 'mailgun down' });
    await expect(settleProvenMailbox(account(), MAILBOX, holder(null)))
      .resolves.toEqual({ verdict: 'claimed', removedProviders: ['password'] });

    resetLinkMock.mockRejectedValueOnce(new Error('auth/internal-error'));
    await expect(settleProvenMailbox(account(), MAILBOX, holder(null)))
      .resolves.toEqual({ verdict: 'claimed', removedProviders: ['password'] });
  });

  it('Δ8 — χωρίς δημόσια διεύθυνση: ΚΑΝΕΝΑ email με σύνδεσμο που δεν ξέρουμε πού οδηγεί', async () => {
    ownedLinkMock.mockReturnValueOnce(null);

    await settleProvenMailbox(account(), MAILBOX, holder(null));

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔴 Δ9 — η επαναδημιουργία αρνήθηκε/απέτυχε: ΠΕΤΑ, και ΚΑΝΕΝΑ email πάνω σε μισή δουλειά', async () => {
    reprovisionMock.mockRejectedValueOnce(new Error('auth/internal-error'));

    await expect(settleProvenMailbox(account(), MAILBOX, holder(null))).rejects.toThrow();
    expect(sendMock).not.toHaveBeenCalled();
    expect(sentryMock).not.toHaveBeenCalled();
  });
});
