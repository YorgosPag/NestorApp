/**
 * ADR-531 Φ5b.5 — tests για τον BIM mapper `TekPillarRecord` → `ColumnEntity` (κολώνα / τοιχίο).
 * Δεδομένα από το πραγματικό δείγμα `ΚΟΛΩΝΕΣ_ΤΟΙΧΙΑ.tek` (records id=1 ορθογώνιο, id=2 κυκλικό).
 */

import { tekPillarToColumnEntity } from '../tek-pillar-to-column';
import type { TekPillarRecord } from '../tek-import-types';
import type { TekXMatrix } from '../tek-import-types';

// id=1 δείγματος: ορθογώνιο 1.4×0.4m στο (4.05, 10.25) [κέντρο]· origin=(4.75,10.45) γωνία u=v=0.
const RECT_PILLAR: TekPillarRecord = {
  matrix: { x00: -1.4, x01: 1.7e-16, x10: -4.9e-17, x11: -0.4, x20: 4.75, x21: 10.45 } as TekXMatrix,
  round: false,
  heightM: 3,
  elevationM: 0,
  color: 'FF5A5A',
};

// id=2 δείγματος: κυκλικό Ø0.4m στο (2.35, 9.9)· origin=(2.15,9.7).
const CIRCULAR_PILLAR: TekPillarRecord = {
  matrix: { x00: 0.4, x01: 0, x10: 0, x11: 0.4, x20: 2.15, x21: 9.7 } as TekXMatrix,
  round: true,
  heightM: 3,
  elevationM: 0,
  color: 'FF5A5A',
};

// Συνθετικό επίμηκες τοιχίο 2.0×0.3m (aspect 6.67 > 4 → shear-wall).
const SHEAR_WALL_PILLAR: TekPillarRecord = {
  matrix: { x00: 2.0, x01: 0, x10: 0, x11: 0.3, x20: 0, x21: 0 } as TekXMatrix,
  round: false,
  heightM: 3,
  elevationM: 0,
  color: '008000',
};

describe('tekPillarToColumnEntity (ADR-531 Φ5b.5)', () => {
  it('ορθογώνια κολώνα: kind rectangular + σωστές διαστάσεις/χρώμα (aspect 3.5 ≤ 4)', () => {
    const { column, warnings } = tekPillarToColumnEntity(RECT_PILLAR, 'level-0', 'mm');
    expect(column).not.toBeNull();
    expect(column?.type).toBe('column');
    expect(column?.kind).toBe('rectangular');
    expect(column?.params.width).toBeCloseTo(1400, 1); // |u| 1.4m → 1400mm
    expect(column?.params.depth).toBeCloseTo(400, 1); // |v| 0.4m → 400mm
    expect(column?.params.height).toBeCloseTo(3000, 1); // 3m → 3000mm
    expect(column?.color).toBe('#FF5A5A');
    expect(warnings).toHaveLength(0);
  });

  it('Y-flip: το κέντρο αντιστρέφεται σε canvas Y-down (μέτρα→scene mm)', () => {
    const { column } = tekPillarToColumnEntity(RECT_PILLAR, 'level-0', 'mm');
    expect(column?.params.position.x).toBeCloseTo(4050, 0); // 4.05m → 4050mm
    expect(column?.params.position.y).toBeCloseTo(-10250, 0); // 10.25m Y-up → −10250 canvas Y-down
  });

  it('κυκλική κολώνα: kind circular + width = διάμετρος (Ø0.4m)', () => {
    const { column } = tekPillarToColumnEntity(CIRCULAR_PILLAR, 'level-0', 'mm');
    expect(column?.kind).toBe('circular');
    expect(column?.params.width).toBeCloseTo(400, 1); // Ø 0.4m → 400mm
    expect(column?.params.position.x).toBeCloseTo(2350, 0); // 2.35m
    expect(column?.params.position.y).toBeCloseTo(-9900, 0); // 9.9m → −9900
  });

  it('επίμηκες ορθογώνιο (aspect > 4) → τοιχίο (shear-wall) — EC8 §5.4.2.4', () => {
    const { column } = tekPillarToColumnEntity(SHEAR_WALL_PILLAR, 'level-0', 'mm');
    expect(column?.kind).toBe('shear-wall');
    expect(column?.params.width).toBeCloseTo(2000, 1); // 2.0m → 2000mm
    expect(column?.params.depth).toBeCloseTo(300, 1); // 0.3m → 300mm
  });
});
