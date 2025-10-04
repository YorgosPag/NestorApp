'use client';

import React from 'react';
import { useCursor } from '../systems/cursor';

interface CursorTooltipOverlayProps {
  className?: string;
  isActive?: boolean;
  cursorPosition?: { x: number; y: number } | null;
  activeTool?: string;
  canvasRect?: DOMRect | null;
}

export default function CursorTooltipOverlay({
  className = '',
  isActive = true,
  cursorPosition = null,
  activeTool = 'select',
  canvasRect = null
}: CursorTooltipOverlayProps) {
  const { settings } = useCursor();

  // Εμφάνιση tooltip μόνο όταν είναι ενεργό στις ρυθμίσεις
  if (!settings.behavior.cursor_tooltip || !isActive || !cursorPosition) {
    return null;
  }

  // Tooltip content βάσει εργαλείου
  const getTooltipContent = () => {
    switch (activeTool) {
      case 'select':
        return 'Επιλογή αντικειμένων';
      case 'line':
        return 'Σχεδίαση γραμμής';
      case 'rectangle':
        return 'Σχεδίαση ορθογωνίου';
      case 'circle':
        return 'Σχεδίαση κύκλου';
      case 'polyline':
        return 'Σχεδίαση πολυγραμμής';
      case 'ruler':
      case 'measure-distance':
        return 'Μέτρηση απόστασης';
      case 'measure-angle':
        return 'Μέτρηση γωνίας';
      case 'measure-area':
        return 'Μέτρηση εμβαδού';
      case 'pan':
        return 'Μετακίνηση οθόνης';
      case 'zoom':
        return 'Εστίαση';
      case 'zoom-window':
        return 'Εστίαση σε περιοχή';
      default:
        return activeTool?.charAt(0)?.toUpperCase() + activeTool?.slice(1) || 'Unknown Tool';
    }
  };

  // Σταθερό positioning: Πάντα αγκυρωμένο στον κέρσορα  
  // Βάση του tooltip container: 15px δεξιά και 15px πάνω από κέρσορα
  // ΠΑΝΤΑ στην ίδια θέση ανεξάρτητα από canvas bounds
  const tooltipX = cursorPosition.x + 15; // Σταθερά 15px δεξιά από κάθετη γραμμή κέρσορα  
  const tooltipY = cursorPosition.y - 15; // Σταθερά 15px πάνω από οριζόντια γραμμή κέρσορα (βάση container)

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: tooltipX,
        top: tooltipY,
        zIndex: 1700 // Πάνω από dynamic input
      }}
    >
      <div className="bg-gray-800/90 text-white px-2 py-1 rounded text-xs border border-gray-600/50 shadow-md whitespace-nowrap">
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
          <span className="text-xs">{getTooltipContent()}</span>
        </div>
      </div>
    </div>
  );
}

export { CursorTooltipOverlay };