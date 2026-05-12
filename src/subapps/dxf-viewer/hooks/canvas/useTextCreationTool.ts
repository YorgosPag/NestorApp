'use client';

/**
 * ADR-344 Phase 6.E follow-up — Text creation tool.
 *
 * Parallel to `useTextDoubleClickEditor` but for NEW entity creation:
 * user activates the 'text' tool → clicks on the canvas → in-canvas
 * TipTap overlay opens at the click position with an empty AST → on
 * commit, a CreateTextCommand is dispatched and the tool returns to
 * 'select' (allowsContinuous=false on the text tool definition).
 *
 * ADR-040 note: local React state only, no useSyncExternalStore.
 * Safe to mount in the orchestrator (CanvasSection).
 */

import { useCallback, useMemo, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { CreateTextCommand } from '../../core/commands/text/CreateTextCommand';
import { useDxfTextServices } from '../../ui/text-toolbar/hooks/useDxfTextServices';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { DXF_COLOR_BY_LAYER } from '../../text-engine/types/text-toolbar.types';
import type { DxfTextNode } from '../../text-engine/types';
import type { ToolType } from '../../ui/toolbar/types';

interface CreatingState {
  readonly entityId: string;
  readonly position: Point2D;
  readonly initial: DxfTextNode;
  readonly anchorRect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
}

interface CanvasTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface UseTextCreationToolParams {
  readonly transformRef: React.RefObject<CanvasTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly activeTool: ToolType;
  readonly onToolChange: (tool: ToolType) => void;
  readonly executeCommand: (cmd: ICommand) => void;
}

interface TextCreationToolApi {
  readonly creatingState: CreatingState | null;
  readonly handleCanvasClick: (worldPoint: Point2D) => boolean;
  readonly onCommit: (next: DxfTextNode) => void;
  readonly onCancel: () => void;
}

// Empty AST: single paragraph, single empty run with default plain CAD style.
// Mirrors `DEFAULT_RUN_STYLE` from text-engine/templates/defaults/template-helpers
// without coupling to that private module.
function makeEmptyTextNode(): DxfTextNode {
  return {
    paragraphs: [{
      runs: [{
        text: '',
        style: {
          fontFamily: 'Arial',
          bold: false,
          italic: false,
          underline: false,
          overline: false,
          strikethrough: false,
          height: 2.5,
          widthFactor: 1.0,
          obliqueAngle: 0,
          tracking: 1.0,
          color: DXF_COLOR_BY_LAYER,
        },
      }],
      indent: 0,
      leftMargin: 0,
      rightMargin: 0,
      tabs: [],
      justification: 0,
      lineSpacingMode: 'multiple',
      lineSpacingFactor: 1.0,
    }],
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1.0 },
    columns: undefined,
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

function computeAnchorRect(
  worldPoint: Point2D,
  transform: CanvasTransform,
  container: HTMLDivElement,
): CreatingState['anchorRect'] {
  const containerRect = container.getBoundingClientRect();
  // Same Y-flip as useTextDoubleClickEditor.computeAnchorRect (ADR-040 worldToScreen parity).
  const left = containerRect.left + worldPoint.x * transform.scale + transform.offsetX;
  const canvasY = container.clientHeight - worldPoint.y * transform.scale - transform.offsetY;
  const top = containerRect.top + canvasY;
  // Default height: 2.5mm × scale × 4 visual buffer, min 24px (parity with double-click overlay).
  const height = Math.max(24, 2.5 * transform.scale * 4);
  return { left, top, width: 200, height };
}

export function useTextCreationTool(
  params: UseTextCreationToolParams,
): TextCreationToolApi {
  const { transformRef, containerRef, activeTool, onToolChange, executeCommand } = params;
  const services = useDxfTextServices();
  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);

  const handleCanvasClick = useCallback(
    (worldPoint: Point2D): boolean => {
      if (activeTool !== 'text') return false;
      if (creatingState) return false; // Already creating; let overlay handle it.
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!container || !transform) return false;
      const anchorRect = computeAnchorRect(worldPoint, transform, container);
      setCreatingState({
        entityId: generateEntityId(),
        position: worldPoint,
        initial: makeEmptyTextNode(),
        anchorRect,
      });
      return true;
    },
    [activeTool, creatingState, containerRef, transformRef],
  );

  const finishAndExit = useCallback(() => {
    setCreatingState(null);
    onToolChange('select');
  }, [onToolChange]);

  const onCancel = useCallback(() => {
    finishAndExit();
  }, [finishAndExit]);

  const onCommit = useCallback(
    (next: DxfTextNode) => {
      const state = creatingState;
      if (!state || !services) {
        finishAndExit();
        return;
      }
      // Skip creation if user committed an empty text (no runs with content).
      const hasContent = next.paragraphs.some((p) =>
        p.runs.some((r) => 'text' in r && r.text.trim().length > 0),
      );
      if (!hasContent) {
        finishAndExit();
        return;
      }
      const cmd = new CreateTextCommand(
        {
          position: state.position,
          layer: DXF_DEFAULT_LAYER,
          textNode: next,
          existingId: state.entityId,
        },
        services.sceneManager,
        services.auditRecorder,
      );
      executeCommand(cmd);
      finishAndExit();
    },
    [creatingState, services, executeCommand, finishAndExit],
  );

  return useMemo(
    () => ({ creatingState, handleCanvasClick, onCommit, onCancel }),
    [creatingState, handleCanvasClick, onCommit, onCancel],
  );
}
