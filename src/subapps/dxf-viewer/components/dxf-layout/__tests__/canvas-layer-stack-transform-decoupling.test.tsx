/**
 * @jest-environment jsdom
 *
 * ADR-040 Phase XXII.B — «το transform ΔΕΝ είναι React prop στο μονοπάτι του shell».
 *
 * Έλεγχοι ΡΑΦΗΣ + συμπεριφοράς που καρφώνουν τις αποφάσεις της φάσης — καθεμία με τη
 * μετάλλαξη που σκοτώνει (αν κάποιος «επαναφέρει» το prop, κάποιο από αυτά κοκκινίζει):
 *
 * 1. Ο shell (CanvasLayerStack) δεν παίρνει/μοιράζει transform — ούτε destructure, ούτε
 *    `transform={`· τα CanvasLayerStackProps δεν έχουν πεδίο transform· ο Bridge ΔΕΝ υπάρχει
 *    και ο CanvasSection κάνει import απευθείας τον shell.
 * 2. Οι mouse handlers (3 αρχεία) διαβάζουν `getImmediateTransform()` στην κλήση και ΔΕΝ
 *    destructure-άρουν transform από props (stale-click regression, εύρημα κριτικής #2).
 * 3. Το zoom-reset αγκυρώνει μέσω του ΕΝΟΣ SSoT helper (`computeRulerOriginTransform`) και
 *    στα ΔΥΟ σημεία (resetToOrigin + DxfCanvas bootstrap) — εύρημα κριτικής #1: το παλιό
 *    interception μέσω re-fire του bootstrap effect καταργήθηκε.
 * 4. Το handle `getTransform` του DxfCanvas επιστρέφει τη ΖΩΝΤΑΝΗ τιμή του SSoT (το παλιό
 *    stale closure πάγωνε snap tolerance / drawing scale μετά από zoom).
 * 5. Οι frame-subscribed canvas painters (subscribeImmediateTransformFrame) — και
 *    συμπεριφορικά: ο GridUnderlayCanvas ξαναζωγραφίζει ΚΑΙ σε transform tick με φρέσκια
 *    τιμή ΚΑΙ σε content change με ακίνητο transform (split-effect ιδίωμα, ρίσκο κριτικής #9).
 *    ADR-732 Batch 1: envelope + analytical (μαζί με mep-wires + proposals) ζουν πλέον ως
 *    painter hooks μέσα στον ΕΝΑΝ Overlay2DDispatchCanvas — ο κατάλογος ελέγχει εκείνον.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, act } from '@testing-library/react';

// ─── Mocks για το συμπεριφορικό σκέλος (GridUnderlayCanvas) ─────────────────────
const framePaints = jest.fn();
const frameSubs: Array<{ id: string; cb: () => void }> = [];

jest.mock('../overlay-dispatch/overlay-dispatch-frame', () => ({
  paintOverlayDispatchFrame: (...args: unknown[]) => framePaints(...args),
}));
jest.mock('../../../rendering/core/immediate-transform-frame', () => ({
  subscribeImmediateTransformFrame: (id: string, _name: string, cb: () => void) => {
    frameSubs.push({ id, cb });
    cb(); // ιδίωμα SSoT: μία ζωγραφιά αμέσως στο subscribe
    return () => {};
  },
}));

import { UnderlayDispatchCanvas } from '../overlay-dispatch/UnderlayDispatchCanvas';
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { computeRulerOriginTransform } from '../../../systems/rulers-grid/ruler-origin';
import { RULERS_GRID_CONFIG } from '../../../systems/rulers-grid/config';
import type { GridSettings } from '../../../canvas-v2';

const SRC_ROOT = path.resolve(__dirname, '..');
const readSource = (rel: string): string =>
  fs.readFileSync(path.resolve(SRC_ROOT, rel), 'utf-8');

// ─── 1. Shell: μηδέν transform prop σε όλο το μονοπάτι ──────────────────────────
describe('shell decoupling — το transform δεν είναι πια prop', () => {
  it('ο CanvasLayerStack δεν destructure-άρει ούτε μοιράζει transform', () => {
    const src = readSource('CanvasLayerStack.tsx');
    expect(src).not.toMatch(/^\s*transform,\s*viewport/m);
    expect(src).not.toContain('transform={');
  });

  it('τα CanvasLayerStackProps δεν έχουν πεδίο transform', () => {
    const src = readSource('canvas-layer-stack-types.ts');
    const props = src.slice(src.indexOf('interface CanvasLayerStackProps'));
    expect(props).not.toMatch(/^\s*transform:\s*ViewTransform/m);
  });

  it('ο TransformBridge ΔΕΝ υπάρχει και ο CanvasSection κάνει import απευθείας τον shell', () => {
    expect(fs.existsSync(path.resolve(SRC_ROOT, 'CanvasLayerStackTransformBridge.tsx'))).toBe(false);
    const section = readSource('CanvasSection.tsx');
    expect(section).toMatch(/import \{ CanvasLayerStack \} from '\.\/CanvasLayerStack'/);
    expect(section).not.toContain('CanvasLayerStackTransformBridge');
  });

  it('οι δύο orchestrators μένουν χωρίς useSyncExternalStore (CHECK 6C)', () => {
    for (const f of ['CanvasSection.tsx', 'CanvasLayerStack.tsx']) {
      // Το ίδιο literal pattern με το pre-commit CHECK 6C (κλήση, όχι μνεία σε σχόλιο).
      expect(readSource(f)).not.toMatch(/useSyncExternalStore\(/);
    }
  });
});

// ─── 2. Mouse handlers: event-time getters (εύρημα κριτικής #2) ─────────────────
describe('mouse handlers — getImmediateTransform() στην κλήση, όχι prop', () => {
  const HANDLERS = [
    '../../systems/cursor/useCentralizedMouseHandlers.ts',
    '../../systems/cursor/mouse-handler-move.ts',
    '../../systems/cursor/mouse-handler-up.ts',
  ];

  it.each(HANDLERS)('%s διαβάζει το ζωντανό SSoT', (rel) => {
    expect(readSource(rel)).toContain('getImmediateTransform()');
  });

  it('κανένας handler δεν destructure-άρει transform από τα props', () => {
    for (const rel of HANDLERS) {
      const src = readSource(rel);
      const destructures = src.match(/const \{[^}]*\} = props;/gs) ?? [];
      for (const d of destructures) {
        expect(d).not.toMatch(/\btransform\b/);
      }
    }
    // Και ο τύπος των props δεν το δηλώνει πια.
    const types = readSource('../../systems/cursor/mouse-handler-types.ts');
    const props = types.slice(types.indexOf('interface CentralizedMouseHandlersProps'));
    expect(props).not.toMatch(/^\s*transform:\s*ViewTransform/m);
  });
});

// ─── 3. Zoom-reset αγκύρωση: ΕΝΑΣ SSoT helper σε ΔΥΟ σημεία (εύρημα #1) ─────────
describe('zoom-reset — ρητή αγκύρωση, όχι interception', () => {
  it('computeRulerOriginTransform: world(0,0) στην κάτω-αριστερή γωνία χαράκων', () => {
    const t = computeRulerOriginTransform(600);
    expect(t).toEqual({
      scale: 1,
      offsetX: RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH,
      offsetY: 600 - RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT,
    });
  });

  it('resetToOrigin ΚΑΙ DxfCanvas bootstrap καλούν τον ΙΔΙΟ helper', () => {
    expect(readSource('../../hooks/interfaces/useCanvasOperations.ts'))
      .toContain('computeRulerOriginTransform(');
    expect(readSource('../../canvas-v2/dxf-canvas/DxfCanvas.tsx'))
      .toContain('computeRulerOriginTransform(');
  });

  it('το handle getTransform επιστρέφει το ΖΩΝΤΑΝΟ SSoT (όχι stale closure)', () => {
    expect(readSource('../../canvas-v2/dxf-canvas/DxfCanvas.tsx'))
      .toMatch(/getTransform:\s*\(\)\s*=>\s*getImmediateTransform\(\)/);
  });
});

// ─── 4. Οι canvas painters είναι frame-subscribed ───────────────────────────────
describe('canvas painters — subscribeImmediateTransformFrame (ιδίωμα HomeRunWires)', () => {
  it.each([
    // ADR-732 — ο ΕΝΑΣ zone μηχανισμός (SSoT) και των δύο zone canvases:
    // ζώνη Α UnderlayDispatchCanvas (πρώην GridUnderlayCanvas + FloorplanBackgroundCanvas),
    // ζώνη Β Overlay2DDispatchCanvas (πρώην Envelope + AnalyticalDispatch + HomeRunWires +
    // ProposalDispatch). Το frame subscription + το draw-time transform ζουν ΕΔΩ.
    'overlay-dispatch/use-overlay-zone-dispatch.ts',
    'FloorUnderlayOverlay.tsx',
    'TopoGridUnderlayCanvas.tsx',
    '../../accessibility/Focus2DOverlay.tsx',
    'ContainerGizmoLayer.tsx',
  ])('%s', (rel) => {
    const src = readSource(rel);
    expect(src).toContain('subscribeImmediateTransformFrame(');
    expect(src).toContain('getImmediateTransform()');
  });

  it('οι δύο gizmo layers παίρνουν ΔΙΑΚΡΙΤΑ scheduler ids (containerKind — όχι fn.name)', () => {
    const src = readSource('ContainerGizmoLayer.tsx');
    expect(src).toContain('`container-gizmo-${containerKind}`');
    expect(readSource('GroupGizmoLayer.tsx')).toContain('containerKind="group"');
    expect(readSource('BlockGizmoLayer.tsx')).toContain('containerKind="block"');
  });
});

// ─── 5. Συμπεριφορά: UnderlayDispatchCanvas split-effect (ρίσκο κριτικής #9) ────
// ADR-732 Batch 2: η συμπεριφορά του πρώην GridUnderlayCanvas ζει στον καμβά ζώνης Α —
// το grid pass είναι το painters[0] (κάτω από την κάτοψη, Giorgio 2026-06-05).
describe('UnderlayDispatchCanvas — repaint σε transform tick ΚΑΙ σε content change', () => {
  const gridOn = { enabled: true, size: 10 } as unknown as GridSettings;
  const gridOff = { enabled: false, size: 10 } as unknown as GridSettings;
  const viewport = { width: 800, height: 600 };

  beforeEach(() => {
    framePaints.mockClear();
    frameSubs.length = 0;
    updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it('ζωγραφίζει με τη ΦΡΕΣΚΙΑ τιμή του store στο frame tick (zero-lag pan)', () => {
    render(<UnderlayDispatchCanvas gridSettings={gridOn} viewport={viewport} floorId={null} />);
    expect(frameSubs.map((s) => s.id)).toContain('underlay-dispatch');
    framePaints.mockClear();

    act(() => {
      updateImmediateTransform({ scale: 2, offsetX: 50, offsetY: -30 });
      frameSubs.find((s) => s.id === 'underlay-dispatch')?.cb();
    });

    expect(framePaints).toHaveBeenCalled();
    const [, , paintedTransform] = framePaints.mock.calls.at(-1) as unknown[];
    expect(paintedTransform).toEqual({ scale: 2, offsetX: 50, offsetY: -30 });
  });

  it('ξαναζωγραφίζει σε αλλαγή gridSettings με ΑΚΙΝΗΤΟ transform (split-effect)', () => {
    const { rerender } = render(
      <UnderlayDispatchCanvas gridSettings={gridOff} viewport={viewport} floorId={null} />,
    );
    framePaints.mockClear();

    rerender(<UnderlayDispatchCanvas gridSettings={gridOn} viewport={viewport} floorId={null} />);

    expect(framePaints).toHaveBeenCalled();
    // Το grid pass είναι το painters[0]· με enabled=true ΔΕΝ είναι null (η πύλη θα ζωγραφίσει).
    const [, painters] = framePaints.mock.calls.at(-1) as [unknown, Array<unknown>];
    expect(painters[0]).not.toBeNull();
  });

  it('χωρίς floorId το floorplan pass (painters[1]) είναι null — η ζώνη δεν πληρώνει τίποτα', () => {
    render(<UnderlayDispatchCanvas gridSettings={gridOn} viewport={viewport} floorId={null} />);
    const [, painters] = framePaints.mock.calls.at(-1) as [unknown, Array<unknown>];
    expect(painters).toHaveLength(2);
    expect(painters[1]).toBeNull();
  });
});
