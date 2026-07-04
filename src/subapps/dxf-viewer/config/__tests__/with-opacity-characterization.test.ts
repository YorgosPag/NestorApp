/**
 * CHARACTERIZATION tests — `color-config` withOpacity + getContrastColor.
 *
 * Κλειδώνουν την ΤΩΡΙΝΗ συμπεριφορά ΠΡΙΝ γίνουν shims πάνω στο `config/color-math`:
 *  - `withOpacity`: hex → append AA· rgb(→rgba)· rgba(→replace alpha)· άλλο → passthrough.
 *    ~12 call sites βασίζονται στο ΑΚΡΙΒΕΣ output string → πρέπει να παραμείνει byte-identical.
 *  - `getContrastColor`: η ΤΩΡΙΝΗ naive `.includes('fff')` έκδοση (το σχόλιο του color-math
 *    ΨΕΥΔΩΣ την έλεγε migrated). Στο Phase A γίνεται σωστό WCAG contrast· ΕΔΩ τεκμηριώνουμε
 *    πού η naive έκδοση δίνει διαφορετικό αποτέλεσμα (τα known-divergent inputs).
 */

import { withOpacity, getContrastColor, UI_COLORS_BASE } from '../color-config';

describe('color-config — withOpacity (exact string output, LOCKED)', () => {
  it('hex → appends 2-digit alpha byte', () => {
    expect(withOpacity('#ffffff', 0.5)).toBe('#ffffff80');
    expect(withOpacity('#000000', 1)).toBe('#000000ff');
    expect(withOpacity('#12ab34', 0)).toBe('#12ab3400');
  });

  it('rgb() → rgba() with opacity', () => {
    expect(withOpacity('rgb(255, 0, 0)', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('rgba() → replaces trailing alpha', () => {
    expect(withOpacity('rgba(255, 0, 0, 0.9)', 0.3)).toBe('rgba(255, 0, 0, 0.3)');
  });

  it('unrecognized format → passthrough', () => {
    expect(withOpacity('hsl(120, 50%, 50%)', 0.4)).toBe('hsl(120, 50%, 50%)');
  });
});

describe('color-config — getContrastColor (naive pre-Phase-A behavior, LOCKED)', () => {
  it('exact white / #fff-containing → black', () => {
    expect(getContrastColor(UI_COLORS_BASE.WHITE)).toBe(UI_COLORS_BASE.BLACK);
    expect(getContrastColor('#ffffff')).toBe(UI_COLORS_BASE.BLACK);
    expect(getContrastColor('#FFF')).toBe(UI_COLORS_BASE.BLACK);
  });

  it('dark colors → white', () => {
    expect(getContrastColor('#000000')).toBe(UI_COLORS_BASE.WHITE);
    expect(getContrastColor('#123456')).toBe(UI_COLORS_BASE.WHITE);
  });

  it('KNOWN NAIVE DIVERGENCE: light non-#fff colors wrongly get white text', () => {
    // '#eeeeee' is a light background → correct answer is BLACK, but naive
    // '.includes(fff)' returns WHITE. Phase A (WCAG) will flip these.
    expect(getContrastColor('#eeeeee')).toBe(UI_COLORS_BASE.WHITE); // naive = wrong
    expect(getContrastColor('#cccccc')).toBe(UI_COLORS_BASE.WHITE); // naive = wrong
  });
});
