/**
 * ADR-929 §6.19 — σημάδια διάστασης (απόληξη + βοηθητική) που το OCR διάβασε «T»/«I»/«4»: απορροφώνται στη διάσταση, ποτέ
 * κάρτα «άλλο κείμενο», ποτέ τιμή. Το σενάριο του ΤΕΣΤ2: κατακόρυφη διάσταση ανατολικά του σπιτιού, κοντό κομμάτι με βέλος
 * στο πάνω άκρο και η βοηθητική οριζόντια πάνω του — το πλαίσιο του OCR τα σκεπάζει και τα δύο.
 */

import { describe, expect, it } from '@jest/globals';
import type { PlanSegmentRole, PlanText } from '../../plan-recognition-types';
import { planAbsorbedMarkCount, planReadValueRows } from '../../../../systems/plan-recognition/plan-read-values';
import { dimensionMarkTextIds, withoutDimensionMarks } from '../dimension-marks';
import { fusePlan } from '../plan-fusion';
import { dimensionOf, fusionInput, houseSegments, KNOWN_SCALE, reading, segment, textAt } from './fusion-fixture';

/** Κοντό κομμάτι διάστασης (από τη βοηθητική προς τα κάτω) και η βοηθητική του, ανατολικά του σπιτιού. */
const STUB = segment('d1', 6800, -125, 6800, 1300);
const TICK = segment('e1', 6620, -125, 6980, -125);
const ROLES: ReadonlyMap<string, PlanSegmentRole> = new Map([['d1', 'dimension-line'], ['e1', 'extension-line']]);
const SEGMENTS = [STUB, TICK];

/** Το «T»: κατακόρυφο πλαίσιο πάνω στη συνάντηση βοηθητικής και κομματιού. */
const mark = (patch: Partial<PlanText> = {}): PlanText => ({ ...textAt('m1', 'T', 6800, -80, 'v', 'other'), ...patch });
/** Ο πραγματικός αριθμός, στο κενό ανάμεσα στα κομμάτια. */
const VALUE = textAt('t1', '4.25', 6800, 2000, 'v');

describe('dimensionMarkTextIds — τι είναι σημάδι διάστασης', () => {
  it('ΤΟ ΣΕΝΑΡΙΟ: «T» πάνω σε βοηθητική + γραμμή διάστασης ⇒ σημάδι· ο αριθμός «4.25» μένει κείμενο', () => {
    const ids = dimensionMarkTextIds(reading({ texts: [mark(), VALUE] }), SEGMENTS, ROLES);
    expect([...ids]).toEqual(['m1']);
  });

  it.each<[string, Partial<PlanText>]>([
    ['διορθωμένο από τον άνθρωπο', { correctedFrom: 'T' }],
    ['επιβεβαιωμένο από τον άνθρωπο', { confirmed: true }],
    ['λέξη τριών χαρακτήρων', { raw: 'ABC' }],
  ])('%s ⇒ ΔΕΝ απορροφάται', (_name, patch) => {
    expect(dimensionMarkTextIds(reading({ texts: [mark(patch)] }), SEGMENTS, ROLES).size).toBe(0);
  });

  it('ακουμπά μόνο βοηθητική, μακριά από τη γραμμή διάστασης ⇒ ΔΕΝ απορροφάται (η απόληξη ζει στη συνάντησή τους)', () => {
    const longTick = segment('e1', 6400, -125, 7400, -125);
    const farOnTick = textAt('m2', 'I', 7300, -125, 'h', 'other');
    expect(dimensionMarkTextIds(reading({ texts: [farOnTick] }), [STUB, longTick], ROLES).size).toBe(0);
  });

  it('χωρίς κρίσεις ρόλων ⇒ τίποτα (καμία μαντεψιά)', () => {
    expect(dimensionMarkTextIds(reading({ texts: [mark()] }), SEGMENTS, new Map()).size).toBe(0);
  });
});

describe('withoutDimensionMarks — η ανάγνωση χωρίς τα σημάδια', () => {
  it('φεύγουν το κείμενο και ό,τι έδειχνε σε αυτό· τα υπόλοιπα μένουν', () => {
    const r = { ...reading({ texts: [mark(), VALUE], dimensions: [dimensionOf('m1', 4), dimensionOf('t1', 4250)] }),
      writtenScale: { textId: 'm1', denominator: 100, confidence: { score: 0.9, factors: {} } } };
    const out = withoutDimensionMarks(r, new Set(['m1']));
    expect(out.texts.map((t) => t.id)).toEqual(['t1']);
    expect(out.dimensions.map((d) => d.textId)).toEqual(['t1']);
    expect(out.writtenScale).toBeNull();
  });

  it('κανένα σημάδι ⇒ η ΙΔΙΑ ανάγνωση (καμία αντιγραφή)', () => {
    const r = reading({ texts: [VALUE] });
    expect(withoutDimensionMarks(r, new Set())).toBe(r);
  });
});

describe('fusePlan + «Τι διάβασα» — από άκρη σε άκρη', () => {
  const input = fusionInput({
    segments: [...houseSegments(), ...SEGMENTS],
    segmentRoles: ROLES,
    knownScale: KNOWN_SCALE,
    reading: { status: 'read', reading: reading({ texts: [mark({ raw: '4', kind: 'dimension' }), VALUE], dimensions: [dimensionOf('m1', 4), dimensionOf('t1', 4250)] }) },
  });

  it('η σύντηξη ονομάζει το σημάδι και ΔΕΝ το κάνει διάσταση', () => {
    const fusion = fusePlan(input);
    expect(fusion.absorbedMarkTextIds).toEqual(['m1']);
    expect(fusion.dimensions.some((d) => d.textId === 'm1')).toBe(false);
  });

  it('η λίστα «Τι διάβασα» δεν δείχνει κάρτα για το σημάδι, αλλά το μετρά', () => {
    const fusion = fusePlan(input);
    const r = input.reading?.status === 'read' ? input.reading.reading : reading({});
    expect(planReadValueRows(r, fusion).map((row) => row.textId)).toEqual(['t1']);
    expect(planAbsorbedMarkCount(fusion)).toBe(1);
  });
});
