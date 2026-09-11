/**
 * @jest-environment node
 *
 * @fileoverview **Η ΦΥΛΑΞΗ ΜΕΤΑ ΑΠΟ ΑΠΟΔΕΙΞΗ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟΥ** (ADR-844 §13).
 * @related server/auth/mailbox-proof-custody.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΡΩΤΟΥΝ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **Κ** — η κρίση: τρεις ετυμηγορίες, και ποτέ «ίδιο email = ίδιος άνθρωπος».
 * - **Δ** — η πράξη: **η σειρά** των κλήσεων Admin (αφαίρεση → ανάκληση), **το κόστος**
 *   (ο κάτοχος δεν ρωτιέται για επιβεβαιωμένο λογαριασμό), και **το email** μόνο όταν
 *   αφαιρέθηκε κάτι.
 *
 * ⚠️ Η Firebase είναι **πλαστή** και καταγράφει **με τη σειρά** κάθε κλήση σε **ένα**
 * ημερολόγιο: μια αντιμετάθεση αφαίρεσης/ανάκλησης **πρέπει** να κοκκινίσει.
 */

jest.mock('server-only', () => ({}));

const adminLog: string[] = [];
const updateUserMock = jest.fn(async (..._args: unknown[]) => { adminLog.push('updateUser'); });
const revokeMock = jest.fn(async (..._args: unknown[]) => { adminLog.push('revoke'); });
const resetLinkMock = jest.fn(async (..._args: unknown[]) => 'https://auth.example/reset?oob=1');

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    updateUser: (...args: unknown[]) => updateUserMock(...args),
    revokeRefreshTokens: (...args: unknown[]) => revokeMock(...args),
    generatePasswordResetLink: (...args: unknown[]) => resetLinkMock(...args),
  }),
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
    providerIds: ['password'],
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
    expect(mailboxProofVerdict({ uid: 'u', emailVerified: true }, null)).toBe('already-verified');
    expect(mailboxProofVerdict({ uid: 'u', emailVerified: true }, 'other')).toBe('already-verified');
  });

  it('🔑 Κ2 — ανεπιβεβαίωτος + συνεδρία του ΙΔΙΟΥ uid ⇒ ο κάτοχος (κωδικός ΚΑΙ γραμματοκιβώτιο)', () => {
    expect(mailboxProofVerdict({ uid: 'u', emailVerified: false }, 'u')).toBe('verified-by-holder');
  });

  it('🔴 Κ3 — ανεπιβεβαίωτος + ανώνυμος ⇒ διεκδίκηση (το σενάριο της επίθεσης)', () => {
    expect(mailboxProofVerdict({ uid: 'u', emailVerified: false }, null)).toBe('claimed');
  });

  it('🔴 Κ4 — ανεπιβεβαίωτος + ΑΛΛΟΣ uid ⇒ διεκδίκηση, ποτέ «σχεδόν κάτοχος»', () => {
    expect(mailboxProofVerdict({ uid: 'u', emailVerified: false }, 'uid_attacker')).toBe('claimed');
  });

  it('🔐 Κ5 — λογαριασμός με 2ο παράγοντα: η απόδειξη email ΔΕΝ δίνει συνεδρία', () => {
    expect(mailboxProofMaySignIn({ secondFactorEnrolled: true })).toBe(false);
    expect(mailboxProofMaySignIn({ secondFactorEnrolled: false })).toBe(true);
  });
});

// =============================================================================
// Δ — Η ΠΡΑΞΗ
// =============================================================================

