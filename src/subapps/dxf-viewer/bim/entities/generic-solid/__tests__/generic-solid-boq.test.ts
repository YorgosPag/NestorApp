/**
 * ADR-684 Φ4-C — generic-solid BOQ: αναλυτικά ακριβής όγκος ανά σχήμα + payload wiring.
 *
 * Γνωστές τιμές (mm → m³) επιβεβαιώνουν ότι κάθε σχήμα χρησιμοποιεί τον ΣΩΣΤΟ τύπο (όχι bbox). Το
 * payload test φρουρεί το anti-dead-code συμβόλαιο: το `genericSolidBoqPayload` παράγει το σχήμα που
 * περιμένει ο bridge, με `params` ακέραιο (ώστε ο resolver να δει το `structuralRole`).
 */

import {
  genericSolidVolumeM3,
  genericSolidBoqGeometry,
  genericSolidBoqPayload,
} from '../generic-solid-boq';
import {
  buildDefaultGenericSolidParams,
  buildGenericSolidEntity,
} from '../../../../hooks/drawing/generic-solid-completion';
import type { GenericSolidEntity, GenericSolidShape } from '../generic-solid-types';

describe('genericSolidVolumeM3 — αναλυτικά ακριβής όγκος ανά σχήμα', () => {
  it('box 1000³ mm = 1 m³', () => {
    expect(genericSolidVolumeM3({ kind: 'box', widthMm: 1000, depthMm: 1000, heightMm: 1000 })).toBeCloseTo(1, 6);
  });

  it('sphere r=1000mm = 4/3·π ≈ 4.18879 m³', () => {
    expect(genericSolidVolumeM3({ kind: 'sphere', radiusMm: 1000 })).toBeCloseTo(4.18879, 4);
  });

  it('cylinder r=1000, h=1000 = π ≈ 3.14159 m³', () => {
    expect(genericSolidVolumeM3({ kind: 'cylinder', radiusMm: 1000, heightMm: 1000 })).toBeCloseTo(3.14159, 4);
  });

  it('πλήρης κώνος R=1000, r=0, h=1000 = π/3 ≈ 1.0472 m³', () => {
    expect(genericSolidVolumeM3({ kind: 'cone', radiusBottomMm: 1000, radiusTopMm: 0, heightMm: 1000 })).toBeCloseTo(1.0472, 4);
  });

  it('κόλουρος κώνος R=1000, r=500, h=1000 ≈ 1.83260 m³ (frustum, όχι bbox)', () => {
    expect(genericSolidVolumeM3({ kind: 'cone', radiusBottomMm: 1000, radiusTopMm: 500, heightMm: 1000 })).toBeCloseTo(1.8326, 3);
  });

  it('torus R=1000, r=200 = 2π²Rr² ≈ 0.78957 m³ (δακτυλιοειδής, όχι bbox)', () => {
    expect(genericSolidVolumeM3({ kind: 'torus', majorRadiusMm: 1000, tubeRadiusMm: 200 })).toBeCloseTo(0.78957, 4);
  });

  it('pyramid 1000×1000×1000 = 1/3 ≈ 0.33333 m³', () => {
    expect(genericSolidVolumeM3({ kind: 'pyramid', baseWidthMm: 1000, baseDepthMm: 1000, heightMm: 1000 })).toBeCloseTo(0.33333, 4);
  });

  it('disc r=1000, t=100 = π·r²·t ≈ 0.31416 m³', () => {
    expect(genericSolidVolumeM3({ kind: 'disc', radiusMm: 1000, thicknessMm: 100 })).toBeCloseTo(0.31416, 4);
  });

  it('τετράγωνο πρίσμα (sides=4, r=1000, h=1000) = 2 m³', () => {
    expect(genericSolidVolumeM3({ kind: 'prism', radiusMm: 1000, heightMm: 1000, sides: 4 })).toBeCloseTo(2, 5);
  });

  it('εξαγωνικό πρίσμα (sides=6, r=1000, h=1000) ≈ 2.59808 m³', () => {
    expect(genericSolidVolumeM3({ kind: 'prism', radiusMm: 1000, heightMm: 1000, sides: 6 })).toBeCloseTo(2.59808, 4);
  });
});

describe('genericSolidBoqGeometry / genericSolidBoqPayload — wiring', () => {
  const shape: GenericSolidShape = { kind: 'cylinder', radiusMm: 1000, heightMm: 1000 };

  function structuralSolid(): GenericSolidEntity {
    const res = buildGenericSolidEntity(
      buildDefaultGenericSolidParams({ x: 0, y: 0 }, { shape }),
      '0',
    );
    if (!res.ok) throw new Error('generic-solid fixture invalid');
    return { ...res.entity, params: { ...res.entity.params, structuralRole: 'structural' } };
  }

  it('geometry φέρει ακριβή όγκο + θετικά area/lengthM', () => {
    const geom = genericSolidBoqGeometry(structuralSolid().params);
    expect(geom.volume).toBeCloseTo(3.14159, 4);
    expect(geom.area).toBeGreaterThan(0);
    expect(geom.lengthM).toBeGreaterThan(0);
  });

  it('payload μεταφέρει id/kind/params(structuralRole)/geometry — όχι dead payload', () => {
    const entity = structuralSolid();
    const payload = genericSolidBoqPayload(entity);
    expect(payload.id).toBe(entity.id);
    expect(payload.kind).toBe('generic');
    expect(payload.params?.['structuralRole']).toBe('structural');
    expect(payload.geometry?.volume).toBeCloseTo(genericSolidVolumeM3(shape), 6);
  });
});
