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

// =============================================================================
// Γ — Η ΓΛΩΣΣΑ ΤΟΥ ΠΑΡΑΛΗΠΤΗ (ADR-777 §8.29)
// =============================================================================

describe('Γ — η σύνοψη γράφεται στη γλώσσα του παραλήπτη', () => {
  /** Ελληνικοί χαρακτήρες — το κριτήριο «είναι όντως ελληνικό;». */
  const GREEK = /[Ͱ-Ͽ]/;

  function digestFor(messages: readonly PendingEmail[]) {
    const digests = digestsOf(planEmailDelivery(messages));
    expect(digests).toHaveLength(1);
    return digests[0] as Extract<DeliveryPlanEntry, { kind: 'digest' }>;
  }

  /** Μέλος με **ουδέτερο** κείμενο, ώστε να κρίνεται μόνο το περιτύλιγμα. */
  function neutral(overrides: Partial<PendingEmail> = {}): PendingEmail {
    return msg({ subject: 'ABC-123', content: '', ...overrides });
  }

  it('Γ0 🔴🔴 — ΜΕΤΑΛΛΑΞΗ ΕΙΣΟΔΟΥ: `el` → `en` ΓΥΡΙΖΕΙ την ετυμηγορία', () => {
    // ⚠️ **Η άγκυρα που κάνει το §8.29 μη-διακοσμητικό.** Ένα test που ελέγχει
    // μόνο ελληνικά περνά ακόμη κι αν η γλώσσα αγνοείται εντελώς. Εδώ αλλάζει
    // **ένα** πεδίο της εισόδου και απαιτείται να αλλάξει ΟΛΟ το περιτύλιγμα.
    const greek = digestFor([
      neutral({ id: 'a', language: 'el' }),
      neutral({ id: 'b', language: 'el' }),
    ]);
    const english = digestFor([
      neutral({ id: 'a', language: 'en' }),
      neutral({ id: 'b', language: 'en' }),
    ]);

    expect(greek.subject).not.toBe(english.subject);
    expect(GREEK.test(greek.subject)).toBe(true);
    expect(GREEK.test(english.subject)).toBe(false);

    // Και στα **τρία** προϊόντα, όχι μόνο στο θέμα: το σώμα κειμένου και το HTML
    // παράγονται από χωριστές συναρτήσεις, άρα μπορούν να ξεχάσουν τη γλώσσα
    // ανεξάρτητα — και ο παραλήπτης θα έβλεπε αγγλικό θέμα με ελληνικό σώμα.
    expect(GREEK.test(english.content)).toBe(false);
    expect(GREEK.test(english.html)).toBe(false);
    expect(GREEK.test(greek.content)).toBe(true);
    expect(GREEK.test(greek.html)).toBe(true);
  });

  it('Γ0β 🔶 ΔΗΛΩΜΕΝΟ ΟΡΙΟ — το ΠΕΡΙΤΥΛΙΓΜΑ μεταφράζεται· οι ΤΙΤΛΟΙ των ειδοποιήσεων ΟΧΙ', () => {
    // 🔴 **Αυτή η άγκυρα υπάρχει για να μη διαβαστεί το §8.29 ως κάτι μεγαλύτερο
    // απ' ό,τι είναι.** Η σύνοψη είναι φάκελος γύρω από N ειδοποιήσεις: ο φάκελος
    // ακολουθεί τη γλώσσα του παραλήπτη, αλλά τα `subject`/`content` του κάθε
    // μέλους παράγονται **αλλού** — στον καλούντα του `dispatchNotification`, ανά
    // συμβάν, και είναι σήμερα ελληνικά για όλα τα 29 συμβάντα.
    //
    // Άρα ένας Άγγλος παραλήπτης βλέπει **αγγλικό «You have 2 new notifications»
    // πάνω από ελληνικές γραμμές**. Είναι βελτίωση έναντι του «όλα ελληνικά», και
    // **δεν** είναι ολοκληρωμένη μετάφραση. Όποιος κλείσει το υπόλοιπο θα πρέπει
    // να σβήσει αυτή την άγκυρα — και τότε θα το κάνει **εν γνώσει του**, όχι
    // ανακαλύπτοντας εκ των υστέρων ότι το είχαμε δηλώσει κλειστό.
    const english = digestFor([
      msg({ id: 'a', subject: 'Νέα ζήτηση', language: 'en' }),
      msg({ id: 'b', subject: 'Νέο ακίνητο', language: 'en' }),
    ]);

    // Το περιτύλιγμα: αγγλικό.
    expect(GREEK.test(english.subject)).toBe(false);
    // Τα μέλη: **αυτούσια**, όπως γεννήθηκαν.
    expect(english.content).toContain('Νέα ζήτηση');
    expect(english.html).toContain('Νέο ακίνητο');
  });

  it('Γ1 🔑 — ΔΥΟ ΓΛΩΣΣΕΣ, ΙΔΙΑ ΔΙΕΥΘΥΝΣΗ ⇒ ΔΥΟ συνόψεις, όχι μία ανάμεικτη', () => {
    // Ο χρήστης άλλαξε γλώσσα μέσα στη μέρα· η ουρά του κρατά και τα δύο.
    // Ένα email έχει **ένα** θέμα: αν ενώνονταν, κάποιος θα αποφάσιζε σιωπηλά
    // ποια γλώσσα κερδίζει — απάντηση που θα εξαρτιόταν από τη σειρά της ουράς.
    const messages = [
      msg({ id: 'a', to: 'ίδιος@x.gr', language: 'el' }),
      msg({ id: 'b', to: 'ίδιος@x.gr', language: 'el' }),
      msg({ id: 'c', to: 'ίδιος@x.gr', language: 'en' }),
      msg({ id: 'd', to: 'ίδιος@x.gr', language: 'en' }),
    ];

    const digests = digestsOf(planEmailDelivery(messages));
    expect(digests).toHaveLength(2);

    for (const digest of digests) {
      const entry = digest as Extract<DeliveryPlanEntry, { kind: 'digest' }>;
      expect(entry.to).toBe('ίδιος@x.gr');
      // **Εσωτερικά συνεπής**: κάθε μέλος έχει τη γλώσσα της ομάδας του.
      for (const member of entry.members) {
        expect(member.language).toBe(entry.language);
      }
      // Και το θέμα ακολουθεί τη γλώσσα της ομάδας, όχι της πρώτης εισόδου.
      expect(GREEK.test(entry.subject)).toBe(entry.language === 'el');
    }
  });

  it('Γ2 🔴 — η κλειστή λογιστική ΔΕΝ κουνιέται από τη νέα διάσταση', () => {
    // Το κλειδί ομαδοποίησης έγινε σύνθετο· ο φρουρός μετρά **μηνύματα**, όχι
    // ομάδες. Ένα μήνυμα εξακολουθεί να προσγειώνεται σε ακριβώς μία εγγραφή.
    const messages: PendingEmail[] = [];
    const recipients = ['a@x.gr', 'b@x.gr'];
    const languages = ['el', 'en', undefined, 'pseudo', 'el-GR'];
    for (let index = 0; index < 40; index += 1) {
      messages.push(msg({
        id: `m${index}`,
        to: recipients[index % 2],
        language: languages[index % languages.length],
        priority: index % 7 === 0 ? 'urgent' : 'normal',
        category: index % 5 === 0 ? 'transactional' : 'notification',
      }));
    }

    const plan = planEmailDelivery(messages);
    expect(planCoversEveryMessage(plan, messages)).toBe(true);
  });

  it('Γ3 🔑 — μήνυμα ΧΩΡΙΣ γλώσσα συμπεριφέρεται ΑΚΡΙΒΩΣ όπως πριν το §8.29', () => {
    // Καμία migration: κάθε έγγραφο γραμμένο πριν σήμερα δεν έχει το πεδίο.
    // Αν αυτό αλλάξει συμπεριφορά, η αλλαγή δεν είναι προσθετική.
    const withoutField = digestFor([msg({ id: 'a' }), msg({ id: 'b' })]);
    const explicitGreek = digestFor([
      msg({ id: 'a', language: 'el' }),
      msg({ id: 'b', language: 'el' }),
    ]);

    expect(withoutField.subject).toBe(explicitGreek.subject);
    expect(withoutField.content).toBe(explicitGreek.content);
    expect(withoutField.html).toBe(explicitGreek.html);
    expect(withoutField.language).toBe('el');
  });

  it('Γ4 🔴 — το `pseudo` ΔΕΝ φτάνει ΠΟΤΕ σε email', () => {
    // Ο επιλογέας της κεφαλίδας το προσφέρει σε περιβάλλον ανάπτυξης. Αν διέρρεε
    // στο έγγραφο, ο παραλήπτης θα έπαιρνε κείμενο τυλιγμένο σε `[[~~ … ~~]]`.
    const digest = digestFor([
      msg({ id: 'a', language: 'pseudo' }),
      msg({ id: 'b', language: 'pseudo' }),
    ]);

    expect(digest.language).toBe('el');
    expect(digest.subject).not.toContain('~~');
    expect(digest.html).not.toContain('~~');
  });

  it('Γ5 — ίδια γλώσσα, ΔΥΟ διευθύνσεις ⇒ παραμένουν χωριστές', () => {
    // Ο διαχωριστής του σύνθετου κλειδιού δεν επιτρέπεται να ενώσει ξένους
    // παραλήπτες. Η αντίστροφη κατεύθυνση της Γ1.
    const digests = digestsOf(planEmailDelivery([
      msg({ id: 'a', to: 'a@x.gr', language: 'en' }),
      msg({ id: 'b', to: 'a@x.gr', language: 'en' }),
      msg({ id: 'c', to: 'b@x.gr', language: 'en' }),
      msg({ id: 'd', to: 'b@x.gr', language: 'en' }),
    ]));

    expect(digests).toHaveLength(2);
    expect(new Set(digests.map((d) => (d as Extract<DeliveryPlanEntry, { kind: 'digest' }>).to)).size).toBe(2);
  });
});
