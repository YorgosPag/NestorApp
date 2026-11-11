/**
 * ADR-937 Φάση Β — πρόταση προσανατολισμού από την κάτοψη.
 *
 *   Κ1  Βορράς πάνω: παράθυρο στη νότια ακμή ⇒ Νότιο, στην ανατολική ⇒ Ανατολικό
 *   Κ2  ΜΟΝΟ εξωτερικοί τοίχοι μετρούν · ΜΟΝΟ ανοίγματα στο όριο του ακινήτου (ανοχή)
 *   Κ3  σύμβαση Βορρά = `forwardRigidMap` (world = R(r)·local): r = 90 ⇒ η νότια ακμή της σκηνής βλέπει Ανατολικά
 *   Κ4  κανένα άνοιγμα / εκφυλισμένο πολύγωνο ⇒ κενή πρόταση (καμία μαντεψιά)
 */

import { createOpening } from '@/services/factories/opening.factory';

import type { OpeningEntity, OpeningGeometry } from '../../types/opening-types';
import { derivePropertyOrientations, type PropertyOrientationInputs } from '../derive-property-orientations';

/** Τετράγωνο 10×10 m (mm), αριστερόστροφο. */
const SQUARE = [
  { x: 0, y: 0 }, { x: 10_000, y: 0 }, { x: 10_000, y: 10_000 }, { x: 0, y: 10_000 },
];

function makeWindow(id: string, wallId: string, cx: number, cy: number): OpeningEntity {
  const geometry: OpeningGeometry = {
    position: { x: cx, y: cy },
    rotation: 0,
    outline: { vertices: [{ x: cx - 500, y: cy }, { x: cx + 500, y: cy }, { x: cx + 500, y: cy }, { x: cx - 500, y: cy }] },
    bbox: { min: { x: cx - 500, y: cy - 100 }, max: { x: cx + 500, y: cy + 100 } },
    area: 2,
    perimeter: 4,
  };
  return createOpening({
    id,
    params: { kind: 'window', wallId, offsetFromStart: 1500, width: 1000, height: 1500, sillHeight: 900 },
    geometry,
    layerId: 'L',
  });
}

function inputs(openings: OpeningEntity[], overrides: Partial<PropertyOrientationInputs> = {}): PropertyOrientationInputs {
  return {
    polygon: SQUARE,
    openings,
    exteriorWallIds: new Set(['ext-s', 'ext-e']),
    tol: 600,
    northRotationDeg: 0,
    ...overrides,
  };
}

describe('derivePropertyOrientations', () => {
  it('Κ1 Βορράς πάνω: νότια και ανατολική ακμή', () => {
    const result = derivePropertyOrientations(inputs([
      makeWindow('w1', 'ext-s', 5_000, 0),
      makeWindow('w2', 'ext-e', 10_000, 5_000),
    ]));
    expect(result).toEqual(['east', 'south']);
  });

  it('Κ2 εσωτερικός τοίχος ή άνοιγμα μακριά από το όριο ΔΕΝ μετρούν', () => {
    expect(derivePropertyOrientations(inputs([makeWindow('w1', 'int-1', 5_000, 0)]))).toEqual([]);
    expect(derivePropertyOrientations(inputs([makeWindow('w2', 'ext-s', 5_000, 3_000)]))).toEqual([]);
    expect(derivePropertyOrientations(inputs([makeWindow('w3', 'ext-s', 5_000, -400)]))).toEqual(['south']);
  });

  it('Κ3 rotationDeg = 90 ⇒ η νότια ακμή της σκηνής βλέπει Ανατολικά', () => {
    const result = derivePropertyOrientations(inputs([makeWindow('w1', 'ext-s', 5_000, 0)], { northRotationDeg: 90 }));
    // −Y της σκηνής, περιστραμμένο αριστερόστροφα κατά 90°, γίνεται +X του κόσμου = Ανατολή.
    expect(result).toEqual(['east']);
  });

  it('Κ4 κανένα άνοιγμα ή εκφυλισμένο πολύγωνο ⇒ κενή πρόταση', () => {
    expect(derivePropertyOrientations(inputs([]))).toEqual([]);
    expect(derivePropertyOrientations(inputs([makeWindow('w1', 'ext-s', 5_000, 0)], { polygon: SQUARE.slice(0, 2) })))
      .toEqual([]);
  });
});
