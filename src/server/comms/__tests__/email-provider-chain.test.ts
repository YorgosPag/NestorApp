/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΑΛΥΣΙΔΑΣ ΠΑΡΟΧΩΝ — ADR-777 §8.26
 * =============================================================================
 *
 * **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ.** Το `email.service.ts` **έγραφε** «Resend + Mailgun
 * fallback» και **δεν είχε fallback**. Η Μ0 το αποδεικνύει διαβάζοντας τον
 * **πραγματικό κώδικα** του καρφωμένου commit — όχι περιγράφοντάς τον.
 *
 * 🔑 **ΓΙΑΤΙ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΕΣ, ΟΧΙ ΔΙΑΚΟΣΜΗΤΙΚΕΣ**: σήμερα το
 * `RESEND_API_KEY` **λείπει** από την παραγωγή, άρα η αλυσίδα έχει **έναν** κρίκο
 * και η μετάπτωση **δεν μπορεί να συμβεί εκεί**. Χωρίς άγκυρες που την **εκτελούν**
 * με πλαστούς κρίκους, ο κώδικας εφεδρείας θα ήταν **αδρανής φρουρός** (ADR-749 §5):
 * γραμμένος, μη εκτελεσμένος, και διαβασμένος ως απόδειξη ασφάλειας.
 */

import { execFileSync } from 'node:child_process';

import {
  PROVIDER_TIMEOUT_MS,
  describeChain,
  sendThroughChain,
  type EmailProvider,
  type OutboundEmail,
  type ProviderAttempt,
} from '@/server/comms/email-provider-chain';

/** Commit **πριν** γραφτεί η αλυσίδα. ⚠️ Καρφωμένο, ΠΟΤΕ `HEAD`. */
const BEFORE_CHAIN_COMMIT = '90b4c13e';

