/**
 * SnapIndicatorOverlay
 * Visual feedback για snap points (■ endpoint, △ midpoint, κλπ)
 *
 * @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Βήμα 4: Εμφάνιση ένδειξης
 * @see docs/features/snapping/ARCHITECTURE.md - Αρχιτεκτονική snap system
 */
'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ViewTransform } from '../../systems/rulers-grid/config';
// 🏢 ENTERPRISE (2026-02-17): World→Screen conversion for correct indicator positioning
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// 🏢 ENTERPRISE: Centralized design tokens for overlay colors
import { canvasUI } from '@/styles/design-tokens/canvas';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
// 🏢 ENTERPRISE: Centralized layout tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-137: Centralized Snap Icon Geometry
import {
  SNAP_ICON_GEOMETRY,
  getSnapIconQuarter,
  getTangentCircleRadius,
  getNodeDotRadius
} from '../../rendering/ui/snap/snap-icon-config';

// ADR-363 Phase A + 5.5i + ADR-370 + Slice 2i: BIM description → i18n key (SSoT).
import { resolveBimSnapLabelText } from '../../snapping/snap-description-keys';

interface SnapResult {
  point: Point2D;
  type: string;
  description?: string;
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
 * @see ADR-137: Snap Icon Geometry Centralization
 */
// 🏢 ADR-137: Using centralized snap icon geometry
const SNAP_INDICATOR_SIZE = SNAP_ICON_GEOMETRY.SIZE;
const SNAP_INDICATOR_HALF = SNAP_INDICATOR_SIZE * SNAP_ICON_GEOMETRY.HALF_RATIO;

/**
 * 🎯 ENTERPRISE: Renders industry-standard snap shape based on type
 * Each snap type has a unique geometric symbol for instant recognition
 */
function SnapShape({ type, color }: { type: string; color: string }) {
  // 🏢 ADR-133: Centralized SVG stroke width
  const strokeWidth = PANEL_LAYOUT.SVG_ICON.STROKE_WIDTH.STANDARD;
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
      // 🏢 ADR-137: Using centralized quarter calculation
      const quarter = getSnapIconQuarter(size);
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
      // 🏢 ADR-137: Using centralized quarter calculation (same as perpendicular)
      const lineOffset = getSnapIconQuarter(size);
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
          {/* 🏢 ADR-137: Using centralized tangent circle radius (UNIFIED: was 0.5 vs 0.6) */}
          <circle cx={half} cy={half} r={getTangentCircleRadius(half)} fill="none" stroke={color} strokeWidth={strokeWidth} />
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
          {/* 🏢 ADR-137: Using centralized node dot radius */}
          <circle cx={half} cy={half} r={getNodeDotRadius()} fill={color} />
        </svg>
      );

