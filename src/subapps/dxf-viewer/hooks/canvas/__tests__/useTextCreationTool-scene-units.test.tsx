/**
 * ADR-344 Phase 13 / Round 7 — `useTextCreationTool` scene-units + annotation-
 * scale awareness.
 *
 * Verifies the 2.5 paper-mm default height is scaled by the `drawingScale` SSoT
 * (Revit annotation scale, stubbed 1:100) and converted to world units before
 * the entity is created, so a ribbon TEXT placed in ANY scene (mm / cm / m / in
 * / ft) renders at the same physical model height (250 mm @ 1:100) — legible at
 * building scale instead of microscopic.
 *
 * Renders the hook with a stubbed `useDxfTextServices` so `CreateTextCommand`
 * is intercepted before it touches the SceneManager singleton. The committed
 * `DxfTextNode` carries the height we assert against.
 */

import { renderHook, act } from '@testing-library/react';
import { useTextCreationTool } from '../useTextCreationTool';
import type { ICommand } from '../../../core/commands';
import type { DxfTextNode } from '../../../text-engine/types';
import type { SceneUnits } from '../../../utils/scene-units';
import type { Point2D } from '../../../rendering/types/Types';
import { clearTextRotationOrigin, setTextEditingActive } from '../../../systems/cursor/TextRotationStore';

// ADR-508 §text-parity — το εργαλείο είναι πλέον 2-click (1ο = θέση + rotation phase, 2ο = κλείδωμα
// κλίσης → άνοιγμα πεδίου). Ο βοηθός κάνει και τα δύο κλικ ώστε το `creatingState` (πεδίο) να ανοίξει·
// το 2ο κλικ οριζόντια δεξιά → 0° κλίση (δεν επηρεάζει το ύψος που ελέγχουν αυτά τα tests).
function placeAndOpenField(
  result: { current: { handleCanvasClick: (p: Point2D) => boolean } },
  at: Point2D = { x: 0, y: 0 },
): void {
  act(() => { result.current.handleCanvasClick(at); });
  act(() => { result.current.handleCanvasClick({ x: at.x + 100, y: at.y }); });
}

// ──────────────────────────────────────────────────────────────────────────────
// Stubs
// ──────────────────────────────────────────────────────────────────────────────

jest.mock('../../../ui/text-toolbar/hooks/useDxfTextServices', () => ({
  useDxfTextServices: () => ({
    sceneManager: {} as never,
    auditRecorder: {} as never,
  }),
}));

// ADR-344 Round 7 — default text height now reads the `drawingScale` SSoT
// (ADR-375 Revit annotation scale, default 1:100). Stub it at 100 so the
// expected model heights below are deterministic.
jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: () => ({ drawingScale: 100 }) },
}));

interface CapturedCommand extends ICommand {
  readonly _params: { readonly textNode: DxfTextNode };
}

jest.mock('../../../core/commands/text/CreateTextCommand', () => ({
  CreateTextCommand: class {
    constructor(public readonly _params: { textNode: DxfTextNode }) {}
    execute() {}
    undo() {}
  },
}));

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeContainerStub(width = 800, height = 600): HTMLDivElement {
  return {
    clientWidth: width,
    clientHeight: height,
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: width, bottom: height,
      width, height, x: 0, y: 0, toJSON: () => ({}),
    }),
  } as unknown as HTMLDivElement;
}

