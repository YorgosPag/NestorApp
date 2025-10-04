'use client';

/**
 * DRAGGABLE OVERLAY TOOLBAR
 * Floating, draggable toolbar για overlay editing operations
 * Extracted από DxfViewerContent.tsx για cleaner architecture
 */

import React from 'react';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import type { ToolType } from '../../ui/toolbar/types';
import { OverlayToolbar } from '../../ui/OverlayToolbar';
import { usePrecisionPositioning } from '../../utils/precision-positioning';

export interface DraggableOverlayToolbarProps {
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
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ PRECISION POSITIONING για toolbar
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const { position: initialPosition, hasInitialized } = usePrecisionPositioning(toolbarRef, {
    targetPoint: { x: 2550, y: 237 }, // 🎯 ΝΕΕΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ: X=2550, Y=237 για πάνω δεξιά γωνία
    alignment: 'top-right' // Top-right γιατί θέλουμε το toolbar στο πάνω μέρος με δεξιά ευθυγράμμιση
  });

  // State για dragging (μετά την αρχική τοποθέτηση, επιτρέπουμε dragging)
  const [position, setPosition] = React.useState(initialPosition);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // 🎯 ΜΟΝΟ ΑΡΧΙΚΗ ΘΕΣΗ: Ενημέρωση position μόνο για την πρώτη initialization
  // ΔΕΝ επαναφέρουμε τη θέση μετά το drag - αφήνουμε τον χρήστη να επιλέξει
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
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        pointerEvents: 'auto',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className="bg-gray-900 rounded-lg shadow-xl border border-gray-500 select-none"
      onMouseDown={handleMouseDown}
    >
      {/* Drag Handle - Visible area για dragging */}
      <div
        className="bg-gray-700 rounded-t-lg px-3 py-1 border-b border-gray-600 flex items-center justify-between cursor-grab active:cursor-grabbing"
        style={{ minHeight: '24px' }}
      >
        <span className="text-xs text-gray-400 font-medium">🔧 Overlay Tools</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
        </div>
      </div>

      {/* Actual Toolbar Content */}
      <OverlayToolbar {...props} />
    </div>
  );
};