    // ⊕ BIM_COLUMN_CENTER + BIM_CENTER: Circle + crosshair — structural axis / centroid.
    // Revit/Tekla plan-view convention: center shown as circle with cross (ADR-363/ADR-370).
    case 'bim_column_center':
    case 'bim_center':
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
          <line x1={half} y1={strokeWidth} x2={half} y2={size - strokeWidth} stroke={color} strokeWidth={strokeWidth} />
          <line x1={strokeWidth} y1={half} x2={size - strokeWidth} y2={half} stroke={color} strokeWidth={strokeWidth} />
        </svg>
      );

    // ┘ BIM_CORNER: L-bracket — ADR-370 generic BIM structural-corner snap (one glyph for
    // wall/beam/slab/column/opening/foundation/…). The per-entity label comes from the
    // candidate description; «περίεργα σχήματα» emit no description → glyph ΧΩΡΙΣ text.
    // Industry convention: right-angle bracket at corner indicates structural face corner.
    case 'bim_corner':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polyline
            points={`${strokeWidth},${strokeWidth} ${strokeWidth},${size - strokeWidth} ${size - strokeWidth},${size - strokeWidth}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      );

    // ▲ BIM_MIDPOINT: Filled triangle — ADR-370 BIM edge/axis midpoint («Μέσο τοίχου»…).
    // Distinct from the generic △ midpoint (outline) — a filled triangle reads as
    // "structural BIM midpoint", mirroring the ┘ corner / ⊕ centre BIM family.
    case 'bim_midpoint':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${half},${strokeWidth} ${size - strokeWidth},${size - strokeWidth} ${strokeWidth},${size - strokeWidth}`}
            fill={color}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="miter"
          />
        </svg>
      );

    // ◇ BIM_MEP_CONNECTOR: Diamond + center dot — ADR-408 Φ9 MEP connector attach point.
    // Distinct from ⊕ column centre (circle+cross) and ■ endpoint; mirrors the
    // Revit/MEP "Connector" marker convention.
    case 'bim_mep_connector':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${half},${strokeWidth} ${size - strokeWidth},${half} ${half},${size - strokeWidth} ${strokeWidth},${half}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="miter"
          />
          <circle cx={half} cy={half} r={getNodeDotRadius()} fill={color} />
        </svg>
      );

    // ═ GUIDE: Horizontal double-line with center tick — ADR-189
    case 'guide':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Two horizontal parallel lines (guide symbol) */}
          <line x1={strokeWidth} y1={half - 3} x2={size - strokeWidth} y2={half - 3} stroke={color} strokeWidth={strokeWidth} />
          <line x1={strokeWidth} y1={half + 3} x2={size - strokeWidth} y2={half + 3} stroke={color} strokeWidth={strokeWidth} />
          {/* Center vertical tick mark */}
          <line x1={half} y1={strokeWidth} x2={half} y2={size - strokeWidth} stroke={color} strokeWidth={strokeWidth} />
        </svg>
      );

    // ▣ TEXT: Nested square (outer + inner) — ADR-378 Phase 3 TEXT/MTEXT 8-point snap
    // Industry convention: text snap rendered as concentric rectangles (Revit/AutoCAD distinct from generic endpoint).
    case 'text':
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
          <rect
            x={size * 0.3}
            y={size * 0.3}
            width={size * 0.4}
            height={size * 0.4}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    // ✦ CONSTRUCTION_POINT: Diamond with center dot — ADR-189
    case 'construction_point':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Diamond outline */}
          <polygon
            points={`${half},${strokeWidth} ${size - strokeWidth},${half} ${half},${size - strokeWidth} ${strokeWidth},${half}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          {/* Center dot */}
          <circle cx={half} cy={half} r={getNodeDotRadius()} fill={color} />
        </svg>
      );

    // ⊙ ROTATION_PIVOT: Circle + center dot — ADR-397 rotation centre snap.
    // Echoes the on-canvas pivot ⊙ marker so the snap reads as "the rotation centre".
    case 'rotation_pivot':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={half - strokeWidth} fill="none" stroke={color} strokeWidth={strokeWidth} />
          <circle cx={half} cy={half} r={getNodeDotRadius()} fill={color} />
        </svg>
      );

    // ◇ ROTATION_GRIP: Diamond — ADR-397 rotating entity grip snap.
    case 'rotation_grip':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${half},${strokeWidth} ${size - strokeWidth},${half} ${half},${size - strokeWidth} ${strokeWidth},${half}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="miter"
          />
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
  const { t } = useTranslation('dxf-viewer-shell');
  if (!snapResult || !snapResult.point || !transform) return null;
  // AutoCAD standard: grid snap has no floating visual marker — cursor snaps silently
  if (snapResult.type === 'grid') return null;

  const { point, type, description } = snapResult;
  // ADR-370: BIM label = «Γωνία/Μέσο/Κέντρο» + entity noun (composition), or null for
  // «περίεργα σχήματα» (empty description) → glyph WITHOUT text (req #4).
  const bimLabel = resolveBimSnapLabelText(t, description) ?? undefined;
  const snapColor = canvasUI.overlay.colors.snap.border;

  // 🏢 ENTERPRISE (2026-02-17): Convert world coordinates → screen coordinates
  // The snap result contains world-space coordinates from ProSnapEngineV2.
  // We must convert to screen-space for correct CSS positioning.
  // Uses the same CoordinateTransforms pipeline as entity rendering (Y-inversion + margins).
  const screenPos = CoordinateTransforms.worldToScreen(
    point,
    transform as { scale: number; offsetX: number; offsetY: number },
    viewport
  );

  return (
    // 🏢 ENTERPRISE: pointer-events-none για να μην εμποδίζει mouse events στο canvas κάτω
    <div
      data-dxf-overlay="snap"
      className={`${className} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
      style={{ zIndex: portalComponents.overlay.snap.zIndex() }}
    >
      {/* 🏢 ENTERPRISE: Industry-standard snap indicator (AutoCAD/MicroStation style) */}
      <div
        className={`absolute ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
        style={{
          left: screenPos.x - SNAP_INDICATOR_HALF,
          top: screenPos.y - SNAP_INDICATOR_HALF,
          filter: `drop-shadow(0 0 2px ${snapColor})` // Glow effect for visibility
        }}
      >
        <SnapShape type={type} color={snapColor} />
      </div>
      {/* ADR-363 Phase A: BIM snap label — shown only for wall/slab/opening snaps */}
      {bimLabel && (
        <div
          className={`absolute ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}
          style={{
            left: screenPos.x + SNAP_INDICATOR_SIZE,
            top: screenPos.y - SNAP_INDICATOR_HALF,
            color: snapColor,
            whiteSpace: 'nowrap',
          }}
        >
          {bimLabel}
        </div>
      )}
    </div>
  );
}