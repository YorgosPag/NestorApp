/**
 * ⚓ ADR-929 Φ4 — η σύντηξη πάνω σε γνωστή αλήθεια (`fusion-fixture.ts`): δέση, κλίμακα, συνόρθωση, ερωτήσεις.
 */

import { describe, expect, it } from '@jest/globals';
import { fusePlan } from '../plan-fusion';
import { writtenPrecisionMm } from '../dimension-precision';
import type { PlanQuestion } from '../plan-fusion-types';
import {
  KNOWN_SCALE,
  PX_PER_MM,
  dimensionOf,
  fusionInput,
  houseDimensions,
  houseSegments,
  reading,
  textAt,
} from './fusion-fixture';

const TRUE_MM_PER_PX = 1 / PX_PER_MM;
const read = (r: ReturnType<typeof reading>) => ({ status: 'read' as const, reading: r });
const kinds = (qs: readonly PlanQuestion[]) => qs.map((q) => q.kind);

describe('dimension-precision — η ακρίβεια από το κείμενο', () => {
  it.each([
    ['3.50', 3500, 10],
    ['3,50', 3500, 10],
    ['350', 3500, 10],
    ['3500', 3500, 1],
    ['3.325', 3325, 1],
    ['Σαλόνι', 3500, 10],
  ])('«%s» (%i mm) ⇒ τελευταίο ψηφίο %i mm', (raw, value, expected) => {
    expect(writtenPrecisionMm(raw, value)).toBe(expected);
  });
});

describe('plan-fusion — σάρωση σε κλίμακα', () => {
  it('χωρίς βαθμονόμηση: η συναίνεση βρίσκει την κλίμακα, όλες οι διαστάσεις συνεπείς, καμία ερώτηση', () => {
    const { texts, dimensions } = houseDimensions();
    const r = fusePlan(fusionInput({ segments: houseSegments(), reading: read(reading({ texts, dimensions })) }));
    expect(r.scale?.chosen).toBe('dimension-consensus');
    expect(Math.abs((r.scale?.mmPerAlignedPx ?? 0) / TRUE_MM_PER_PX - 1)).toBeLessThan(0.002);
    expect(r.dimensions.map((d) => d.status)).toEqual(['consistent', 'consistent', 'consistent', 'consistent', 'consistent']);
    expect(r.questions).toEqual([]);
    expect(r.adjustment?.globalTestPassed).toBe(true);
  });

  it('η δέση είναι η γεωμετρικά σωστή: «3.325» στις εσωτερικές παρειές του δυτικού δωματίου', () => {
    const { texts, dimensions } = houseDimensions();
    const r = fusePlan(fusionInput({ segments: houseSegments(), reading: read(reading({ texts, dimensions })) }));
    const west = r.dimensions.find((d) => d.textId === 't-west');
    const lineOf = (seg: string) => r.faceLines.find((l) => l.segmentIds.includes(seg))?.id;
    // Η σειρά ακολουθεί την κάθετο της οικογένειας (για τις κατακόρυφες `n = (−1, 0)`), όχι το x της εικόνας.
    expect(new Set([west?.binding?.lineA, west?.binding?.lineB])).toEqual(new Set([lineOf('v1'), lineOf('v2')]));
    expect(west?.adjustedMm).toBeCloseTo(3325, 0);
  });

  it('με βαθμονόμηση: κερδίζει η βαθμονόμηση (Δ4) και η συναίνεση συμφωνεί ⇒ καμία ερώτηση κλίμακας', () => {
    const { texts, dimensions } = houseDimensions();
    const r = fusePlan(fusionInput({ segments: houseSegments(), reading: read(reading({ texts, dimensions })), knownScale: KNOWN_SCALE }));
    expect(r.scale?.chosen).toBe('known-calibration');
    expect(r.scale?.metresPerOriginalPx).toBeCloseTo(KNOWN_SCALE.metresPerPixelX, 9);
    expect(kinds(r.questions)).not.toContain('scale-conflict');
  });

  it('🔴 λάθος βαθμονόμηση (5%) ⇒ ερώτηση κλίμακας με τις δύο τιμές', () => {
    const { texts, dimensions } = houseDimensions();
    const wrong = { ...KNOWN_SCALE, metresPerPixelX: KNOWN_SCALE.metresPerPixelX * 1.05, metresPerPixelY: KNOWN_SCALE.metresPerPixelY * 1.05 };
    const r = fusePlan(fusionInput({ segments: houseSegments(), reading: read(reading({ texts, dimensions })), knownScale: wrong }));
    const q = r.questions.find((x) => x.kind === 'scale-conflict');
    expect(q?.kind === 'scale-conflict' && q.other.source).toBe('dimension-consensus');
  });
});

