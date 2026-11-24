/** ADR-950 §8.2 · §8.13 — τα γράμματα που μπερδεύει η ανάγνωση σφραγίδας και το «Μήπως εννοείτε…». */

import { closestUnderOcrConfusion } from '@/lib/string/ocr-glyph-fold';

const NEIGHBOURHOOD = ['Σαμοθράκης', 'Εγνατίας', 'Κορδελιού', 'Τιμίου Σταυρού', 'Κανάρη'];

describe('closestUnderOcrConfusion', () => {
  it('Σαμοφράκης ⇒ Σαμοθράκης (Θ/Φ, οπτική σύγχυση) — ζωντανός έλεγχος 2026-11-23', () => {
    expect(closestUnderOcrConfusion('Σαμοφράκης', NEIGHBOURHOOD)).toBe('Σαμοθράκης');
  });

  it('ΣΑΜΟΓΡΑΦΗΣ ⇒ Σαμοθράκης (γράμματα κρυμμένα από υπογραφή) — ζωντανός έλεγχος 2026-11-24', () => {
    expect(closestUnderOcrConfusion('ΣΑΜΟΓΡΑΦΗΣ', NEIGHBOURHOOD)).toBe('Σαμοθράκης');
  });

  it('ανεξάρτητα από τόνους, κεφαλαία και τελικό σίγμα', () => {
    expect(closestUnderOcrConfusion('ΣΑΜΟΘΡΑΚΗΣ', NEIGHBOURHOOD)).toBe('Σαμοθράκης');
  });

  it('ίδιο όνομα με άλλη γραφή (τόνος) δεν είναι ισοπαλία', () => {
    expect(closestUnderOcrConfusion('Σαμοφράκης', ['Σαμοθράκης', 'Σαμοθρακης'])).toBe('Σαμοθράκης');
  });

  it('ισοπαλία δύο διαφορετικών ονομάτων ⇒ καμία πρόταση', () => {
    expect(closestUnderOcrConfusion('Σαμοθράκ', ['Σαμοθράκης', 'Σαμοθράκια'])).toBeNull();
  });

  it('πέρα από το όριο λαθών (AUTO: 2 για λέξη > 5) ⇒ καμία πρόταση', () => {
    expect(closestUnderOcrConfusion('Σαλονίκης', NEIGHBOURHOOD)).toBeNull();
  });

  it('κοντή λέξη ανέχεται 1 λάθος, πολύ κοντή κανένα', () => {
    expect(closestUnderOcrConfusion('Κανάρ', NEIGHBOURHOOD)).toBe('Κανάρη');
    expect(closestUnderOcrConfusion('Κα', ['Κο'])).toBeNull();
  });

  it('κενό ⇒ καμία πρόταση', () => {
    expect(closestUnderOcrConfusion('', NEIGHBOURHOOD)).toBeNull();
  });
});
