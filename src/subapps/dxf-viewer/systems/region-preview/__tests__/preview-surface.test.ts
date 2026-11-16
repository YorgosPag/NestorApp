/**
 * ADR-911 §Φ3β-palette — ποια παλέτα ζωνών, πάνω σε ποιο φόντο.
 *
 * Ισχυρισμοί που κανένας τύπος δεν φυλάει:
 *   1. Η απόφαση είναι **μέτρηση**, όχι κατώφλι: σε κάθε φόντο νικά η παλέτα με τη μεγαλύτερη ελάχιστη αντίθεση.
 *   2. Το χαρτί ενός υποβάθρου συντίθεται με τη διαφάνειά του πάνω στον καμβά — ό,τι βλέπει το μάτι.
 *   3. Η παλέτα που επιλέγεται κρατά ≥ 3:1 (WCAG 1.4.11) σε κάθε τυπικό φόντο του προϊόντος.
 */

import { contrastRatio } from '../../../config/color-math';
import { choosePreviewSurface, effectivePreviewSurfaceHex } from '../preview-surface';
import { PREVIEW_SURFACES } from '../preview-zone-style';

const WCAG_NON_TEXT = 3;
const minContrast = (surface: keyof typeof PREVIEW_SURFACES, bg: string): number =>
  Math.min(...Object.values(PREVIEW_SURFACES[surface].stroke).map((hex) => contrastRatio(hex, bg)));

describe('choosePreviewSurface — η παλέτα που διαβάζεται καλύτερα', () => {
  it('μαύρος καμβάς (AutoCAD) ⇒ σκούρα παλέτα · λευκό χαρτί ⇒ ανοιχτή', () => {
    expect(choosePreviewSurface('#000000')).toBe('dark');
    expect(choosePreviewSurface('#ffffff')).toBe('light');
  });

  it.each(['#000000', '#1a1a1a', '#ffffff'])(
    'φόντο %s (μαύρος καμβάς · σκούρο θέμα AutoCAD · χαρτί): η επιλεγμένη παλέτα κρατά ≥ 3:1',
    (bg) => {
      expect(minContrast(choosePreviewSurface(bg), bg)).toBeGreaterThanOrEqual(WCAG_NON_TEXT);
    },
  );

  // ⚠️ Μετρημένο 2026-11-16: σε ΕΝΔΙΑΜΕΣΑ φόντα (#333333 → 2,98 · #f5f5f5 → 2,92 · #808080 → 1,24) ΚΑΜΙΑ παλέτα δεν
  // φτάνει 3:1. Η εγγύηση ισχύει μόνο στις δηλωμένες επιφάνειες· αλλού ο επιλογέας δίνει την ΚΑΛΥΤΕΡΗ διαθέσιμη.
  it.each(['#000000', '#1a1a1a', '#333333', '#808080', '#f5f5f5', '#ffffff'])(
    'φόντο %s: η επιλεγμένη παλέτα δεν είναι ποτέ χειρότερη από την άλλη',
    (bg) => {
      const chosen = choosePreviewSurface(bg);
      const other = chosen === 'light' ? 'dark' : 'light';
      expect(minContrast(chosen, bg)).toBeGreaterThanOrEqual(minContrast(other, bg));
    },
  );

  it('κάθε παλέτα κρατά ≥ 3:1 στη ΔΙΚΗ της δηλωμένη επιφάνεια (ό,τι κρίνει και το CHECK 3.41 Κ3)', () => {
    for (const surface of ['light', 'dark'] as const) {
      expect(minContrast(surface, PREVIEW_SURFACES[surface].surface)).toBeGreaterThanOrEqual(WCAG_NON_TEXT);
    }
  });
});

describe('effectivePreviewSurfaceHex — τι βρίσκεται πραγματικά κάτω από τη ζώνη', () => {
  it('χωρίς υπόβαθρο, ή με διαφάνεια 0 ⇒ ο καμβάς αυτούσιος', () => {
    expect(effectivePreviewSurfaceHex('#000000', null)).toBe('#000000');
    expect(effectivePreviewSurfaceHex('#000000', { opacity: 0 })).toBe('#000000');
  });

  it('αδιαφανές υπόβαθρο ⇒ το χαρτί (λευκό) ⇒ ανοιχτή παλέτα', () => {
    const hex = effectivePreviewSurfaceHex('#000000', { opacity: 1 });
    expect(hex.toLowerCase()).toBe('#ffffff');
    expect(choosePreviewSurface(hex)).toBe('light');
  });

  it('ημιδιαφανές υπόβαθρο ⇒ σύνθεση πάνω στον καμβά (ούτε λευκό ούτε μαύρο)', () => {
    const hex = effectivePreviewSurfaceHex('#000000', { opacity: 0.5 }).toLowerCase();
    expect(hex).not.toBe('#ffffff');
    expect(hex).not.toBe('#000000');
  });

  it('άκυρος καμβάς ⇒ επιστρέφεται αυτούσιος, καμία μαντεψιά', () => {
    expect(effectivePreviewSurfaceHex('var(--x)', { opacity: 1 })).toBe('var(--x)');
  });
});
