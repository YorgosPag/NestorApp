/**
 * ADR-724 Φ0 — Ο κανόνας πλάτους της αγκυρωμένης παλέτας.
 *
 * Καθαρές συναρτήσεις, μηδέν DOM: αν κάποια μέρα χρειαστούν jsdom, κάτι έχει διαρρεύσει μέσα τους.
 */

import { clampDockWidth, parseDockWidth } from '../workspace-dock-geometry';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

const { WIDTH_DEFAULT, WIDTH_MIN, WIDTH_MAX } = PANEL_LAYOUT.WORKSPACE_DOCK;

describe('ADR-724 — workspace-dock-geometry', () => {
  describe('οι τιμές του συμβολαίου (§6.4)', () => {
    it('η προεπιλογή είναι το σημερινό πλάτος (w-96) ⇒ μηδενική οπτική αλλαγή', () => {
      expect(WIDTH_DEFAULT).toBe(384);
    });

    it('το ελάχιστο ταυτίζεται με το DEFAULT_MIN_PANEL_SIZE.width του ADR-723', () => {
      // Μία έννοια «στενότερο λειτουργικό πλάτος παλέτας» σε όλη την εφαρμογή.
      expect(WIDTH_MIN).toBe(280);
    });

    it('η προεπιλογή βρίσκεται εντός των ορίων', () => {
      expect(WIDTH_DEFAULT).toBeGreaterThanOrEqual(WIDTH_MIN);
      expect(WIDTH_DEFAULT).toBeLessThanOrEqual(WIDTH_MAX);
    });
  });

  describe('clampDockWidth', () => {
    it('αφήνει αυτούσιο ένα πλάτος εντός ορίων', () => {
      expect(clampDockWidth(500)).toBe(500);
    });

    it('κρατά και τα δύο άκρα (κλειστό διάστημα)', () => {
      expect(clampDockWidth(WIDTH_MIN)).toBe(WIDTH_MIN);
      expect(clampDockWidth(WIDTH_MAX)).toBe(WIDTH_MAX);
    });

    it('ανεβάζει ένα υπερβολικά στενό πλάτος στο ελάχιστο', () => {
      expect(clampDockWidth(120)).toBe(WIDTH_MIN);
    });

    it('κατεβάζει ένα υπερβολικά πλατύ πλάτος στο μέγιστο', () => {
      expect(clampDockWidth(5000)).toBe(WIDTH_MAX);
    });

    it.each([NaN, Infinity, -Infinity, 0, -300])(
      'επιστρέφει την ΠΡΟΕΠΙΛΟΓΗ (όχι το πλησιέστερο όριο) για μη έγκυρη είσοδο: %p',
      (value) => {
        // Ένα NaN που γινόταν 280 θα έκρυβε ότι η πηγή του είναι χαλασμένη.
        expect(clampDockWidth(value)).toBe(WIDTH_DEFAULT);
      },
    );

    it('είναι ιδεματικό (idempotent) — δεύτερη εφαρμογή δεν αλλάζει τίποτα', () => {
      for (const value of [120, 500, 5000, NaN]) {
        expect(clampDockWidth(clampDockWidth(value))).toBe(clampDockWidth(value));
      }
    });
  });

  describe('parseDockWidth', () => {
    it('δέχεται πεπερασμένο θετικό αριθμό αυτούσιο — ΧΩΡΙΣ clamp', () => {
      // Σκόπιμα: «η αποθήκευση λέει 5000» και «το 5000 είναι αποδεκτό» είναι δύο ερωτήματα.
      expect(parseDockWidth(5000)).toBe(5000);
      expect(parseDockWidth(384)).toBe(384);
    });

    it.each([
      ['string', '384'],
      ['null', null],
      ['undefined', undefined],
      ['αντικείμενο', { width: 384 }],
      ['πίνακας', [384]],
      ['boolean', true],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['μηδέν', 0],
      ['αρνητικό', -384],
    ])('επιστρέφει null για %s', (_label, value) => {
      expect(parseDockWidth(value)).toBeNull();
    });
  });
});
