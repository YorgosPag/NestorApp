/**
 * ADR-739 §58 (Φάση Γ) — άγκυρες για τον πυρήνα της αναδίπλωσης.
 *
 * Ο μετρητής είναι **μονοσπαστικός** (`1 μονάδα ανά χαρακτήρα`): κάθε αριθμός εδώ είναι
 * επαληθεύσιμος με το μάτι, και καμία άγκυρα δεν εξαρτάται από μετρικά γραμματοσειράς —
 * που σε jsdom είναι ούτως ή άλλως προσέγγιση.
 */

import { lineBreakOpportunities } from '../line-break-opportunities';
import {
  BALANCE_MAX_LINES,
  wrapTextToLines,
  wrappedLineCount,
  type RangeWidth,
} from '../text-wrap-lines';

/** Μία μονάδα ανά χαρακτήρα — «πλάτος» === «πλήθος χαρακτήρων». */
const monospace = (text: string): RangeWidth => (start, end) => text.slice(start, end).length;

function wrap(text: string, width: number, balance = true): string[] {
  return wrapTextToLines({
    text,
    availableWidth: width,
    rangeWidth: monospace(text),
    balance,
  }).map((line) => line.text);
}

describe('lineBreakOpportunities — ΠΟΥ επιτρέπεται να σπάσει', () => {
  it('σπάει μετά από κενό, μία ευκαιρία ανά ακολουθία', () => {
    expect(lineBreakOpportunities('ΑΒ ΓΔ')).toEqual([3]);
    expect(lineBreakOpportunities('ΑΒ   ΓΔ')).toEqual([5]);
  });

  it('σπάει μετά από ενωτικό και κάθετο — το κενό δεν είναι η μόνη ευκαιρία', () => {
    // Το ελάττωμα που γέννησε το module: «Φ12-Φ16» δεν έσπαγε ΠΟΤΕ.
    expect(lineBreakOpportunities('Φ12-Φ16')).toEqual([4]);
    expect(lineBreakOpportunities('m³/τεμ')).toEqual([3]);
  });

  it('🔴 LB25 — ΔΕΝ σπάει ενωτικό/κάθετο ανάμεσα σε ΨΗΦΙΑ (ημερομηνία, κλάσμα)', () => {
    // Σπασμένη ημερομηνία σε πίνακα ποσοτήτων = σφάλμα ΤΙΜΗΣ, όχι εμφάνισης.
    expect(lineBreakOpportunities('05/08/2026')).toEqual([]);
    expect(lineBreakOpportunities('1/2')).toEqual([]);
    expect(lineBreakOpportunities('2026-08-07')).toEqual([]);
    // Αλλά ο σύνθετος κωδικός σπάει κανονικά: δεξιά του ενωτικού είναι γράμμα.
    expect(lineBreakOpportunities('12-Φ16')).toEqual([3]);
  });

  it('🔴 NBSP ΔΕΝ είναι ευκαιρία — είναι ρητή απαγόρευση του χρήστη', () => {
    expect(lineBreakOpportunities('10\u00A0m²')).toEqual([]);
    expect(lineBreakOpportunities('10 m²')).toEqual([3]);
  });

  it('τιμά τον μαλακό ενωτικό και το ZWSP — ρητή δήλωση του συγγραφέα', () => {
    expect(lineBreakOpportunities('ΣΚΥΡΟ\u00ADΔΕΜΑ')).toEqual([6]);
    expect(lineBreakOpportunities('ΣΚΥΡΟ\u200BΔΕΜΑ')).toEqual([6]);
  });

  it('ακυρώνει ευκαιρία που θα άφηνε στίξη να ξεκινά γραμμή', () => {
    // Ευκαιρία μετά το «/» θα άφηνε το «)» μόνο του στην επόμενη γραμμή.
    expect(lineBreakOpportunities('(Α/)Β')).toEqual([]);
  });

  it('ποτέ 0 και ποτέ το μήκος — δεν είναι αποφάσεις', () => {
    expect(lineBreakOpportunities(' ΑΒ')).toEqual([1]);
    expect(lineBreakOpportunities('ΑΒ ')).toEqual([]);
    expect(lineBreakOpportunities('')).toEqual([]);
    expect(lineBreakOpportunities('Α')).toEqual([]);
  });
});

