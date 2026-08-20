/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΣΥΝΑΘΡΟΙΣΗΣ — ADR-777 §8.25
 * =============================================================================
 *
 * **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ.** Πριν από αυτό το module, το `email-delivery-window.ts`
 * δήλωνε **γραπτά** ότι τρία γεγονότα με `daily` γίνονται τρία email. Η Μ0 το
 * αποδεικνύει **διαβάζοντας το ίδιο το αρχείο**, όχι περιγράφοντάς το: αν κάποιος
 * αφαιρέσει τη δήλωση χωρίς να υλοποιήσει τη συνάθροιση, η άγκυρα κοκκινίζει.
 *
 * ⚠️ **Οι μεταλλάξεις είναι στις ΕΙΣΟΔΟΥΣ, όχι στη συνάρτηση.** Η συνάρτηση είναι
 * καθαρή: κάθε κανόνας της αποδεικνύεται αλλάζοντας **ένα** πεδίο και δείχνοντας
 * ότι η ετυμηγορία **γυρίζει**. Μια μετάλλαξη που δεν αλλάζει την ετυμηγορία δεν
 * αποδεικνύει τίποτα (μάθημα CHECK 3.44 / Μ11).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MIN_DIGEST_SIZE,
  planCoversEveryMessage,
  planEmailDelivery,
  type DeliveryPlanEntry,
  type PendingEmail,
} from '@/server/notifications/email-digest';

/** Συναθροίσιμο εξ ορισμού: ειδοποίηση, μη επείγουσα. */
function msg(overrides: Partial<PendingEmail> = {}): PendingEmail {
  return {
    id: 'm1',
    to: 'a@example.com',
    subject: 'Θέμα',
    content: 'Σώμα',
    priority: 'normal',
    category: 'notification',
    ...overrides,
  };
}

function digestsOf(plan: readonly DeliveryPlanEntry[]) {
  return plan.filter((entry) => entry.kind === 'digest');
}

function solosOf(plan: readonly DeliveryPlanEntry[]) {
  return plan.filter((entry) => entry.kind === 'solo');
}

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: ΤΟ ΚΕΝΟ ΗΤΑΝ ΓΡΑΜΜΕΝΟ, ΟΧΙ ΞΕΧΑΣΜΕΝΟ
// =============================================================================

describe('🔴 Μ0 — το κενό ήταν δηλωμένο όριο', () => {
  it('το `email-delivery-window` δηλώνει ρητά ότι ΔΕΝ συναθροίζει', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/server/notifications/email-delivery-window.ts'),
      'utf8',
    );
    expect(source).toContain('ΔΕΝ ΕΙΝΑΙ ΣΥΝΟΨΗ');
    // Και ονομάζει τον **αποστολέα** ως τη σωστή θέση — αυτό το module.
    expect(source).toContain('ανήκει στον **αποστολέα**');
  });
});

// =============================================================================
// Δ — Η ΑΠΟΦΑΣΗ: ΠΟΙΑ ΦΕΥΓΟΥΝ ΜΑΖΙ
// =============================================================================

