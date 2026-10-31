/**
 * **ΘΕΜΑΤΙΚΟ ΚΕΙΜΕΝΟ ⇒ ΘΕΜΑΤΙΚΗ ΕΠΙΦΑΝΕΙΑ** — οι παλέτες των modal του DXF (pending «bg-white/bg-black», ADR-770)
 * @related config/modal-colors.ts · design-system/color-bridge.ts
 *
 * 🔴 Ως 2026-10-30 το `modal-colors.ts` κρατούσε ΣΚΙΩΔΕΣ `COLOR_BRIDGE` με `bg.primary: 'bg-white'` ⇒ το `input` έβγαινε
 *    `bg-white … text-foreground` ⇒ στο σκοτεινό θέμα λευκό κείμενο σε λευκό πεδίο. Καμία πύλη δεν το έβλεπε (το CHECK 3.26
 *    μετρά παλέτες με απόχρωση· το `white`/`black` δεν είναι).
 *
 * Ελέγχονται οι ΤΙΜΕΣ του runtime (όχι τα σχόλια). Τα σταθερά ζεύγη του τεχνικού θέματος (`bg-gray-800 … text-white`)
 * είναι νόμιμα — κόκκινο είναι ΜΟΝΟ η μίξη θεματικού κειμένου με σταθερό συμπαγές φόντο.
 */

import * as modalColors from '../modal-colors';

const THEMED_TEXT = /(?<![\w-])text-(foreground|muted-foreground|card-foreground)(?![\w-])/;
const FIXED_SOLID_SURFACE = /(?<![\w:-])bg-(white|black)(?![\w/-])/;

function collect(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') out.push([path, value]);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) collect(child, `${path}.${key}`, out);
  }
}

const values: [string, string][] = [];
for (const [name, exported] of Object.entries(modalColors)) collect(exported, name, values);

describe('modal-colors — θεματικό κείμενο σε θεματική επιφάνεια', () => {
  it('ο παρονομαστής: υπάρχουν τιμές με θεματικό κείμενο (αλλιώς το «0 παραβάσεις» δεν σημαίνει τίποτα)', () => {
    expect(values.filter(([, v]) => THEMED_TEXT.test(v)).length).toBeGreaterThan(3);
  });

  it('🔴 καμία τιμή δεν βάζει θεματικό κείμενο πάνω σε σταθερό `bg-white` / `bg-black`', () => {
    const offenders = values.filter(([, v]) => THEMED_TEXT.test(v) && FIXED_SOLID_SURFACE.test(v));
    expect(offenders).toEqual([]);
  });

  it('ο κριτής πιάνει το παλιό λάθος (αυτοέλεγχος των regex)', () => {
    const old = 'bg-white border-input text-foreground focus:border-ring';
    expect(THEMED_TEXT.test(old) && FIXED_SOLID_SURFACE.test(old)).toBe(true);
    expect(FIXED_SOLID_SURFACE.test('bg-black/80')).toBe(false);
    expect(FIXED_SOLID_SURFACE.test('hover:bg-white')).toBe(false);
  });
});
