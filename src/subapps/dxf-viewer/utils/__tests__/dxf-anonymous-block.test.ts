import { shouldPreserveBlockName, isAnonymousBlockName } from '../dxf-anonymous-block';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import { isBlockEntity, type BlockEntity } from '../../types/entities';
import { expandBlockInstance } from '../../systems/block/block-expander';
import type { AnySceneEntity } from '../../types/scene';

/**
 * ADR-640 M3 — anonymous-block preservation gate.
 *
 * Real AutoCAD drawings reference furniture/symbols through ANONYMOUS blocks (`*U#` dynamic /
 * anonymous, `*A#` array). The pre-M3 gate flattened every `*`-prefixed name, so those blocks
 * broke into loose lines/arcs (repro: μπλοκ+γραμμοσκιαση.dxf INSERT `*U2` @ layer EPIPLA_ON_OFF).
 * These tests pin the SSoT predicate AND the end-to-end scene-builder behaviour on synthetic DXF
 * (no external-file dependency): `*U#` is preserved as a BlockEntity; `*D#`/`*X#` decorations
 * still flatten.
 */

function lines(...pairs: Array<[string | number, string | number]>): string[] {
  return pairs.flatMap(([c, v]) => [String(c), String(v)]);
}

/** Minimal DXF with one BLOCK def (name + a single LINE) and one INSERT of it. */
function sceneWith(blockName: string, insertName = blockName): AnySceneEntity[] {
  const content = [
    ...lines(['0', 'SECTION'], ['2', 'BLOCKS']),
    ...lines(
      ['0', 'BLOCK'], ['2', blockName], ['70', 1], ['10', 0], ['20', 0], ['30', 0],
      ['0', 'LINE'], ['8', 'EPIPLA_ON_OFF'], ['10', 10], ['20', 20], ['11', 30], ['21', 40],
      ['0', 'ENDBLK'],
    ),
    ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'SECTION'], ['2', 'ENTITIES']),
    ...lines(['0', 'INSERT'], ['2', insertName], ['10', 1000], ['20', 2000]),
    ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'EOF']),
  ].join('\n');
  return DxfSceneBuilder.buildScene(content, 'mm').entities;
}

describe('shouldPreserveBlockName (SSoT)', () => {
  it('preserves named blocks', () => {
    expect(shouldPreserveBlockName('CHAIR')).toBe(true);
    expect(shouldPreserveBlockName('_ARCHTICK')).toBe(true);
    expect(shouldPreserveBlockName('NEW00O_BLOCK')).toBe(true);
  });

  it('preserves real-anonymous blocks (*U / *A / *E)', () => {
    expect(shouldPreserveBlockName('*U2')).toBe(true);   // dynamic / anonymous furniture
    expect(shouldPreserveBlockName('*U137')).toBe(true);
    expect(shouldPreserveBlockName('*A5')).toBe(true);    // associative array
    expect(shouldPreserveBlockName('*E1')).toBe(true);    // non-uniform-scaled ref
  });

  it('flattens hatch (*X) and dimension (*D) decorations', () => {
    expect(shouldPreserveBlockName('*X5')).toBe(false);
    expect(shouldPreserveBlockName('*D12')).toBe(false);
    expect(shouldPreserveBlockName('*x5')).toBe(false);   // case-insensitive
    expect(shouldPreserveBlockName('*d12')).toBe(false);
  });

  it('isAnonymousBlockName flags only *-prefixed names', () => {
    expect(isAnonymousBlockName('*U2')).toBe(true);
    expect(isAnonymousBlockName('CHAIR')).toBe(false);
  });
});

describe('scene-builder anonymous-block preservation (end-to-end)', () => {
  it('preserves a *U# anonymous block as a single BlockEntity (the furniture bug)', () => {
    const es = sceneWith('*U2');
    const blocks = es.filter((e) => isBlockEntity(e));
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as BlockEntity).name).toBe('*U2');
    // Its geometry expands from BLOCK-LOCAL to world (placement 1000,2000) — one line, not loose.
    const members = expandBlockInstance(blocks[0] as BlockEntity) as AnySceneEntity[];
    expect(members.filter((m) => m.type === 'line')).toHaveLength(1);
  });

  it('preserves a named block as a BlockEntity', () => {
    const es = sceneWith('CHAIR');
    expect(es.filter((e) => isBlockEntity(e))).toHaveLength(1);
  });

  it('flattens a *D# dimension block to loose entities (no BlockEntity)', () => {
    const es = sceneWith('*D3');
    expect(es.filter((e) => isBlockEntity(e))).toHaveLength(0);
    expect(es.filter((e) => e.type === 'line')).toHaveLength(1); // still drawn, just loose
  });
});
