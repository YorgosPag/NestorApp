/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΑΓΩΓΟΥ — ADR-777 §8.23
 * =============================================================================
 *
 * **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ.** Πριν από αυτό το job, την ουρά εξερχομένων **δεν την
 * άδειαζε κανείς**. Η Μ0 το αποδεικνύει **εκτελώντας** αναζήτηση στον πραγματικό
 * κώδικα του καρφωμένου commit, όχι περιγράφοντάς την.
 *
 * ⚠️ Καμία άγκυρα δεν στέλνει πραγματικό email: ο `EmailAdapter` είναι mock
 * (Π3 — απαγορεύεται δοκιμαστική αποστολή σε πραγματικούς ανθρώπους).
 */

import { execFileSync } from 'node:child_process';

const sendEmail = jest.fn();
const getAdminFirestore = jest.fn();

jest.mock('@/server/comms/email-adapter', () => ({
  EmailAdapter: jest.fn().mockImplementation(() => ({
    sendEmail: (...args: unknown[]) => sendEmail(...args),
  })),
}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => getAdminFirestore(),
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import {
  MAX_FLUSH_PER_RUN,
  flushReportBalances,
  runOutboundEmailFlush,
} from '@/lib/cron/jobs/outbound-email-flush.job';

const BEFORE_PIPELINE_COMMIT = 'e5d78a0b';

function gitShow(pathInRepo: string): string {
  const out = execFileSync('git', ['show', `${BEFORE_PIPELINE_COMMIT}:${pathInRepo}`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (out.trim().length === 0) {
    throw new Error(`gitShow: κενή απάντηση για ${pathInRepo} — η άγκυρα δεν κοίταξε τίποτα.`);
  }
  return out;
}

/** Ένα έγγραφο ουράς με καταγραφή των ενημερώσεων που δέχτηκε. */
function queuedDoc(id: string, data: Record<string, unknown>) {
  const updates: Array<Record<string, unknown>> = [];
  return {
    id,
    data: () => data,
    ref: {
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return Promise.resolve();
      },
    },
    updates,
    /** Η συγχωνευμένη τελική κατάσταση, όπως θα τη δει η Firestore. */
    final: () => Object.assign({}, ...updates) as Record<string, unknown>,
  };
}

type QueuedDoc = ReturnType<typeof queuedDoc>;

/** Στήνει τη Firestore ώστε το ερώτημα του αγωγού να επιστρέψει `docs`. */
function firestoreReturning(docs: QueuedDoc[]): { where: jest.Mock } {
  const chain = {
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    get: jest.fn(),
  };
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.get.mockResolvedValue({ docs, size: docs.length });

  getAdminFirestore.mockReturnValue({ collection: jest.fn().mockReturnValue(chain) });
  return chain;
}

function email(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    to: 'someone@example.com',
    subject: 'Θέμα',
    content: 'Σώμα',
    attempts: 0,
    maxAttempts: 3,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  sendEmail.mockResolvedValue({ success: true, messageId: 'ext_1' });
});

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: Η ΟΥΡΑ ΔΕΝ ΑΔΕΙΑΖΕ ΑΠΟ ΚΑΝΕΝΑΝ
// =============================================================================

describe('🔴 Μ0 — πριν το §8.23 το email δεν έφευγε ΠΟΤΕ', () => {
  it('το πρόγραμμα του καρφωμένου commit δεν έχει αγωγό', () => {
    expect(gitShow('src/config/cron-schedule.ts')).not.toContain('outbound-email-flush');
  });

  it('🔑 το `enqueueMessage` έγραφε `status: pending` και ΤΕΛΕΙΩΝΕ', () => {
    const comms = gitShow('src/server/comms/orchestrator.ts');
    expect(comms).toContain("status: 'pending'");
    // Καμία αποστολή μέσα στον ίδιο τον enqueue: γράφει και επιστρέφει.
    expect(comms).not.toContain('sendEmail(');
  });

  it('🔴 ο μόνος υποψήφιος αποστολέας διάβαζε ΑΛΛΗ συλλογή', () => {
    // `processEmailJob` → COLLECTIONS.COMMUNICATIONS· `enqueueMessage` → COLLECTIONS.MESSAGES.
    // Ακόμη κι αν κάποιος τον καλούσε, θα κοίταζε σε λάθος μέρος.
    const adapter = gitShow('src/server/comms/email-adapter.ts');
    expect(adapter).toContain('processEmailJob');
    expect(adapter).toContain('COLLECTIONS.COMMUNICATIONS');

    const comms = gitShow('src/server/comms/orchestrator.ts');
    expect(comms).toContain('COLLECTIONS.MESSAGES');
  });
});

// =============================================================================
// Α — Η ΑΝΑΖΗΤΗΣΗ: ΤΟ `scheduledAt` ΣΕΒΕΤΑΙ ΤΗΝ ΠΟΛΙΤΙΚΗ
// =============================================================================

describe('Α — το ερώτημα του αγωγού', () => {
  it('Α1 🔑 — φιλτράρει σε `scheduledAt <= τώρα`', async () => {
    // ⚠️ Χωρίς αυτόν τον όρο, ένα μήνυμα προγραμματισμένο για τις 20:00 θα έφευγε
    // στο επόμενο δεκάλεπτο — και ΟΛΗ η πολιτική παραθύρου/ησυχίας θα ήταν
    // διακοσμητική.
    const chain = firestoreReturning([]);
    await runOutboundEmailFlush();

    const fields = chain.where.mock.calls.map((call) => `${call[0]} ${call[1]}`);
    expect(fields).toContain('channel ==');
    expect(fields).toContain('status ==');
    expect(fields).toContain('scheduledAt <=');
  });

  it('Α2 — κόβει στο δηλωμένο όριο', async () => {
    const chain = firestoreReturning([]);
    await runOutboundEmailFlush();
    expect(chain.limit).toHaveBeenCalledWith(MAX_FLUSH_PER_RUN);
  });
});

// =============================================================================
// Π — ΠΑΡΑΔΟΣΗ: ΤΡΕΙΣ ΡΗΤΕΣ ΚΑΤΑΛΗΞΕΙΣ
// =============================================================================

describe('Π — κάθε κατάληξη έχει απόδειξη ζωής', () => {
  it('Π1 — επιτυχία ⇒ `sent` + εξωτερικό αναγνωριστικό', async () => {
    const doc = queuedDoc('msg_1', email());
    firestoreReturning([doc]);

    const result = await runOutboundEmailFlush();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(doc.final().status).toBe('sent');
    expect(doc.final().externalId).toBe('ext_1');
    expect(result.metrics?.sent).toBe(1);
  });

  it('Π2 — αποτυχία με προσπάθειες ⇒ μένει `pending` για επανάληψη', async () => {
    sendEmail.mockResolvedValue({ success: false, error: 'provider 500' });
    const doc = queuedDoc('msg_2', email({ attempts: 0, maxAttempts: 3 }));
    firestoreReturning([doc]);

    const result = await runOutboundEmailFlush();

    // ⚠️ Δεν γράφεται `status`: το ερώτημα του επόμενου γύρου το βρίσκει αυτούσιο.
    expect(doc.final().status).toBeUndefined();
    expect(doc.final().attempts).toBe(1);
    expect(result.metrics?.retrying).toBe(1);
  });

  it('Π3 🔴 — εξάντληση προσπαθειών ⇒ `failed` ΜΕ ΛΟΓΟ, όχι σιωπή', async () => {
    // Ουρά χωρίς dead-letter είναι ουρά που κρύβει τα θύματά της: το μήνυμα θα
    // έμενε `pending` για πάντα και θα ξαναδοκιμαζόταν κάθε δέκα λεπτά, αιώνια.
    sendEmail.mockResolvedValue({ success: false, error: 'provider 500' });
    const doc = queuedDoc('msg_3', email({ attempts: 2, maxAttempts: 3 }));
    firestoreReturning([doc]);

    const result = await runOutboundEmailFlush();

    expect(doc.final().status).toBe('failed');
    expect(doc.final().error).toBe('provider 500');
    expect(result.metrics?.deadLettered).toBe(1);
  });

  it('Π4 🔴 — άκυρη διεύθυνση ⇒ dead-letter ΑΜΕΣΩΣ, χωρίς να καεί γύρος', async () => {
    // Καμία επανάληψη δεν γεννά διεύθυνση που δεν υπάρχει. Τρεις γύροι θα ήταν
    // τρεις κλήσεις παρόχου για βέβαιη αποτυχία.
    const doc = queuedDoc('msg_4', email({ to: 'usr_KaPoIoS' }));
    firestoreReturning([doc]);

    const result = await runOutboundEmailFlush();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(doc.final().status).toBe('failed');
    expect(result.metrics?.deadLettered).toBe(1);
  });

  it('Π5 🔴 — το `attempts` αυξάνεται ΠΡΙΝ την αποστολή', async () => {
    // Αν αυξανόταν μετά, μια κατάρρευση στη μέση θα άφηνε τον μετρητή πίσω και το
    // μήνυμα θα ξαναδοκιμαζόταν επ' άπειρον χωρίς ποτέ να φτάσει σε dead-letter.
    const doc = queuedDoc('msg_5', email({ attempts: 0 }));
    firestoreReturning([doc]);

    sendEmail.mockImplementation(() => {
      expect(doc.updates.some((patch) => patch.attempts === 1)).toBe(true);
      return Promise.resolve({ success: true, messageId: 'ext_5' });
    });

    await runOutboundEmailFlush();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Λ — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ
// =============================================================================

describe('Λ — η λογιστική κλείνει, αλλιώς ουρλιάζει', () => {
  it('Λ1 — κάθε μήνυμα προσγειώνεται σε ΑΚΡΙΒΩΣ έναν κάδο', async () => {
    sendEmail
      .mockResolvedValueOnce({ success: true, messageId: 'a' })
      .mockResolvedValueOnce({ success: false, error: 'x' })
      .mockResolvedValueOnce({ success: false, error: 'y' });

    firestoreReturning([
      queuedDoc('m1', email()),
      queuedDoc('m2', email({ attempts: 0, maxAttempts: 3 })),
      queuedDoc('m3', email({ attempts: 2, maxAttempts: 3 })),
      queuedDoc('m4', email({ to: 'όχι-διεύθυνση' })),
    ]);

    const result = await runOutboundEmailFlush();

    expect(result.metrics).toMatchObject({
      sent: 1,
      retrying: 1,
      deadLettered: 2,
      considered: 4,
    });
  });

  it('Λ2 — ο έλεγχος ισοζυγίου πιάνει ασυμφωνία', () => {
    expect(
      flushReportBalances({
        sent: 1, retrying: 1, deadLettered: 1, considered: 3, truncated: false,
      }),
    ).toBe(true);
    expect(
      flushReportBalances({
        sent: 1, retrying: 0, deadLettered: 0, considered: 3, truncated: false,
      }),
    ).toBe(false);
  });

  it('Λ3 — και οι πέντε κάδοι εκπέμπονται όταν η ουρά είναι ΑΔΕΙΑ', async () => {
    // Π2: ένα «0» που λείπει διαβάζεται ως «δεν έστειλα», αλλά και ως «δεν κοίταξα».
    firestoreReturning([]);
    const result = await runOutboundEmailFlush();

    expect(Object.keys(result.metrics ?? {}).sort()).toEqual([
      'considered', 'deadLettered', 'retrying', 'sent', 'truncated',
    ]);
    expect(result.metrics?.considered).toBe(0);
  });
});
