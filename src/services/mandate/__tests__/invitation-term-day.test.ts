/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **ΤΟ ΕΓΓΡΑΦΟ ΠΟΥ ΦΕΥΓΕΙ ΓΡΑΦΕΙ ΤΗΝ ΗΜΕΡΑ ΠΟΥ ΔΗΛΩΘΗΚΕ.**
 * @related ADR-834 §6.5.α #12 · §6.5.γ · services/mandate/mandate-invitation.service.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — **ΤΕΤΑΡΤΟ ΜΕΛΟΣ, ΚΑΙ ΤΟ ΜΟΝΟ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΟΘΟΝΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §6.5.β έκλεισε **τρεις** επιφάνειες με λάθος ημέρα *(γραμμή κατάληψης · πάνελ
 * ιδιοκτήτη · οθόνη συγκατάθεσης)*. Η **τέταρτη** βρέθηκε μόνο όταν το μήνυμα έφτασε
 * πραγματικά στην ουρά (§6.5.γ): το σώμα του email έγραφε *«Η εντολή θα ισχύει μέχρι
 * **01/05/2027**»* ενώ ο μεσίτης δήλωσε **30/04/2027**.
 *
 * 🔑 **Και βαραίνει περισσότερο από τις τρεις οθόνες.** Το άρθρο 200 §1 Ν.4072/2012
 * δέχεται **ρητά** *«τα μηνύματα ηλεκτρονικού ταχυδρομείου»* ως **έγγραφο τύπο** της
 * μεσιτικής σύμβασης: εδώ η ημέρα δεν **παρουσιάζεται** στον ιδιοκτήτη — του
 * **αποστέλλεται εγγράφως**.
 *
 * ⚠️ **Η ερώτηση είναι «καλεί ΑΥΤΟΣ ο γραφέας τη σωστή συνάρτηση;»**, ίδιο συμβόλαιο με
 * το `consent-term-day.test.tsx`. Τα εννέα test του `formatTermDay` **δεν μπορούν** να
 * τη δουν: το ελάττωμα δεν ήταν ποτέ **μέσα** του, ήταν στο ότι κανείς δεν τον καλούσε.
 *
 * ⚠️ **Ο ταχυδρόμος είναι ο ΜΟΝΟΣ που αντικαθίσταται.** Η ανάγνωση της επαφής, η
 * επιλογή λεκτικών και η σύνθεση του σώματος τρέχουν **αληθινά**.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { endOfDay } from '@/lib/mandate/mandate-term-window';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const enqueued: Record<string, unknown>[] = [];

jest.mock('@/server/comms/orchestrator', () => ({
  enqueueMessage: jest.fn(async (params: Record<string, unknown>) => {
    enqueued.push(params);
    return { success: true, messageIds: ['msg_1'] };
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sendMandateInvitation } =
  require('@/services/mandate/mandate-invitation.service') as typeof import('@/services/mandate/mandate-invitation.service');

/** Η ημέρα που δηλώνει ο μεσίτης — και που ο ιδιοκτήτης οφείλει να διαβάσει πίσω. */
const AGREED_DAY = '2027-04-30';
const CLIENT = 'cont_kostas';

/**
 * 🔑 **Η στιγμή γράφεται με τον ΙΔΙΟ γραφέα που τη γεννά στην παραγωγή.** Χειρόγραφη
 * `'2027-04-30T23:59:59.999Z'` θα ήταν δεύτερη γραφή του ίδιου γεγονότος.
 */
const EXPIRES_AT = endOfDay(AGREED_DAY);

function dbWithContact(email: string | null): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.CONTACTS, CLIENT, {
    emails: email === null ? [] : [{ email, type: 'work', isPrimary: true }],
  });
  return fake as unknown as AdminFirestore;
}

async function invite(email: string | null = 'kostas@example.gr') {
  enqueued.length = 0;
  const outcome = await sendMandateInvitation(dbWithContact(email), 'consent-request', {
    clientContactId: CLIENT,
    agencyName: 'ΑΛΦΑ ΜΕΣΙΤΙΚΗ',
    listingTitle: 'TEST',
    expiresAt: EXPIRES_AT,
    token: 'token-δοκιμής',
    idempotencyKey: 'mandate-consent:nonce-δοκιμής',
  });
  return { outcome, body: String(enqueued[0]?.content ?? '') };
}

describe('🔑 Ω — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το μήνυμα ΓΡΑΦΤΗΚΕ και το περιβάλλον ΜΠΟΡΕΙ να δείξει το λάθος', () => {
  it('Ω0 — φεύγει μήνυμα με σώμα, και η ζώνη εκτέλεσης ΔΕΝ ταυτίζεται με UTC', async () => {
    // 🔴 Χωρίς τη δεύτερη προσδοκία, ένα πράσινο σε **UTC** θα σήμαινε *«κανείς δεν
    //    κοίταξε»*: εκεί το καθολικό `formatDate` δίνει το **ίδιο** αποτέλεσμα με το
    //    `formatTermDay` και κάθε μετάλλαξη «σκοτώνεται» χωρίς να μετρά τίποτα.
    //    Ίδιο συμβόλαιο με το `Σ0` του `consent-term-day.test.tsx`.
    const { outcome, body } = await invite();
    expect(outcome).toEqual({ kind: 'sent', to: 'kostas@example.gr' });
    expect(body).toContain('TEST');

    const boundary = new Date(EXPIRES_AT);
    expect(boundary.getDate()).not.toBe(boundary.getUTCDate());
  });

  it('Ω1 — και ο φρουρός της διεύθυνσης ΜΠΟΡΕΙ να πει «όχι»', async () => {
    // Χωρίς αυτό, το `sent` του Ω0 θα ήταν πράσινο πάνω σε γραφέα που στέλνει **πάντα**.
    const { outcome } = await invite(null);
    expect(outcome).toEqual({ kind: 'no-address' });
    expect(enqueued).toHaveLength(0);
  });
});

describe('🔴 Ψ — το ΕΓΓΡΑΦΟ που αποστέλλεται λέει τη ΔΗΛΩΜΕΝΗ ημέρα', () => {
  it('🔴 Ψ1 — το σώμα γράφει 30/04/2027', async () => {
    const { body } = await invite();
    expect(body).toContain('30/04/2027');
  });

  it('🔑 Ψ2 — και ΔΕΝ γράφει την επόμενη ημέρα (το ακριβές περιστατικό)', async () => {
    // 🔴 **Η γραμμή που κοκκινίζει αν κάποιος ξαναβάλει το καθολικό `formatDate`.**
    //    Στην Ελλάδα εκείνο δίνει «01/05/2027» για την ίδια στιγμή.
    const local = new Intl.DateTimeFormat('el', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(EXPIRES_AT));

    const { body } = await invite();
    expect(body).not.toContain(local);
  });

  it('Ψ3 — καμία ωμή ISO στιγμή στο κείμενο που διαβάζει άνθρωπος', async () => {
    const { body } = await invite();
    expect(body).not.toContain('T23:59');
    expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
