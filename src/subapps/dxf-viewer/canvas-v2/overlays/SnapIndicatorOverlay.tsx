'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ViewTransform } from '../../systems/rulers-grid/config';
// 🏢 ENTERPRISE: Centralized design tokens for overlay colors
import { canvasUI } from '@/styles/design-tokens/canvas';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
// 🏢 ENTERPRISE: Centralized layout tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// 🏢 ENTERPRISE NOTE: This component uses a simplified SnapResult interface
// TODO: Migrate to use ProSnapResult.snappedPoint instead of point when refactoring
interface SnapResult {
  point: Point2D;
  type: string;
}

interface SnapIndicatorOverlayProps {
  snapResult?: SnapResult | null;
  viewport: { width: number; height: number };
  canvasRect: DOMRect | null;
  transform?: ViewTransform;  // ✅ ENTERPRISE: Proper type instead of any
  className?: string;
}

/**
 * 🏢 ENTERPRISE: Industry-standard snap indicator symbols
 * Based on AutoCAD/MicroStation snap marker conventions
 *
 * @see AutoCAD Object Snap Markers: https://knowledge.autodesk.com/support/autocad
 * @see MicroStation AccuSnap: https://docs.bentley.com
 */
const SNAP_INDICATOR_SIZE = 12; // pixels - CAD standard size
const SNAP_INDICATOR_HALF = SNAP_INDICATOR_SIZE / 2;

/**
 * 🎯 ENTERPRISE: Renders industry-standard snap shape based on type
 * Each snap type has a unique geometric symbol for instant recognition
 */
function SnapShape({ type, color }: { type: string; color: string }) {
  const strokeWidth = 2;
  const size = SNAP_INDICATOR_SIZE;
  const half = SNAP_INDICATOR_HALF;

  switch (type.toLowerCase()) {
    // ■ ENDPOINT: Square - AutoCAD/MicroStation standard
    case 'endpoint':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size - strokeWidth}
            height={size - strokeWidth}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    // △ MIDPOINT: Triangle - AutoCAD/MicroStation standard
    case 'midpoint':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${half},${strokeWidth} ${size - strokeWidth},${size - strokeWidth} ${strokeWidth},${size - strokeWidth}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    // ○ CENTER: Circle - AutoCAD/MicroStation standard
    case 'center':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={half}
            cy={half}
            r={half - strokeWidth}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    // ✕ INTERSECTION: X shape - AutoCAD/MicroStation standard
    case 'intersection':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <line x1={strokeWidth} y1={strokeWidth} x2={size - strokeWidth} y2={size - strokeWidth} stroke={color} strokeWidth={strokeWidth} />
          <line x1={size - strokeWidth} y1={strokeWidth} x2={strokeWidth} y2={size - strokeWidth} stroke={color} strokeWidth={strokeWidth} />
        </svg>
      );

    // ⊥ PERPENDICULAR: Right angle symbol - AutoCAD standard
    case 'perpendicular':
      const quarter = half / 2;
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polyline
            points={`${half - quarter},${strokeWidth} ${half - quarter},${half - quarter} ${strokeWidth},${half - quarter}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    // ║ PARALLEL: Two parallel lines - AutoCAD standard
    case 'parallel':
      const lineOffset = size / 4;
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <line x1={strokeWidth} y1={half - lineOffset} x2={size - strokeWidth} y2={half - lineOffset} stroke={color} strokeWidth={strokeWidth} />
          <line x1={strokeWidth} y1={half + lineOffset} x2={size - strokeWidth} y2={half + lineOffset} stroke={color} strokeWidth={strokeWidth} />
        </svg>
      );

    // ◯─ TANGENT: Circle with tangent line - AutoCAD standard
    case 'tangent':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={half * 0.5} fill="none" stroke={color} strokeWidth={strokeWidth} />
          <line x1={strokeWidth} y1={half} x2={size - strokeWidth} y2={half} stroke={color} strokeWidth={strokeWidth} />
        </svg>
      );

    // ◇ QUADRANT: Diamond - AutoCAD/MicroStation standard
    case 'quadrant':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${half},${strokeWidth} ${size - strokeWidth},${half} ${half},${size - strokeWidth} ${strokeWidth},${half}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    // + NEAREST: Plus sign - AutoCAD standard
    case 'nearest':
    case 'near':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <line x1={half} y1={strokeWidth} x2={half} y2={size - strokeWidth} stroke={color} strokeWidth={strokeWidth} />
          <line x1={strokeWidth} y1={half} x2={size - strokeWidth} y2={half} stroke={color} strokeWidth={strokeWidth} />
        </svg>
      );

    // • GRID: Filled dot - Standard grid snap indicator
    case 'grid':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={3} fill={color} />
        </svg>
      );

    // ↗ EXTENSION: Arrow extension line
    case 'extension':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <line x1={strokeWidth} y1={size - strokeWidth} x2={size - strokeWidth} y2={strokeWidth} stroke={color} strokeWidth={strokeWidth} strokeDasharray="2,2" />
        </svg>
      );

    // ⊙ NODE/INSERTION: Circle with center dot
    case 'node':
    case 'insertion':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={half - strokeWidth} fill="none" stroke={color} strokeWidth={strokeWidth} />
          <circle cx={half} cy={half} r={2} fill={color} />
        </svg>
      );

    // Default: X shape (intersection style) - fallback
    default:
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <line x1={strokeWidth} y1={strokeWidth} x2={size - strokeWidth} y2={size - strokeWidth} stroke={color} strokeWidth={strokeWidth} />
          <line x1={size - strokeWidth} y1={strokeWidth} x2={strokeWidth} y2={size - strokeWidth} stroke={color} strokeWidth={strokeWidth} />
        </svg>
      );
  }
}

export default function SnapIndicatorOverlay({
  snapResult,
  viewport,
  canvasRect,
  transform,
  className = ''
}: SnapIndicatorOverlayProps) {
  if (!snapResult || !snapResult.point) return null;

  const { point, type } = snapResult;
  const snapColor = canvasUI.overlay.colors.snap.border;

  return (
    <div className={className} style={{ zIndex: portalComponents.overlay.snap.zIndex() }}>
      {/* 🏢 ENTERPRISE: Industry-standard snap indicator (AutoCAD/MicroStation style) */}
      <div
        className={`absolute ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
        style={{
          left: point.x - SNAP_INDICATOR_HALF,
          top: point.y - SNAP_INDICATOR_HALF,
          filter: `drop-shadow(0 0 2px ${snapColor})` // Glow effect for visibility
        }}
      >
        <SnapShape type={type} color={snapColor} />
      </div>
    </div>
  );
}