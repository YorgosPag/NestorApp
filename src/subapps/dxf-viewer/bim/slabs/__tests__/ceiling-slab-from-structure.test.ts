/**
 * ADR-534 — Auto-πλάκα οροφής: **ενιαίο περίγραμμα κτιρίου** (DXF + BIM combined). Επαληθεύει:
 * καθαρό πλαίσιο δοκαριών → 1 ενιαία· **μικτό (3 DXF τοίχοι + 1 δοκάρι) → 1 ενιαία**· DXF + εσωτερικό
 * χώρισμα → 1 ενιαία (το χώρισμα διαλύεται)· τίποτα → no-bays.
 */

import type { Entity } from '../../../types/entities';
import { buildCeilingSlabsFromStructure } from '../ceiling-slab-from-structure';
import type { BeamParams } from '../../types/beam-types';

const M = 1000, TOP = 3000, W = 250;

function beam(id: string, sx: number, sy: number, ex: number, ey: number) {
  const params: BeamParams = {
    kind: 'straight', startPoint: { x: sx, y: sy, z: 0 }, endPoint: { x: ex, y: ey, z: 0 },
    width: W, depth: 400, topElevation: TOP, sceneUnits: 'mm',
  };
  return { id, type: 'beam' as const, params };
}
function line(id: string, sx: number, sy: number, ex: number, ey: number) {
  return { id, type: 'line' as const, start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}
const ents = (arr: readonly unknown[]): Entity[] => arr as unknown as Entity[];

describe('ADR-534 ceiling slab — building outline (DXF + BIM combined)', () => {
  it('καθαρό πλαίσιο 4 δοκαριών (χωρίς DXF) → 1 ΕΝΙΑΙΑ πλάκα, flush top', () => {
    const frame = [
      beam('s', 0, 0, 12 * M, 0), beam('e', 12 * M, 0, 12 * M, 12 * M),
      beam('n', 12 * M, 12 * M, 0, 12 * M), beam('w', 0, 12 * M, 0, 0),
    ];
    const r = buildCeilingSlabsFromStructure(ents(frame), {}, 'lvl', 'mm');
    expect(r.ok).toBe(true);
    expect(r.slabs.length).toBe(1);
    expect(r.slabs[0].kind).toBe('ceiling');
    expect(r.slabs[0].params.levelElevation).toBe(TOP);
  });

  it('ΜΙΚΤΟ: 3 DXF τοίχοι + 1 δοκάρι (4η πλευρά) → 1 ΕΝΙΑΙΑ πλάκα', () => {
    const entities = ents([
      line('w', 0, 0, 0, 12 * M), line('s', 0, 0, 12 * M, 0), line('e', 12 * M, 0, 12 * M, 12 * M),
      beam('n', 0, 12 * M, 12 * M, 12 * M), // η πάνω πλευρά κλείνει από δοκάρι
    ]);
    const r = buildCeilingSlabsFromStructure(entities, {}, 'lvl', 'mm');
    expect(r.ok).toBe(true);
    expect(r.slabs.length).toBe(1); // ΕΝΙΑΙΑ — DXF + BIM έκλεισαν μαζί το περίγραμμα
  });

  it('DXF περίγραμμα + εσωτερικό χώρισμα → 1 ΕΝΙΑΙΑ (το χώρισμα διαλύεται)', () => {
    const entities = ents([
      ...[line('w', 0, 0, 0, 8 * M), line('s', 0, 0, 12 * M, 0), line('e', 12 * M, 0, 12 * M, 8 * M), line('n', 12 * M, 8 * M, 0, 8 * M)],
      line('part', 6 * M, 0, 6 * M, 8 * M), // εσωτερικό χώρισμα → ΔΕΝ τεμαχίζει
    ]);
    const r = buildCeilingSlabsFromStructure(entities, {}, 'lvl', 'mm');
    expect(r.ok).toBe(true);
    expect(r.slabs.length).toBe(1); // ΕΝΙΑΙΑ (όχι 2 δωμάτια)
  });

  it('τίποτα κλειστό → no-bays', () => {
    const r = buildCeilingSlabsFromStructure(ents([beam('b', 0, 0, 5 * M, 0)]), {}, 'lvl', 'mm');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-bays');
  });

  // ─── ADR-534 Φ2 — υποδιαίρεση σε φατνώματα + per-bay πάχος ──────────────────────
  const frame = [
    beam('s', 0, 0, 12 * M, 0), beam('e', 12 * M, 0, 12 * M, 12 * M),
    beam('n', 12 * M, 12 * M, 0, 12 * M), beam('w', 0, 12 * M, 0, 0),
  ];

  it('Φ2: σταυρός εσωτερικών δοκαριών → 4 φατνώματα (όχι 1 ενιαία)', () => {
    const cross = [beam('iv', 6 * M, 0, 6 * M, 12 * M), beam('ih', 0, 6 * M, 12 * M, 6 * M)];
    const r = buildCeilingSlabsFromStructure(ents([...frame, ...cross]), {}, 'lvl', 'mm');
    expect(r.ok).toBe(true);
    expect(r.slabs.length).toBe(4);
    for (const sl of r.slabs) expect(sl.params.levelElevation).toBe(TOP); // κοινή κορυφή
  });

  it('Φ2: per-bay πάχος από span (callback) — μικρότερα φατνώματα → λεπτότερη πλάκα', () => {
    const cross = [beam('iv', 4 * M, 0, 4 * M, 12 * M), beam('ih', 0, 6 * M, 12 * M, 6 * M)];
    const r = buildCeilingSlabsFromStructure(
      ents([...frame, ...cross]), {}, 'lvl', 'mm',
      (bay) => (bay.spanMm < 5 * M ? 180 : 250),
    );
    expect(r.slabs.length).toBe(4);
    const thicknesses = new Set(r.slabs.map((sl) => sl.params.thickness));
    expect(thicknesses.size).toBeGreaterThanOrEqual(2); // 4m-στενά (180) vs 6m+ (250)
    expect(thicknesses.has(180)).toBe(true);
    expect(thicknesses.has(250)).toBe(true);
  });

  it('Φ2: εσωτερικό DXF χώρισμα (γραμμή) ΔΕΝ φτιάχνει φάτνωμα — μόνο δομικά μέλη', () => {
    const r = buildCeilingSlabsFromStructure(
      ents([...frame, line('part', 6 * M, 0, 6 * M, 12 * M)]), {}, 'lvl', 'mm',
    );
    expect(r.ok).toBe(true);
    expect(r.slabs.length).toBe(1); // η DXF γραμμή δεν είναι κόπτης → 1 ενιαία
  });
});
