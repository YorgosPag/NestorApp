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

  it('🔑 Α2 — όνομα + ΜΟΝΟ τηλέφωνο ⇒ κανένα εμπόδιο (ΠΕ4: ένας τρόπος αρκεί)', () => {
    expect(firstContactFormBlockers({ name: 'Νίκος', email: '', phone: '6912345678' })).toEqual([]);
  });
});

describe('Β — τι λείπει', () => {
  it('🔴 Β1 — κενό όνομα', () => {
    expect(firstContactFormBlockers({ ...VALID, name: '   ' })).toContain('contact-name-unset');
  });

  it('🔴 Β2 — ούτε email ούτε τηλέφωνο ⇒ ΕΝΑΣ κωδικός, όχι δύο', () => {
    // 🔑 Η απαίτηση είναι «**ένας** τρόπος», όχι «και τα δύο» — δύο χωριστά σφάλματα
    //    θα έλεγαν ψέματα για τον κανόνα.
    const found = firstContactFormBlockers({ name: 'Νίκος', email: '', phone: '' });
    expect(found).toEqual(['contact-channel-unset']);
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
   * σε **κενό**, η φόρμα θα απαιτούσε σιωπηλά **και email ΚΑΙ τηλέφωνο** — δηλαδή θα
   * ακύρωνε το ΠΕΔ4 *(«εσύ διαλέγεις ποιον τρόπο»)* χωρίς να το πει πουθενά.
   */
  it('⛔ Γ1 — κενό email με έγκυρο τηλέφωνο ΔΕΝ είναι σφάλμα μορφής', () => {
    const found = firstContactFormBlockers({ name: 'Νίκος', email: '', phone: '6912345678' });
    expect(found).not.toContain('contact-email-malformed');
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
