import { DxfSceneBuilder } from '../dxf-scene-builder';
import { extractEntityColor } from '../dxf-converter-helpers';
import type { AnySceneEntity } from '../../types/scene';
import { isBlockEntity, type BlockEntity } from '../../types/entities';
import { expandBlockInstance } from '../../systems/block/block-expander';

/**
 * ADR-635 Φ2 + ADR-640 — INSERT/BLOCK expansion.
 *
 * Proves block references are placed with the DXF transform
 *   p_world = insertPoint + Rot(angle)·Scale(sx,sy)·(p_block − base)
 * instead of block-definition geometry leaking at its authored coordinates (the ~360m-away bug).
 *
 * ADR-640 — a NAMED, single INSERT is now PRESERVED as a first-class `BlockEntity` (not flattened),
 * so these tests expand the block to its world-space members (`flat()`) before asserting geometry.
 * The placement math is byte-identical to the legacy flatten path (shared `applyBlockTransformGeometry`).
 * MINSERT arrays and unknown blocks still take the flatten/no-op path.
 */

function lines(...pairs: Array<[string | number, string | number]>): string[] {
  return pairs.flatMap(([c, v]) => [String(c), String(v)]);
}

/** Build a minimal DXF (mm units, scale factor 1), then EXPAND any preserved block instance to its
 * world-space members — so geometry assertions see the same primitives the canvas renders. */
function build(blocks: string[], entities: string[]): AnySceneEntity[] {
  const content = [
    ...lines(['0', 'SECTION'], ['2', 'BLOCKS']), ...blocks, ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'SECTION'], ['2', 'ENTITIES']), ...entities, ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'EOF']),
  ].join('\n');
  const es = DxfSceneBuilder.buildScene(content, 'mm').entities;
  return es.flatMap((e) => (isBlockEntity(e) ? (expandBlockInstance(e as BlockEntity) as AnySceneEntity[]) : [e]));
}

const blockLine = (name: string, base: [number, number], seg: [number, number, number, number]): string[] =>
  lines(
    ['0', 'BLOCK'], ['2', name], ['10', base[0]], ['20', base[1]], ['30', 0],
    ['0', 'LINE'], ['8', '0'], ['10', seg[0]], ['20', seg[1]], ['11', seg[2]], ['21', seg[3]],
    ['0', 'ENDBLK'],
  );

const lineOf = (es: AnySceneEntity[]): { start: { x: number; y: number }; end: { x: number; y: number } } =>
  es.find(e => e.type === 'line') as unknown as { start: { x: number; y: number }; end: { x: number; y: number } };

const approx = (a: number, b: number) => expect(a).toBeCloseTo(b, 3);

