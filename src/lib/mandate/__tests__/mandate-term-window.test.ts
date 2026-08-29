/**
 * @fileoverview **Η ΑΛΥΣΙΔΑ ΤΗΣ ΛΗΞΗΣ** — προεπιλογή → οθόνη → κριτής → σύρμα.
 * @related ADR-827 §9.17 ζ · §9.18 · lib/mandate/mandate-term-window.ts · ΑΚ 243
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΑΛΥΣΙΔΑ ΚΑΙ ΟΧΙ ΤΑ ΚΟΜΜΑΤΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ελάττωμα του §9.18 έζησε πίσω από **53 πράσινα tests**. Κανένα δεν ήταν λάθος:
 * το `defaultExpiryFor` δοκιμαζόταν μόνο του *(«2027-04-20T12:00:00.000Z» — σωστό)*,
 * το `exceedsStatutoryTerm` μόνο του *(«πάνω από 8 μήνες ⇒ true» — σωστό)*. Κανένα δεν
 * ρωτούσε **το ερώτημα που ζει ο άνθρωπος**:
 *
 * > *«ανοίγω τη φόρμα, δεν αγγίζω τίποτα — είναι νόμιμο αυτό που βλέπω;»*
 *
 * Η απάντηση ήταν **όχι**, επί δύο ημέρες παραγωγής. Ίδιο σχήμα με το §8.9 δ *(«τα 307
 * tests έλεγχαν τον τύπο και το σχήμα **χωριστά**, ποτέ την **αλυσίδα**»)* — και είναι
 * η **δεύτερη** φορά που η ίδια οικογένεια το πληρώνει.
 *
 * ⚠️ **ΜΗΝ «απλοποιήσεις» τις δοκιμές της αλυσίδας σε δοκιμές μονάδας.** Τα κομμάτια
 * έχουν ήδη τις δικές τους άγκυρες· αυτό εδώ φυλά τη **ραφή** τους, που είναι το μόνο
 * σημείο όπου κανένα από τα δύο αρχεία δεν κοιτάζει.
 */

import {
  defaultExpiryFor,
  exceedsStatutoryTerm,
} from '@/types/owner-property-mandate';
import { EXCLUSIVE_AGENCY, OPEN_LISTING } from '@/types/listing-agreement';
import { emptyMandateForm, mandateFormBlockers } from '@/lib/mandate/mandate-form-values';

import { endOfDay, toDateInputValue } from '../mandate-term-window';

describe('mandate-term-window — η μετάφραση ημέρας ⇄ στιγμής', () => {
  it('Α1. endOfDay δίνει το ΤΕΛΟΣ της ημέρας, με χιλιοστά και ζώνη — και τα τρία μετρούν', () => {
    // ⚠️ Τέσσερις ανεξάρτητοι ισχυρισμοί, ΟΧΙ ένας: η μονή μετάλλαξη «άλλαξε τα
    //    χιλιοστά» πρέπει να κοκκινίζει μόνη της (το μάθημα του §9.16 γ, όπου η
    //    διπλή προεπιλογή του `formatDate` απορροφούσε τη μονή μετάλλαξη).
    expect(endOfDay('2027-04-29')).toBe('2027-04-29T23:59:59.999Z');
    expect(endOfDay('2027-04-29')).toContain('T23:59:59');
    expect(endOfDay('2027-04-29')).toMatch(/\.999Z$/);
    expect(endOfDay('2027-04-29').slice(0, 10)).toBe('2027-04-29');
  });

  it('Α2. endOfDay είναι ΤΕΛΟΣ και όχι ΑΡΧΗ — η διαφορά είναι ένα εικοσιτετράωρο', () => {
    const start = Date.parse('2027-04-29T00:00:00.000Z');
    const end = Date.parse(endOfDay('2027-04-29'));
    // 🔑 Ο αριθμός είναι η **συνέπεια** της λάθος γραφής, γραμμένος ώστε να μη
    //    μπορεί να περάσει ένα `T00:00:00.000Z`.
    expect(end - start).toBe(86_399_999);
  });

  it('Α3. toDateInputValue κόβει, ΔΕΝ ξαναδιαβάζει — καμία τοπική ζώνη στη μέση', () => {
    // 🔴 Η στιγμή είναι **λίγο πριν τα μεσάνυχτα UTC**: ένα `new Date(...)` με τοπική
    //    ζώνη ανατολικά του UTC θα έδινε την **επόμενη** ημέρα. Η άγκυρα κοκκινίζει
    //    για κάθε υλοποίηση που περνά από ημερολόγιο αντί για τεμαχισμό.
    expect(toDateInputValue('2027-04-29T23:30:00.000Z')).toBe('2027-04-29');
    expect(toDateInputValue('2027-04-29T00:30:00.000Z')).toBe('2027-04-29');
  });

  it('Α4. toDateInputValue(null) δίνει κενό — ποτέ σιωπηλή σημερινή', () => {
    expect(toDateInputValue(null)).toBe('');
  });
});