describe('plan-fusion — ποιος φταίει (Baarda)', () => {
  it('🔴 λάθος γραμμένη τιμή («2.90» αντί 3.325) ⇒ dimension-conflict ΓΙΑ ΑΥΤΗ, οι άλλες συνεπείς', () => {
    const { texts, dimensions } = houseDimensions({ 't-west': { raw: '2.90', valueMm: 2900 } });
    const r = fusePlan(fusionInput({ segments: houseSegments(), reading: read(reading({ texts, dimensions })), knownScale: KNOWN_SCALE }));
    const west = r.dimensions.find((d) => d.textId === 't-west');
    expect(west?.status).toBe('conflict');
    expect(west?.measuredMm).toBeCloseTo(3325, 0);
    expect(r.dimensions.filter((d) => d.textId !== 't-west').every((d) => d.status === 'consistent')).toBe(true);
    const q = r.questions[0];
    expect(q.kind === 'dimension-conflict' && [q.textId, q.writtenMm]).toEqual(['t-west', 2900]);
  });

  it('🔴 παρειά εκτός θέσης κατά 8 cm (≈5σ σάρωσης), ενώ τρεις διαστάσεις συμφωνούν ⇒ face-displaced με τη μετατόπιση', () => {
    const { texts, dimensions } = houseDimensions();
    const extra = [textAt('t-west-out', '3.575', 1662.5, 2400, 'h'), textAt('t-wall', '0.10', 3500, 1000, 'h')];
    const extraDims = [dimensionOf('t-west-out', 3575), dimensionOf('t-wall', 100)];
    const segments = houseSegments({ faceIndex: 2, mm: -80 });
    const r = fusePlan(fusionInput({
      segments,
      reading: read(reading({ texts: [...texts, ...extra], dimensions: [...dimensions, ...extraDims] })),
      knownScale: KNOWN_SCALE,
    }));
    const q = r.questions.find((x) => x.kind === 'face-displaced');
    expect(q?.kind === 'face-displaced' && q.segmentIds).toEqual(['v2']);
    expect(q?.kind === 'face-displaced' && q.shiftMm).toBeCloseTo(80, -1);
    const status = (id: string) => r.dimensions.find((d) => d.textId === id)?.status;
    expect([status('t-west'), status('t-west-out')]).toEqual(['consistent', 'consistent']);
    // Η «0.10» (πάχος τοίχου) ελέγχεται μόνο για λάθη ~10 εκ. ⇒ τίμια «μη ελέγξιμη», όχι «συνεπής».
    expect(status('t-wall')).toBe('uncheckable');
    const moved = r.adjustedSegments.find((s) => s.id === 'v2');
    expect(moved?.start.x).toBeCloseTo(100 + 3450 * PX_PER_MM, 0);
  });

  it('μία μόνη διάσταση χωρίς βαθμονόμηση: δεν αποδεικνύει κλίμακα ⇒ καμία κλίμακα, καμία ψεύτικη βεβαιότητα', () => {
    const r = fusePlan(fusionInput({
      segments: houseSegments(),
      reading: read(reading({ texts: [textAt('t1', '6.25', 3000, 4800, 'h')], dimensions: [dimensionOf('t1', 6250)] })),
    }));
    expect(r.scale).toBeNull();
    expect(r.dimensions[0].status).toBe('unbound');
  });

  it('μία διάσταση με γνωστή κλίμακα ⇒ ελέγχεται από τις θέσεις (συνεπής), όχι «μη ελέγξιμη»', () => {
    const r = fusePlan(fusionInput({
      segments: houseSegments(),
      reading: read(reading({ texts: [textAt('t1', '6.25', 3000, 4800, 'h')], dimensions: [dimensionOf('t1', 6250)] })),
      knownScale: KNOWN_SCALE,
    }));
    expect(r.dimensions[0].status).toBe('consistent');
  });

  it('μία διάσταση + δέση που επιβεβαιώνει η ανάγνωση, χωρίς βαθμονόμηση ⇒ κλίμακα, αλλά η διάσταση «μη ελέγξιμη»', () => {
    const r = fusePlan(fusionInput({
      segments: houseSegments(),
      reading: read(reading({ texts: [textAt('t1', '6.25', 3000, 4800, 'h')], dimensions: [dimensionOf('t1', 6250, ['v0', 'v5'])] })),
    }));
    expect(r.scale?.chosen).toBe('dimension-consensus');
    expect(r.dimensions[0].status).toBe('uncheckable');
    expect(r.dimensions[0].confidence.factors.solver).toBe(0.5);
  });
});

