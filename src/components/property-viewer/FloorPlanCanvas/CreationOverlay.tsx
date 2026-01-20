'use client';

import React from 'react';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface Point {
  x: number;
  y: number;
}

interface CreationOverlayProps {
  mode?: string;
  isCreating?: boolean;
  currentPolyline?: Point[];
  vertices?: Point[]; // Legacy prop για backward compatibility
  mousePosition?: Point;
  className?: string;
}

export function CreationOverlay({
  mode,
  isCreating = false,
  currentPolyline = [],
  vertices = [], // Default empty array
  mousePosition,
  className = ''
}: CreationOverlayProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  // Use currentPolyline if available, fallback to vertices
  const points = currentPolyline.length > 0 ? currentPolyline : vertices;

  // Safe check για undefined/null arrays
  if (!Array.isArray(points) || points.length === 0 || !mousePosition) {
    return null;
  }

  // Don't render if not in creation mode
  if (mode !== 'create' && !isCreating) {
    return null;
  }

  // Get translation labels for SVG text
  const instructionText = points.length === 0
    ? t('creation.clickToStart')
    : t('creation.pointsContinue', { count: points.length });

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <svg 
        width="100%" 
        height="100%" 
        className="absolute inset-0 z-[15]"
      >
        {/* Existing polyline */}
        {points.length > 1 && (
          <polyline
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
          />
        )}
        
        {/* Current line from last point to mouse */}
        {points.length > 0 && mousePosition && (
          <line
            x1={points[points.length - 1].x}
            y1={points[points.length - 1].y}
            x2={mousePosition.x}
            y2={mousePosition.y}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="3,3"
            opacity="0.5"
          />
        )}
        
        {/* Points */}
        {points.map((point, index) => (
          <g key={index}>
            {/* Point circle */}
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#3b82f6"
              stroke="white"
              strokeWidth="2"
            />
            
            {/* Point label */}
            <text
              x={point.x + 8}
              y={point.y - 8}
              fontSize="12"
              fill="#374151"
              className="font-medium"
            >
              {index + 1}
            </text>
          </g>
        ))}
        
        {/* Mouse position indicator */}
        {mousePosition && (
          <circle
            cx={mousePosition.x}
            cy={mousePosition.y}
            r="3"
            fill="#ef4444"
            opacity="0.6"
          />
        )}
        
        {/* Instructions */}
        {isCreating && (
          <text
            x="10"
            y="30"
            fontSize="14"
            fill="#374151"
            className="font-medium"
          >
            {instructionText}
          </text>
        )}
      </svg>
    </div>
  );
}
