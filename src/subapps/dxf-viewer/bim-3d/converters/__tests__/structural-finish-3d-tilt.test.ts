/**
 * ADR-404 Bug A — tilt-aware structural finish skin (σοβάς ακολουθεί την κλίση).
 *
 * Όταν μια κολώνα πλαγιάζει στο 3Δ, ο πυρήνας έπαιρνε `applyColumnTilt` αλλά ο
 * σοβάς (per-element finish) έμενε κάθετος. Fix: το `buildColumnFinishSkin`
 * εφαρμόζει τον ΙΔΙΟ shear SSoT (`applyColumnTilt`) στο finish geometry ανά band
 * (no-op flat fast-path). Εδώ επαληθεύεται ότι το δέρμα γέρνει 1:1 με τον πυρήνα.
 *
 * Σκόπιμα ΧΩΡΙΣ import του `columnToMesh` (που τραβά τον reinforcement→firebase
 * chain στο node): δοκιμάζουμε μόνο τον pure finish builder.
 */

import * as THREE from 'three';
import { buildColumnFinishSkin } from '../structural-finish-3d';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { StructuralFinishSpec } from '../../../bim/finishes/structural-finish-types';

const FINISH: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

function column(tilt?: { angle: number; direction: number }): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), finish: FINISH, ...(tilt ? { tilt } : {}) };
  const res = buildColumnEntity(params, '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

const box = (c: ColumnEntity) => new THREE.Box3().setFromObject(buildColumnFinishSkin(c, [], [], 0)!);

describe('buildColumnFinishSkin — tilt-aware (ADR-404 Bug A)', () => {
  it('κεκλιμένη κολώνα (direction 0) → η κορυφή του σοβά γέρνει +X πέρα από τον flat', () => {
    const flat = box(column());
    const tilt = box(column({ angle: 30, direction: 0 }));
    expect(tilt.max.x).toBeGreaterThan(flat.max.x + 0.3);
    // Η βάση μένει αγκυρωμένη → min.x ~ίδιο (δεν μεταφέρεται όλη η κολώνα).
    expect(tilt.min.x).toBeCloseTo(flat.min.x, 2);
  });

  it('direction 90 (plan +y → world −z) → ο σοβάς γέρνει −Z', () => {
    const flat = box(column());
    const tilt = box(column({ angle: 30, direction: 90 }));
    expect(tilt.min.z).toBeLessThan(flat.min.z - 0.3);
  });

  it('flat fast-path: angle 0 → ίδιο bounding box με μη-tilted (μηδέν regression)', () => {
    const flat = box(column());
    const zero = box(column({ angle: 0, direction: 45 }));
    expect(zero.max.x).toBeCloseTo(flat.max.x, 6);
    expect(zero.min.x).toBeCloseTo(flat.min.x, 6);
    expect(zero.max.z).toBeCloseTo(flat.max.z, 6);
    expect(zero.min.z).toBeCloseTo(flat.min.z, 6);
  });
});
