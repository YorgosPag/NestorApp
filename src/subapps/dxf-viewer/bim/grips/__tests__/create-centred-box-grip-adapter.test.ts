/**
 * ADR-602 — centred-box grip **adapter factory** tests.
 *
 * Pins the deduplicated thin-adapter behaviour (the third leg after B2 persistence
 * + B4 placement): the `${prefix}-${role}` kind maps, the role→discriminant-field
 * emit, the drag delegation to the box SSoT, the referential no-op short-circuit,
 * the unknown-kind guard, and the `toBoxParams` / `fromBoxPatch` field bridge. The
 * box GEOMETRY itself is pinned by `centred-box-grips.test.ts`; here we assert only
 * the adapter wiring. `sceneUnits: 'mm'` → scale s = 1, so geometry is exact.
 */

import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  type CentredBoxKind,
} from '../create-centred-box-grip-adapter';
import type { CentredBoxParams } from '../centred-box-grips';
import type {
  ElectricalPanelGripKind,
  MepManifoldGripKind,
  FurnitureGripKind,
} from '../../../hooks/grip-types';

const box: CentredBoxParams = {
  position: { x: 1000, y: 2000, z: 0 },
  rotation: 0,
  width: 600,
  length: 600,
  sceneUnits: 'mm',
};

// ─── buildCentredBoxKindMaps ──────────────────────────────────────────────────

describe('buildCentredBoxKindMaps', () => {
  it('builds `${prefix}-${role}` for all 6 roles', () => {
    const { roleToKind } = buildCentredBoxKindMaps('demo');
    expect(roleToKind).toEqual({
      move: 'demo-move',
      rotation: 'demo-rotation',
      'corner-ne': 'demo-corner-ne',
      'corner-nw': 'demo-corner-nw',
      'corner-sw': 'demo-corner-sw',
      'corner-se': 'demo-corner-se',
    });
  });

  it('kindToRole is the exact inverse (round-trip for every role)', () => {
    const { roleToKind, kindToRole } = buildCentredBoxKindMaps('demo');
    (Object.keys(roleToKind) as (keyof typeof roleToKind)[]).forEach((role) => {
      expect(kindToRole[roleToKind[role]]).toBe(role);
    });
  });
});

// ─── Pure adapter (identity params, real discriminant field) ──────────────────

type PanelEntity = { readonly id: string; readonly params: CentredBoxParams };

const panel = createCentredBoxGripAdapter<
  PanelEntity,
  CentredBoxParams,
  CentredBoxKind<'electrical-panel'>
>({
  ...buildCentredBoxKindMaps('electrical-panel'),
  minDimensionMm: 20,
  toBoxParams: (p) => p,
  fromBoxPatch: (o, patch) => ({ ...o, ...patch }),
  toGripInfo: (base, kind) => ({ ...base, gripKind: { on: 'electrical-panel', kind } }),
});

describe('createCentredBoxGripAdapter — getGrips (pure)', () => {
  const grips = panel.getGrips({ id: 'panel-1', params: box });

  it('emits the 5 box grips wrapped with the entity discriminant field + id', () => {
    expect(grips.map((g) => g.gripKind?.kind)).toEqual([
      'electrical-panel-rotation',
      'electrical-panel-corner-ne',
      'electrical-panel-corner-nw',
      'electrical-panel-corner-sw',
      'electrical-panel-corner-se',
    ]);
    expect(grips.every((g) => g.entityId === 'panel-1')).toBe(true);
  });

  it('carries the box geometry through unchanged (rotation handle on +Y face)', () => {
    const byKind = Object.fromEntries(grips.map((g) => [g.gripKind?.kind, g.position]));
    expect(byKind['electrical-panel-rotation']).toEqual({ x: 1000, y: 2300 });
    expect(byKind['electrical-panel-corner-ne']).toEqual({ x: 1300, y: 2300 });
  });
});

