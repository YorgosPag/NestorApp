/**
 * ADR-456 §3.3 — mapColumn shape-aware BOQ regression lock.
 *
 * Ο `mapColumn` περνά `resolveColumnReinforcementSection(p)` στον υπολογισμό ποσοτήτων, ώστε μια
 * μη-ορθογωνική κολώνα (Γ/Τ/Π/κυκλική/τοίχωμα) να αναφέρει το ΣΩΣΤΟ σχήμα βάρους χάλυβα — ΟΧΙ το
 * ορθογωνικό ισοδύναμο (ο παραπλανητικός bug πριν το fix). Ταυτόχρονα: η ορθογωνική περνά από το
 * ίδιο rect fast-path → μηδέν regression.
 */

import { mapColumn } from '../schedule-preset-mappers';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';
import type { ColumnReinforcement } from '../../structural/reinforcement/column-reinforcement-types';
import type { ScheduleLookups } from '../types';

const lookups: ScheduleLookups = {
  floor: (id) => (id ? `Όροφος ${id}` : ''),
  material: (id) => (id ? `Υλικό:${id}` : ''),
  floorFinish: () => undefined,
};

const REINF: ColumnReinforcement = {
  longitudinal: { diameterMm: 16, count: 8 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
  coverMm: 30,
};

function bbox(x: number, y: number) {
  return { min: { x: 0, y: 0 }, max: { x, y } };
}

/** Κολώνα με οπλισμό· `kind` (+ width/depth) καθορίζει το σχήμα διατομής. */
function makeColumn(kind: ColumnParams['kind'], width: number, depth: number): ColumnEntity {
  const area = (width / 1000) * (depth / 1000); // m² (bbox — αρκεί για grossArea/ratio)
  return {
    id: `c-${kind}`,
    type: 'column',
    kind,
    floorId: 'floor-1',
    params: {
      kind,
      position: { x: 0, y: 0, z: 0 },
      anchor: 'center',
      width,
      depth,
      height: 3000,
      rotation: 0,
      sceneUnits: 'mm',
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
      reinforcement: REINF,
    },
    geometry: {
      footprint: { vertices: [] },
      bbox: bbox(width, depth),
      area,
      volume: area * 3,
      height: 3000,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

describe('mapColumn — shape-aware steel weight (ADR-456 §3.3)', () => {
  it('non-rectangular (Γ) column reports a DIFFERENT steel weight than the rectangular equivalent bbox', () => {
    const rectW = mapColumn(makeColumn('rectangular', 600, 600), lookups).steelWeight as number;
    const lW = mapColumn(makeColumn('L-shape', 600, 600), lookups).steelWeight as number;
    expect(typeof rectW).toBe('number');
    expect(typeof lW).toBe('number');
    expect(rectW).toBeGreaterThan(0);
    expect(lW).toBeGreaterThan(0);
    // Το κλειδί του fix: το σχήμα Γ ΔΕΝ αναφέρει το ορθογωνικό βάρος (πριν → ίδιο νούμερο, παραπλανητικό).
    expect(lW).not.toBeCloseTo(rectW, 1);
  });

  it('shear-wall column reports a DIFFERENT (larger detailing) steel weight than the rectangular bbox', () => {
    const rectW = mapColumn(makeColumn('rectangular', 2000, 250), lookups).steelWeight as number;
    const wallW = mapColumn(makeColumn('shear-wall', 2000, 250), lookups).steelWeight as number;
    expect(wallW).toBeGreaterThan(0);
    // Το τοίχωμα έχει boundary hoops + web bars → σαφώς διαφορετικό από ένα σκέτο ορθογωνικό στεφάνι.
    expect(wallW).not.toBeCloseTo(rectW, 1);
  });

  it('rectangular column still yields the label + a positive weight (zero regression)', () => {
    const cells = mapColumn(makeColumn('rectangular', 400, 400), lookups);
    expect(cells.longitudinalRebar).toBe('8Ø16');
    expect(cells.stirrups).toBe('Ø8/100-200');
    expect(cells.steelWeight as number).toBeGreaterThan(0);
  });

  it('column without reinforcement → null steel weight (no crash)', () => {
    const col = makeColumn('rectangular', 400, 400);
    const noReinf = {
      ...col,
      params: { ...col.params, reinforcement: undefined },
    } as unknown as ColumnEntity;
    const cells = mapColumn(noReinf, lookups);
    expect(cells.steelWeight).toBeNull();
    expect(cells.longitudinalRebar).toBeNull();
  });
});
