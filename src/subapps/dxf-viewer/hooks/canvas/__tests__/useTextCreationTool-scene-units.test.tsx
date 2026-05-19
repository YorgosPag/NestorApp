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

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextCreationTool } from '../useTextCreationTool';
import type { ICommand } from '../../../core/commands';
import type { DxfTextNode } from '../../../text-engine/types';
import type { SceneUnits } from '../../../utils/scene-units';

// ──────────────────────────────────────────────────────────────────────────────
// Stubs
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('../../../ui/text-toolbar/hooks/useDxfTextServices', () => ({
  useDxfTextServices: () => ({
    sceneManager: {} as never,
    auditRecorder: {} as never,
  }),
}));

interface CapturedCommand extends ICommand {
  readonly _params: { readonly textNode: DxfTextNode };
}

vi.mock('../../../core/commands/text/CreateTextCommand', () => ({
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
      onToolChange: vi.fn(),
      executeCommand,
      getSceneUnits: () => units,
    }),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Cases
// ──────────────────────────────────────────────────────────────────────────────

const CASES: ReadonlyArray<{ units: SceneUnits; expected: number }> = [
  { units: 'mm', expected: 2.5 },
  { units: 'cm', expected: 0.25 },
  { units: 'm',  expected: 0.0025 },
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

  it('falls back to mm when getSceneUnits is omitted (back-compat)', () => {
    const container = makeContainerStub();
    const { result } = renderHook(() =>
      useTextCreationTool({
        transformRef: { current: { scale: 1, offsetX: 0, offsetY: 0 } },
        containerRef: { current: container },
        activeTool: 'text',
        onToolChange: vi.fn(),
        executeCommand: vi.fn(),
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
