/**
 * CHARACTERIZATION tests — `aci-palette` (Color-Conversion SSoT consolidation).
 *
 * Κλειδώνουν την ΤΩΡΙΝΗ (pre-refactor) συμπεριφορά:
 *  1. `hexToAci` — **Phase C DONE**: πλέον delegateάρει στο `settings/standards/aci.findClosestAci`
 *     (πραγματικό ACI_PALETTE, single SSoT). Ο παλιός προσεγγιστικός ramp ΑΦΑΙΡΕΘΗΚΕ. Οι τιμές
 *     του snapshot είναι οι ΣΩΣΤΕΣ ACI (near-exact matches), όχι οι παλιές λάθος ramp τιμές.
 *  2. `parseHex` / `rgbToHex` — tuple μορφή· delegates στο color-math (Phase B). Βασικές τιμές μένουν.
 *
 * Βασικά χρώματα (ACI 1-9) ΔΕΝ αλλάζουν από κανένα mapper → hard asserts.
 */

import { hexToAci, parseHex, rgbToHex, aciToRgb } from '../aci-palette';

describe('aci-palette — hexToAci (basic colors, STABLE across mappers)', () => {
  const cases: ReadonlyArray<readonly [string, number]> = [
    ['#FF0000', 1], // red
    ['#FFFF00', 2], // yellow
    ['#00FF00', 3], // green
    ['#00FFFF', 4], // cyan
    ['#0000FF', 5], // blue
    ['#FF00FF', 6], // magenta
    ['#FFFFFF', 7], // white
  ];
  it.each(cases)('%s → ACI %i', (hex, aci) => {
    expect(hexToAci(hex)).toBe(aci);
  });

  it('invalid hex → 7 (fallback)', () => {
    expect(hexToAci('garbage')).toBe(7);
  });
});

describe('aci-palette — hexToAci (NON-basic colors, real ACI_PALETTE SSoT)', () => {
  // Intermediate hexes → correct ACI indices from findClosestAci (post-Phase-C).
  const spread = [
    '#804020', '#3366cc', '#c0c0c0', '#808080', '#123456',
    '#2b2f36', '#b07d1f', '#7f3fff', '#00994c', '#cc6600',
    '#264c26', '#66cc99', '#993333', '#4c2f26', '#a0a0a0',
  ] as const;
  it('SSoT nearest-match snapshot', () => {
    const map = Object.fromEntries(spread.map((h) => [h, hexToAci(h)]));
    expect(map).toMatchInlineSnapshot(`
{
  "#00994c": 114,
  "#123456": 148,
  "#264c26": 99,
  "#2b2f36": 250,
  "#3366cc": 152,
  "#4c2f26": 29,
  "#66cc99": 113,
  "#7f3fff": 190,
  "#804020": 17,
  "#808080": 8,
  "#993333": 15,
  "#a0a0a0": 253,
  "#b07d1f": 45,
  "#c0c0c0": 9,
  "#cc6600": 32,
}
`);
  });
});

describe('aci-palette — parseHex / rgbToHex (tuple form)', () => {
  it('parseHex 6-digit → tuple', () => {
    expect(parseHex('#2b2f36')).toEqual([0x2b, 0x2f, 0x36]);
  });

  it('parseHex invalid → null', () => {
    expect(parseHex('nope')).toBeNull();
  });

  it('rgbToHex → #rrggbb (lowercase, clamped)', () => {
    expect(rgbToHex(43, 47, 54)).toBe('#2b2f36');
    expect(rgbToHex(300, -5, 128)).toBe('#ff0080');
  });

  it('aciToRgb — named colors', () => {
    expect(aciToRgb(1)).toEqual([255, 0, 0]);
    expect(aciToRgb(4)).toEqual([0, 255, 255]);
    expect(aciToRgb(7)).toEqual([255, 255, 255]);
  });
});
