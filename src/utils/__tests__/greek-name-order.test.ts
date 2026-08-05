/**
 * @fileoverview Η **σειρά** του ελληνικού ονόματος (ADR-759 Φ1) — άγκυρα του
 * {@link @/utils/greek-name-order}.
 *
 * 🔴 **Γιατί χρειάζεται ξεχωριστό test, ενώ το ταίριασμα καλύπτεται ήδη.** Το
 * `greek-person-name.test.ts` ελέγχει «είναι ο ίδιος άνθρωπος;» — ερώτηση **ανεξάρτητη σειράς**
 * εκ κατασκευής. Άρα **κανένα** από τα υπάρχοντα tests δεν κοκκινίζει αν το `firstName` και το
 * `lastName` γραφτούν ανάποδα στη βάση: ο ταιριαστής θα εξακολουθούσε να δίνει `name-exact`.
 * Η ανεστραμμένη εγγραφή είναι λάθος **που καμία άλλη άγκυρα του έργου δεν μπορεί να δει**.
 */

import { splitGreekPersonName } from '@/utils/greek-name-order';

describe('splitGreekPersonName — τα σήματα του ίδιου του σχεδίου', () => {
  it('🔑 αρχικό πατρωνύμου ΑΝΑΜΕΣΑ ⇒ σημαδεύει το σύνορο (το δείγμα G753)', () => {
    const parts = splitGreekPersonName('ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ');
    expect(parts).toEqual({
      lastName: 'ΝΙΚΟΛΑΟΥ',
      firstName: 'ΙΩΑΝΝΗΣ',
      patronymicInitial: 'ΕΥ.',
      signal: 'patronymic-initial',
    });
  });

  it('🔑 το σύνορο αντέχει ΣΥΝΘΕΤΟ επώνυμο — καμία μέτρηση κομματιών δεν θα το έβρισκε', () => {
    const parts = splitGreekPersonName('ΠΑΠΑ ΓΕΩΡΓΙΟΥ Ν. ΝΙΚΟΛΑΟΣ');
    expect(parts.lastName).toBe('ΠΑΠΑ ΓΕΩΡΓΙΟΥ');
    expect(parts.firstName).toBe('ΝΙΚΟΛΑΟΣ');
  });

  it('🔑 ΣΥΣΤΟΛΗ ⇒ δείχνει το ίδιο το μικρό όνομα (το δείγμα G753)', () => {
    const parts = splitGreekPersonName('ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ');
    expect(parts).toEqual({
      lastName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ',
      firstName: 'ΚΩΝ/ΝΟΣ',
      patronymicInitial: '',
      signal: 'contraction',
    });
  });

  it('🔴 η ΣΥΣΤΟΛΗ είναι το μόνο σήμα που επιβιώνει σε ΑΝΕΣΤΡΑΜΜΕΝΗ γραφή', () => {
    // Εδώ το έθιμο «επώνυμο πρώτο» θα έδινε επώνυμο «ΚΩΝ/ΝΟΣ» — δηλαδή θα ονόμαζε τον άνθρωπο
    // με τη συντομογραφία του βαφτιστικού του. Γι' αυτό η συστολή ρωτιέται ΠΡΩΤΗ.
    const parts = splitGreekPersonName('ΚΩΝ/ΝΟΣ ΜΑΥΡΟΜΙΧΑΛΗΣ');
    expect(parts.lastName).toBe('ΜΑΥΡΟΜΙΧΑΛΗΣ');
    expect(parts.firstName).toBe('ΚΩΝ/ΝΟΣ');
  });

  it('χωρίς κανένα σήμα ισχύει το έθιμο — και ΔΗΛΩΝΕΤΑΙ ως έθιμο', () => {
    const parts = splitGreekPersonName('ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ');
    expect(parts.lastName).toBe('ΠΑΠΑΔΟΠΟΥΛΟΣ');
    expect(parts.firstName).toBe('ΓΕΩΡΓΙΟΣ');
    // 🔑 ΤΟ ΚΡΙΣΙΜΟ ΣΚΕΛΟΣ: το `convention` είναι η **μοναδική** διαδρομή που μαντεύει, και
    // είναι αυτό που ανάβει την προειδοποίηση στην οθόνη. Αν κάποια μέρα επιστραφεί εδώ
    // «patronymic-initial» ή «contraction», η προειδοποίηση σβήνει σιωπηλά και ο άνθρωπος
    // παύει να ξέρει ότι μαντέψαμε.
    expect(parts.signal).toBe('convention');
  });

  it('🔴 αρχικό στην ΑΡΧΗ ή στο ΤΕΛΟΣ δεν σημαδεύει σύνορο ⇒ πέφτει στο έθιμο, δηλωμένα', () => {
    expect(splitGreekPersonName('ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ Ν.').signal).toBe('convention');
    expect(splitGreekPersonName('Ν. ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ').signal).toBe('convention');
  });

  it('🔴 ΔΥΟ συστολές δεν είναι σήμα — δεν υπάρχει «το» μικρό όνομα', () => {
    expect(splitGreekPersonName('ΠΑΝ/ΤΗΣ ΚΩΝ/ΝΟΣ').signal).toBe('convention');
  });

  it('ένα μόνο συστατικό γίνεται ΕΠΩΝΥΜΟ και το όνομα μένει ΟΡΑΤΑ κενό', () => {
    const parts = splitGreekPersonName('ΜΑΥΡΟΜΙΧΑΛΗΣ');
    expect(parts).toEqual({
      lastName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ',
      firstName: '',
      patronymicInitial: '',
      signal: 'single-token',
    });
  });

  it('κενό κείμενο δεν σκάει και δεν εφευρίσκει τίποτα', () => {
    expect(splitGreekPersonName('   ')).toEqual({
      lastName: '',
      firstName: '',
      patronymicInitial: '',
      signal: 'single-token',
    });
  });

  it('τρία συστατικά χωρίς σήμα: επώνυμο το πρώτο, όνομα τα υπόλοιπα', () => {
    const parts = splitGreekPersonName('ΖΕΡΒΑ ΓΕΩΡΓΙΑ ΜΑΡΙΑ');
    expect(parts.lastName).toBe('ΖΕΡΒΑ');
    expect(parts.firstName).toBe('ΓΕΩΡΓΙΑ ΜΑΡΙΑ');
  });
});
