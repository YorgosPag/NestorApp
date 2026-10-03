/**
 * @fileoverview **ΤΟ ΣΗΜΕΙΟ ΤΗΣ ΠΡΟΤΑΣΗΣ** (ADR-904 Κ9) — ανάγνωση, κάτοψη στη λίστα, και προβολή απέναντι στην κάτοψη **τώρα**.
 *
 * - **Σ1** έγκυρο σημείο ταξιδεύει όπως δηλώθηκε (pixel της πρωτότυπης εικόνας + hash + αβεβαιότητα)·
 * - **Σ2** άκυρο ⇒ `undefined` — και σημείο **χωρίς όροφο** είναι άκυρο (δεν έχει κάτοψη)·
 * - **Σ3** `captureLevelChoices`: κάτοψη **μόνο** ενεργή **και** βαθμονομημένη·
 * - **Σ4** `placementHintPoint`: στην κάτοψη · η κάτοψη άλλαξε · εκτός κάτοψης · άγνωστος όροφος — καμία σιωπηλή μεταφορά.
 */

import type { FloorPlanRecord, TourLevel } from '@/types/spatial-tour';

import { captureLevelChoices, placementHintPoint, readCapturePlacementHint } from '../tour-capture-placement-hint';

const HASH = 'a'.repeat(64);
const GROUND = { kind: 'local', ordinal: 0 } as const;
const POINT = { planContentHash: HASH, x: 120, y: 80, radiusPx: 12 };

function plan(overrides: Partial<FloorPlanRecord> = {}): FloorPlanRecord {
  return {
    source: 'engineer', state: 'active', fileId: 'file_1', approvedBy: 'u1', approvedAt: '2026-10-01T00:00:00.000Z',
    image: { width: 300, height: 200, contentHash: HASH },
    scale: { metresPerPixel: 0.02, calibratedBy: 'u1', calibratedAt: '2026-10-01T00:00:00.000Z' },
    ...overrides,
  };
}

const level = (floorPlans: FloorPlanRecord[]): TourLevel => ({ key: GROUND, floorPlans });

describe('Σ1 — έγκυρο σημείο', () => {
  it('ταξιδεύει όπως δηλώθηκε, με τον όροφο του', () => {
    expect(readCapturePlacementHint({ level: GROUND, point: POINT })).toEqual({ level: GROUND, point: POINT });
  });

  it('χωρίς αβεβαιότητα ⇒ χωρίς πεδίο (άγνωστη, όχι μηδέν)', () => {
    expect(readCapturePlacementHint({ level: GROUND, point: { ...POINT, radiusPx: undefined } })).toEqual({
      level: GROUND, point: { planContentHash: HASH, x: 120, y: 80 },
    });
  });
});

describe('Σ2 — άκυρο ⇒ undefined', () => {
  it.each([
    ['σημείο χωρίς όροφο', { point: POINT }],
    ['αρνητικό x', { level: GROUND, point: { ...POINT, x: -1 } }],
    ['NaN y', { level: GROUND, point: { ...POINT, y: Number.NaN } }],
    ['τεράστιο y', { level: GROUND, point: { ...POINT, y: 100_001 } }],
    ['κενό hash', { level: GROUND, point: { ...POINT, planContentHash: ' ' } }],
    ['μηδενική αβεβαιότητα', { level: GROUND, point: { ...POINT, radiusPx: 0 } }],
    ['σημείο όχι αντικείμενο', { level: GROUND, point: [120, 80] }],
  ])('%s', (_label, raw) => {
    expect(readCapturePlacementHint(raw)).toBeUndefined();
  });
});

describe('Σ3 — η κάτοψη στη λίστα', () => {
  it('ενεργή + βαθμονομημένη ⇒ εικόνα + κλίμακα', () => {
    const [choice] = captureLevelChoices([level([plan({ state: 'superseded', image: { width: 1, height: 1, contentHash: 'old' } }), plan()])]);
    expect(choice).toEqual({
      key: GROUND, ordinal: 0, label: null,
      calibratedPlan: { image: { width: 300, height: 200, contentHash: HASH }, metresPerPixel: 0.02 },
    });
  });

  it.each([
    ['αβαθμονόμητη', plan({ scale: null })],
    ['χωρίς εικόνα', plan({ image: null })],
  ])('%s ⇒ null (σημείο δεν προσφέρεται)', (_label, record) => {
    expect(captureLevelChoices([level([record])])[0].calibratedPlan).toBeNull();
  });
});

describe('Σ4 — το σημείο απέναντι στην κάτοψη τώρα', () => {
  const levels = captureLevelChoices([level([plan()])]);

  it('ίδια κάτοψη, πάνω της ⇒ on-plan με pixel και αβεβαιότητα', () => {
    const at = placementHintPoint({ level: GROUND, point: POINT }, levels);
    expect(at).toMatchObject({ kind: 'on-plan', pixel: { x: 120, y: 80 }, radiusPx: 12, plan: { metresPerPixel: 0.02 } });
  });

  it('άλλη κάτοψη (νέο hash) ⇒ plan-changed — ΠΟΤΕ μεταφορά στη νέα', () => {
    expect(placementHintPoint({ level: GROUND, point: { ...POINT, planContentHash: 'b'.repeat(64) } }, levels)).toEqual({ kind: 'plan-changed' });
  });

  it('η κάτοψη έχασε τη βαθμονόμηση ⇒ plan-changed', () => {
    expect(placementHintPoint({ level: GROUND, point: POINT }, captureLevelChoices([level([plan({ scale: null })])]))).toEqual({ kind: 'plan-changed' });
  });

  it('έξω από την εικόνα ⇒ outside-plan', () => {
    expect(placementHintPoint({ level: GROUND, point: { ...POINT, x: 301 } }, levels)).toEqual({ kind: 'outside-plan' });
  });

  it('ο όροφος δεν υπάρχει ⇒ level-unknown · χωρίς σημείο ⇒ null', () => {
    expect(placementHintPoint({ level: { kind: 'local', ordinal: 3 }, point: POINT }, levels)).toEqual({ kind: 'level-unknown' });
    expect(placementHintPoint({ level: GROUND }, levels)).toBeNull();
  });
});
