/**
 * @fileoverview Άγκυρα του ταιριάσματος οικισμών ↔ σημείων ΕΛΣΤΑΤ (ADR-883 §5.10) — πάνω σε
 * μικρή, χειροποίητη ιεραρχία, ώστε κάθε κανόνας να έχει **ένα** παράδειγμα που τον σπάει.
 */

import { buildSettlements, type DrawnBoundary } from '../settlement-points';
import type { HierarchyRow } from '../admin-boundary-source';

/** Ένα τετράγωνο γύρω από το (lng, lat), μισής πλευράς `half` μοιρών. */
function square(lng: number, lat: number, half: number): GeoJSON.MultiPolygon {
  const ring = [[lng - half, lat - half], [lng + half, lat - half], [lng + half, lat + half], [lng - half, lat + half], [lng - half, lat - half]];
  return { type: 'MultiPolygon', coordinates: [[ring]] };
}

function point(code: string, name: string, lng: number, lat: number): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { kalcode: code, oikismos: name },
    geometry: { type: 'MultiPoint', coordinates: [[lng, lat]] },
  };
}

const HIERARCHY: HierarchyRow[] = [
  { id: 'municipal_unit:070906', n: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΛΑΧΑΝΑ', c: '070906', l: 6, p: null },
  { id: 'community:07090602', n: 'Τοπική Κοινότητα Καρτερών', c: '07090602', l: 7, p: 'municipal_unit:070906' },
  { id: 'settlement:0709060201', n: 'Καρτεραί', c: '0709060201', l: 8, p: 'community:07090602' },
  { id: 'settlement:0709060202', n: 'Δορκάδα', c: '0709060202', l: 8, p: 'community:07090602' },
  { id: 'settlement:0709060203', n: 'Άσσηρος', c: '0709060203', l: 8, p: 'community:07090602' },
  { id: 'settlement:0709060204', n: 'Νέα Μάδυτος', c: '0709060204', l: 8, p: 'community:07090602' },
  // Κοινότητα ΧΩΡΙΣ όριο (όπως η Δράμεση) — ο οικισμός της δείχνει το όριο της Δ.Ε.
  { id: 'community:07090603', n: 'Τοπική Κοινότητα Χωρίς Όριο', c: '07090603', l: 7, p: 'municipal_unit:070906' },
  { id: 'settlement:0709060301', n: 'Ξεχασμένο', c: '0709060301', l: 8, p: 'community:07090603' },
];

const BOUNDARIES = new Map<string, DrawnBoundary>([
  ['municipal_unit:070906', { geometry: square(23.1, 40.9, 0.5), toleranceM: 15 }],
  ['community:07090602', { geometry: square(23.1, 40.88, 0.05), toleranceM: 10 }],
]);

function run(points: GeoJSON.Feature[]) {
  return buildSettlements(HIERARCHY, BOUNDARIES, { type: 'FeatureCollection', features: points });
}

describe('buildSettlements', () => {
  it('🔑 Δορκάδα: το «Δορκάς,η» της ΕΛΣΤΑΤ ταιριάζει (κλίση) — γραμμή στο όριο της κοινότητας, θέση μέσα της', () => {
    const { rows, places } = run([point('0709060202', 'Δορκάς,η', 23.1032, 40.8866)]);
    expect(rows).toContainEqual(['settlement:0709060202', 'Δορκάδα', 8, 'community:07090602']);
    expect(places.get('community:07090602')).toEqual({ 'settlement:0709060202': [23.1032, 40.8866] });
  });

  it('η ΕΔΡΑ («Καρτεραί» της «Τ.Κ. Καρτερών») δεν γίνεται δεύτερη γραμμή — είναι ήδη η κοινότητα', () => {
    const { rows, report } = run([]);
    expect(rows.map((row) => row[0])).not.toContain('settlement:0709060201');
    expect(report.seats).toBe(1);
  });

  it('🔴 ίδιος κωδικός, ΑΛΛΟ όνομα (αναρίθμηση απογραφών) ⇒ το σημείο πάει στο χωριό με το ΟΝΟΜΑ', () => {
    // Ο κωδικός …03 είναι «Άσσηρος» στην ιεραρχία· η ΕΛΣΤΑΤ τον δίνει στη «Νέα Μάδυτο».
    const { places } = run([point('0709060203', 'Νέα Μάδυτος,η', 23.09, 40.87)]);
    const community = places.get('community:07090602') ?? {};
    expect(community['settlement:0709060204']).toEqual([23.09, 40.87]);
    expect(community['settlement:0709060203']).toBeUndefined();
  });

  it('σημείο που δεν ταιριάζει σε κανένα όνομα της κοινότητας ⇒ καμία πινέζα, ποτέ εικασία', () => {
    const { places, report } = run([point('0709060202', 'Άγνωστο,το', 23.1, 40.88)]);
    expect(places.size).toBe(0);
    expect(report.unmatchedPoints).toBe(1);
  });

  it('δύο σημεία για τον ίδιο οικισμό ⇒ κανένα (αμφιβολία)', () => {
    const { places, report } = run([
      point('0709060202', 'Δορκάς,η', 23.1032, 40.8866),
      point('0709060202', 'Δορκάς,η', 23.11, 40.89),
    ]);
    expect(places.size).toBe(0);
    expect(report.ambiguousPoints).toBe(1);
  });

  it('🔒 θέση ΕΞΩ από το περίγραμμα που θα ζωγραφιστεί ⇒ καμία πινέζα (η γραμμή μένει)', () => {
    const { rows, places, report } = run([point('0709060202', 'Δορκάς,η', 24.5, 41.5)]);
    expect(rows.map((row) => row[0])).toContain('settlement:0709060202');
    expect(places.size).toBe(0);
    expect(report.outsideOwner).toBe(1);
  });

  it('κοινότητα ΧΩΡΙΣ όριο ⇒ ο οικισμός δείχνει τον πλησιέστερο πρόγονο ΜΕ όριο (τη Δ.Ε.)', () => {
    const { rows } = run([]);
    expect(rows).toContainEqual(['settlement:0709060301', 'Ξεχασμένο', 8, 'municipal_unit:070906']);
  });
});
