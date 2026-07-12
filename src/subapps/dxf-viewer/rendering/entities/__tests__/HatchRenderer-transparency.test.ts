// Stub Firebase auth chain before any imports — BaseEntityRenderer → PhaseManager
// transitively touches firestore in test env (mirror SlabRenderer-hatch.test).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-507 — HatchRenderer per-object transparency (ribbon «Διαφάνεια»).
 *
 * Regression: ο HatchRenderer έχει custom render() που ΔΕΝ περνά από το
 * `BaseEntityRenderer.setupStyle` (όπου εφαρμόζεται το `options.alpha`), οπότε η
 * διαφάνεια αγνοούνταν σιωπηλά ΜΟΝΟ για τη γραμμοσκίαση (browser bug Giorgio 2026-07-12).
 * Επαληθεύει ότι το `options.alpha` πολλαπλασιάζει το `globalAlpha` κατά τη σχεδίαση.
 */

import { HatchRenderer } from '../HatchRenderer';
import type { EntityModel, RenderOptions } from '../../types/Types';

interface MockCtxCall { fn: string; args: readonly unknown[] }

/** Mock 2D ctx με STATEFUL globalAlpha (getter+setter, όπως το πραγματικό canvas → το `*=` δουλεύει). */
function createMockCtx(width = 800, height = 600) {
  const calls: MockCtxCall[] = [];
  let alpha = 1;
  const record = (fn: string) => (...args: unknown[]): unknown => { calls.push({ fn, args }); return undefined; };
  const canvas = {
    width, height, clientWidth: width, clientHeight: height,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0 }),
  };
  const ctx = {
    canvas,
    save: record('save'), restore: record('restore'),
    beginPath: record('beginPath'), moveTo: record('moveTo'), lineTo: record('lineTo'),
    closePath: record('closePath'), clip: record('clip'), fill: record('fill'), stroke: record('stroke'),
    setLineDash: record('setLineDash'), createPattern: () => null,
    get globalAlpha() { return alpha; },
    set globalAlpha(v: number) { alpha = v; calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    set globalCompositeOperation(_v: string) {},
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {}, set lineCap(_v: string) {}, set lineJoin(_v: string) {},
    set shadowBlur(_v: number) {}, set shadowColor(_v: string) {},
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

const SQUARE = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

function solidHatch(): EntityModel {
  return {
    id: 'h', type: 'hatch', visible: true, fillType: 'solid', boundaryPaths: [SQUARE],
  } as unknown as EntityModel;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new HatchRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

function alphaSetsBelow1(calls: readonly MockCtxCall[]): number[] {
  return calls.filter((c) => c.fn === 'set:globalAlpha' && (c.args[0] as number) < 1).map((c) => c.args[0] as number);
}

describe('HatchRenderer — per-object transparency (ADR-507)', () => {
  it('options.alpha=0.5 → globalAlpha πολλαπλασιάζεται στο 0.5 κατά τη σχεδίαση', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(solidHatch(), { alpha: 0.5 } as RenderOptions);
    expect(alphaSetsBelow1(mock.calls)).toContain(0.5);
  });

  it('αδιαφανές (χωρίς alpha) → ΚΑΝΕΝΑ globalAlpha < 1 (μηδέν regression)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(solidHatch(), {} as RenderOptions);
    expect(alphaSetsBelow1(mock.calls)).toHaveLength(0);
  });

  it('alpha=1 (πλήρως αδιαφανές) → δεν αγγίζει το globalAlpha (guard < 1)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(solidHatch(), { alpha: 1 } as RenderOptions);
    expect(alphaSetsBelow1(mock.calls)).toHaveLength(0);
  });
});