describe('wrapTextToLines — greedy', () => {
  it('δεν σπάει ό,τι χωρά', () => {
    expect(wrap('ΑΒΓΔ', 10)).toEqual(['ΑΒΓΔ']);
  });

  it('κόβει το κενό του σπασίματος και από τις δύο πλευρές', () => {
    // «ΑΑΑ ΒΒΒ» σε πλάτος 4: η πρώτη γραμμή είναι «ΑΑΑ», όχι «ΑΑΑ ».
    expect(wrap('ΑΑΑ ΒΒΒ', 4, false)).toEqual(['ΑΑΑ', 'ΒΒΒ']);
  });

  it('μία λέξη πλατύτερη από το κελί κόβεται σε χαρακτήρα (όπως το AutoCAD)', () => {
    expect(wrap('ΑΒΓΔΕΖΗΘ', 3, false)).toEqual(['ΑΒΓ', 'ΔΕΖ', 'ΗΘ']);
  });

  it('μηδενικό πλάτος ⇒ μία γραμμή με τα πάντα· η περικοπή είναι αλλουνού δουλειά', () => {
    expect(wrap('ΑΒΓ', 0)).toEqual(['ΑΒΓ']);
  });

  it('κενό κείμενο ⇒ ΚΑΜΙΑ γραμμή, όχι μία κενή', () => {
    expect(wrap('', 10)).toEqual([]);
  });

  it('🔴 σέβεται το ενωτικό — το ελάττωμα που γέννησε τη φάση', () => {
    // «Φ12-Φ16» = 7 χαρακτήρες σε πλάτος 6: ΠΡΕΠΕΙ να σπάσει, και μόνο στο ενωτικό.
    // Χωρίς τις ευκαιρίες θα έπεφτε στο fallback χαρακτήρα: «Φ12-Φ1» / «6».
    expect(wrap('ΤΜΗΜΑ Φ12-Φ16', 6, false)).toEqual(['ΤΜΗΜΑ', 'Φ12-', 'Φ16']);
  });

  it('τηρεί το φράγμα γραμμών ΧΩΡΙΣ να χάνει κείμενο', () => {
    const lines = wrapTextToLines({
      text: 'Α Β Γ Δ Ε Ζ',
      availableWidth: 1,
      rangeWidth: monospace('Α Β Γ Δ Ε Ζ'),
      maxLines: 2,
      balance: false,
    });
    expect(lines).toHaveLength(2);
    // Ό,τι δεν χώρεσε μπαίνει ακέραιο στην τελευταία: φράγμα ≠ άδεια απώλειας δεδομένων.
    expect(lines.map((l) => l.text).join('')).toContain('Ζ');
  });

  it('οι δείκτες δείχνουν στο ΑΡΧΙΚΟ κείμενο (τα runs/links του κελιού τους χρειάζονται)', () => {
    const text = 'ΑΑΑ ΒΒΒ';
    const lines = wrapTextToLines({
      text,
      availableWidth: 4,
      rangeWidth: monospace(text),
      balance: false,
    });
    expect(lines).toEqual([
      { text: 'ΑΑΑ', start: 0, end: 3 },
      { text: 'ΒΒΒ', start: 4, end: 7 },
    ]);
    expect(text.slice(lines[1].start, lines[1].end)).toBe('ΒΒΒ');
  });
});

