'use client';
import React from 'react';
import type { Status, OverlayKind, OverlayEditorMode } from '../overlays/types';

interface OverlayToolbarProps {
  mode: OverlayEditorMode;
  onModeChange: (mode: OverlayEditorMode) => void;
  currentStatus: Status;
  onStatusChange: (status: Status) => void;
  currentKind: OverlayKind;
  onKindChange: (kind: OverlayKind) => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  selectedOverlayId: string | null;
  onDuplicate: () => void;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToolChange?: (tool: string) => void;
}

export const OverlayToolbar: React.FC<OverlayToolbarProps> = (props) => {
  // Απλή έκδοση για debugging
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800 border border-gray-500 rounded-lg">
      <div className="text-white">Overlay Toolbar (Simple Version)</div>
      <button
        onClick={() => props.onModeChange('select')}
        className="px-2 py-1 bg-blue-600 text-white rounded"
      >
        Select
      </button>
      <button
        onClick={() => props.onModeChange('draw')}
        className="px-2 py-1 bg-blue-600 text-white rounded"
      >
        Draw
      </button>
      <button
        onClick={() => props.onModeChange('edit')}
        className="px-2 py-1 bg-blue-600 text-white rounded"
      >
        Edit
      </button>
    </div>
  );
};