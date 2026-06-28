/**
 * ADR-040 / ADR-537 — DXF overlay idempotency guard. Pure key logic: only the entities
 * the underlay DRAWS (line/circle/arc/polyline/text) + layersById + units affect the key;
 * BIM-wrapper churn (beam/column) and invisible entities must NOT invalidate it.
 */

import type { DxfScene, DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../../types/entities';
import {
  toDxfOverlaySyncKey,
  isSameDxfOverlaySync,
  isSameMultiKey,
} from '../dxf-overlay-sync-guard';

const ent = (id: string, type: string, visible = true): DxfEntityUnion =>
  ({ id, type, visible }) as unknown as DxfEntityUnion;

const scene = (entities: DxfEntityUnion[], extra: Partial<DxfScene> = {}): DxfScene =>
  ({ entities, layers: [], layersById: undefined, bounds: null, units: 'mm', ...extra }) as DxfScene;

describe('toDxfOverlaySyncKey', () => {
  it('null scene → empty key', () => {
    const k = toDxfOverlaySyncKey(null);
    expect(k.drawn).toEqual([]);
    expect(k.units).toBeUndefined();
  });

  it('keeps only drawn entity types, in order', () => {
    const line = ent('l', 'line');
    const beam = ent('b', 'beam');
    const text = ent('t', 'text');
    const k = toDxfOverlaySyncKey(scene([line, beam, text]));
    expect(k.drawn).toEqual([line, text]); // beam excluded
  });

  it('excludes invisible entities (mirrors buildColorGroup)', () => {
    const visible = ent('a', 'line', true);
    const hidden = ent('h', 'line', false);
    const k = toDxfOverlaySyncKey(scene([visible, hidden]));
    expect(k.drawn).toEqual([visible]);
  });
});

describe('isSameDxfOverlaySync', () => {
  it('null previous → never equal', () => {
    expect(isSameDxfOverlaySync(null, toDxfOverlaySyncKey(scene([])))).toBe(false);
  });

  it('two empty scenes → equal', () => {
    expect(isSameDxfOverlaySync(toDxfOverlaySyncKey(null), toDxfOverlaySyncKey(null))).toBe(true);
  });

  it('same drawn entity references → equal', () => {
    const line = ent('l', 'line');
    expect(isSameDxfOverlaySync(
      toDxfOverlaySyncKey(scene([line])),
      toDxfOverlaySyncKey(scene([line])),
    )).toBe(true);
  });

  it('BIM-wrapper churn does NOT invalidate (beam ref changed, lines unchanged)', () => {
    const line = ent('l', 'line');
    const before = toDxfOverlaySyncKey(scene([line, ent('b', 'beam')]));
    const after = toDxfOverlaySyncKey(scene([line, ent('b', 'beam')])); // fresh beam ref
    expect(isSameDxfOverlaySync(before, after)).toBe(true);
  });

  it('changed drawn entity reference → not equal', () => {
    expect(isSameDxfOverlaySync(
      toDxfOverlaySyncKey(scene([ent('l', 'line')])),
      toDxfOverlaySyncKey(scene([ent('l', 'line')])), // different line ref
    )).toBe(false);
  });

  it('different drawn count → not equal', () => {
    const line = ent('l', 'line');
    expect(isSameDxfOverlaySync(
      toDxfOverlaySyncKey(scene([line])),
      toDxfOverlaySyncKey(scene([line, ent('t', 'text')])),
    )).toBe(false);
  });

  it('reorder → not equal', () => {
    const a = ent('a', 'line');
    const b = ent('b', 'line');
    expect(isSameDxfOverlaySync(
      toDxfOverlaySyncKey(scene([a, b])),
      toDxfOverlaySyncKey(scene([b, a])),
    )).toBe(false);
  });

  it('layersById reference change → not equal (ByLayer colour may differ)', () => {
    const line = ent('l', 'line');
    const layers = {} as Record<string, SceneLayer>;
    expect(isSameDxfOverlaySync(
      toDxfOverlaySyncKey(scene([line], { layersById: layers })),
      toDxfOverlaySyncKey(scene([line], { layersById: { ...layers } })),
    )).toBe(false);
  });

  it('units change → not equal', () => {
    const line = ent('l', 'line');
    expect(isSameDxfOverlaySync(
      toDxfOverlaySyncKey(scene([line], { units: 'mm' })),
      toDxfOverlaySyncKey(scene([line], { units: 'm' })),
    )).toBe(false);
  });
});

describe('isSameMultiKey', () => {
  const floor = (entities: DxfEntityUnion[], elev: number) =>
    ({ key: toDxfOverlaySyncKey(scene(entities)), elev });

  it('null previous → not equal', () => {
    expect(isSameMultiKey(null, [floor([ent('l', 'line')], 0)])).toBe(false);
  });

  it('same stack → equal', () => {
    const line = ent('l', 'line');
    expect(isSameMultiKey(
      [floor([line], 0), floor([line], 3000)],
      [floor([line], 0), floor([line], 3000)],
    )).toBe(true);
  });

  it('different elevation → not equal', () => {
    const line = ent('l', 'line');
    expect(isSameMultiKey([floor([line], 0)], [floor([line], 100)])).toBe(false);
  });

  it('different floor count → not equal', () => {
    const line = ent('l', 'line');
    expect(isSameMultiKey([floor([line], 0)], [floor([line], 0), floor([line], 3000)])).toBe(false);
  });

  it('changed floor content → not equal', () => {
    expect(isSameMultiKey(
      [floor([ent('l', 'line')], 0)],
      [floor([ent('l', 'line')], 0)], // fresh line ref
    )).toBe(false);
  });
});
