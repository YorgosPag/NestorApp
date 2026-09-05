/**
 * @fileoverview **Ο ΚΡΙΤΗΣ ΤΗΣ ΦΟΡΜΑΣ ΤΡΕΧΕΙ** — και λέει ΟΛΑ όσα λείπουν, όχι το πρώτο.
 * @related lib/contact/first-contact-form-values.ts · ADR-843 §10.13
 *
 * 🔑 **Γιατί υπάρχει**: αυτή η συνάρτηση είναι ο **μόνος** λόγος που ο άνθρωπος δεν
 * πληρώνει γύρο δικτύου για κενό πεδίο. Αν σιωπήσει, η οθόνη **δεν σπάει** — απλώς
 * ξαναγίνεται η προηγούμενη, χειρότερη εκδοχή της, **αθόρυβα**.
 */

import {
  BLOCKER_FIELD,
  FIRST_CONTACT_FORM_BLOCKERS,
  disclosureChannelOf,
  firstContactFormBlockers,
} from '@/lib/contact/first-contact-form-values';

const VALID = { name: 'Ελένη', email: 'eleni@example.gr', phone: '' } as const;

describe('Α — ο παρονομαστής: η έγκυρη δήλωση ΠΕΡΝΑ', () => {
  it('🔑 Α1 — όνομα + email ⇒ κανένα εμπόδιο', () => {
    // ⚠️ Χωρίς αυτό, μια συνάρτηση που επιστρέφει **πάντα** εμπόδια θα περνούσε κάθε
    //    άλλο σκέλος — και η φόρμα δεν θα στελνόταν ΠΟΤΕ.
    expect(firstContactFormBlockers(VALID)).toEqual([]);
  });

  it('🔑 Α2 — όνομα + email + τηλέφωνο ⇒ κανένα εμπόδιο (το τηλέφωνο είναι ΠΡΟΣΘΕΤΟ)', () => {
    expect(
      firstContactFormBlockers({ name: 'Νίκος', email: 'nikos@example.gr', phone: '6912345678' }),
    ).toEqual([]);
  });
});

describe('Β — τι λείπει', () => {
  it('🔴 Β1 — κενό όνομα', () => {
    expect(firstContactFormBlockers({ ...VALID, name: '   ' })).toContain('contact-name-unset');
  });

  it('🔴 Β2 — κενό email ⇒ ΕΝΑΣ κωδικός, όχι δύο για το ίδιο πεδίο (ADR-844 #3)', () => {
    // 🔑 Το κανάλι που **μπορούμε να αποδείξουμε** είναι ένα. Ένα δεύτερο εμπόδιο
    //    («ούτε email ούτε τηλέφωνο») θα κοκκίνιζε **δύο** γραμμές σύνοψης με
    //    σύνδεσμο στο **ίδιο** `<input>`.
    const found = firstContactFormBlockers({ name: 'Νίκος', email: '', phone: '' });
    expect(found).toEqual(['contact-email-unset']);
  });

  it('🔴 Β2β — και ΜΕ τηλέφωνο, το κενό email εξακολουθεί να εμποδίζει', () => {
    // ⛔ **Η ΑΝΤΙΣΤΡΟΦΗ ΤΟΥ ΠΑΛΙΟΥ Α2, ΚΑΙ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ ΤΟ ADR-844.**
    //    Ως τις 2026-09-05 αυτή η δήλωση περνούσε — και ο ιδιοκτήτης έπαιρνε
    //    **ανεπαλήθευτο** κανάλι από άνθρωπο που κανείς δεν είχε επιβεβαιώσει.
    const found = firstContactFormBlockers({ name: 'Νίκος', email: '', phone: '6912345678' });
    expect(found).toEqual(['contact-email-unset']);
  });

  it('🔴 Β3 — ΟΛΑ μαζί, ποτέ μόνο το πρώτο', () => {
    // ⚠️ Ο άνθρωπος που διορθώνει ένα τη φορά κάνει τρεις γύρους για τρία λάθη.
    const found = firstContactFormBlockers({ name: '', email: 'οχι-email', phone: '123' });
    expect(found).toEqual(
      expect.arrayContaining([
        'contact-name-unset',
        'contact-email-malformed',
        'contact-phone-malformed',
      ]),
    );
    expect(found.length).toBe(3);
  });
});

describe('Γ — 🔴 ΤΟ ΚΕΝΟ ΠΕΔΙΟ ΔΕΝ ΕΙΝΑΙ ΚΑΚΟΣΧΗΜΑΤΙΣΜΕΝΟ', () => {
  /**
   * 🔴 **ΤΟ ΠΙΟ ΕΥΚΟΛΟ ΛΑΘΟΣ ΟΛΟΥ ΤΟΥ ΑΡΧΕΙΟΥ.** Αν ο έλεγχος μορφής έτρεχε και πάνω
   * σε **κενό**, το προαιρετικό τηλέφωνο θα γινόταν σιωπηλά **απαιτούμενο** — δηλαδή θα
   * ακύρωνε την απόφαση #5 του ADR-844 χωρίς να το πει πουθενά.
   */
  it('⛔ Γ1 — το κενό email λέει «λείπει», ΠΟΤΕ «δεν διαβάζεται»', () => {
    const found = firstContactFormBlockers({ name: 'Νίκος', email: '', phone: '6912345678' });
    expect(found).not.toContain('contact-email-malformed');
    expect(found).toContain('contact-email-unset');
  });

  it('⛔ Γ2 — κενό τηλέφωνο με έγκυρο email ΔΕΝ είναι σφάλμα μορφής', () => {
    const found = firstContactFormBlockers({ name: 'Ελένη', email: 'a@b.gr', phone: '' });
    expect(found).not.toContain('contact-phone-malformed');
  });

  it('🔑 Γ3 — ο παρονομαστής: γεμάτο ΚΑΙ άκυρο ΕΙΝΑΙ σφάλμα', () => {
    // ⚠️ Χωρίς αυτό, μια συνάρτηση που **ποτέ** δεν ελέγχει μορφή θα περνούσε τα Γ1/Γ2.
    expect(firstContactFormBlockers({ ...VALID, phone: '12' })).toContain(
      'contact-phone-malformed',
    );
  });
});

describe('Δ — κάθε εμπόδιο ξέρει ΠΟΥ στέκεται ο άνθρωπος', () => {
  it('🔴 Δ1 — πλήρης χάρτης πεδίων', () => {
    // Γραμμή σύνοψης χωρίς πεδίο = σύνδεσμος που **δεν πηγαίνει πουθενά**.
    expect(FIRST_CONTACT_FORM_BLOCKERS.filter((code) => !(code in BLOCKER_FIELD))).toEqual([]);
  });
});

describe('Ε — το κανάλι φεύγει ως null, όχι ως κενό', () => {
  it('🔴 Ε1 — κενό και κενά διαστήματα ⇒ null', () => {
    // 🔴 Το `hasReplyChannel` ρωτά `!== null`. Κενό string θα περνούσε ως «κανάλι»
    //    που δεν υπάρχει — αδιέξοδο με ημερομηνία.
    expect(disclosureChannelOf('')).toBeNull();
    expect(disclosureChannelOf('   ')).toBeNull();
  });

  it('🔑 Ε2 — και η πραγματική τιμή περνά καθαρή', () => {
    expect(disclosureChannelOf('  a@b.gr  ')).toBe('a@b.gr');
  });
});
