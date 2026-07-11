/**
 * ADR-635 Φ C.7 — MLINESTYLE (OBJECTS section) reader + end-to-end MLINE expansion.
 *
 *  - `buildMlineStyleMap`: ordered scan of the OBJECTS section (repeated 49/62/6 survive),
 *    keyed by BOTH style name (2) and handle (5); fill-colour 62 before the first 49 ignored.
 *  - `DxfSceneBuilder.buildScene`: an MLINE draws its N parallel element polylines (one group),
 *    or STANDARD (±0.5) when there is no OBJECTS/MLINESTYLE.
 */
import { buildMlineStyleMap } from '../dxf-mline-style-parser';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import type { AnySceneEntity } from '../../types/scene';

/** Build the trimmed line array from a code/value list. */
function lines(...cv: Array<[string | number, string | number]>): string[] {
  return cv.flatMap(([c, v]) => [String(c), String(v)]);
}
function content(...cv: Array<[string | number, string | number]>): string {
  return lines(...cv).join('\n');
}

const OBJECTS_WITH_WALL: Array<[string | number, string | number]> = [
  ['0', 'SECTION'], ['2', 'OBJECTS'],
  ['0', 'MLINESTYLE'],
  ['5', 'A1'],
  ['330', '1F'],
  ['100', 'AcDbMlineStyle'],
  ['2', 'WALL'],
  ['70', '0'],
  ['3', ''],
  ['62', '256'],   // fill colour — BEFORE first 49 ⇒ ignored
  ['71', '2'],     // element count — ignored (structural)
  ['49', '0.5'], ['62', '1'], ['6', 'BYLAYER'],
  ['49', '-0.5'], ['62', '2'], ['6', 'BYLAYER'],
  ['0', 'ENDSEC'],
];

describe('buildMlineStyleMap — OBJECTS-section MLINESTYLE reader', () => {
  it('parse-άρει elements (offset 49 + ACI 62), κλειδί name ΚΑΙ handle', () => {
    const map = buildMlineStyleMap(lines(...OBJECTS_WITH_WALL, ['0', 'EOF']));
    const byName = map.get('WALL');
    const byHandle = map.get('A1');
    expect(byName).toBeDefined();
    expect(byHandle).toBe(byName); // ίδιο def object και για τα δύο κλειδιά
    expect(byName!.elements).toEqual([
      { offset: 0.5, aci: '1' },
      { offset: -0.5, aci: '2' },
    ]);
  });

  it('αγνοεί το fill-colour 62 ΠΡΙΝ το πρώτο 49 (δεν γίνεται element)', () => {
    const map = buildMlineStyleMap(lines(...OBJECTS_WITH_WALL, ['0', 'EOF']));
    expect(map.get('WALL')!.elements).toHaveLength(2);
  });

  it('κενό map όταν δεν υπάρχει OBJECTS section', () => {
    const map = buildMlineStyleMap(lines(
      ['0', 'SECTION'], ['2', 'ENTITIES'], ['0', 'ENDSEC'], ['0', 'EOF'],
    ));
    expect(map.size).toBe(0);
  });
});

function mlineEntities(dxf: string): AnySceneEntity[] {
  return DxfSceneBuilder.buildScene(dxf).entities.filter(e => e.type === 'polyline');
}

describe('DxfSceneBuilder — MLINE → N element polylines (end-to-end)', () => {
  it('MLINE με MLINESTYLE → 2 παράλληλες polylines στα σωστά offsets, κοινό groupId', () => {
    const dxf = content(
      ['0', 'SECTION'], ['2', 'ENTITIES'],
      ['0', 'MLINE'], ['8', '0'], ['2', 'WALL'], ['340', 'A1'],
      ['40', '1'], ['70', '1'], ['71', '2'],
      ['11', '0'], ['21', '0'], ['11', '100'], ['21', '0'],
      ['0', 'ENDSEC'],
      ...OBJECTS_WITH_WALL,
      ['0', 'EOF'],
    );
    const polys = mlineEntities(dxf) as unknown as Array<{
      groupId?: string; vertices: Array<{ x: number; y: number }>;
    }>;
    expect(polys).toHaveLength(2);
    // Symmetric ±offset (magnitude carries the import unit-scale — irrelevant to C.7).
    const ys = polys.map(p => p.vertices[0].y).sort((a, b) => a - b);
    expect(ys[0]).toBeLessThan(0);
    expect(ys[1]).toBeGreaterThan(0);
    expect(ys[0]).toBeCloseTo(-ys[1]);
    expect(polys[0].groupId).toBe(polys[1].groupId);
    expect(polys[0].groupId).toBeTruthy();
  });

  it('MLINE χωρίς OBJECTS/MLINESTYLE → STANDARD default (2 γραμμές)', () => {
    const dxf = content(
      ['0', 'SECTION'], ['2', 'ENTITIES'],
      ['0', 'MLINE'], ['8', '0'], ['40', '1'], ['70', '1'],
      ['11', '0'], ['21', '0'], ['11', '50'], ['21', '0'],
      ['0', 'ENDSEC'], ['0', 'EOF'],
    );
    const polys = mlineEntities(dxf) as unknown as Array<{ vertices: Array<{ y: number }> }>;
    expect(polys).toHaveLength(2);
    const ys = polys.map(p => p.vertices[0].y).sort((a, b) => a - b);
    expect(ys[0]).toBeLessThan(0);
    expect(ys[1]).toBeGreaterThan(0);
    expect(ys[0]).toBeCloseTo(-ys[1]); // STANDARD ±0.5 (× import unit-scale)
  });
});