describe('§9.18 — Η ΠΡΟΕΠΙΛΟΓΗ ΤΗΣ ΦΟΡΜΑΣ ΕΙΝΑΙ ΝΟΜΙΜΗ (το ελάττωμα που έζησε πίσω από 53 πράσινα)', () => {
  /**
   * 🔴 **Η ΩΡΑ ΤΗΣ ΑΦΕΤΗΡΙΑΣ ΕΙΝΑΙ ΤΟ ΟΛΟ ΝΟΗΜΑ.** Με `T00:00:00Z` το ελάττωμα
   * **εξαφανίζεται** (δεν έχει περάσει καμία ώρα να χαθεί), και η άγκυρα θα ήταν
   * πράσινη για λάθος λόγο. Το μεσημέρι είναι η ρεαλιστική στιγμή που ανοίγει
   * κανείς φόρμα, και η υπέρβαση που παρήγαγε ήταν **12 ώρες**.
   */
  const NOON = '2026-08-29T12:00:00.000Z';

  it('Β1. 🔴 ΤΟ ΣΕΝΑΡΙΟ ΤΟΥ ΑΝΘΡΩΠΟΥ: ανοίγω τη φόρμα, δεν αγγίζω τίποτα ⇒ ΚΑΝΕΝΑ εμπόδιο διάρκειας', () => {
    const values = emptyMandateForm(NOON);
    const blockers = mandateFormBlockers(values, NOON);

    // ⚠️ Μόνο το `mandate-client-unset` επιτρέπεται εδώ: ο πελάτης όντως λείπει.
    //    Το `mandate-term-illegal` σε **προεπιλογή που παρήγαγε το ίδιο το σύστημα**
    //    είναι το ελάττωμα του §9.18.
    expect(blockers).not.toContain('mandate-term-illegal');
    expect(blockers).toEqual(['mandate-client-unset']);
  });

  it('Β2. Η ίδια αλήθεια στον ΚΡΙΤΗ, χωρίς τη φόρμα στη μέση', () => {
    const latest = defaultExpiryFor(EXCLUSIVE_AGENCY, NOON);
    expect(latest).not.toBeNull();

    // Η ακριβής αλυσίδα: όριο → ημερομηνία οθόνης → στιγμή που στέλνεται.
    const onScreen = toDateInputValue(latest);
    const onTheWire = endOfDay(onScreen);

    expect(exceedsStatutoryTerm(EXCLUSIVE_AGENCY, NOON, onTheWire)).toBe(false);
  });

  it('Β3. 🔑 ΚΑΙ ΤΟ ΟΡΙΟ ΔΕΝ ΧΑΛΑΡΩΣΕ: μία ημέρα παραπάνω ΕΞΑΚΟΛΟΥΘΕΙ να ξεπερνά', () => {
    // ⚠️ Χωρίς αυτό, η «διόρθωση» θα μπορούσε να είναι σκέτο `return false` και η
    //    Β1/Β2 θα ήταν **πράσινες**. Είναι ο φρουρός του φρουρού.
    expect(exceedsStatutoryTerm(EXCLUSIVE_AGENCY, NOON, endOfDay('2027-04-30'))).toBe(true);
    expect(exceedsStatutoryTerm(EXCLUSIVE_AGENCY, NOON, '2027-04-30T00:00:00.000Z')).toBe(true);
  });

  it('Β4. Η τελευταία νόμιμη ΣΤΙΓΜΗ είναι το τέλος της αντίστοιχης ημέρας (ΑΚ 243)', () => {
    // 8 μήνες από 29/08/2026 ⇒ 29/04/2027. «Λήγει **με την παρέλευση** της ημέρας».
    expect(exceedsStatutoryTerm(EXCLUSIVE_AGENCY, NOON, '2027-04-29T23:59:59.999Z')).toBe(false);
    expect(exceedsStatutoryTerm(EXCLUSIVE_AGENCY, NOON, '2027-04-30T00:00:00.000Z')).toBe(true);
  });

  it('Β5. Ισχύει και για το ΑΛΛΟ είδος εντολής — δεν διορθώσαμε μία περίπτωση', () => {
    // 🔑 Η ανοιχτή εντολή έχει **άλλο** ανώτατο (12 μήνες). Αν η θεραπεία ήταν
    //    καρφωμένη στους 8, αυτό εδώ θα κοκκίνιζε.
    const latest = defaultExpiryFor(OPEN_LISTING, NOON);
    expect(exceedsStatutoryTerm(OPEN_LISTING, NOON, endOfDay(toDateInputValue(latest)))).toBe(false);
    expect(exceedsStatutoryTerm(OPEN_LISTING, NOON, endOfDay('2027-08-30'))).toBe(true);
  });

  it('Β6. Η ώρα της αφετηρίας ΔΕΝ αλλάζει πια την ετυμηγορία — η ρίζα του ελαττώματος', () => {
    // 🔴 Αυτό είναι **κυριολεκτικά** το ελάττωμα: με το παλιό όριο, η ίδια λήξη
    //    κρινόταν νόμιμη στις 00:00 και **παράνομη** στις 23:00 της ίδιας ημέρας.
    const sameExpiry = endOfDay('2027-04-29');
    const verdicts = [
      '2026-08-29T00:00:00.000Z',
      '2026-08-29T12:00:00.000Z',
      '2026-08-29T23:00:00.000Z',
    ].map((from) => exceedsStatutoryTerm(EXCLUSIVE_AGENCY, from, sameExpiry));

    expect(verdicts).toEqual([false, false, false]);
  });
});
