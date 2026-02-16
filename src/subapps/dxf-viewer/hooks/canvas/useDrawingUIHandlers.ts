/**
 * 🏢 ENTERPRISE: useDrawingUIHandlers Hook
 *
 * @description UI action handlers for drawing operations: finish, close, cancel, undo, flip arc.
 * Each handler supports dual-path: overlay polygon drawing OR unified drawing tools.
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~56 lines of drawing UI handler callbacks
 *
 * @see ADR-047: DrawingContextMenu
 * @see ADR-053: Drawing operations
 */

'use client';

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';

import type { OverlayEditorMode } from '../../overlays/types';

// ============================================================================
// TYPES
// ============================================================================

/** Minimal interface for drawingHandlersRef — only the methods we need */
interface DrawingHandlersLike {
  onDrawingDoubleClick?: () => void;
  onDrawingCancel?: () => void;
  onUndoLastPoint?: () => void;
  onFlipArc?: () => void;
}

export interface UseDrawingUIHandlersParams {
  /** Current overlay editor mode */
  overlayMode: OverlayEditorMode;
  /** Ref to draft polygon array */
  draftPolygonRef: MutableRefObject<Array<[number, number]>>;
  /** Ref to finishDrawingWithPolygon function (avoids block-scope issues) */
  finishDrawingWithPolygonRef: MutableRefObject<(polygon: Array<[number, number]>) => Promise<boolean>>;
  /** Ref to drawing handlers (avoids stale closures) */
  drawingHandlersRef: MutableRefObject<DrawingHandlersLike | null>;
  /** Setter for draft polygon state */
  setDraftPolygon: Dispatch<SetStateAction<Array<[number, number]>>>;
}

export interface UseDrawingUIHandlersReturn {
  /** Finish current drawing (dual-path: overlay polygon or unified drawing) */
  handleDrawingFinish: () => void;
  /** Close current drawing (same as finish — closes polygon or completes tool) */
  handleDrawingClose: () => void;
  /** Cancel current drawing (clear overlay polygon or cancel unified drawing) */
  handleDrawingCancel: () => void;
  /** Undo last point (remove last polygon vertex or undo unified drawing point) */
  handleDrawingUndoLastPoint: () => void;
  /** Flip arc direction (unified drawing only) */
  handleFlipArc: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useDrawingUIHandlers({
  overlayMode,
  draftPolygonRef,
  finishDrawingWithPolygonRef,
  drawingHandlersRef,
  setDraftPolygon,
}: UseDrawingUIHandlersParams): UseDrawingUIHandlersReturn {

  const handleDrawingFinish = useCallback(() => {
    if (overlayMode === 'draw' && draftPolygonRef.current.length >= 3) {
      finishDrawingWithPolygonRef.current(draftPolygonRef.current).then(success => {
        if (success) setDraftPolygon([]);
      });
      return;
    }
    if (drawingHandlersRef.current?.onDrawingDoubleClick) {
      drawingHandlersRef.current.onDrawingDoubleClick();
    }
  }, [overlayMode, draftPolygonRef, finishDrawingWithPolygonRef, drawingHandlersRef, setDraftPolygon]);

  const handleDrawingClose = useCallback(() => {
    if (overlayMode === 'draw' && draftPolygonRef.current.length >= 3) {
      finishDrawingWithPolygonRef.current(draftPolygonRef.current).then(success => {
        if (success) setDraftPolygon([]);
      });
      return;
    }
    if (drawingHandlersRef.current?.onDrawingDoubleClick) {
      drawingHandlersRef.current.onDrawingDoubleClick();
    }
  }, [overlayMode, draftPolygonRef, finishDrawingWithPolygonRef, drawingHandlersRef, setDraftPolygon]);

  const handleDrawingCancel = useCallback(() => {
    if (overlayMode === 'draw') {
      setDraftPolygon([]);
      return;
    }
    if (drawingHandlersRef.current?.onDrawingCancel) {
      drawingHandlersRef.current.onDrawingCancel();
    }
  }, [overlayMode, drawingHandlersRef, setDraftPolygon]);

  const handleDrawingUndoLastPoint = useCallback(() => {
    if (overlayMode === 'draw') {
      setDraftPolygon(prev => prev.slice(0, -1));
      return;
    }
    if (drawingHandlersRef.current?.onUndoLastPoint) {
      drawingHandlersRef.current.onUndoLastPoint();
    }
  }, [overlayMode, drawingHandlersRef, setDraftPolygon]);

  const handleFlipArc = useCallback(() => {
    if (drawingHandlersRef.current?.onFlipArc) {
      drawingHandlersRef.current.onFlipArc();
    }
  }, [drawingHandlersRef]);

  return {
    handleDrawingFinish,
    handleDrawingClose,
    handleDrawingCancel,
    handleDrawingUndoLastPoint,
    handleFlipArc,
  };
}