describe('INSERT expansion', () => {
  it('places block geometry at insert + (geom - base)', () => {
    const es = build(
      blockLine('B', [0, 0], [100, 200, 110, 210]),
      lines(['0', 'INSERT'], ['2', 'B'], ['10', 1000], ['20', 2000]),
    );
    const ls = es.filter(e => e.type === 'line');
    expect(ls).toHaveLength(1);
    const l = lineOf(es);
    approx(l.start.x, 1100); approx(l.start.y, 2200);
    approx(l.end.x, 1110); approx(l.end.y, 2210);
  });

  it('does NOT emit block-definition geometry standalone (no leak)', () => {
    // Block authored far away (+363619) but never re-placed near origin unless via INSERT.
    const es = build(
      blockLine('FAR', [0, 0], [363619, 89583, 363620, 89584]),
      lines(['0', 'INSERT'], ['2', 'FAR'], ['10', -346494], ['20', -85488]),
    );
    const l = lineOf(es);
    approx(l.start.x, 17125); approx(l.start.y, 4095); // cancels back to the drawing
  });

  it('applies scale and rotation about the base point', () => {
    // line (10,0)-(20,0), scale 2 → (20,0)-(40,0), rot 90° CCW → (0,20)-(0,40), +insert(100,100)
    const es = build(
      blockLine('B', [0, 0], [10, 0, 20, 0]),
      lines(['0', 'INSERT'], ['2', 'B'], ['10', 100], ['20', 100], ['41', 2], ['42', 2], ['50', 90]),
    );
    const l = lineOf(es);
    approx(l.start.x, 100); approx(l.start.y, 120);
    approx(l.end.x, 100); approx(l.end.y, 140);
  });

  it('expands nested INSERT (block referencing a block)', () => {
    const inner = blockLine('INNER', [0, 0], [1, 0, 2, 0]);
    const outer = lines(
      ['0', 'BLOCK'], ['2', 'OUTER'], ['10', 0], ['20', 0], ['30', 0],
      ['0', 'INSERT'], ['2', 'INNER'], ['10', 10], ['20', 0],
      ['0', 'ENDBLK'],
    );
    const es = build([...inner, ...outer], lines(['0', 'INSERT'], ['2', 'OUTER'], ['10', 100], ['20', 0]));
    const l = lineOf(es);
    approx(l.start.x, 111); approx(l.start.y, 0); // 1 + 10 + 100
    approx(l.end.x, 112);
  });

  it('expands a MINSERT 2×2 array with column/row spacing', () => {
    const es = build(
      blockLine('B', [0, 0], [0, 0, 1, 0]),
      lines(['0', 'INSERT'], ['2', 'B'], ['10', 0], ['20', 0],
        ['70', 2], ['71', 2], ['44', 1000], ['45', 2000]),
    );
    const starts = es.filter(e => e.type === 'line')
      .map(e => (e as unknown as { start: { x: number; y: number } }).start);
    expect(starts).toHaveLength(4);
    // cells at (0,0),(1000,0),(0,2000),(1000,2000)
    const has = (x: number, y: number) => starts.some(s => Math.abs(s.x - x) < 1e-6 && Math.abs(s.y - y) < 1e-6);
    expect(has(0, 0)).toBe(true);
    expect(has(1000, 0)).toBe(true);
    expect(has(0, 2000)).toBe(true);
    expect(has(1000, 2000)).toBe(true);
  });

  it('ignores INSERT of an unknown block (no crash, no entities)', () => {
    const es = build([], lines(['0', 'INSERT'], ['2', 'NOPE'], ['10', 5], ['20', 5]));
    expect(es.filter(e => e.type === 'line')).toHaveLength(0);
  });
});

describe('INSERT BYBLOCK color inheritance (ADR-635 Φ C.2)', () => {
  // Block line drawn with an explicit color code (62) so we can exercise BYBLOCK (0) vs explicit.
  const coloredBlockLine = (name: string, colorCode: number): string[] =>
    lines(
      ['0', 'BLOCK'], ['2', name], ['10', 0], ['20', 0], ['30', 0],
      ['0', 'LINE'], ['8', '0'], ['62', colorCode], ['10', 0], ['20', 0], ['11', 1], ['21', 0],
      ['0', 'ENDBLK'],
    );

  it('BYBLOCK child inherits the INSERT explicit color', () => {
    const es = build(
      coloredBlockLine('B', 0), // child color = BYBLOCK
      lines(['0', 'INSERT'], ['2', 'B'], ['10', 0], ['20', 0], ['62', 1]), // INSERT color = ACI 1
    );
    const l = es.find(e => e.type === 'line') as AnySceneEntity;
    expect(l.color).toBe(extractEntityColor({ '62': '1' }));
  });

  it('non-BYBLOCK child keeps its OWN color, ignoring the INSERT color', () => {
    const es = build(
      coloredBlockLine('B', 2), // child color = ACI 2 (explicit)
      lines(['0', 'INSERT'], ['2', 'B'], ['10', 0], ['20', 0], ['62', 1]),
    );
    const l = es.find(e => e.type === 'line') as AnySceneEntity;
    expect(l.color).toBe(extractEntityColor({ '62': '2' }));
  });

  it('BYBLOCK child + BYLAYER INSERT (no explicit color) → falls through to layer (no bogus inherit)', () => {
    // With no explicit INSERT color there is nothing to inherit: the child must resolve exactly
    // like a plain BYLAYER child, NOT pick up a stray color. Compare against a BYLAYER reference.
    const byBlock = build(
      coloredBlockLine('B', 0), // child color = BYBLOCK
      lines(['0', 'INSERT'], ['2', 'B'], ['10', 0], ['20', 0]), // INSERT has no explicit color
    );
    const byLayerRef = build(
      blockLine('R', [0, 0], [0, 0, 1, 0]), // plain child, no color code (BYLAYER)
      lines(['0', 'INSERT'], ['2', 'R'], ['10', 0], ['20', 0]),
    );
    const l = byBlock.find(e => e.type === 'line') as AnySceneEntity;
    const ref = byLayerRef.find(e => e.type === 'line') as AnySceneEntity;
    expect(l.color).toBe(ref.color);
  });
});
