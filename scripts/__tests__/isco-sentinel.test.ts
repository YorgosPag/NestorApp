/**
 * ΑΓΚΥΡΕΣ — **ο διαχωριστής ανάμεσα στον ΓΝΗΣΙΟ και στον ΕΠΙΝΟΗΜΕΝΟ κωδικό**
 * (ADR-132 §10 · ADR-823 §Α).
 *
 * ⚠️ Ο λόγος που αυτή η λογική βγήκε σε **δικό της module** και δεν έμεινε μέσα
 * στον ελεγκτή: ο ελεγκτής ανοίγει σύνδεση με την **παραγωγή** στο φόρτωμα. Μια
 * άγκυρα που δεν μπορεί να **εκτελέσει** τη συνάρτηση θα έλεγχε μόνο το
 * **κείμενο** — δηλαδή «η λογική είναι ΓΡΑΜΜΕΝΗ», ποτέ «η λογική ΚΡΙΝΕΙ σωστά».
 */

import {
  ISCO_SENTINELS,
  isSentinelCode,
  judgeIscoCode,
} from '../_shared/isco-sentinel';

const REAL_URI = 'http://data.europa.eu/esco/occupation/fbceeac6-798b-4307-a825-626707a753ad';

describe('Α. η ΤΙΜΗ δεν μπορεί να κρίνει τον εαυτό της', () => {
  it('το «0000» είναι υπαρκτή μείζων ομάδα — άρα ΥΠΟΠΤΟ, όχι ένοχο', () => {
    expect(isSentinelCode('0000')).toBe(true);
    // …αλλά η υποψία ΜΟΝΗ ΤΗΣ δεν καταδικάζει: χρειάζεται αυθεντία.
    expect(judgeIscoCode(REAL_URI, '0000')).toBe('confirmed');
  });

  it('όλες οι σεντινέλες αναγνωρίζονται, και τίποτε άλλο', () => {
    for (const sentinel of ISCO_SENTINELS) {
      expect(isSentinelCode(sentinel)).toBe(true);
    }
    for (const notSentinel of ['2142', '0110', '1', '00000', '0a', ' 0000', '', 'ΟΧΙ']) {
      expect(isSentinelCode(notSentinel)).toBe(false);
    }
  });

  it('μη-συμβολοσειρές δεν είναι ποτέ σεντινέλες', () => {
    for (const value of [0, null, undefined, {}, [], NaN, false]) {
      expect(isSentinelCode(value)).toBe(false);
    }
  });
});

describe('Β. η ΚΡΙΣΗ γίνεται από τη ΜΝΗΜΗ', () => {
  it('🔴 μνήμη λέει ΚΕΝΟ ⇒ ο κωδικός του ανθρώπου είναι ΕΠΙΝΟΗΜΕΝΟΣ', () => {
    // Αυτό είναι **ακριβώς** το περιστατικό: το ESCO δεν δίνει κωδικό, ο νέος
    // εισαγωγέας γράφει `''`, άρα το `'0000'` του ανθρώπου ήρθε από το ψέμα.
    expect(judgeIscoCode(REAL_URI, '')).toBe('fabricated');
  });

  it('🔴 μνήμη λέει ΑΛΛΟΝ κωδικό ⇒ ΕΠΙΝΟΗΜΕΝΟΣ', () => {
    expect(judgeIscoCode(REAL_URI, '2142')).toBe('fabricated');
  });

  it('✅ μνήμη λέει σεντινέλα ⇒ ΓΝΗΣΙΟΣ — υπάρχουν πραγματικοί στρατιωτικοί', () => {
    expect(judgeIscoCode(REAL_URI, '0000')).toBe('confirmed');
    expect(judgeIscoCode(REAL_URI, '0')).toBe('confirmed');
  });
});

describe('Γ. ΤΡΕΙΣ εκβάσεις — το «δεν ξέρω» ΔΕΝ γίνεται «ψέμα»', () => {
  it('χωρίς escoUri ⇒ ΑΝΕΠΙΒΕΒΑΙΩΤΟ, ποτέ fabricated', () => {
    // 🔑 Αν αυτό γύριζε `fabricated`, μια μετανάστευση θα ΕΣΒΗΝΕ κωδικούς που
    // ήρθαν από χειρόγραφη καταχώριση ή import — δηλαδή θα κατέστρεφε αληθινά
    // δεδομένα για να διορθώσει ένα ψέμα. Ίδια κλάση σφάλματος με την αρχική.
    expect(judgeIscoCode(null, '')).toBe('unverifiable');
    expect(judgeIscoCode(null, '2142')).toBe('unverifiable');
    expect(judgeIscoCode('', '')).toBe('unverifiable');
    expect(judgeIscoCode('   ', '2142')).toBe('unverifiable');
  });

  it('έννοια ΑΓΝΩΣΤΗ στη μνήμη ⇒ ΑΝΕΠΙΒΕΒΑΙΩΤΟ, ποτέ fabricated', () => {
    // URI που αποσύρθηκε από το ESCO (Delta file) ή μνήμη που δεν έχει τρέξει.
    expect(judgeIscoCode(REAL_URI, null)).toBe('unverifiable');
  });

  it('καμία είσοδος δεν παράγει τέταρτη έκβαση', () => {
    const inputs: [string | null, string | null][] = [
      [REAL_URI, '0000'], [REAL_URI, ''], [REAL_URI, '2142'], [REAL_URI, null],
      [null, '0000'], [null, null], ['', ''], ['  ', null],
    ];
    for (const [uri, memory] of inputs) {
      expect(['confirmed', 'fabricated', 'unverifiable']).toContain(judgeIscoCode(uri, memory));
    }
  });
});
