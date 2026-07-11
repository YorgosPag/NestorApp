/**
 * ADR-635 Φάση B — SOLID / 3DFACE / TRACE → HatchEntity(solid) import coverage.
 * Κρίσιμο: bowtie draw-order swap (1→2→4→3) + triangle collapse + 2D projection.
 */
import { convertSolid, convert3dFace, convertTrace, parseQuadVertices } from '../dxf-quad-fill-converter';

type HatchScene = {
  type: string;
  boundaryPaths: Array<Array<{ x: number; y: number }>>;
  fillType?: string;
  patternType?: string;
  color?: string;
};

describe('parseQuadVertices — bowtie swap + triangle collapse (ADR-635 Φάση B)', () => {
  it('γυρίζει τις κορυφές στη σωστή σειρά ζωγραφίσματος 1-2-4-3 (ΟΧΙ 1-2-3-4)', () => {
    const data = { '10': '0', '20': '0', '11': '10', '21': '0', '12': '10', '22': '10', '13': '0', '23': '10' };
    const parsed = parseQuadVertices(data, 'SOLID', 0)!;
    expect(parsed.isTriangle).toBe(false);
    expect(parsed.vertices.map(v => [v.x, v.y])).toEqual([[0, 0], [10, 0], [0, 10], [10, 10]]);
  });

  it('τρίγωνο: 4η κορυφή απούσα → 3 deduped κορυφές, ΟΧΙ 4 με επανάληψη', () => {
    const data = { '10': '0', '20': '0', '11': '10', '21': '0', '12': '5', '22': '10' };
    const parsed = parseQuadVertices(data, '3DFACE', 1)!;
    expect(parsed.isTriangle).toBe(true);
    expect(parsed.vertices).toHaveLength(3);
    expect(parsed.vertices.map(v => [v.x, v.y])).toEqual([[0, 0], [10, 0], [5, 10]]);
  });

  it('τρίγωνο: 4η κορυφή ρητά ίση με 3η (13/23===12/22) → ίδιο με απούσα', () => {
    const data = { '10': '0', '20': '0', '11': '10', '21': '0', '12': '5', '22': '10', '13': '5', '23': '10' };
    const parsed = parseQuadVertices(data, 'TRACE', 2)!;
    expect(parsed.isTriangle).toBe(true);
    expect(parsed.vertices).toHaveLength(3);
  });

  it('NaN guard: λείπουν οι πρώτες κορυφές → null', () => {
    expect(parseQuadVertices({ '10': '0', '20': '0' }, 'SOLID', 3)).toBeNull();
    expect(parseQuadVertices({}, '3DFACE', 4)).toBeNull();
  });
});

describe('convertSolid / convert3dFace / convertTrace — solid fill HatchEntity', () => {
  const quadData = { '10': '0', '20': '0', '11': '10', '21': '0', '12': '10', '22': '10', '13': '0', '23': '10' };

  it('convertSolid: fillType/patternType = solid, boundaryPaths = 1 loop σε σωστό winding', () => {
    const e = convertSolid(quadData, 'L1', 0) as unknown as HatchScene;
    expect(e.type).toBe('hatch');
    expect(e.fillType).toBe('solid');
    expect(e.patternType).toBe('solid');
    expect(e.boundaryPaths).toHaveLength(1);
    expect(e.boundaryPaths[0]).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }]);
  });

  it('convert3dFace: Z (30/31/32/33) αγνοείται στο boundaryPaths (2D projection)', () => {
    const data3d = { ...quadData, '30': '5', '31': '5', '32': '5', '33': '5' };
    const e = convert3dFace(data3d, 'L1', 1) as unknown as HatchScene;
    expect(e.boundaryPaths[0][0]).toEqual({ x: 0, y: 0 });
    expect(Object.keys(e.boundaryPaths[0][0])).toEqual(['x', 'y']);
  });

  it('convertTrace: χρώμα ACI 1 → hex μέσω extractEntityColor SSoT', () => {
    const e = convertTrace({ ...quadData, '62': '1' }, 'L1', 2) as unknown as HatchScene;
    expect(e.color).toBeDefined();
  });

  it('convertSolid: μη-έγκυρες κορυφές → null (δεν πετάει exception)', () => {
    expect(convertSolid({}, 'L1', 3)).toBeNull();
  });
});
