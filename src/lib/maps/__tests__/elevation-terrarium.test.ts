/**
 * ADR-920 §14.12 Β3 — η κωδικοποίηση Terrarium: οι προσδοκίες βγαίνουν από τον ΤΥΠΟ της προδιαγραφής
 * (ύψος = R·256 + G + B/256 − 32768), όχι από τη συνάρτηση.
 */

import { decodeTerrarium, readTerrarium, TERRARIUM_BYTES_PER_PIXEL, writeTerrarium } from '../elevation-terrarium';

function bytesOf(elevationM: number): number[] {
  const out = new Uint8ClampedArray(TERRARIUM_BYTES_PER_PIXEL);
  writeTerrarium(out, 0, elevationM);
  return Array.from(out);
}

describe('Terrarium', () => {
  it('γνωστά ύψη γράφονται στα bytes της προδιαγραφής, αδιαφανή', () => {
    expect(bytesOf(0)).toEqual([128, 0, 0, 255]);
    expect(bytesOf(-32768)).toEqual([0, 0, 0, 255]);
    expect(bytesOf(1)).toEqual([128, 1, 0, 255]);
    expect(bytesOf(256.5)).toEqual([129, 0, 128, 255]);
    // Όλυμπος: 2917 + 32768 = 35685 = 139 · 256 + 101
    expect(bytesOf(2917)).toEqual([139, 101, 0, 255]);
  });

  it('η ανάγνωση είναι ο τύπος της προδιαγραφής', () => {
    expect(readTerrarium(128, 0, 0)).toBe(0);
    expect(readTerrarium(0, 0, 0)).toBe(-32768);
    expect(readTerrarium(139, 101, 64)).toBe(2917.25);
  });

  it('εγγραφή και ανάγνωση συμφωνούν μέσα σε μισό βήμα (1/512 m), συμμετρικά — στρογγύλευση, όχι αποκοπή', () => {
    for (const elevationM of [833.1, 124.004, -3.9999, 0.0019, 0.002, 2917.4981]) {
      const [r, g, b] = bytesOf(elevationM);
      expect(Math.abs(readTerrarium(r, g, b) - elevationM)).toBeLessThanOrEqual(1 / 512 + 1e-12);
    }
    // 0,003 m είναι πιο κοντά στο βήμα 1/256 (0,0039) παρά στο 0: η αποκοπή θα έγραφε 0.
    expect(bytesOf(0.003)).toEqual([128, 0, 1, 255]);
  });

  it('ύψος έξω από το εύρος κόβεται στο άκρο του', () => {
    expect(bytesOf(-40_000)).toEqual([0, 0, 0, 255]);
    expect(bytesOf(40_000)).toEqual([255, 255, 255, 255]);
  });

  it('γράφει στη θέση που του δίνεται και δεν αγγίζει τα γειτονικά pixels', () => {
    const out = new Uint8ClampedArray(3 * TERRARIUM_BYTES_PER_PIXEL).fill(7);
    writeTerrarium(out, TERRARIUM_BYTES_PER_PIXEL, 1);
    expect(Array.from(out)).toEqual([7, 7, 7, 7, 128, 1, 0, 255, 7, 7, 7, 7]);
  });

  it('ολόκληρη εικόνα → ύψη, με τη σειρά των pixels', () => {
    const rgba = new Uint8ClampedArray(2 * TERRARIUM_BYTES_PER_PIXEL);
    writeTerrarium(rgba, 0, 12.5);
    writeTerrarium(rgba, TERRARIUM_BYTES_PER_PIXEL, -1);
    expect(Array.from(decodeTerrarium(rgba))).toEqual([12.5, -1]);
  });
});
