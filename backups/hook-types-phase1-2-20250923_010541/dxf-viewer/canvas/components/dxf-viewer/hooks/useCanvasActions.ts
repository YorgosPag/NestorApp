'use client';

import { useCallback } from 'react';
import type { DxfCanvasRef } from '../../../../DxfCanvas';

interface CanvasActionsOptions {
  dxfCanvasRef: React.RefObject<DxfCanvasRef>;
  canUndo: boolean;
  canRedo: boolean;
  setCanUndo: (canUndo: boolean) => void;
  setCanRedo: (canRedo: boolean) => void;
}

export function useCanvasActions({
  dxfCanvasRef,
  canUndo,
  canRedo,
  setCanUndo,
  setCanRedo
}: CanvasActionsOptions) {
  
  // ============================================================================
  // UNDO/REDO ACTIONS
  // ============================================================================
  const handleUndo = useCallback(() => {
    if (dxfCanvasRef.current?.undo()) {
      setCanUndo(dxfCanvasRef.current.canUndo());
      setCanRedo(dxfCanvasRef.current.canRedo());
    }
  }, [dxfCanvasRef, setCanUndo, setCanRedo]);

  const handleRedo = useCallback(() => {
    if (dxfCanvasRef.current?.redo()) {
      setCanUndo(dxfCanvasRef.current.canUndo());
      setCanRedo(dxfCanvasRef.current.canRedo());
    }
  }, [dxfCanvasRef, setCanUndo, setCanRedo]);

  // ============================================================================
  // UNDO/REDO STATE UPDATE
  // ============================================================================
  const updateUndoRedoState = useCallback(() => {
    if (dxfCanvasRef.current) {
      setCanUndo(dxfCanvasRef.current.canUndo());
      setCanRedo(dxfCanvasRef.current.canRedo());
    }
  }, [dxfCanvasRef, setCanUndo, setCanRedo]);

  return {
    // State
    canUndo,
    canRedo,
    
    // Actions
    handleUndo,
    handleRedo,
    updateUndoRedoState,
  };
}