/**
 * ADR-344 Phase 13 — `useTextCreationTool` scene-units awareness.
 *
 * Verifies the 2.5 paper-mm default height is converted to world units before
 * the entity is created, so a ribbon TEXT placed in a non-mm scene (cm / m /
 * in / ft) renders at the equivalent of 2.5 mm on canvas — matching native
 * imported DXF texts that are stored directly in world units.
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

// ──────────────────────────────────────────────────────────────────────────────
// Stubs
// ──────────────────────────────────────────────────────────────────────────────

jest.mock('../../../ui/text-toolbar/hooks/useDxfTextServices', () => ({
  useDxfTextServices: () => ({
    sceneManager: {} as never,
    auditRecorder: {} as never,
  }),
}));

// Stub registry — no styles registered → rawDimscale=1 → unit-aware fallback applies.
jest.mock('../../../systems/dimensions/dim-style-registry', () => ({
  getDimStyleRegistry: () => ({
    getAllStyles: () => [],
    getActiveStyleId: () => '',
  }),
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

// ADR-344 R6: unit-aware dimscale fallback (rawDimscale≤1 → cm×10, m×100).
// Registry stub above returns no styles → rawDimscale=1 → fallback activates.
// Formula: 2.5 * dimscaleFallback(units) * mmToSceneUnits(units)
//   mm: 2.5 * 1   * 1     = 2.5        (paper-mm stays as-is)
//   cm: 2.5 * 10  * 0.1   = 2.5        (25mm model space in cm-scene)
//   m:  2.5 * 100 * 0.001 = 0.25       (250mm model space in m-scene)
//   in: 2.5 * 1   * 1/25.4 ≈ 0.0984
//   ft: 2.5 * 1   * 1/304.8 ≈ 0.0082
const CASES: ReadonlyArray<{ units: SceneUnits; expected: number }> = [
  { units: 'mm', expected: 2.5 },
  { units: 'cm', expected: 2.5 },         // 2.5 * 10  * 0.1   = 2.5
  { units: 'm',  expected: 0.25 },        // 2.5 * 100 * 0.001 = 0.25
  { units: 'in', expected: 2.5 / 25.4 },
  { units: 'ft', expected: 2.5 / 304.8 },
];

describe('useTextCreationTool — scene-units awareness (ADR-344 Phase 13)', () => {
  let capturedNode: DxfTextNode | null;

  beforeEach(() => {
    capturedNode = null;
  });

  it.each(CASES)('scales default height for $units scenes', ({ units, expected }) => {
    const { result } = renderTool(units, (cmd) => {
      capturedNode = (cmd as CapturedCommand)._params.textNode;
    });

    // Initial click — creates the in-progress text state at this world point.
    act(() => {
      result.current.handleCanvasClick({ x: 0, y: 0 });
    });
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
      } as DxfTextNode);
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

    act(() => { result.current.handleCanvasClick({ x: 0, y: 0 }); });
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
      } as DxfTextNode);
    });

    expect(capturedNode).not.toBeNull();
    const run = capturedNode!.paragraphs[0].runs[0];
    if ('text' in run) {
      // R6 dimscale fallback: m-scene + rawDimscale≤1 → fallback=100
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

    act(() => { result.current.handleCanvasClick({ x: 0, y: 0 }); });
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
      } as DxfTextNode);
    });

    expect(capturedNode).not.toBeNull();
    const run = capturedNode!.paragraphs[0].runs[0];
    if ('text' in run) {
      expect(run.style.height).toBeCloseTo(0.005, 6);
    } else {
      throw new Error('Expected TextRun');
    }
  });

  it('falls back to mm when getSceneUnits is omitted (back-compat)', () => {
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

    act(() => {
      result.current.handleCanvasClick({ x: 0, y: 0 });
    });
    const run = result.current.creatingState!.initial.paragraphs[0].runs[0];
    if ('text' in run) {
      expect(run.style.height).toBe(2.5);
    } else {
      throw new Error('Expected first run to be a TextRun');
    }
  });
});
