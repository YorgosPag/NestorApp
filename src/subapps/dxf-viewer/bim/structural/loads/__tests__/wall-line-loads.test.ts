/**
 * ADR-478 — wall masonry line-loads (pure SSoT).
 *
 * Καλύπτει: φορτίο όψης από DNA layers & single-layer, fallback πυκνότητας,
 * exclusion φέροντος τοιχώματος Ο.Σ. (shear wall), effective resolver (explicit-wins).
 */

import {
  resolveWallFaceLoadKpa,
  resolveWallLineLoadKnm,
  isMasonryLineLoadCandidate,
  resolveEffectiveWallLineLoad,
  DEFAULT_MASONRY_DENSITY_KG_M3,
} from '../wall-line-loads';
import type { WallDna } from '../../../types/wall-dna-types';

const G = 9.81;
/** γ (kN/m³) από πυκνότητα (kg/m³). */
const gamma = (densityKgM3: number): number => (densityKgM3 * G) / 1000;

/** Εξωτερική DNA 25cm: σοβάς-εξ 25 (1800) + τούβλο 210 (1800) + σοβάς-εσ 15 (1200). */
function extDna(): WallDna {
  return {
    layers: [
      { id: 'a', name: 'plaster-ext', thickness: 25, materialId: 'mat-plaster-ext', side: 'exterior' },
      { id: 'b', name: 'brick', thickness: 210, materialId: 'mat-brick-masonry', side: 'core' },
      { id: 'c', name: 'plaster-int', thickness: 15, materialId: 'mat-plaster-int', side: 'interior' },
    ],
    totalThickness: 250,
  };
}

describe('resolveWallFaceLoadKpa', () => {
  it('DNA layers → άθροισμα ιδίου βάρους όλων των στρώσεων', () => {
    const expected =
      (25 / 1000) * gamma(1800) + (210 / 1000) * gamma(1800) + (15 / 1000) * gamma(1200);
    expect(resolveWallFaceLoadKpa({ dna: extDna(), thickness: 250 })).toBeCloseTo(expected, 4);
  });

  it('χωρίς DNA → ενιαίο thickness + material', () => {
    const face = resolveWallFaceLoadKpa({ thickness: 200, material: 'mat-brick-masonry' });
    expect(face).toBeCloseTo((200 / 1000) * gamma(1800), 4); // 3.5316
  });

  it('άγνωστο υλικό → fallback πυκνότητα τοιχοποιίας (ποτέ silent-drop)', () => {
    const face = resolveWallFaceLoadKpa({ thickness: 100, material: 'mat-unknown-xyz' });
    expect(face).toBeCloseTo((100 / 1000) * gamma(DEFAULT_MASONRY_DENSITY_KG_M3), 4);
  });
});

describe('resolveWallLineLoadKnm', () => {
  it('γραμμικό = φορτίο όψης × ύψος[m]', () => {
    const face =
      (25 / 1000) * gamma(1800) + (210 / 1000) * gamma(1800) + (15 / 1000) * gamma(1200);
    expect(resolveWallLineLoadKnm({ dna: extDna(), thickness: 250, height: 3000 })).toBeCloseTo(
      face * 3,
      4,
    );
  });

  it('μη-θετικό ύψος → 0', () => {
    expect(resolveWallLineLoadKnm({ thickness: 200, material: 'mat-brick-masonry', height: 0 })).toBe(0);
  });
});

describe('isMasonryLineLoadCandidate', () => {
  it('DNA core τούβλο → true (τοιχοποιία πληρώσεως)', () => {
    expect(isMasonryLineLoadCandidate({ dna: extDna() })).toBe(true);
  });

  it('DNA core χυτό σκυρόδεμα → false (φέρον τοίχωμα Ο.Σ. = κατακόρυφο μέλος, T6)', () => {
    const rc: WallDna = {
      layers: [{ id: 'x', name: 'rc', thickness: 200, materialId: 'mat-concrete-c25', side: 'core' }],
      totalThickness: 200,
    };
    expect(isMasonryLineLoadCandidate({ dna: rc })).toBe(false);
  });

  it('μπλοκ σκυροδέματος (mat-concrete-block) → true (τοιχοποιία, όχι χυτό RC)', () => {
    const block: WallDna = {
      layers: [{ id: 'x', name: 'block', thickness: 200, materialId: 'mat-concrete-block', side: 'core' }],
      totalThickness: 200,
    };
    expect(isMasonryLineLoadCandidate({ dna: block })).toBe(true);
  });

  it('χωρίς DNA: material χυτό σκυρόδεμα → false· absent → true (drawn default τούβλο)', () => {
    expect(isMasonryLineLoadCandidate({ material: 'mat-concrete-c30' })).toBe(false);
    expect(isMasonryLineLoadCandidate({})).toBe(true);
  });
});

describe('resolveEffectiveWallLineLoad', () => {
  const params = { dna: extDna(), thickness: 250, height: 3000 };

  it('ρητή τιμή κερδίζει', () => {
    expect(resolveEffectiveWallLineLoad({ explicitDeadLineLoadKnm: 5, params }).deadLineLoadKnm).toBe(5);
  });

  it('absent/μη-θετική ρητή → auto από γεωμετρία+υλικό', () => {
    const auto = resolveWallLineLoadKnm(params);
    expect(resolveEffectiveWallLineLoad({ params }).deadLineLoadKnm).toBeCloseTo(auto, 6);
    expect(
      resolveEffectiveWallLineLoad({ explicitDeadLineLoadKnm: -3, params }).deadLineLoadKnm,
    ).toBeCloseTo(auto, 6);
  });
});