describe('Δ — η σειρά, το κόστος, και το email', () => {
  it('🔑 Δ1 — επιβεβαιωμένος: ΜΗΔΕΝ γραφές, και ο κάτοχος ΔΕΝ ρωτιέται (κόστος)', async () => {
    const probe = holder('uid_account');

    const receipt = await settleProvenMailbox(account({ emailVerified: true }), MAILBOX, probe);

    expect(receipt).toEqual({ verdict: 'already-verified', unlinkedProviders: [] });
    expect(probe).not.toHaveBeenCalled();
    expect(adminLog).toEqual([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔑 Δ2 — ο κάτοχος: ΜΟΝΟ `emailVerified` — κανένας κωδικός δεν χάνεται, καμία αποσύνδεση', async () => {
    const receipt = await settleProvenMailbox(account(), MAILBOX, holder('uid_account'));

    expect(receipt).toEqual({ verdict: 'verified-by-holder', unlinkedProviders: [] });
    expect(updateUserMock).toHaveBeenCalledWith('uid_account', { emailVerified: true });
    expect(revokeMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('🔴 Δ3 — Η ΕΠΙΘΕΣΗ: αφαίρεση κωδικού ΠΡΙΝ την ανάκληση, και email με τον δρόμο πίσω', async () => {
    const receipt = await settleProvenMailbox(account(), MAILBOX, holder(null));

    expect(receipt).toEqual({ verdict: 'claimed', unlinkedProviders: ['password'] });
    expect(updateUserMock).toHaveBeenCalledWith('uid_account', {
      emailVerified: true,
      providersToUnlink: ['password'],
    });
    expect(revokeMock).toHaveBeenCalledWith('uid_account');
    // 🔴 **Η ΣΕΙΡΑ**: αντίστροφα, ο επιτιθέμενος θα συνδεόταν ΑΝΑΜΕΣΑ και θα κρατούσε
    //    συνεδρία γεννημένη μετά την ανάκληση.
    expect(adminLog).toEqual(['updateUser', 'revoke']);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const mail = sendMock.mock.calls[0][0] as { to: string; textBody: string; htmlBody: string };
    expect(mail.to).toBe('maria@example.com');
    expect(mail.textBody).toContain('https://auth.example/reset?oob=1');
    // 🔴 Το αντίδοτο στο δηλωμένο υπόλοιπο (εκκρεμής αλλαγή email του επιτιθέμενου).
    expect(mail.textBody).toContain('αναίρεσης');
    expect(sentryMock).toHaveBeenCalledTimes(1);
  });

  it('Δ4 — διεκδίκηση ΧΩΡΙΣ κωδικό: επιβεβαίωση + ανάκληση, αλλά ΚΑΝΕΝΑ email (δεν αφαιρέθηκε τίποτα)', async () => {
    const receipt = await settleProvenMailbox(account({ providerIds: [] }), MAILBOX, holder(null));

    expect(receipt).toEqual({ verdict: 'claimed', unlinkedProviders: [] });
    expect(updateUserMock).toHaveBeenCalledWith('uid_account', { emailVerified: true });
    expect(adminLog).toEqual(['updateUser', 'revoke']);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('Δ5 — ΜΟΝΟ ο κωδικός αφαιρείται — ο αξιόπιστος πάροχος μένει', async () => {
    await settleProvenMailbox(account({ providerIds: ['google.com', 'password'] }), MAILBOX, holder(null));

    expect(updateUserMock).toHaveBeenCalledWith('uid_account', {
      emailVerified: true,
      providersToUnlink: ['password'],
    });
  });

  it('🔑 Δ6 — το email που αποτυγχάνει ΔΕΝ αναιρεί την ασφάλεια (ούτε πετά)', async () => {
    sendMock.mockResolvedValue({ success: false, error: 'mailgun down' });
    await expect(settleProvenMailbox(account(), MAILBOX, holder(null)))
      .resolves.toEqual({ verdict: 'claimed', unlinkedProviders: ['password'] });

    resetLinkMock.mockRejectedValueOnce(new Error('auth/internal-error'));
    await expect(settleProvenMailbox(account(), MAILBOX, holder(null)))
      .resolves.toEqual({ verdict: 'claimed', unlinkedProviders: ['password'] });
  });

  it('🔴 Δ7 — η Firebase δεν απάντησε: ΠΕΤΑ, και ΚΑΜΙΑ ανάκληση πάνω σε μισή δουλειά', async () => {
    updateUserMock.mockRejectedValueOnce(new Error('auth/internal-error'));

    await expect(settleProvenMailbox(account(), MAILBOX, holder(null))).rejects.toThrow();
    expect(revokeMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
