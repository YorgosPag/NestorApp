/** ADR-950 §8.2 — τα γράμματα που μπερδεύει η ανάγνωση σφραγίδας. */

import { sameUnderOcrConfusion } from '@/lib/string/ocr-glyph-fold';

describe('sameUnderOcrConfusion', () => {
  it('Σαμοφράκης ⇄ Σαμοθράκης (Θ/Φ) — το περιστατικό του ζωντανού ελέγχου', () => {
    expect(sameUnderOcrConfusion('Σαμοφράκης', 'Σαμοθράκης')).toBe(true);
  });

  it('ανεξάρτητα από τόνους, κεφαλαία και τελικό σίγμα', () => {
    expect(sameUnderOcrConfusion('ΣΑΜΟΘΡΑΚΗΣ', 'σαμοθρακης')).toBe(true);
  });

  it('γράμματα που ΔΕΝ μοιάζουν δεν ενώνονται (Θ/Κ)', () => {
    expect(sameUnderOcrConfusion('Σαμοκράκης', 'Σαμοθράκης')).toBe(false);
  });

  it('διαφορετικό μήκος δεν ενώνεται ποτέ', () => {
    expect(sameUnderOcrConfusion('Σαμοθράκη', 'Σαμοθράκης')).toBe(false);
  });

  it('κενό δεν ταιριάζει με κενό', () => {
    expect(sameUnderOcrConfusion('', '')).toBe(false);
  });
});
