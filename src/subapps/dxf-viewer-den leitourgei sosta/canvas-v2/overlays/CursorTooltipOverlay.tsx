'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';

interface CursorTooltipOverlayProps {
  isActive: boolean;
  cursorPosition: Point2D | null;
  activeTool: string;
  canvasRect: DOMRect | null;
  className?: string;
}

export default function CursorTooltipOverlay({
  isActive,
  cursorPosition,
  activeTool,
  canvasRect,
  className = ''
}: CursorTooltipOverlayProps) {
  if (!isActive || !cursorPosition || activeTool === 'select') return null;

  const toolLabels: { [key: string]: string } = {
    'line': 'Γραμμή',
    'rectangle': 'Ορθογώνιο',
    'circle': 'Κύκλος',
    'pan': 'Μετακίνηση',
    'zoom-window': 'Παράθυρο Zoom',
    'layering': 'Επίπεδα'
  };

  const label = toolLabels[activeTool] || activeTool;

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div
        className="absolute text-sm text-white bg-gray-800 bg-opacity-90 px-2 py-1 rounded shadow-lg"
        style={{
          left: cursorPosition.x + 15,
          top: cursorPosition.y - 35,
          zIndex: 1005
        }}
      >
        {label}
      </div>
    </div>
  );
}