describe('createCentredBoxGripAdapter — applyGripDrag (pure)', () => {
  it('delegates a corner drag to the box SSoT (grows width, pins SW, re-centres)', () => {
    const p = panel.applyGripDrag('electrical-panel-corner-ne', {
      originalParams: box,
      delta: { x: 100, y: 0 },
    });
    expect(p.width).toBe(700);
    expect(p.length).toBe(600);
    expect(p.position).toEqual({ x: 1050, y: 2000, z: 0 });
  });

  it('zero delta → returns originalParams REFERENTIALLY unchanged (commit short-circuit)', () => {
    const p = panel.applyGripDrag('electrical-panel-corner-ne', {
      originalParams: box,
      delta: { x: 0, y: 0 },
    });
    expect(p).toBe(box);
  });
});

// ─── Escape-hatch adapter (superset kind → partial kindToRole guard) ──────────

type ManifoldEntity = { readonly id: string; readonly params: CentredBoxParams };

const manifold = createCentredBoxGripAdapter<
  ManifoldEntity,
  CentredBoxParams,
  MepManifoldGripKind
>({
  ...buildCentredBoxKindMaps('mep-manifold'),
  minDimensionMm: 20,
  toBoxParams: (p) => p,
  fromBoxPatch: (o, patch) => ({ ...o, ...patch }),
  toGripInfo: (base, kind) => ({ ...base, gripKind: { on: 'mep-manifold', kind } }),
});

describe('createCentredBoxGripAdapter — unknown-kind guard', () => {
  it('a kind with no box role (outlet action) → originalParams REFERENTIALLY unchanged', () => {
    const p = manifold.applyGripDrag('mep-manifold-outlet-add', {
      originalParams: box,
      delta: { x: 100, y: 0 },
    });
    expect(p).toBe(box);
  });
});

// ─── Field-remap adapter (differing param field names) ────────────────────────

interface RemapParams {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotationDeg: number;
  readonly widthMm: number;
  readonly depthMm: number;
  readonly sceneUnits: 'mm';
}
type RemapEntity = { readonly id: string; readonly params: RemapParams };

const remap = createCentredBoxGripAdapter<RemapEntity, RemapParams, FurnitureGripKind>({
  ...buildCentredBoxKindMaps('furniture'),
  minDimensionMm: 20,
  toBoxParams: (p) => ({
    position: p.position,
    rotation: p.rotationDeg,
    width: p.widthMm,
    length: p.depthMm,
    sceneUnits: p.sceneUnits,
  }),
  fromBoxPatch: (o, patch) => ({
    ...o,
    position: { x: patch.position.x, y: patch.position.y, z: patch.position.z },
    rotationDeg: patch.rotation,
    widthMm: patch.width,
    depthMm: patch.length,
  }),
  toGripInfo: (base, kind) => ({ ...base, gripKind: { on: 'furniture', kind } }),
});

describe('createCentredBoxGripAdapter — field remap', () => {
  const params: RemapParams = {
    position: { x: 1000, y: 2000, z: 0 },
    rotationDeg: 0,
    widthMm: 600,
    depthMm: 600,
    sceneUnits: 'mm',
  };

  it('emits grips from the bridged box params (remapped field names)', () => {
    const grips = remap.getGrips({ id: 'f-1', params });
    const byKind = Object.fromEntries(grips.map((g) => [g.gripKind?.kind, g.position]));
    expect(byKind['furniture-corner-ne']).toEqual({ x: 1300, y: 2300 });
  });

  it('folds the box patch back onto the entity field names', () => {
    const p = remap.applyGripDrag('furniture-corner-ne', {
      originalParams: params,
      delta: { x: 100, y: 0 },
    });
    expect(p.widthMm).toBe(700);
    expect(p.depthMm).toBe(600);
    expect(p.rotationDeg).toBe(0);
    expect(p.position).toEqual({ x: 1050, y: 2000, z: 0 });
  });
});
