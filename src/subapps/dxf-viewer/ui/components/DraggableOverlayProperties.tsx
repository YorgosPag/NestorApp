'use client';

import React from 'react';
import { OverlayProperties } from '../OverlayProperties';
import { usePrecisionPositioning } from '../../utils/precision-positioning';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '../../../../components/ui/effects';
import { PANEL_COLORS } from '../../config/panel-tokens';

interface DraggableOverlayPropertiesProps {
  overlay: any;
  onUpdate: (overlayId: string, updates: any) => void;
  onClose: () => void;
}

export const DraggableOverlayProperties: React.FC<DraggableOverlayPropertiesProps> = ({
  overlay,
  onUpdate,
  onClose
}) => {
  // CENTRALIZED PRECISION POSITIONING
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { position: initialPosition } = usePrecisionPositioning(containerRef, {
    targetPoint: { x: 2550, y: 1230 },
    alignment: 'bottom-right',
    dependencies: [overlay]
  });

  const [position, setPosition] = React.useState(initialPosition);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // Update position when initial position changes (on first mount)
  React.useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition.x, initialPosition.y]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if clicking on the header, not buttons or inputs
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
      const maxX = window.innerWidth - 320; // Panel width
      const maxY = window.innerHeight - 400; // Panel height estimate

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
      ref={containerRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 90,
        cursor: isDragging ? 'grabbing' : 'auto',
        userSelect: isDragging ? 'none' : 'auto',
        backgroundColor: PANEL_COLORS.BG_PRIMARY,
        color: PANEL_COLORS.TEXT_PRIMARY
      }}
      className="bg-gray-900 rounded-lg shadow-xl border border-gray-500 select-none"
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
    >
      {/* Drag Handle Header */}
      <div
        className={`bg-gray-700 rounded-t-lg px-3 py-2 border-b border-gray-600 flex items-center justify-between ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } transition-colors hover:bg-gray-600`}
        style={{ backgroundColor: PANEL_COLORS.BG_SECONDARY }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          </div>
          <span className="text-sm text-gray-300 font-medium">🏠 Overlay Properties</span>
        </div>
        <button
          onClick={onClose}
          className={`text-gray-400 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} transition-colors`}
          style={{ backgroundColor: PANEL_COLORS.BG_TERTIARY, color: PANEL_COLORS.TEXT_SECONDARY }}
        >
          ✕
        </button>
      </div>

      {/* Properties Panel Content */}
      <div className="p-0">
        <OverlayProperties
          overlay={overlay}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