describe('Δ — ομαδοποίηση κατά παραλήπτη', () => {
  it('Δ1 🔑 — δύο ειδοποιήσεις στον ίδιο άνθρωπο ⇒ ΜΙΑ σύνοψη', () => {
    const plan = planEmailDelivery([msg({ id: 'a' }), msg({ id: 'b' })]);

    expect(digestsOf(plan)).toHaveLength(1);
    expect(solosOf(plan)).toHaveLength(0);
  });

  it('Δ2 🔴 — ΜΕΤΑΛΛΑΞΗ ΕΙΣΟΔΟΥ: άλλος παραλήπτης ⇒ ΚΑΜΙΑ σύνοψη', () => {
    // ⚠️ Η μοναδική διαφορά από το Δ1 είναι το `to`. Αν η ομαδοποίηση αγνοούσε τον
    // παραλήπτη, το Δ1 θα περνούσε **και** αυτό θα περνούσε — και ο ένας άνθρωπος
    // θα διάβαζε τις ειδοποιήσεις του άλλου.
    const plan = planEmailDelivery([
      msg({ id: 'a', to: 'a@example.com' }),
      msg({ id: 'b', to: 'b@example.com' }),
    ]);

    expect(digestsOf(plan)).toHaveLength(0);
    expect(solosOf(plan).map((entry) => entry.reason)).toEqual(['alone', 'alone']);
  });

  it('Δ3 🔴 — ΜΕΤΑΛΛΑΞΗ ΕΙΣΟΔΟΥ: `urgent` βγαίνει ΕΞΩ από τη σύνοψη', () => {
    const plan = planEmailDelivery([
      msg({ id: 'a' }),
      msg({ id: 'b' }),
      msg({ id: 'c', priority: 'urgent' }),
    ]);

    const digest = digestsOf(plan)[0];
    expect(digest.members.map((member) => member.id)).toEqual(['a', 'b']);
    expect(solosOf(plan)).toEqual([
      expect.objectContaining({ reason: 'urgent' }),
    ]);
  });

  it('Δ4 🔴 — ΜΕΤΑΛΛΑΞΗ ΕΙΣΟΔΟΥ: μη-ειδοποίηση βγαίνει ΕΞΩ', () => {
    const plan = planEmailDelivery([
      msg({ id: 'a' }),
      msg({ id: 'b' }),
      msg({ id: 'c', category: 'marketing' }),
    ]);

    expect(digestsOf(plan)[0].members).toHaveLength(2);
    expect(solosOf(plan)[0]).toMatchObject({ reason: 'not-a-notification' });
  });

  it('Δ5 🔑 — ΕΝΑ μόνο του ΔΕΝ γίνεται σύνοψη', () => {
    // «Έχετε 1 νέα ειδοποίηση» κρύβει το θέμα πίσω από γενικό τίτλο. Η σύνοψη
    // κερδίζει μόνο όταν αντικαθιστά **πολλές** διακοπές με μία.
    const plan = planEmailDelivery([msg({ id: 'a' })]);

    expect(digestsOf(plan)).toHaveLength(0);
    expect(solosOf(plan)[0]).toMatchObject({ reason: 'alone' });
    expect(MIN_DIGEST_SIZE).toBe(2);
  });

  it('Δ6 — η σειρά των μελών είναι η σειρά εισόδου (άρα χρονολογική)', () => {
    // Ο αγωγός ταξινομεί κατά `scheduledAt`. Αν η ομαδοποίηση χαλούσε τη σειρά, η
    // σύνοψη θα διαβαζόταν ανάποδα χωρίς κανείς να το προσέξει.
    const plan = planEmailDelivery([
      msg({ id: 'a', subject: 'Πρώτο' }),
      msg({ id: 'b', subject: 'Δεύτερο' }),
      msg({ id: 'c', subject: 'Τρίτο' }),
    ]);

    expect(digestsOf(plan)[0].members.map((member) => member.subject)).toEqual([
      'Πρώτο', 'Δεύτερο', 'Τρίτο',
    ]);
  });
});

// =============================================================================
// Σ — ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ: ΤΙΠΟΤΑ ΔΕΝ ΧΑΝΕΤΑΙ ΣΤΟ ΤΥΛΙΓΜΑ
// =============================================================================

describe('Σ — η σύνοψη λέει ό,τι έλεγαν τα μέλη της', () => {
  it('Σ1 🔑 — κάθε θέμα και κάθε σώμα υπάρχει, σε κείμενο ΚΑΙ σε HTML', () => {
    const plan = planEmailDelivery([
      msg({ id: 'a', subject: 'Νέο ενδιαφέρον', content: 'Οδός Παπάγου 4' }),
      msg({ id: 'b', subject: 'Νέα υπογραφή', content: 'Γεωργίου Κ.' }),
    ]);
    const digest = digestsOf(plan)[0];

    for (const needle of ['Νέο ενδιαφέρον', 'Οδός Παπάγου 4', 'Νέα υπογραφή', 'Γεωργίου Κ.']) {
      expect(digest.content).toContain(needle);
      expect(digest.html).toContain(needle);
    }
  });

  it('Σ2 — το θέμα λέει το πλήθος', () => {
    const plan = planEmailDelivery([msg({ id: 'a' }), msg({ id: 'b' }), msg({ id: 'c' })]);
    expect(digestsOf(plan)[0].subject).toContain('3');
  });

  it('Σ3 🔴 — κείμενο χρήστη με `<` ΔΕΝ σπάει το HTML', () => {
    // ⚠️ Τα θέματα περιέχουν ονόματα ακινήτων και ανθρώπων — κείμενο που γράφει
    // χρήστης. Ένα `<` σε τίτλο θα έσπαγε το μήνυμα· ένα `<script>` θα ήταν χειρότερο.
    const plan = planEmailDelivery([
      msg({ id: 'a', subject: '<script>alert(1)</script>' }),
      msg({ id: 'b', content: 'Τιμή < 100.000 &' }),
    ]);
    const digest = digestsOf(plan)[0];

    expect(digest.html).not.toContain('<script>');
    expect(digest.html).toContain('&lt;script&gt;');
    expect(digest.html).toContain('&amp;');
    // Το απλό κείμενο μένει **αυτούσιο**: εκεί δεν υπάρχει σήμανση να σπάσει.
    expect(digest.content).toContain('<script>alert(1)</script>');
  });

  it('Σ4 — άδειο σώμα δεν γεννά κενή γραμμή στο HTML', () => {
    const plan = planEmailDelivery([
      msg({ id: 'a', subject: 'Μόνο θέμα', content: '   ' }),
      msg({ id: 'b' }),
    ]);
    expect(digestsOf(plan)[0].html).not.toContain('<p style="margin:4px 0 0;color:#555"></p>');
  });
});

