/**
 * DXF BLOCK instance Roundtrip — ADR-640 M2.
 *
 * Αποδεικνύει ότι ένα first-class `BlockEntity` (M1 import: named single INSERT → container)
 * ΞΑΝΑ-εξάγεται ώς AutoCAD/Revit convention:
 *   1. ENTITIES: ένα `INSERT` (2=name, 10/20=θέση, 41/42=scale, 50=rotation),
 *   2. BLOCKS: ΜΙΑ named `BLOCK … ENDBLK` ανά distinct `name` (dedup — πολλά instances, ένας ορισμός),
 *      με τα members σε BLOCK-LOCAL coords @ base (0,0).
 * Και ότι το full re-import (`DxfSceneBuilder.buildScene`) ανακτά ισοδύναμο block
 * (name/placement/geometry idempotent) — ο στόχος «το έπιπλο επιβιώνει ως ΕΝΑ INSERT».
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { DxfSceneBuilder } from '../../../utils/dxf-scene-builder';
import { isBlockEntity, type BlockEntity, type Entity } from '../../../types/entities';
import { expandBlockInstance } from '../../../systems/block/block-expander';

const LAYERS = { L: { name: 'BLKLAYER' } };

/** A block-local LINE member (stored relative to base (0,0), the M1 convention). */
function memberLine(id: string, sx: number, sy: number, ex: number, ey: number): Entity {
  return { id, type: 'line', layerId: 'L', start: { x: sx, y: sy }, end: { x: ex, y: ey } } as unknown as Entity;
}

/** Build a first-class BlockEntity with two local members + a placement transform. */
function block(over: Partial<BlockEntity> = {}): BlockEntity {
  return {
    id: 'blk1', type: 'block', name: 'TESTBLK', layerId: 'L', visible: true,
    position: { x: 1000, y: 2000 }, scale: { x: 1, y: 1 }, rotation: 0,
    entities: [memberLine('m0', 0, 0, 10, 0), memberLine('m1', 0, 0, 0, 10)],
    ...over,
  } as BlockEntity;
}

/** Flatten the writer's code/value stream and collect the first entity record of a given DXF type. */
function firstRecord(dxf: string, dxfType: string): Record<string, string> | null {
  const t = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < t.length - 1; i += 2) {
    if (t[i] === '0' && t[i + 1] === dxfType) { start = i + 2; break; }
  }
  if (start < 0) return null;
  const data: Record<string, string> = {};
  for (let i = start; i < t.length - 1; i += 2) {
    if (t[i] === '0') break;
    data[t[i]] = t[i + 1];
  }
  return data;
}

/** Count `0/<type>` markers in the writer output. */
function countMarkers(dxf: string, dxfType: string): number {
  const t = dxf.split('\n');
  let n = 0;
  for (let i = 0; i < t.length - 1; i += 2) if (t[i] === '0' && t[i + 1] === dxfType) n++;
  return n;
}

