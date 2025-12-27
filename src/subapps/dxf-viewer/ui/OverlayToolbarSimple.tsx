'use client';
import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
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
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // Απλή έκδοση για debugging
  return (
    <div className={`flex items-center gap-2 p-2 ${colors.bg.secondary} ${quick.card}`}>
      <div className={`${colors.text.primary}`}>Overlay Toolbar (Simple Version)</div>
      <button
        onClick={() => props.onModeChange('select')}
        className={`px-2 py-1 ${colors.bg.info} ${colors.text.inverted} rounded`}
      >
        Select
      </button>
      <button
        onClick={() => props.onModeChange('draw')}
        className={`px-2 py-1 ${colors.bg.info} ${colors.text.inverted} rounded`}
      >
        Draw
      </button>
      <button
        onClick={() => props.onModeChange('edit')}
        className={`px-2 py-1 ${colors.bg.info} ${colors.text.inverted} rounded`}
      >
        Edit
      </button>
    </div>
  );
};