describe('plan-fusion — χωρίς ανάγνωση, εμβαδά', () => {
  it('ανάγνωση μη διαθέσιμη ⇒ μόνο γεωμετρία με τη γνωστή κλίμακα, καμία ερώτηση', () => {
    const r = fusePlan(fusionInput({ segments: houseSegments(), reading: { status: 'unavailable', reason: 'ai-disabled-for-company' }, knownScale: KNOWN_SCALE }));
    expect(r.scale?.chosen).toBe('known-calibration');
    expect(r.dimensions).toEqual([]);
    expect(r.questions).toEqual([]);
    expect(r.adjustment).toBeNull();
    expect(r.adjustedSegments).toEqual(houseSegments());
  });

  it('γραμμένη κλίμακα «1:100» σε 127 dpi ⇒ 0,2 mm χαρτιού × 100 = 20 mm ανά pixel (Δ4 #2)', () => {
    const r = fusePlan(fusionInput({
      segments: houseSegments(),
      reading: read({ ...reading({ texts: [textAt('s', '1:100', 3000, 4800, 'h', 'scale')] }), writtenScale: { textId: 's', denominator: 100, confidence: { score: 0.9, factors: { reading: 0.9 } } } }),
      sourceDpi: 127,
    }));
    expect(r.scale?.chosen).toBe('written-scale');
    expect(r.scale?.mmPerAlignedPx).toBeCloseTo(TRUE_MM_PER_PX, 6);
  });

  it('κάτοψη αγγελίας χωρίς διαστάσεις: η κλίμακα βγαίνει από τα γραμμένα εμβαδά (σταθερό σημείο)', () => {
    const areaPx = (3325 * 3750) * PX_PER_MM * PX_PER_MM;
    const r = fusePlan(fusionInput({
      kind: 'listing',
      segments: houseSegments(),
      reading: read(reading({
        texts: [textAt('n1', 'Σαλόνι', 1787.5, 2000, 'h', 'room-name')],
        rooms: [{ name: 'Σαλόνι', writtenAreaM2: 12.47, boundarySegmentIds: [], nameTextId: 'n1', confidence: { score: 0.9, factors: { reading: 0.9 } } }],
      })),
      roomAreaProbe: () => areaPx,
    }));
    expect(r.scale?.chosen).toBe('room-area');
    expect(Math.abs((r.scale?.mmPerAlignedPx ?? 0) / TRUE_MM_PER_PX - 1)).toBeLessThan(0.002);
    expect(r.rooms[0].status).toBe('consistent');
  });

  it('🔴 γραμμένο εμβαδόν που διαφωνεί με τη γνωστή κλίμακα ⇒ area-conflict με τις δύο τιμές', () => {
    const areaPx = (3325 * 3750) * PX_PER_MM * PX_PER_MM;
    const r = fusePlan(fusionInput({
      segments: houseSegments(),
      reading: read(reading({
        texts: [textAt('n1', 'Σαλόνι', 1787.5, 2000, 'h', 'room-name')],
        rooms: [{ name: 'Σαλόνι', writtenAreaM2: 15, boundarySegmentIds: [], nameTextId: 'n1', confidence: { score: 0.9, factors: { reading: 0.9 } } }],
      })),
      knownScale: KNOWN_SCALE,
      roomAreaProbe: () => areaPx,
    }));
    const q = r.questions.find((x) => x.kind === 'area-conflict');
    expect(q?.kind === 'area-conflict' && q.writtenM2).toBe(15);
    expect(q?.kind === 'area-conflict' && q.measuredM2).toBeCloseTo(12.47, 1);
  });
});

describe('plan-fusion — ντετερμινισμός', () => {
  it('ίδια είσοδος ⇒ ίδιο αποτέλεσμα', () => {
    const { texts, dimensions } = houseDimensions();
    const input = fusionInput({ segments: houseSegments(), reading: read(reading({ texts, dimensions })) });
    expect(JSON.stringify(fusePlan(input).dimensions)).toBe(JSON.stringify(fusePlan(input).dimensions));
  });
});