describe('🏆 wrapTextToLines — ισορρόπηση (text-wrap: balance)', () => {
  it('εξαφανίζει την ορφανή λέξη', () => {
    const text = 'ΣΚΥΡΟΔΕΜΑ C20/25 ΑΝΩ ΠΕΔΙΛΟΥ';
    expect(wrap(text, 22, false)).toEqual(['ΣΚΥΡΟΔΕΜΑ C20/25 ΑΝΩ', 'ΠΕΔΙΛΟΥ']);
    expect(wrap(text, 22, true)).toEqual(['ΣΚΥΡΟΔΕΜΑ C20/25', 'ΑΝΩ ΠΕΔΙΛΟΥ']);
  });

  it('🔴 Η ΑΝΑΛΛΟΙΩΤΗ: ΠΟΤΕ δεν αλλάζει το πλήθος γραμμών', () => {
    // Αυτό είναι που κάνει την ισορρόπηση ασφαλή: το ύψος της γραμμής του πίνακα —
    // δηλαδή η ΓΕΩΜΕΤΡΙΑ ΤΗΣ ΟΝΤΟΤΗΤΑΣ — βγαίνει ταυτόσημο με του greedy.
    const samples = [
      'ΣΚΥΡΟΔΕΜΑ C20/25 ΑΝΩ ΠΕΔΙΛΟΥ',
      'ΟΠΛΙΣΜΟΣ Φ12-Φ16 ΑΝΩ ΚΑΙ ΚΑΤΩ ΠΑΡΕΙΑ',
      'ΕΠΙΧΡΙΣΜΑΤΑ ΤΡΙΠΤΑ ΤΡΙΨΙΔΙΑ ΕΣΩΤΕΡΙΚΩΝ ΧΩΡΩΝ ΜΕ ΤΣΙΜΕΝΤΟΚΟΝΙΑΜΑ',
      'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠ',
      'Α ΒΒ ΓΓΓ ΔΔΔΔ ΕΕΕΕΕ',
    ];
    for (const text of samples) {
      for (let width = 2; width <= 40; width++) {
        expect({ text, width, lines: wrap(text, width, true).length }).toEqual({
          text,
          width,
          lines: wrap(text, width, false).length,
        });
      }
    }
  });

  it('🔴 Η ΑΛΛΗ ΑΝΑΛΛΟΙΩΤΗ: ΠΟΤΕ δεν χάνει ή αλλοιώνει χαρακτήρα', () => {
    const text = 'ΟΠΛΙΣΜΟΣ Φ12-Φ16 ΑΝΩ ΚΑΙ ΚΑΤΩ';
    for (let width = 2; width <= 40; width++) {
      // Οι γραμμές, ενωμένες με ένα κενό, δίνουν το αρχικό κείμενο — εκτός από τις
      // κοπές μέσα σε λέξη, όπου δεν μπήκε κενό. Ελέγχουμε ότι δεν χάθηκε ΤΙΠΟΤΑ.
      const joined = wrap(text, width, true).join('').replace(/\s+/gu, '');
      expect(joined).toBe(text.replace(/\s+/gu, ''));
    }
  });

  it('δεν εφαρμόζεται σε μία γραμμή ούτε πάνω από το φράγμα', () => {
    expect(wrap('ΑΒΓ', 10, true)).toEqual(['ΑΒΓ']);
    const long = Array.from({ length: BALANCE_MAX_LINES + 4 }, (_, i) => `Λ${i}`).join(' ');
    expect(wrap(long, 3, true)).toEqual(wrap(long, 3, false));
  });
});

describe('wrappedLineCount', () => {
  it('μετρά χωρίς να πληρώνει την ισορρόπηση, και ποτέ δεν επιστρέφει 0', () => {
    const text = 'ΑΑΑ ΒΒΒ ΓΓΓ';
    expect(wrappedLineCount({ text, availableWidth: 4, rangeWidth: monospace(text) })).toBe(3);
    expect(wrappedLineCount({ text: '', availableWidth: 4, rangeWidth: monospace('') })).toBe(1);
  });
});
