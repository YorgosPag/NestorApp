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

// ⚠️ **Ο αγωγός περνά πλέον από την ΑΛΥΣΙΔΑ παρόχων** (§8.26), όχι απευθείας από
// τον `EmailAdapter`. Οι μεταβλητές είναι απαραίτητες: χωρίς αυτές ο κρίκος Mailgun
// αναφέρει `configured: false`, η αλυσίδα επιστρέφει `no-provider` και **καμία**
// άγκυρα δεν θα άγγιζε τον πάροχο — δηλαδή 22 πράσινα tests που δεν δοκιμάζουν
// τίποτα. Το `RESEND_API_KEY` μένει **σβηστό** επίτηδες, ώστε αυτές οι άγκυρες να
// περνούν από **έναν** κρίκο· η μετάπτωση δοκιμάζεται στις δικές της.
process.env.MAILGUN_API_KEY = 'test-key';
process.env.MAILGUN_DOMAIN = 'test.example.com';
delete process.env.RESEND_API_KEY;
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
    // 🔑 **Ο λόγος ΚΑΙ ο ένοχος.** Μετά το §8.26 το σφάλμα ονομάζει τον πάροχο που
    // απέτυχε — χωρίς αυτό, ένα «provider 500» σε αλυσίδα δύο κρίκων δεν λέει ποιος
    // από τους δύο έπεσε, δηλαδή δεν λέει τι να διορθώσει κανείς.
    expect(doc.final().error).toBe('mailgun: provider 500');
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

  it('Λ3 — και οι ΕΠΤΑ κάδοι εκπέμπονται όταν η ουρά είναι ΑΔΕΙΑ', async () => {
    // Π2: ένα «0» που λείπει διαβάζεται ως «δεν έστειλα», αλλά και ως «δεν κοίταξα».
    firestoreReturning([]);
    const result = await runOutboundEmailFlush();

    expect(Object.keys(result.metrics ?? {}).sort()).toEqual([
      'considered', 'deadLettered', 'digested', 'emailsSent', 'retrying', 'sent', 'truncated',
    ]);
    expect(result.metrics?.considered).toBe(0);
  });
});

// =============================================================================
// Σ — ΣΥΝΑΘΡΟΙΣΗ: ΤΟ ΠΛΑΝΟ ΓΙΝΕΤΑΙ ΠΡΑΞΗ (ADR-777 §8.25)
// =============================================================================

/** Ειδοποίηση — δηλαδή **συναθροίσιμη**. Ό,τι δεν το δηλώνει, δεν είναι. */
function notification(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return email({ metadata: { category: 'notification', priority: 'normal' }, ...overrides });
}

