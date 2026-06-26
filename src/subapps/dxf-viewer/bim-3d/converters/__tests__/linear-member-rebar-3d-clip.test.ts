/**
 * ADR-534 Φ3c-B3a — soffit top-clip του 3Δ κλωβού οπλισμού γραμμικού μέλους.
 * Όταν μονολιθική πλάκα καλύπτει τη δοκό, ο κλωβός κόβεται στο soffit (world Y = `topClipY`)
 * ώστε ο οπλισμός να μην προεξέχει στην πλάκα — παράλληλα με την κοπή του ορατού στερεού.
 */

import * as THREE from 'three';
import { buildLinearMemberRebarCage } from '../linear-member-rebar-3d';
import type { BeamRebarLayout } from '../../../bim/structural/reinforcement/beam-rebar-layout';

/** Διάταξη: άνω ράβδοι @ w=+200, κάτω @ w=−200, συνδετήρας ±230 (διατομή 300×500). */
const layout: BeamRebarLayout = {
  spanMm: 6000,
  widthMm: 300,
  depthMm: 500,
  longitudinalBars: [
    { vMm: 120, wMm: 200, uStartMm: 0, uEndMm: 6000, diameterMm: 16, layer: 'top', role: 'continuous' },
    { vMm: -120, wMm: 200, uStartMm: 0, uEndMm: 6000, diameterMm: 16, layer: 'top', role: 'continuous' },
    { vMm: 120, wMm: -200, uStartMm: 0, uEndMm: 6000, diameterMm: 16, layer: 'bottom', role: 'continuous' },
    { vMm: -120, wMm: -200, uStartMm: 0, uEndMm: 6000, diameterMm: 16, layer: 'bottom', role: 'continuous' },
  ],
  stirrupSectionPathMm: [
    { x: -130, y: -230 }, { x: 130, y: -230 }, { x: 130, y: 230 }, { x: -130, y: 230 },
  ],
  stirrupHookEndsMm: [],
  stirrupLevelsMm: [0, 3000, 6000],
  stirrupCornerRadiusMm: 16,
  stirrupDiameterMm: 8,
  stirrupCenterlineLengthMm: 1000,
};

/** Μέγιστο world-Y από τα instance matrices (μέσα τμημάτων) — version-independent από Box3. */
function maxInstanceY(group: THREE.Group): number {
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  let maxY = -Infinity;
  group.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh) return;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      if (p.y > maxY) maxY = p.y;
    }
  });
  return maxY;
}

const baseInput = {
  axisPts: [{ x: 0, y: 0 }, { x: 6000, y: 0 }],
  sceneUnits: 'mm' as const,
  layout,
  stirrupType: 'closed-welded' as const,
  bottomFaceY: 0, // → centerY = 0.25m· άνω ζώνη ≈ 0.45–0.48m
};

describe('buildLinearMemberRebarCage — ADR-534 Φ3c-B3a soffit clip', () => {
  it('χωρίς topClipY → ο κλωβός φτάνει την πλήρη άνω ζώνη (byte-for-byte)', () => {
    const cage = buildLinearMemberRebarCage(baseInput);
    expect(cage).not.toBeNull();
    expect(maxInstanceY(cage!)).toBeGreaterThan(0.4);
  });

  it('με topClipY=0.30 → ο κλωβός κόβεται στο soffit (καμία κορυφή πάνω από το clip)', () => {
    const cage = buildLinearMemberRebarCage({ ...baseInput, topClipY: 0.3 });
    expect(cage).not.toBeNull();
    expect(maxInstanceY(cage!)).toBeLessThanOrEqual(0.3 + 1e-6);
  });

  it('topClipY πάνω από τον κλωβό → no-op (δεν κόβει τίποτα)', () => {
    const clipped = buildLinearMemberRebarCage({ ...baseInput, topClipY: 5 });
    const plain = buildLinearMemberRebarCage(baseInput);
    expect(maxInstanceY(clipped!)).toBeCloseTo(maxInstanceY(plain!), 9);
  });
});
