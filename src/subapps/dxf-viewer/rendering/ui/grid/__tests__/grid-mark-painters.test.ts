/**
 * 🔵 DOT & CROSS GRID — ADR-681 §5.9 regression anchors.
 *
 * The lines got the adaptive cascade in §5-§5.8; dots and crosses did not, and
 * kept a raw `settings.size * transform.scale` step. Two consequences, both
 * pinned here:
 *
 *  1. no cascade — zoom out and the marks densify without bound (measured
 *     2026-07-20: 8.3×10⁸ marks/frame at scale 0.005, ~2×10¹⁰ at MIN_SCALE,
 *     with the `minVisibleSize` brake shipped disabled at 0);
 *  2. a path+fill PER MARK, so even a survivable count cost far more than it
 *     needed to.
 *
 * The fix routes both styles through the SAME `renderAdaptiveGrid` the lines
 * use. So the continuity maths is already pinned by `grid-adaptive.test.ts` and
 * is deliberately NOT re-asserted here. What is new — and therefore what this
 * file pins — is that the renderer actually calls that mechanism, that emphasis
 * survives the translation from stroke weight to mark SIZE, and that a pass
 * costs one draw call rather than N.
 *
 * @see ../grid-mark-painters.ts
 * @see ../GridRenderer.ts
 */
import {
  paintDotMarks,
  paintCrossMarks,
  dotRadii,
  crossArms,
  type GridMarkLattice,
} from '../grid-mark-painters';
import { GridRenderer } from '../GridRenderer';
import { DEFAULT_GRID_SETTINGS } from '../GridTypes';
import { computeAdaptiveLevels } from '../grid-adaptive';
import type { GridSettings } from '../GridTypes';
import type { Viewport } from '../../../types/Types';

const VIEWPORT = { width: 800, height: 600 } as Viewport;

interface RecordedCall {
  readonly op: string;
  readonly args: readonly number[];
  readonly fillStyle: string;
  readonly strokeStyle: string;
  readonly lineWidth: number;
  readonly globalAlpha: number;
}

