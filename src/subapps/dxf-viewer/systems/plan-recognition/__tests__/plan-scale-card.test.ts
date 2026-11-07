/**
 * ⚓ ADR-929 Φ5.3γ — η κάρτα κλίμακας πάνω στη γνωστή αλήθεια του σπιτιού (1 px = 20 mm): πρόταση χωρίς βαθμονόμηση,
 * επιβεβαίωση με σωστή βαθμονόμηση, αντικατάσταση με λάθος βαθμονόμηση (και οι δύο τιμές), και «ό,τι βλέπεις, αυτό
 * γράφεται» (η εγγραφή φτιάχνεται από τη λύση της κάρτας, με προέλευση).
 */

import { describe, expect, it } from '@jest/globals';
import { fusePlan } from '../../../bim/plan-recognition/fusion/plan-fusion';
import type { PlanFusionInput } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import type { RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import { isCalibrationData } from '../../../floorplan-background/geometry/calibration-record-guard';
import { planScaleCard, planScaleSubject, scaleCardCalibration, type PlanScaleCardInput } from '../plan-scale-card';
import {
  KNOWN_SCALE,
  PX_PER_MM,
  fusionInput,
  houseDimensions,
  houseSegments,
  reading,
} from '../../../bim/plan-recognition/fusion/__tests__/fusion-fixture';

const TRUE_MM_PER_PX = 1 / PX_PER_MM;
const PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 500, height: 400 },
  transform: { translateX: 10, translateY: -5, scaleX: 1, scaleY: 1, rotation: 0 },
};
const WRONG_SCALE = { ...KNOWN_SCALE, metresPerPixelX: KNOWN_SCALE.metresPerPixelX * 1.05, metresPerPixelY: KNOWN_SCALE.metresPerPixelY * 1.05 };

function inputFor(knownScale: PlanFusionInput['knownScale'], withReading = true): PlanScaleCardInput {
  const { texts, dimensions } = houseDimensions();
  const readingOutcome = withReading ? { status: 'read' as const, reading: reading({ texts, dimensions }) } : null;
  const base = fusionInput({ segments: houseSegments(), reading: readingOutcome, knownScale });
  return {
    fusion: fusePlan(base),
    reading: readingOutcome,
    alignment: { originalToAligned: IDENTITY_HOMOGRAPHY, alignedToOriginal: IDENTITY_HOMOGRAPHY },
    placement: PLACEMENT,
    sceneUnits: 'mm',
    dimensionFusion: () => fusePlan({ ...base, knownScale: null }),
  };
}

const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('planScaleCard — οι τρεις καταστάσεις', () => {
  it('χωρίς βαθμονόμηση ⇒ πρόταση από τις διαστάσεις, με την αληθινή κλίμακα (±0,2%)', () => {
    const card = planScaleCard(inputFor(null));
    expect(card?.kind).toBe('proposal');
    if (card?.kind !== 'proposal') return;
    expect(rel(card.solution.mmPerPixelX, TRUE_MM_PER_PX)).toBeLessThan(0.002);
    expect(rel(card.solution.mmPerPixelY, TRUE_MM_PER_PX)).toBeLessThan(0.002);
    expect(card.replacesMmPerPixel).toBeNull();
    expect(card.references.used.length).toBeGreaterThanOrEqual(2);
    expect(card.solution.residualsRel).toHaveLength(card.references.used.length);
  });

  it('σωστή βαθμονόμηση ⇒ επιβεβαίωση: «συμφωνεί με N διαστάσεις», μικρή απόκλιση', () => {
    const card = planScaleCard(inputFor(KNOWN_SCALE));
    expect(card?.kind).toBe('confirmed');
    if (card?.kind !== 'confirmed') return;
    expect(card.agreeing).toBeGreaterThanOrEqual(2);
    expect(card.maxDeviationRel).toBeLessThan(0.01);
  });

  it('🔴 λάθος βαθμονόμηση (5%) ⇒ πρόταση αντικατάστασης με ΚΑΙ τις δύο τιμές, στην κλίμακα των διαστάσεων', () => {
    const card = planScaleCard(inputFor(WRONG_SCALE));
    expect(card?.kind).toBe('proposal');
    if (card?.kind !== 'proposal') return;
    expect(card.replacesMmPerPixel).toBeCloseTo(TRUE_MM_PER_PX * 1.05, 6);
    expect(rel(card.solution.mmPerPixelX, TRUE_MM_PER_PX)).toBeLessThan(0.002);
  });

  it('χωρίς ανάγνωση ⇒ καμία κάρτα (η κλίμακα από διαστάσεις χρειάζεται διαστάσεις)', () => {
    expect(planScaleCard(inputFor(null, false))).toBeNull();
  });

  it('η σύντηξη χωρίς γνωστή κλίμακα ζητείται ΜΟΝΟ στη διαφωνία', () => {
    const calls = { n: 0 };
    const counted = (input: PlanScaleCardInput): PlanScaleCardInput =>
      ({ ...input, dimensionFusion: () => { calls.n += 1; return input.dimensionFusion(); } });
    const uncalibrated = counted(inputFor(null));
    expect(planScaleSubject(uncalibrated.fusion, uncalibrated.reading, uncalibrated.dimensionFusion)?.kind).toBe('proposal');
    planScaleCard(counted(inputFor(KNOWN_SCALE)));
    expect(calls.n).toBe(0);
    planScaleCard(counted(inputFor(WRONG_SCALE)));
    expect(calls.n).toBe(1);
  });
});

describe('scaleCardCalibration — ό,τι βλέπεις, αυτό γράφεται', () => {
  it('η εγγραφή είναι η λύση της κάρτας, με προέλευση και πηγή ανά αναφορά, και περνά τον έλεγχο του διακομιστή', () => {
    const card = planScaleCard(inputFor(null));
    if (card?.kind !== 'proposal') throw new Error('expected a proposal');
    const { transform, data } = scaleCardCalibration(card, 1234);
    expect(transform).toBe(card.solution.transform);
    expect(data.origin).toBe('plan-dimensions');
    expect(data.scaleMode).toBe(card.solution.mode);
    expect(data.sceneUnits).toBe('mm');
    expect(data.calibratedAt).toBe(1234);
    expect(data.references?.map((r) => r.sourceTextId)).toEqual(card.references.used.map((r) => r.textId));
    expect(data.references?.every((r) => r.unit === 'mm')).toBe(true);
    expect(isCalibrationData(data)).toBe(true);
  });
});
