// Stub Firebase auth chain before any imports — BaseEntityRenderer →
// PhaseManager → GripProvider transitively touches firestore in test env.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-449 Slice 4 — BeamRenderer finished-outline unit tests.
 *
 * Επαληθεύει ότι ο 2D renderer ζωγραφίζει τη σοβατισμένη όψη (πλάγιες όψεις) ΜΟΝΟ
 * όταν έχει εγχυθεί per-frame finish index — distinctive signal = plaster flat
 * colour `#e8e0d0` (SSoT). Plus smoke test του builder `buildFinishFacesByBeam`.
 */

import { BeamRenderer } from '../BeamRenderer';
import { buildFinishFacesByBeam } from '../../../canvas-v2/dxf-canvas/dxf-renderer-frame-builders';
import { buildDefaultBeamParams, buildBeamEntity } from '../../../hooks/drawing/beam-completion';
import type { BeamEntity } from '../../types/beam-types';
import type { StructuralFinishFaces, StructuralFinishSpec } from '../../finishes/structural-finish-types';
import type { EntityModel } from '../../../rendering/types/Types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

const PLASTER_HEX = '#e8e0d0';

const FINISH: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

interface MockCtxCall { fn: string; args: readonly unknown[] }

function createMockCtx(width = 800, height = 600) {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => {
    calls.push({ fn, args });
    return undefined;
  };
  const canvas = {
    width, height,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0 }),
  };
  const ctxStub = {
    canvas,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    stroke: record('stroke'),
    fill: record('fill'),
    clip: record('clip'),
    arc: record('arc'),
    fillText: record('fillText'),
    translate: record('translate'),
    rotate: record('rotate'),
    setLineDash: record('setLineDash'),
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set font(v: string) { calls.push({ fn: 'set:font', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'set:textAlign', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'set:textBaseline', args: [v] }); },
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function strokeStyles(calls: readonly MockCtxCall[]): string[] {
  return calls.filter((c) => c.fn === 'set:strokeStyle').map((c) => String(c.args[0]).toLowerCase());
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new BeamRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

function makeBeam(finish?: StructuralFinishSpec): BeamEntity {
  const params = {
    ...buildDefaultBeamParams({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'straight', { width: 250, depth: 500 }),
    // ADR-449 Slice 5 — ρητό override του factory default finish (undefined χωρίς arg).
    finish,
  };
  const res = buildBeamEntity(params, '0');
  if (!res.ok) throw new Error('beam fixture invalid');
  return res.entity;
}

function facesWith(materialId: string, count: number): StructuralFinishFaces {
  const segments = Array.from({ length: count }, (_unused, i) => ({
    a: { x: i * 100, y: 0 },
    b: { x: i * 100 + 100, y: 0 },
    classification: 'interior' as const,
    materialId,
    thickness: 15,
    lengthM: 0.1,
  }));
  return { segments, heightM: 0.5, interiorAreaM2: 0.05 * count, exteriorAreaM2: 0 };
}

describe('BeamRenderer finished outline (ADR-449 Slice 4)', () => {
  it('injected finish faces → ένα plaster stroke ανά segment', () => {
    const { renderer, mock } = makeRenderer();
    const b = makeBeam(FINISH);
    renderer.setBeamFinishFaces(new Map([[b.id, facesWith('mat-plaster-int', 2)]]));
    renderer.render(b as unknown as EntityModel, {});
    expect(strokeStyles(mock.calls).filter((s) => s === PLASTER_HEX)).toHaveLength(2);
  });

  it('κανένα injected index → καμία plaster γραμμή (μόνο πυρήνας)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeBeam(FINISH) as unknown as EntityModel, {});
    expect(strokeStyles(mock.calls)).not.toContain(PLASTER_HEX);
  });

  it('index για ΑΛΛΟ δοκάρι → καμία plaster γραμμή εδώ', () => {
    const { renderer, mock } = makeRenderer();
    const b = makeBeam(FINISH);
    renderer.setBeamFinishFaces(new Map([['beam_other', facesWith('mat-plaster-int', 3)]]));
    renderer.render(b as unknown as EntityModel, {});
    expect(strokeStyles(mock.calls)).not.toContain(PLASTER_HEX);
  });
});

describe('buildFinishFacesByBeam (ADR-449 Slice 4)', () => {
  it('δοκάρι με ενεργό finish → entry με 2 segments (πλάγιες όψεις)', () => {
    const b = makeBeam(FINISH);
    const map = buildFinishFacesByBeam([b] as unknown as DxfEntityUnion[]);
    expect(map.has(b.id)).toBe(true);
    expect(map.get(b.id)!.segments).toHaveLength(2);
  });

  it('δοκάρι χωρίς finish → κενό map (μηδέν κόστος)', () => {
    const map = buildFinishFacesByBeam([makeBeam()] as unknown as DxfEntityUnion[]);
    expect(map.size).toBe(0);
  });
});