function gitShow(pathInRepo: string): string {
  const out = execFileSync('git', ['show', `${BEFORE_CHAIN_COMMIT}:${pathInRepo}`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (out.trim().length === 0) {
    throw new Error(`gitShow: κενή απάντηση για ${pathInRepo} — η άγκυρα δεν κοίταξε τίποτα.`);
  }
  return out;
}

const MESSAGE: OutboundEmail = { to: 'a@example.com', subject: 'Θέμα', text: 'Σώμα' };

/** Πλαστός κρίκος με καταγραφή κλήσεων. */
function fake(
  name: string,
  behaviour: ProviderAttempt | 'throws' | 'hangs',
  configured = true,
): EmailProvider & { calls: number } {
  const provider = {
    name,
    configured,
    calls: 0,
    async send(): Promise<ProviderAttempt> {
      provider.calls += 1;
      if (behaviour === 'throws') throw new Error(`${name} κατέρρευσε`);
      if (behaviour === 'hangs') return new Promise<ProviderAttempt>(() => { /* ποτέ */ });
      return behaviour;
    },
  };
  return provider;
}

const OK: ProviderAttempt = { kind: 'delivered', messageId: 'ext' };
const NO: ProviderAttempt = { kind: 'rejected', error: 'πάροχος 500' };

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: Η ΛΕΞΗ «FALLBACK» ΠΕΡΙΕΓΡΑΦΕ ΚΑΤΙ ΠΟΥ ΔΕΝ ΥΠΗΡΧΕ
// =============================================================================

describe('🔴 Μ0 — πριν το §8.26 δεν υπήρχε καμία εφεδρεία', () => {
  it('το σχόλιο υποσχόταν «fallback»…', () => {
    expect(gitShow('src/services/email.service.ts')).toContain('Resend + Mailgun fallback');
  });

  it('🔴 …ενώ ο κώδικας διάλεγε ΕΝΑΝ πάροχο, μία φορά, από την ύπαρξη κλειδιού', () => {
    const source = gitShow('src/services/email.service.ts');
    // Τριαδικός τελεστής **επιλογής**: αν υπάρχει resend → resend, αλλιώς mailgun.
    // Καμία διαδρομή δεν ξαναρωτά μετά από αποτυχία.
    expect(source).toContain("const provider = resend ? 'resend' : mailgunAdapter ? 'mailgun' : null");
    // Και η αποτυχία **πετούσε**, αντί να δοκιμάσει τον επόμενο.
    expect(source).toContain("throw new Error('All Mailgun sends failed')");
  });

  it('🔴 ο αγωγός cron δεν είχε ΟΥΤΕ φρουρό χρόνου', () => {
    // Το `withProviderTimeout` ζούσε **μόνο** στο email.service. Ένας κολλημένος
    // πάροχος κρατούσε την εργασία μέχρι να τη σκοτώσει η πλατφόρμα.
    const job = gitShow('src/lib/cron/jobs/outbound-email-flush.job.ts');
    expect(job).toContain('new EmailAdapter()');
    expect(job).not.toContain('timeout');
  });
});

// =============================================================================
// Ε — Η ΕΦΕΔΡΕΙΑ: ΕΚΤΕΛΕΙΤΑΙ, ΔΕΝ ΥΠΟΤΙΘΕΤΑΙ
// =============================================================================

describe('Ε — αν πέσει ο πρώτος, φεύγει από τον δεύτερο', () => {
  it('Ε1 — ο πρώτος πετυχαίνει ⇒ ο δεύτερος ΔΕΝ αγγίζεται', async () => {
    const first = fake('πρώτος', OK);
    const second = fake('δεύτερος', OK);

    const outcome = await sendThroughChain([first, second], MESSAGE);

    expect(outcome).toMatchObject({ kind: 'delivered', provider: 'πρώτος', failedOver: false });
    // Διπλή αποστολή θα σήμαινε ότι ο παραλήπτης παίρνει το ίδιο email δύο φορές.
    expect(second.calls).toBe(0);
  });

  it('Ε2 🔑 — ΤΟ ΚΕΝΤΡΙΚΟ: ο πρώτος πέφτει, ο δεύτερος σώζει', async () => {
    const first = fake('πρώτος', NO);
    const second = fake('δεύτερος', OK);

    const outcome = await sendThroughChain([first, second], MESSAGE);

    expect(outcome).toMatchObject({
      kind: 'delivered',
      provider: 'δεύτερος',
      // 🔑 Η μετάπτωση **δηλώνεται**: το email έφυγε, αλλά ένας πάροχος είναι
      // πεσμένος και κάποιος πρέπει να το μάθει πριν πέσει και ο δεύτερος.
      failedOver: true,
    });
    expect(first.calls).toBe(1);
    expect(second.calls).toBe(1);
  });

  it('Ε3 🔴 — πάροχος που ΠΕΤΑ δεν ρίχνει την αλυσίδα', async () => {
    // Χωρίς περίφραξη, μια εξαίρεση στον πρώτο θα εμπόδιζε τον δεύτερο να
    // δοκιμαστεί — δηλαδή θα ακύρωνε τον λόγο ύπαρξης του module.
    const outcome = await sendThroughChain([fake('α', 'throws'), fake('β', OK)], MESSAGE);
    expect(outcome).toMatchObject({ kind: 'delivered', provider: 'β', failedOver: true });
  });

  it('Ε4 🔴 — όλοι πέφτουν ⇒ `all-failed` ΜΕ ΟΝΟΜΑΤΑ, όχι σκέτο false', async () => {
    const outcome = await sendThroughChain([fake('α', NO), fake('β', NO)], MESSAGE);

    expect(outcome.kind).toBe('all-failed');
    if (outcome.kind !== 'all-failed') throw new Error('αδύνατο');
    expect(outcome.attempts).toEqual([
      { provider: 'α', error: 'πάροχος 500' },
      { provider: 'β', error: 'πάροχος 500' },
    ]);
  });

  it('Ε5 🔑 — η ΣΕΙΡΑ της λίστας είναι η προτίμηση', async () => {
    const a = fake('α', OK);
    const b = fake('β', OK);
    expect((await sendThroughChain([b, a], MESSAGE))).toMatchObject({ provider: 'β' });
    expect((await sendThroughChain([a, b], MESSAGE))).toMatchObject({ provider: 'α' });
  });
});

// =============================================================================
// Ρ — ΡΥΘΜΙΣΗ: «ΔΕΝ ΥΠΑΡΧΕΙ ΠΑΡΟΧΟΣ» ΔΕΝ ΕΙΝΑΙ «Ο ΠΑΡΟΧΟΣ ΑΠΕΤΥΧΕ»
// =============================================================================

describe('Ρ — η απουσία ρύθμισης είναι ΔΙΚΗ ΤΗΣ κατάσταση', () => {
  it('Ρ1 🔴 — κανένας ρυθμισμένος ⇒ `no-provider`, ΟΧΙ `all-failed`', async () => {
    // ⚠️ Η διαφορά δεν είναι σημασιολογική πολυτέλεια: το `all-failed` καίει
    // προσπάθεια και μετά από τρεις γύρους στέλνει το μήνυμα σε dead-letter — για
    // κλήσεις που **δεν έγιναν ποτέ**. Η θεραπεία εδώ είναι μεταβλητή περιβάλλοντος.
    const outcome = await sendThroughChain(
      [fake('α', OK, false), fake('β', OK, false)],
      MESSAGE,
    );
    expect(outcome).toEqual({ kind: 'no-provider' });
  });

  it('Ρ2 — μη ρυθμισμένος κρίκος ΠΑΡΑΛΕΙΠΕΤΑΙ, δεν «αποτυγχάνει»', async () => {
    const unconfigured = fake('α', OK, false);
    const outcome = await sendThroughChain([unconfigured, fake('β', OK)], MESSAGE);

    expect(unconfigured.calls).toBe(0);
    expect(outcome).toMatchObject({
      kind: 'delivered',
      provider: 'β',
      // 🔑 **ΔΕΝ** είναι μετάπτωση: κανείς δεν έπεσε. Αν το μετρούσαμε ως μετάπτωση,
      // κάθε αποστολή σήμερα (χωρίς `RESEND_API_KEY`) θα ανέφερε ψευδή βλάβη.
      failedOver: false,
    });
  });

  it('Ρ3 🔑 — άδεια λίστα ⇒ `no-provider`', async () => {
    expect(await sendThroughChain([], MESSAGE)).toEqual({ kind: 'no-provider' });
  });
});

// =============================================================================
// Χ — ΧΡΟΝΟΣ: Η ΣΥΝΗΘΕΣΤΕΡΗ ΒΛΑΒΗ ΠΑΡΟΧΟΥ ΕΙΝΑΙ Η ΣΙΩΠΗ
// =============================================================================

describe('Χ — ο κολλημένος πάροχος δεν κρατά όμηρο την αλυσίδα', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('Χ1 🔑 — πάροχος που ΔΕΝ ΑΠΑΝΤΑ ΠΟΤΕ ⇒ μετάπτωση στον επόμενο', async () => {
    // ⚠️ Χωρίς όριο χρόνου η εφεδρεία είναι διακοσμητική: η δεύτερη απόπειρα δεν
    // φτάνει ποτέ, γιατί η πρώτη δεν τελειώνει ποτέ. Συμβάν 2026-04-19: «Resend
    // hung silently».
    const hanging = fake('κολλημένος', 'hangs');
    const rescue = fake('σωτήρας', OK);

    const promise = sendThroughChain([hanging, rescue], MESSAGE);
    await jest.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS + 1);

    expect(await promise).toMatchObject({
      kind: 'delivered',
      provider: 'σωτήρας',
      failedOver: true,
    });
  });

  it('Χ2 — το χρονόμετρο καθαρίζεται στη γρήγορη διαδρομή', async () => {
    // Ζωντανό χρονόμετρο κρατά τη διεργασία Node ανοιχτή — σε cron σημαίνει
    // εργασία που δεν κλείνει ποτέ.
    await sendThroughChain([fake('γρήγορος', OK)], MESSAGE);
    expect(jest.getTimerCount()).toBe(0);
  });
});

// =============================================================================
// Ο — ΟΡΑΤΟΤΗΤΑ: ΤΟ «ΕΝΑΣ ΜΟΝΟ ΚΡΙΚΟΣ» ΕΙΝΑΙ ΜΕΤΡΗΣΙΜΟ
// =============================================================================

describe('Ο — η κατάσταση της αλυσίδας δεν είναι υπόθεση', () => {
  it('Ο1 🔑 — ένας ρυθμισμένος ⇒ `hasFailover: false`', () => {
    // Η διαφορά «η εφεδρεία δεν λειτούργησε» / «δεν υπήρχε εφεδρεία» δεν φαίνεται
    // από πουθενά αλλού, και είναι η διαφορά ανάμεσα σε βλάβη και σε ρύθμιση.
    const report = describeChain([fake('resend', OK, false), fake('mailgun', OK, true)]);

    expect(report).toEqual({
      configured: ['mailgun'],
      missing: ['resend'],
      hasFailover: false,
    });
  });

  it('Ο2 — δύο ρυθμισμένοι ⇒ `hasFailover: true`', () => {
    expect(describeChain([fake('α', OK), fake('β', OK)]).hasFailover).toBe(true);
  });
});
