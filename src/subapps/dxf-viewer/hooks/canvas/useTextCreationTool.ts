'use client';

/**
 * ADR-344 Phase 6.E/6.F — Text + MText creation tool.
 *
 * Handles both 'text' (single-line) and 'mtext' (multiline, width-bounded):
 *   'text'  → click → narrow overlay (width=200px) → TEXT entity (auto) or MTEXT if multiline
 *   'mtext' → click → wide overlay (width=40% canvas) → MTEXT entity (forced)
 *
 * On commit, CreateTextCommand is dispatched and the tool returns to 'select'
 * (allowsContinuous=false on both tool definitions).
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
  /** World-space width for MTEXT bounding box. Undefined for TEXT. */
  readonly worldWidth?: number;
  /** Force MTEXT type on commit (mtext tool mode). */
  readonly forceMText?: boolean;
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

const TEXT_OVERLAY_WIDTH_PX = 200;
// MTEXT overlay: 40% of canvas width, clamped to [280, 600]px screen
function mtextOverlayWidth(containerWidth: number): number {
  return Math.min(600, Math.max(280, Math.round(containerWidth * 0.4)));
}

function computeAnchorRect(
  worldPoint: Point2D,
  transform: CanvasTransform,
  container: HTMLDivElement,
  isMText: boolean,
): CreatingState['anchorRect'] & { worldWidth: number } {
  const containerRect = container.getBoundingClientRect();
  // Same Y-flip as useTextDoubleClickEditor.computeAnchorRect (ADR-040 worldToScreen parity).
  const left = containerRect.left + worldPoint.x * transform.scale + transform.offsetX;
  const canvasY = container.clientHeight - worldPoint.y * transform.scale - transform.offsetY;
  const top = containerRect.top + canvasY;
  const height = Math.max(24, 2.5 * transform.scale * 4);
  const screenWidth = isMText ? mtextOverlayWidth(container.clientWidth) : TEXT_OVERLAY_WIDTH_PX;
  const worldWidth = screenWidth / transform.scale;
  return { left, top, width: screenWidth, height, worldWidth };
}

export function useTextCreationTool(
  params: UseTextCreationToolParams,
): TextCreationToolApi {
  const { transformRef, containerRef, activeTool, onToolChange, executeCommand } = params;
  const services = useDxfTextServices();
  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);

  const handleCanvasClick = useCallback(
    (worldPoint: Point2D): boolean => {
      if (activeTool !== 'text' && activeTool !== 'mtext') return false;
      if (creatingState) return false; // Already creating; let overlay handle it.
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!container || !transform) return false;
      const isMText = activeTool === 'mtext';
      const { worldWidth, ...anchorRect } = computeAnchorRect(worldPoint, transform, container, isMText);
      setCreatingState({
        entityId: generateEntityId(),
        position: worldPoint,
        initial: makeEmptyTextNode(),
        anchorRect,
        worldWidth,
        forceMText: isMText,
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
          ...(state.forceMText ? { forceType: 'mtext' as const } : {}),
          ...(state.forceMText && state.worldWidth != null ? { width: state.worldWidth } : {}),
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