/** Canvas double that records the op stream plus the style live at each op. */
function recordingCtx(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const state = { fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1 };
  const record = (op: string) => (...args: number[]) => {
    calls.push({ op, args, ...state });
  };
  const ctx = {
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v: string) { state.fillStyle = v; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v: string) { state.strokeStyle = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v: number) { state.lineWidth = v; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v: number) { state.globalAlpha = v; },
    beginPath: record('beginPath'),
    fill: record('fill'),
    stroke: record('stroke'),
    ellipse: record('ellipse'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    save: record('save'),
    restore: record('restore'),
    fillText: record('fillText'),
    font: '',
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

function lattice(spacingPx: number): GridMarkLattice {
  return { viewport: VIEWPORT, originScreenX: 0, originScreenY: 0, spacingPx };
}

const count = (calls: readonly RecordedCall[], op: string): number =>
  calls.filter((c) => c.op === op).length;

// ─── Batching ───────────────────────────────────────────────────────────────

describe('grid mark painters — one draw call per pass, not per mark', () => {
  it('draws N dots with exactly one beginPath and one fill', () => {
    const { ctx, calls } = recordingCtx();
    paintDotMarks(ctx, lattice(40), 1.5);

    // Count net FIRST: without it, a painter that drew nothing at all would
    // satisfy both call-count assertions vacuously (ADR-681 §5.1 lesson 1).
    const marks = count(calls, 'ellipse');
    expect(marks).toBe(21 * 16); // ⌊800/40⌋+1 × ⌊600/40⌋+1
    expect(count(calls, 'beginPath')).toBe(1);
    expect(count(calls, 'fill')).toBe(1);
  });

  it('draws N crosses with exactly one beginPath and one stroke', () => {
    const { ctx, calls } = recordingCtx();
    paintCrossMarks(ctx, lattice(40), 3);

    const marks = count(calls, 'moveTo');
    expect(marks).toBe(21 * 16 * 2); // two strokes (— and |) per cross
    expect(count(calls, 'lineTo')).toBe(marks);
    expect(count(calls, 'beginPath')).toBe(1);
    expect(count(calls, 'stroke')).toBe(1);
  });

  it('starts a fresh subpath before every dot — batching must not fuse them', () => {
    // THE §5.9 REGRESSION, pinned. `ellipse()` appends to the current subpath,
    // so inside one batched path N circles silently become ONE self-intersecting
    // snake and the nonzero fill rule cancels most of it → blank grid. Harmless
    // while each dot had its own `beginPath()`; fatal the moment they share one.
    //
    // It shipped because the anchors above count CALLS and never modelled path
    // CONNECTIVITY — they stayed green on a renderer that drew nothing visible.
    // Crosses and lines were immune only because both already emit `moveTo` per
    // mark, which is exactly why dots were the sole broken style.
    const { ctx, calls } = recordingCtx();
    paintDotMarks(ctx, lattice(40), 1.5);

    const ellipses = calls.filter((c) => c.op === 'ellipse');
    expect(ellipses).toHaveLength(21 * 16); // the anchor has a subject
    calls.forEach((c, i) => {
      if (c.op !== 'ellipse') return;
      expect(calls[i - 1].op).toBe('moveTo');
    });
  });

  it('refuses to walk a lattice too dense to terminate', () => {
    // The freeze guard. At MIN_SCALE the pre-§5.9 loop stepped 0.001px across
    // 800px — ~4.8×10¹¹ iterations, i.e. a hung tab. The cascade keeps spacing
    // above `minGridSpacing` in normal use; this is the belt to that braces.
    for (const spacing of [0.001, 0.1, 0]) {
      const { ctx, calls } = recordingCtx();
      paintDotMarks(ctx, lattice(spacing), 1);
      paintCrossMarks(ctx, lattice(spacing), 2);
      expect(calls).toHaveLength(0);
    }
  });

  it('still draws at the cascade floor — the guard must not eat real grids', () => {
    // Paired with the test above: a guard tuned too high would silently blank
    // the grid at legitimate zoom levels and every other test here would pass.
    const { ctx, calls } = recordingCtx();
    paintDotMarks(ctx, lattice(DEFAULT_GRID_SETTINGS.minGridSpacing), 1);
    expect(count(calls, 'ellipse')).toBeGreaterThan(1000);
  });
});

// ─── Emphasis translation ───────────────────────────────────────────────────

describe('grid mark painters — emphasis survives as SIZE', () => {
  it('gives major marks a strictly larger footprint than minor ones', () => {
    // For lines emphasis is weight; for dots it is radius, for crosses arm
    // length. If these ever collapsed to equal, the hierarchy would vanish for
    // those styles while the lines kept theirs — and no other test would notice.
    const settings = DEFAULT_GRID_SETTINGS;
    expect(dotRadii(settings).major).toBeGreaterThan(dotRadii(settings).minor);
    expect(crossArms(settings).major).toBeGreaterThan(crossArms(settings).minor);
  });

  it('paints the whole pass in one style — never the last mark’s style', () => {
    // The pre-§5.9 cross renderer set strokeStyle INSIDE the loop but stroked
    // once at the end, so every cross took the last-assigned colour. Style is
    // now hoisted to the pass, which makes that bug unrepresentable.
    const { ctx, calls } = recordingCtx();
    ctx.strokeStyle = '#123456';
    ctx.lineWidth = 2;
    paintCrossMarks(ctx, lattice(50), 3);
    const strokes = calls.filter((c) => c.op === 'stroke');
    expect(strokes).toHaveLength(1);
    expect(strokes[0].strokeStyle).toBe('#123456');
    expect(strokes[0].lineWidth).toBe(2);
  });
});

// ─── The feature itself: dots/crosses actually cascade ──────────────────────

/**
 * Mark CENTRES per pass, in emission order.
 *
 * A dot emits one `ellipse(cx, cy, …)`. A cross emits two `moveTo`s —
 * `(cx-arm, cy)` then `(cx, cy-arm)` — so only every OTHER moveTo carries the
 * lattice y, and reading them all would recover the arm length instead of the
 * spacing. Passes are delimited by `beginPath`.
 */
function passMarkYs(calls: readonly RecordedCall[], style: GridSettings['style']): number[][] {
  const passes: number[][] = [];
  let current: number[] | null = null;
  let moveToIndex = 0;
  for (const c of calls) {
    if (c.op === 'beginPath') { current = []; passes.push(current); moveToIndex = 0; continue; }
    if (current === null) continue;
    if (style === 'dots' && c.op === 'ellipse') current.push(c.args[1]);
    if (style === 'crosses' && c.op === 'moveTo') {
      if (moveToIndex % 2 === 0) current.push(c.args[1]); // horizontal arm → lattice y
      moveToIndex++;
    }
  }
  return passes.filter((p) => p.length > 1);
}

function renderGrid(style: GridSettings['style'], scale: number, smoothFade: boolean): RecordedCall[] {
  const renderer = new GridRenderer();
  const { ctx, calls } = recordingCtx();
  renderer.renderDirect(
    ctx,
    VIEWPORT,
    {
      ...DEFAULT_GRID_SETTINGS,
      style,
      smoothFade,
      smoothFadeDurationMs: 0, // instant — no temporal lerp in the assertion
      minVisibleSize: 0,       // as shipped by useCanvasSettings
      showAxes: false,
      showOrigin: false,
    },
    { scale, offsetX: 0, offsetY: 0 },
  );
  return calls;
}

/** Distinct spacings the renderer laid marks at, for one style and scale. */
function passSpacings(style: GridSettings['style'], scale: number): number[] {
  const spacings = new Set<number>();
  for (const ys of passMarkYs(renderGrid(style, scale, true), style)) {
    const ascending = [...new Set(ys)].sort((a, b) => a - b);
    for (let i = 1; i < ascending.length; i++) {
      spacings.add(Number((ascending[i] - ascending[i - 1]).toFixed(6)));
    }
  }
  return [...spacings];
}

describe.each(['dots', 'crosses'] as const)('GridRenderer — %s cascade (ADR-681 §5.9)', (style) => {
  it('lays marks at the CASCADE spacings, never at the raw size × scale step', () => {
    // The defect in one assertion: before §5.9 the only spacing ever emitted
    // was `size * scale`. Sampled mid-band, where the cascade level and the raw
    // step genuinely differ — at a band edge they coincide and this hides.
    const scale = 0.088; // minor lands at 22px — half-way up the 10-50px band
    const rawStep = DEFAULT_GRID_SETTINGS.size * scale; // 0.88px — unusable
    const { minorScreenPx, majorScreenPx, coarseScreenPx, minorOpacity } = computeAdaptiveLevels({
      worldStep: DEFAULT_GRID_SETTINGS.size,
      scale,
      subDivisions: DEFAULT_GRID_SETTINGS.majorInterval,
      minSpacingPx: DEFAULT_GRID_SETTINGS.minGridSpacing,
    });
    expect(minorOpacity).toBeGreaterThan(0.1);
    expect(minorOpacity).toBeLessThan(0.9); // genuinely mid-period

    const spacings = passSpacings(style, scale);
    expect(spacings.length).toBeGreaterThan(0); // the anchor has a subject
    expect(spacings).not.toContain(Number(rawStep.toFixed(6)));
    for (const px of spacings) {
      expect([minorScreenPx, majorScreenPx, coarseScreenPx].some((c) => Math.abs(c - px) < 1e-4)).toBe(true);
    }
  });

  it('keeps mark spacing bounded across 4 zoom decades — the whole point', () => {
    // The user-visible promise, and the exact thing the raw `size × scale` step
    // could not give: marks never densify without bound as you zoom out, nor
    // thin without bound as you zoom in.
    //
    // The FLOOR is the tight bound — no pass may ever be laid below the cascade
    // anchor. The ceiling is looser by construction: near the band floor the
    // minor pass has faded to invisible and is culled, so the finest pass
    // actually DRAWN is the major (one period up), and the coarse pass sits two
    // periods above that. Asserting `ceiling` here would fail on correct
    // output — the honest bound is three periods.
    const floor = DEFAULT_GRID_SETTINGS.minGridSpacing;
    const sub = DEFAULT_GRID_SETTINGS.majorInterval;
    const widest = floor * Math.pow(sub, 3);
    let sampled = 0;
    for (let exp = -2; exp <= 2; exp += 0.05) {
      const spacings = passSpacings(style, Math.pow(10, exp));
      if (spacings.length === 0) continue;
      sampled++;
      expect(Math.min(...spacings)).toBeGreaterThanOrEqual(floor - 1e-6);
      expect(Math.max(...spacings)).toBeLessThanOrEqual(widest + 1e-6);
    }
    expect(sampled).toBeGreaterThan(70); // net: the sweep really ran
  });

  it('leaves the legacy render untouched when the cascade is off', () => {
    // `smoothFade` ships OFF. Those users must see exactly the pre-§5.9 grid,
    // raw step and per-mark index test included.
    const scale = 0.4;
    const rawStep = DEFAULT_GRID_SETTINGS.size * scale; // 4px
    // Read marks FLAT, not per pass: legacy dots still issue a beginPath per
    // dot (that is precisely the untouched behaviour under test), so the
    // pass-delimited reader used for the cascade cannot apply here.
    const calls = renderGrid(style, scale, false);
    const marks =
      style === 'dots'
        ? calls.filter((c) => c.op === 'ellipse').map((c) => c.args[1])
        : calls.filter((c) => c.op === 'moveTo').filter((_, i) => i % 2 === 0).map((c) => c.args[1]);
    expect(marks.length).toBeGreaterThan(0); // subject exists

    const ys = [...new Set(marks)].sort((a, b) => a - b);
    expect(ys.length).toBeGreaterThan(VIEWPORT.height / rawStep - 2);
    // Legacy draws on the raw lattice: consecutive y steps are the raw step.
    expect(ys[1] - ys[0]).toBeCloseTo(rawStep, 6);
  });
});