describe('writeDxfAscii — BLOCK instance → INSERT (ADR-640 M2)', () => {
  it('εκπέμπει INSERT με 2=name, 10/20=θέση, 41/42=scale, 50=rotation', () => {
    const ins = firstRecord(writeDxfAscii([block()], { layersById: LAYERS }), 'INSERT');
    expect(ins).not.toBeNull();
    expect(ins!['2']).toBe('TESTBLK');
    expect(ins!['8']).toBe('BLKLAYER');
    expect(ins!['10']).toBe('1000');
    expect(ins!['20']).toBe('2000');
    expect(ins!['41']).toBe('1');
    expect(ins!['42']).toBe('1');
    expect(ins!['50']).toBe('0');
  });

  it('κλιμακώνει τη θέση (10/20) με το coordinate scale, ΟΧΙ τα scale-factors (41/42)', () => {
    const ins = firstRecord(writeDxfAscii([block({ scale: { x: 2, y: 3 } })], { layersById: LAYERS, scale: 2 }), 'INSERT')!;
    expect(ins['10']).toBe('2000'); // 1000 × 2
    expect(ins['20']).toBe('4000'); // 2000 × 2
    expect(ins['41']).toBe('2');     // dimensionless — unscaled
    expect(ins['42']).toBe('3');
  });

  it('εκπέμπει μία named BLOCK definition (base 0,0) με τα local members', () => {
    const dxf = writeDxfAscii([block()], { layersById: LAYERS });
    const def = firstRecord(dxf, 'BLOCK');
    expect(def).not.toBeNull();
    expect(def!['2']).toBe('TESTBLK');
    expect(def!['70']).toBe('0');   // named, non-anonymous
    expect(def!['10']).toBe('0');   // base @ origin (M1 baked)
    expect(def!['20']).toBe('0');
    expect(countMarkers(dxf, 'ENDBLK')).toBe(1);
    // δύο LINE members ζουν μέσα στο BLOCK…ENDBLK
    expect(countMarkers(dxf, 'LINE')).toBe(2);
  });

  it('ADR-640 M3 — anonymous *U# block βγαίνει με flag 70=1 και round-trip-άρει ως block', () => {
    const anon = block({ name: '*U2' });
    const dxf = writeDxfAscii([anon], { layersById: LAYERS });
    const def = firstRecord(dxf, 'BLOCK')!;
    expect(def['2']).toBe('*U2');
    expect(def['70']).toBe('1'); // 1 = anonymous
    // full re-import keeps it a single BlockEntity (not flattened to loose lines)
    const scene = DxfSceneBuilder.buildScene(dxf, 'mm').entities;
    expect(scene.filter(isBlockEntity)).toHaveLength(1);
    expect(scene.filter(isBlockEntity)[0].name).toBe('*U2');
  });

  it('dedup: δύο instances του ΙΔΙΟΥ name → ΜΙΑ BLOCK definition, δύο INSERT', () => {
    const a = block({ id: 'a', position: { x: 0, y: 0 } });
    const b = block({ id: 'b', position: { x: 500, y: 500 } });
    const dxf = writeDxfAscii([a, b], { layersById: LAYERS });
    expect(countMarkers(dxf, 'INSERT')).toBe(2);
    expect(countMarkers(dxf, 'BLOCK')).toBe(1);
    expect(countMarkers(dxf, 'ENDBLK')).toBe(1);
  });

  it('BLOCKS section βγαίνει ΠΡΙΝ τα ENTITIES (σωστή DXF σειρά)', () => {
    const dxf = writeDxfAscii([block()], { layersById: LAYERS });
    expect(dxf.indexOf('2\nBLOCKS')).toBeGreaterThanOrEqual(0);
    expect(dxf.indexOf('2\nBLOCKS')).toBeLessThan(dxf.indexOf('2\nENTITIES'));
  });

  it('χωρίς block/dimension → καμία BLOCKS section (zero regression)', () => {
    const line = memberLine('l', 0, 0, 1, 1);
    const dxf = writeDxfAscii([line], { layersById: LAYERS });
    expect(dxf).not.toContain('2\nBLOCKS');
  });
});

describe('writeDxfAscii → DxfSceneBuilder — full block round-trip (ADR-640 M2)', () => {
  it('re-import ανακτά ισοδύναμο BlockEntity (name/θέση/scale/rotation + member count)', () => {
    const dxf = writeDxfAscii([block()], { layersById: LAYERS });
    const scene = DxfSceneBuilder.buildScene(dxf, 'mm').entities;
    const blocks = scene.filter(isBlockEntity);
    expect(blocks).toHaveLength(1);
    const b = blocks[0];
    expect(b.name).toBe('TESTBLK');
    expect(b.position.x).toBeCloseTo(1000, 3);
    expect(b.position.y).toBeCloseTo(2000, 3);
    expect(b.scale.x).toBeCloseTo(1, 3);
    expect(b.scale.y).toBeCloseTo(1, 3);
    expect(b.rotation).toBeCloseTo(0, 3);
    expect(b.entities).toHaveLength(2);
  });

  it('re-import διατηρεί scale + rotation (2,3 @ 45°)', () => {
    const dxf = writeDxfAscii([block({ scale: { x: 2, y: 3 }, rotation: 45 })], { layersById: LAYERS });
    const b = DxfSceneBuilder.buildScene(dxf, 'mm').entities.filter(isBlockEntity)[0];
    expect(b.scale.x).toBeCloseTo(2, 3);
    expect(b.scale.y).toBeCloseTo(3, 3);
    expect(b.rotation).toBeCloseTo(45, 3);
  });

  it('το έπιπλο επιβιώνει ως ΕΝΑ block (όχι exploded loose lines)', () => {
    const dxf = writeDxfAscii([block()], { layersById: LAYERS });
    const scene = DxfSceneBuilder.buildScene(dxf, 'mm').entities;
    expect(scene.filter(isBlockEntity)).toHaveLength(1);
    expect(scene.filter((e) => e.type === 'line')).toHaveLength(0); // members live INSIDE the block
  });

  it('expand μετά το round-trip τοποθετεί τα members στο world (position + local)', () => {
    const dxf = writeDxfAscii([block()], { layersById: LAYERS });
    const b = DxfSceneBuilder.buildScene(dxf, 'mm').entities.filter(isBlockEntity)[0];
    const world = expandBlockInstance(b) as unknown as Array<{ type: string; start: { x: number; y: number } }>;
    const starts = world.filter((e) => e.type === 'line').map((e) => e.start);
    // scale 1, rot 0, position (1000,2000): local (0,0) → world (1000,2000)
    expect(starts.some((p) => Math.abs(p.x - 1000) < 1e-6 && Math.abs(p.y - 2000) < 1e-6)).toBe(true);
  });
});
