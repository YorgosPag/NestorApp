/**
 * Άγκυρες του κριτή επαφής περιγράμματος ⇄ ορίου (ADR-923 Ν11 ε): κάθε `true` είναι απόδειξη πέρα από την ανοχή.
 */

import { outlineTouchesRegion } from '../geo-region-contact';
import type { GeoOutline, GeoRegion } from '@/types/geo/coordinates';

const rectangle = (south: number, west: number, north: number, east: number): GeoOutline => [
  { lat: south, lng: west },
  { lat: south, lng: east },
  { lat: north, lng: east },
  { lat: north, lng: west },
];

/** ~11 × 8,5 χλμ. γύρω από τις 40°Β 23°Α, ανοχή 50 μ. */
const REGION: GeoRegion = {
  adminId: 'municipality:0001',
  level: 5,
  rings: [rectangle(40.0, 23.0, 40.1, 23.1)],
  bbox: { south: 40.0, west: 23.0, north: 40.1, east: 23.1 },
  toleranceM: 50,
};

describe('outlineTouchesRegion', () => {
  it('περίγραμμα μέσα στο όριο ⇒ επαφή', () => {
    expect(outlineTouchesRegion(rectangle(40.04, 23.04, 40.06, 23.06), REGION)).toBe(true);
  });

  it('όριο ολόκληρο μέσα στο περίγραμμα ⇒ επαφή (καμία κορυφή του περιγράμματος μέσα στο όριο)', () => {
    expect(outlineTouchesRegion(rectangle(39.5, 22.5, 40.5, 23.5), REGION)).toBe(true);
  });

  it('επικάλυψη γωνίας ⇒ επαφή', () => {
    expect(outlineTouchesRegion(rectangle(40.05, 23.05, 40.15, 23.15), REGION)).toBe(true);
  });

  it('μακριά ⇒ καμία επαφή', () => {
    expect(outlineTouchesRegion(rectangle(41.0, 24.0, 41.1, 24.1), REGION)).toBe(false);
  });

  it('⚠️ λωρίδα στενότερη από την ανοχή ⇒ καμία απόδειξη, άρα καμία επαφή', () => {
    // Το νότιο σύνορο του περιγράμματος μπαίνει ~22 μ. μέσα στο όριο: λιγότερο από τα 50 μ. της απλοποίησης.
    expect(outlineTouchesRegion(rectangle(40.0998, 22.9, 40.2, 23.2), REGION)).toBe(false);
    // Η ίδια λωρίδα, ~220 μ. μέσα: απόδειξη.
    expect(outlineTouchesRegion(rectangle(40.098, 22.9, 40.2, 23.2), REGION)).toBe(true);
  });

  it('περίγραμμα με λιγότερες από 3 κορυφές δεν αγγίζει τίποτα', () => {
    expect(outlineTouchesRegion([{ lat: 40.05, lng: 23.05 }, { lat: 40.06, lng: 23.06 }], REGION)).toBe(false);
  });
});