// =============================================================================
// Κ — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ: Ο ΦΡΟΥΡΟΣ ΜΠΟΡΕΙ ΝΑ ΠΥΡΟΔΟΤΗΣΕΙ
// =============================================================================

describe('Κ — το πλάνο καλύπτει τα πάντα, ακριβώς μία φορά', () => {
  it('Κ1 — κανονικό πλάνο ⇒ καλύπτει', () => {
    const messages = [msg({ id: 'a' }), msg({ id: 'b' }), msg({ id: 'c', priority: 'urgent' })];
    expect(planCoversEveryMessage(planEmailDelivery(messages), messages)).toBe(true);
  });

  it('Κ2 🔴 — ΧΑΜΕΝΟ μήνυμα ⇒ ο φρουρός ουρλιάζει', () => {
    // ⚠️ Αυτό είναι το χειρότερο σενάριο και είναι **σιωπηλό**: το μήνυμα δεν
    // αποτυγχάνει, μένει `pending` και ξαναδοκιμάζεται αιώνια χωρίς κανείς να το μάθει.
    const messages = [msg({ id: 'a' }), msg({ id: 'b' })];
    const truncated: DeliveryPlanEntry[] = [
      { kind: 'solo', message: messages[0], reason: 'alone' },
    ];
    expect(planCoversEveryMessage(truncated, messages)).toBe(false);
  });

  it('Κ3 🔴 — ΔΙΠΛΟ μήνυμα ⇒ ο φρουρός ουρλιάζει', () => {
    // Ίδιο πλήθος με την είσοδο, αλλά το ένα στάλθηκε δύο φορές και το άλλο ποτέ.
    // Ένας έλεγχος μόνο σε μέγεθος θα το έβαφε πράσινο.
    const messages = [msg({ id: 'a' }), msg({ id: 'b' })];
    const doubled: DeliveryPlanEntry[] = [
      { kind: 'solo', message: messages[0], reason: 'alone' },
      { kind: 'solo', message: messages[0], reason: 'alone' },
    ];
    expect(planCoversEveryMessage(doubled, messages)).toBe(false);
  });

  it('Κ4 🔴 — ΞΕΝΟ μήνυμα στο πλάνο ⇒ ο φρουρός ουρλιάζει', () => {
    const messages = [msg({ id: 'a' })];
    const foreign: DeliveryPlanEntry[] = [
      { kind: 'solo', message: msg({ id: 'ξένο' }), reason: 'alone' },
    ];
    expect(planCoversEveryMessage(foreign, messages)).toBe(false);
  });

  it('Κ5 — άδεια είσοδος ⇒ άδειο πλάνο, και κλείνει', () => {
    expect(planEmailDelivery([])).toEqual([]);
    expect(planCoversEveryMessage([], [])).toBe(true);
  });

  it('Κ6 🔑 — μεγάλο ανάμεικτο πέρασμα κλείνει ΠΑΝΤΑ', () => {
    // Κάθε συνδυασμός κατάστασης, ώστε κανένας κλάδος να μην είναι αδοκίμαστος.
    const messages: PendingEmail[] = [];
    const recipients = ['a@x.gr', 'b@x.gr', 'c@x.gr'];
    for (let index = 0; index < 30; index += 1) {
      messages.push(msg({
        id: `m${index}`,
        to: recipients[index % 3],
        priority: index % 7 === 0 ? 'urgent' : 'normal',
        category: index % 5 === 0 ? 'transactional' : 'notification',
      }));
    }

    const plan = planEmailDelivery(messages);
    expect(planCoversEveryMessage(plan, messages)).toBe(true);
  });
});
