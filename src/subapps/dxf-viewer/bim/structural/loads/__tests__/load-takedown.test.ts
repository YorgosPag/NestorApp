/**
 * ADR-464 Slice 4 — tributary load takedown (pure math).
 *
 * Καλύπτει: grid half-spacing tributary (εσωτερική/edge/μεμονωμένη κολώνα), το κοινό
 * area→load resultant, το takedown (source='takedown', concentric, +self-weight), τη
 * μηδενική περίπτωση (χωρίς area loads/ορόφους), και τον κανόνα manual-vs-takedown.
 */

import {
  areaLoadResultant,
  computeGridTributaryAreas,
  computeMemberTakedown,
  toAppliedTakedownLoad,
  DEFAULT_BAY_SPAN_M,
  type TributaryColumn,
} from '../load-takedown';
import { isTakedownWritable, type AppliedMemberLoad } from '../structural-loads-types';

describe('computeGridTributaryAreas (grid half-spacing)', () => {
  it('εσωτερική κολώνα 3×3 κανάβου 5m → ίδιο φάτνωμα (5×5=25 m²)', () => {
    const cols: TributaryColumn[] = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cols.push({ id: `${i}-${j}`, xM: i * 5, yM: j * 5 });
    const areas = computeGridTributaryAreas(cols);
    // Κεντρική (1-1): half-spacing 2.5 εκατέρωθεν σε X & Y → 5×5.
    expect(areas.get('1-1')).toBeCloseTo(25, 6);
  });

  it('γωνιακή (edge) κολώνα → mirror του εσωτερικού half-spacing (5×5=25 m²)', () => {
    const cols: TributaryColumn[] = [
      { id: 'a', xM: 0, yM: 0 }, { id: 'b', xM: 6, yM: 0 },
      { id: 'c', xM: 0, yM: 4 }, { id: 'd', xM: 6, yM: 4 },
    ];
    const areas = computeGridTributaryAreas(cols);
    // a: X mirror 3+3=6, Y mirror 2+2=4 → 24 m².
    expect(areas.get('a')).toBeCloseTo(24, 6);
  });

  it('μεμονωμένη κολώνα → DEFAULT_BAY_SPAN_M² (κανένας γείτονας)', () => {
    const areas = computeGridTributaryAreas([{ id: 'solo', xM: 10, yM: 10 }]);
    expect(areas.get('solo')).toBeCloseTo(DEFAULT_BAY_SPAN_M * DEFAULT_BAY_SPAN_M, 6);
  });

  it('άνισα ανοίγματα → άθροισμα half-spacings ανά πλευρά', () => {
    // X-άξονες 0,4,10 → η μεσαία (4): 2 + 3 = 5 πλάτος. Y μεμονωμένο → DEFAULT.
    const areas = computeGridTributaryAreas([
      { id: 'l', xM: 0, yM: 0 }, { id: 'm', xM: 4, yM: 0 }, { id: 'r', xM: 10, yM: 0 },
    ]);
    expect(areas.get('m')).toBeCloseTo(5 * DEFAULT_BAY_SPAN_M, 6);
  });
});

describe('areaLoadResultant', () => {
  it('A×n×load ανά συνιστώσα', () => {
    const r = areaLoadResultant(25, 4, 6, 2);
    expect(r.deadAxialKn).toBeCloseTo(25 * 4 * 6, 6); // 600
    expect(r.liveAxialKn).toBeCloseTo(25 * 4 * 2, 6); // 200
  });

  it('μη-έγκυρα/αρνητικά → 0 (μηδέν NaN)', () => {
    expect(areaLoadResultant(-5, 4, 6, 2)).toEqual({ deadAxialKn: 0, liveAxialKn: 0 });
    expect(areaLoadResultant(25, 0, 6, 2)).toEqual({ deadAxialKn: 0, liveAxialKn: 0 });
    expect(areaLoadResultant(25, 4, Number.NaN, 2).liveAxialKn).toBeCloseTo(200, 6);
  });

  it('όροφοι στρογγυλοποιούνται προς τα κάτω (counted storeys)', () => {
    expect(areaLoadResultant(10, 3.9, 5, 0).deadAxialKn).toBeCloseTo(10 * 3 * 5, 6);
  });
});

describe('computeMemberTakedown', () => {
  it('source=takedown, κεντρικό (μηδέν ροπές), + self-weight', () => {
    const load = computeMemberTakedown({
      tributaryAreaM2: 25, storeyCount: 4, deadAreaLoadKpa: 6, liveAreaLoadKpa: 2, extraDeadAxialKn: 50,
    });
    expect(load.source).toBe('takedown');
    expect(load.deadAxialKn).toBeCloseTo(600 + 50, 6);
    expect(load.liveAxialKn).toBeCloseTo(200, 6);
    expect(load.deadMomentXKnm).toBe(0);
    expect(load.deadMomentYKnm).toBe(0);
  });

  it('χωρίς area loads → μηδενικό φορτίο (μόνο τυχόν self-weight)', () => {
    const load = computeMemberTakedown({
      tributaryAreaM2: 25, storeyCount: 4, deadAreaLoadKpa: 0, liveAreaLoadKpa: 0,
    });
    expect(load.deadAxialKn).toBe(0);
    expect(load.liveAxialKn).toBe(0);
  });

  it('toAppliedTakedownLoad κρατά αξονικά + source, παραλείπει ροπές (Firestore-safe)', () => {
    const applied = toAppliedTakedownLoad(computeMemberTakedown({
      tributaryAreaM2: 25, storeyCount: 4, deadAreaLoadKpa: 6, liveAreaLoadKpa: 2,
    }));
    expect(applied.source).toBe('takedown');
    expect(applied).not.toHaveProperty('deadMomentXKnm');
    expect(Object.values(applied)).not.toContain(undefined);
  });
});

describe('isTakedownWritable (manual vs auto)', () => {
  it('absent / μηδενικό / takedown-derived → εγγράψιμο', () => {
    expect(isTakedownWritable(undefined)).toBe(true);
    expect(isTakedownWritable({ deadAxialKn: 0, liveAxialKn: 0 })).toBe(true);
    expect(isTakedownWritable({ deadAxialKn: 600, liveAxialKn: 0, source: 'takedown' })).toBe(true);
  });

  it('χειροκίνητο μη-μηδενικό φορτίο → ΟΧΙ εγγράψιμο (δεν αντικαθίσταται)', () => {
    const manual: AppliedMemberLoad = { deadAxialKn: 800, liveAxialKn: 0, source: 'manual' };
    expect(isTakedownWritable(manual)).toBe(false);
    // legacy χωρίς source αλλά με φορτίο → θεωρείται manual.
    expect(isTakedownWritable({ deadAxialKn: 500, liveAxialKn: 0 })).toBe(false);
  });
});