function renderTool(units: SceneUnits, executeCommand: (cmd: ICommand) => void) {
  const container = makeContainerStub();
  return renderHook(() =>
    useTextCreationTool({
      transformRef: { current: { scale: 1, offsetX: 0, offsetY: 0 } },
      containerRef: { current: container },
      activeTool: 'text',
      onToolChange: jest.fn(),
      executeCommand,
      getSceneUnits: () => units,
    }),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Cases
// ──────────────────────────────────────────────────────────────────────────────

// ADR-344 Round 7: height = 2.5(paper-mm) × drawingScale(=100) × mmToSceneUnits(units).
// Every unit system yields the SAME physical height (250mm) — the whole point of
// the fix. Stored value is in scene units, so the number differs per unit:
//   mm: 2.5 * 100 * 1       = 250        (= 250mm)
//   cm: 2.5 * 100 * 0.1     = 25         (= 250mm)
//   m:  2.5 * 100 * 0.001   = 0.25       (= 250mm)
//   in: 2.5 * 100 * 1/25.4  ≈ 9.8425     (= 250mm)
//   ft: 2.5 * 100 * 1/304.8 ≈ 0.8202     (= 250mm)
const CASES: ReadonlyArray<{ units: SceneUnits; expected: number }> = [
  { units: 'mm', expected: 250 },
  { units: 'cm', expected: 25 },
  { units: 'm',  expected: 0.25 },
  { units: 'in', expected: 2.5 * 100 / 25.4 },
  { units: 'ft', expected: 2.5 * 100 / 304.8 },
];

describe('useTextCreationTool — scene-units awareness (ADR-344 Phase 13)', () => {
  let capturedNode: DxfTextNode | null;

  beforeEach(() => {
    capturedNode = null;
    clearTextRotationOrigin();
  });
  afterEach(() => {
    clearTextRotationOrigin();
    setTextEditingActive(false);
  });

  it.each(CASES)('scales default height for $units scenes', ({ units, expected }) => {
    const { result } = renderTool(units, (cmd) => {
      capturedNode = (cmd as CapturedCommand)._params.textNode;
    });

    // 2-click place→rotate: 1ο κλικ θέση, 2ο κλικ κλείδωμα κλίσης → ανοίγει το πεδίο.
    placeAndOpenField(result);
    const state = result.current.creatingState;
    expect(state).not.toBeNull();
    const initialHeight = state!.initial.paragraphs[0].runs[0];
    if ('text' in initialHeight) {
      expect(initialHeight.style.height).toBeCloseTo(expected, 6);
    } else {
      throw new Error('Expected first run to be a TextRun');
    }

    // Commit a non-empty edit — fires CreateTextCommand with the same scaled
    // height (commit path doesn't override it, just forwards the AST).
    act(() => {
      result.current.onCommit({
        ...state!.initial,
        paragraphs: [
          {
            ...state!.initial.paragraphs[0],
            runs: [
              {
                text: 'hello',
                style: {
                  ...(initialHeight as { style: { height: number } }).style,
                },
              },
            ],
          },
        ],
      } as unknown as DxfTextNode);
    });

    expect(capturedNode).not.toBeNull();
    const run = capturedNode!.paragraphs[0].runs[0];
    if ('text' in run) {
      expect(run.style.height).toBeCloseTo(expected, 6);
    } else {
      throw new Error('Expected first commit run to be a TextRun');
    }
  });

  it('R6: patches height:0 runs (TipTap mark loss) with units-scaled default', () => {
    // Simulates the bug: TipTap drops the fontHeight mark for empty initial
    // runs, so newly-typed text inherits height:0 from defaultStyle().
    // patchZeroHeightRuns must substitute the units-aware default at commit.
    let capturedNode: DxfTextNode | null = null;
    const { result } = renderTool('m', (cmd) => {
      capturedNode = (cmd as CapturedCommand)._params.textNode;
    });

    placeAndOpenField(result);
    const state = result.current.creatingState!;
    const initialRun = state.initial.paragraphs[0].runs[0];

    act(() => {
      result.current.onCommit({
        ...state.initial,
        paragraphs: [{
          ...state.initial.paragraphs[0],
          runs: [{
            text: 'hello',
            style: {
              ...(initialRun as { style: { height: number } }).style,
              height: 0, // simulated TipTap mark loss
            },
          }],
        }],
      } as unknown as DxfTextNode);
    });

    expect(capturedNode).not.toBeNull();
    const run = capturedNode!.paragraphs[0].runs[0];
    if ('text' in run) {
      // Round 7: m-scene + drawingScale=100 (stubbed)
      // defaultHeight = 2.5 * 100 * 0.001 = 0.25m (250mm — visible at building scale)
      expect(run.style.height).toBeCloseTo(0.25, 6);
    } else {
      throw new Error('Expected TextRun');
    }
  });

  it('R6: preserves non-zero height — patch does not overwrite explicit value', () => {
    let capturedNode: DxfTextNode | null = null;
    const { result } = renderTool('m', (cmd) => {
      capturedNode = (cmd as CapturedCommand)._params.textNode;
    });

    placeAndOpenField(result);
    const state = result.current.creatingState!;
    const initialRun = state.initial.paragraphs[0].runs[0];

    act(() => {
      result.current.onCommit({
        ...state.initial,
        paragraphs: [{
          ...state.initial.paragraphs[0],
          runs: [{
            text: 'hello',
            style: {
              ...(initialRun as { style: { height: number } }).style,
              height: 0.005, // explicit non-zero — must NOT be replaced
            },
          }],
        }],
      } as unknown as DxfTextNode);
    });

    expect(capturedNode).not.toBeNull();
    const run = capturedNode!.paragraphs[0].runs[0];
    if ('text' in run) {
      expect(run.style.height).toBeCloseTo(0.005, 6);
    } else {
      throw new Error('Expected TextRun');
    }
  });

  it('falls back to mm units when getSceneUnits is omitted (back-compat)', () => {
    const container = makeContainerStub();
    const { result } = renderHook(() =>
      useTextCreationTool({
        transformRef: { current: { scale: 1, offsetX: 0, offsetY: 0 } },
        containerRef: { current: container },
        activeTool: 'text',
        onToolChange: jest.fn(),
        executeCommand: jest.fn(),
      }),
    );

    placeAndOpenField(result);
    const run = result.current.creatingState!.initial.paragraphs[0].runs[0];
    if ('text' in run) {
      // mm units (default) × drawingScale 100 (stubbed) × paper 2.5 = 250.
      expect(run.style.height).toBe(250);
    } else {
      throw new Error('Expected first run to be a TextRun');
    }
  });
});