describe('Σ — η σύνοψη φεύγει ως ΕΝΑ email', () => {
  it('Σ1 🔑 — τρεις ειδοποιήσεις στον ΙΔΙΟ άνθρωπο ⇒ ΕΝΑ email, τρία `sent`', async () => {
    const docs = [
      queuedDoc('m1', notification({ subject: 'Πρώτο' })),
      queuedDoc('m2', notification({ subject: 'Δεύτερο' })),
      queuedDoc('m3', notification({ subject: 'Τρίτο' })),
    ];
    firestoreReturning(docs);

    const result = await runOutboundEmailFlush();

    // 🔑 Ο ΛΟΓΟΣ ΥΠΑΡΞΗΣ: μία διακοπή αντί για τρεις.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(result.metrics).toMatchObject({ sent: 3, emailsSent: 1, digested: 3, considered: 3 });
    // Κάθε έγγραφο κλείνει — κανένα δεν μένει `pending` να ξαναδοκιμάζεται αιώνια.
    for (const doc of docs) expect(doc.final().status).toBe('sent');
  });

  it('Σ2 🔑 — και τα τρία θέματα ταξιδεύουν ΜΕΣΑ στο ένα email', async () => {
    // ⚠️ Χωρίς αυτή την άγκυρα, μια σύνοψη που κρατά μόνο το πρώτο θέμα θα περνούσε
    // το Σ1 ολόκληρο: ένα email έφυγε, τρία έγγραφα έκλεισαν, **δύο ειδοποιήσεις
    // χάθηκαν σιωπηλά**. Το «έφυγε email» δεν είναι «ειπώθηκε το περιεχόμενο».
    firestoreReturning([
      queuedDoc('m1', notification({ subject: 'Πρώτο', content: 'Σώμα Α' })),
      queuedDoc('m2', notification({ subject: 'Δεύτερο', content: 'Σώμα Β' })),
    ]);

    await runOutboundEmailFlush();

    const job = sendEmail.mock.calls[0][0] as { subject: string; content: string; html: string };
    expect(job.subject).toContain('2');
    for (const needle of ['Πρώτο', 'Δεύτερο', 'Σώμα Α', 'Σώμα Β']) {
      expect(job.content).toContain(needle);
      expect(job.html).toContain(needle);
    }
  });

  it('Σ3 🔴 — δύο ΔΙΑΦΟΡΕΤΙΚΟΙ άνθρωποι ΔΕΝ μπαίνουν στο ίδιο email', async () => {
    // Η χειρότερη δυνατή αστοχία: ο ένας διαβάζει τις ειδοποιήσεις του άλλου.
    firestoreReturning([
      queuedDoc('m1', notification({ to: 'a@example.com', subject: 'Της Άννας' })),
      queuedDoc('m2', notification({ to: 'a@example.com', subject: 'Της Άννας ξανά' })),
      queuedDoc('m3', notification({ to: 'b@example.com', subject: 'Του Βασίλη' })),
    ]);

    const result = await runOutboundEmailFlush();

    expect(result.metrics).toMatchObject({ sent: 3, emailsSent: 2, digested: 2 });
    const jobs = sendEmail.mock.calls.map((call) => call[0] as { to: string; content: string });
    const toAnna = jobs.find((job) => job.to === 'a@example.com');
    expect(toAnna?.content).not.toContain('Του Βασίλη');
  });

  it('Σ4 🔑 — ΕΝΑ μόνο του φεύγει ΑΥΤΟΥΣΙΟ, όχι ως «έχετε 1 ειδοποίηση»', async () => {
    // Σύνοψη του ενός είναι αυστηρά χειρότερη από το πρωτότυπο: κρύβει το θέμα
    // πίσω από γενικό τίτλο και ζητά από τον παραλήπτη να ανοίξει για να μάθει.
    firestoreReturning([queuedDoc('m1', notification({ subject: 'Το πραγματικό θέμα' }))]);

    const result = await runOutboundEmailFlush();

    expect((sendEmail.mock.calls[0][0] as { subject: string }).subject).toBe('Το πραγματικό θέμα');
    expect(result.metrics).toMatchObject({ sent: 1, emailsSent: 1, digested: 0 });
  });

  it('Σ5 🔴 — το ΕΠΕΙΓΟΝ δεν μπαίνει ΠΟΤΕ σε σύνοψη', async () => {
    // Τα 5 υποχρεωτικά συμβάντα είναι ασφάλειας. Τυλιγμένα σε «Έχετε 3 νέες
    // ειδοποιήσεις» χάνουν ακριβώς αυτό που τα κάνει υποχρεωτικά: το θέμα τους.
    firestoreReturning([
      queuedDoc('m1', notification({ subject: 'Ήσυχο Α' })),
      queuedDoc('m2', notification({ subject: 'Ήσυχο Β' })),
      queuedDoc('m3', email({
        subject: 'Παραβίαση λογαριασμού',
        metadata: { category: 'notification', priority: 'urgent' },
      })),
    ]);

    const result = await runOutboundEmailFlush();

    expect(result.metrics).toMatchObject({ sent: 3, emailsSent: 2, digested: 2 });
    const subjects = sendEmail.mock.calls.map((call) => (call[0] as { subject: string }).subject);
    expect(subjects).toContain('Παραβίαση λογαριασμού');
  });

  it('Σ6 — ό,τι ΔΕΝ είναι ειδοποίηση κρατά το δικό του πρότυπο', async () => {
    // Οι κοινοποιήσεις ακινήτων φέρνουν δικό τους επώνυμο HTML· συνάθροιση θα το
    // πετούσε και θα κρατούσε το απλό κείμενο — υποβάθμιση, όχι βελτίωση.
    firestoreReturning([
      queuedDoc('m1', email({ subject: 'Ακίνητο Α', metadata: { category: 'marketing' } })),
      queuedDoc('m2', email({ subject: 'Ακίνητο Β', metadata: { category: 'marketing' } })),
    ]);

    const result = await runOutboundEmailFlush();
    expect(result.metrics).toMatchObject({ emailsSent: 2, digested: 0 });
  });

  it('Σ7 🔴 — αποτυχία σύνοψης κρίνεται ΑΝΑ ΕΓΓΡΑΦΟ, με το δικό του όριο', async () => {
    // Τα μέλη έχουν διαφορετικό `maxAttempts` (το παράγει η προτεραιότητα). Κοινός
    // μετρητής θα έστελνε το ανεκτικό σε dead-letter μαζί με το εξαντλημένο.
    sendEmail.mockResolvedValue({ success: false, error: 'provider 500' });
    const fresh = queuedDoc('m1', notification({ attempts: 0, maxAttempts: 3 }));
    const exhausted = queuedDoc('m2', notification({ attempts: 2, maxAttempts: 3 }));
    firestoreReturning([fresh, exhausted]);

    const result = await runOutboundEmailFlush();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(fresh.final().status).toBeUndefined();
    expect(exhausted.final().status).toBe('failed');
    expect(result.metrics).toMatchObject({ sent: 0, retrying: 1, deadLettered: 1, emailsSent: 0 });
  });

  it('Σ8 🔑 — το `attempts` ΟΛΩΝ αυξάνεται ΠΡΙΝ φύγει η σύνοψη', async () => {
    const docs = [queuedDoc('m1', notification()), queuedDoc('m2', notification())];
    firestoreReturning(docs);

    sendEmail.mockImplementation(() => {
      for (const doc of docs) {
        expect(doc.updates.some((patch) => patch.attempts === 1)).toBe(true);
      }
      return Promise.resolve({ success: true, messageId: 'ext' });
    });

    await runOutboundEmailFlush();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('Σ9 — κάθε μέλος φέρει το ίχνος της σύνοψης που το κουβάλησε', async () => {
    // Χωρίς αυτό, το «γιατί δεν έλαβα ξεχωριστό email;» δεν απαντιέται από τη βάση.
    const doc = queuedDoc('m1', notification());
    firestoreReturning([doc, queuedDoc('m2', notification())]);

    await runOutboundEmailFlush();

    expect(doc.final().digestSize).toBe(2);
    expect(doc.final().digestOf).toBe('someone@example.com');
  });
});
