/**
 * CHARACTERIZATION tests — `color-config` withOpacity (ADR-573).
 *
 * Κλειδώνουν την ΤΩΡΙΝΗ συμπεριφορά του `withOpacity` (shim πάνω στο `config/color-math`
 * `channelToHex`): hex → append AA· rgb(→rgba)· rgba(→replace alpha)· άλλο → passthrough.
 * ~12 call sites βασίζονται στο ΑΚΡΙΒΕΣ output string → πρέπει να παραμείνει byte-identical.
 */

import { withOpacity } from '../color-config';

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
