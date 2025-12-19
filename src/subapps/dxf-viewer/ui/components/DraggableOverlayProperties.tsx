'use client';

import React from 'react';
import { OverlayProperties } from '../OverlayProperties';
import { usePrecisionPositioning } from '../../utils/precision-positioning';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '../../../../components/ui/effects';
import { PANEL_COLORS } from '../../config/panel-tokens';
// Enterprise floating panel design tokens integration

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

  const [position, setPosition] = React.useState<{x: number; y: number}>(initialPosition || { x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // Update position when initial position changes (on first mount)
  React.useEffect(() => {
    if (initialPosition) {
      setPosition(initialPosition);
    }
  }, [initialPosition?.x, initialPosition?.y]);

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
    if (!isDragging) return;

    // Inline event handlers to avoid TypeScript callback dependency issues
    const handleMouseMove = (e: MouseEvent) => {
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

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart.x, dragStart.y]);

  const combinedStyles = React.useMemo(() => ({
    // Enterprise draggable positioning (from floating-system-tokens)
    position: 'fixed' as const,
    cursor: (isDragging ? 'grabbing' : 'grab') as 'grab' | 'grabbing',
    userSelect: 'none' as const,
    left: position?.x || 0,
    top: position?.y || 0,
    zIndex: 50, // Enterprise floating panels z-index (from floating-system-tokens)
    borderRadius: '8px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: `1px solid ${PANEL_COLORS.BORDER_SECONDARY}`,
    backgroundColor: PANEL_COLORS.BG_PRIMARY,
    color: PANEL_COLORS.TEXT_PRIMARY,
    '--bg-secondary': PANEL_COLORS.BG_SECONDARY,
    '--bg-tertiary': PANEL_COLORS.BG_TERTIARY,
    '--text-secondary': PANEL_COLORS.TEXT_SECONDARY
  } as React.CSSProperties & Record<string, string>), [position, isDragging]);

  return (
    <div
      ref={containerRef}
      style={combinedStyles}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
    >
      {/* Drag Handle Header */}
      <div
        className={`bg-[var(--bg-secondary)] rounded-t-lg px-3 py-2 border-b border-gray-600 flex items-center justify-between ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } transition-colors hover:bg-gray-600`}
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
          className={`bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} transition-colors`}
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
