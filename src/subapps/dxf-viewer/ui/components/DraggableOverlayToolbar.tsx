'use client';

import React from 'react';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import type { ToolType } from '../toolbar/types';
import { OverlayToolbar } from '../OverlayToolbar';
import { usePrecisionPositioning } from '../../utils/precision-positioning';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';

interface DraggableOverlayToolbarProps {
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
  onToolChange: (tool: ToolType) => void;
}

export const DraggableOverlayToolbar: React.FC<DraggableOverlayToolbarProps> = (props) => {
  // CENTRALIZED PRECISION POSITIONING for toolbar
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const { position: initialPosition, hasInitialized } = usePrecisionPositioning(toolbarRef, {
    targetPoint: { x: 2550, y: 237 }, // Target coordinates: X=2550, Y=237 for top-right corner
    alignment: 'top-right' // Top-right alignment
  });

  // State for dragging (after initial positioning, allow dragging)
  const [position, setPosition] = React.useState(initialPosition);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // ONLY INITIAL POSITION: Update position only for first initialization
  // Do NOT reset position after drag - let user choose
  const [hasSetInitialPosition, setHasSetInitialPosition] = React.useState(false);

  React.useEffect(() => {
    if (hasInitialized && !hasSetInitialPosition) {
      setPosition(initialPosition);
      setHasSetInitialPosition(true);
    }
  }, [hasInitialized, hasSetInitialPosition, initialPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if clicking on the toolbar background, not buttons
    if ((e.target as HTMLElement).closest('button, input, select')) {
      return;
    }

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Keep within viewport bounds
      const maxX = window.innerWidth - 300; // Approximate toolbar width
      const maxY = window.innerHeight - 100; // Approximate toolbar height

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        pointerEvents: 'auto'
      }}
      className="select-none"
    >
      {/* OVERLAY TOOLBAR CONTENT */}
      <OverlayToolbar
        mode={props.mode}
        onModeChange={props.onModeChange}
        currentStatus={props.currentStatus}
        onStatusChange={props.onStatusChange}
        currentKind={props.currentKind}
        onKindChange={props.onKindChange}
        snapEnabled={props.snapEnabled}
        onSnapToggle={props.onSnapToggle}
        selectedOverlayId={props.selectedOverlayId}
        onDuplicate={props.onDuplicate}
        onDelete={props.onDelete}
        canUndo={props.canUndo}
        canRedo={props.canRedo}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onToolChange={props.onToolChange ? (tool: string) => props.onToolChange(tool as ToolType) : undefined}
      />
    </div>
  );
};
