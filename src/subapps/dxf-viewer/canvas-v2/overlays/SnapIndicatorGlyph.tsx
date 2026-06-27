/**
 * SnapIndicatorGlyph — the ONE screen-space presentational SSoT for a snap marker
 * (glyph + BIM label + type colour). ADR-542.
 *
 * Extracted from `SnapIndicatorOverlay` so BOTH the 2D canvas overlay AND the 3D BIM
 * viewport overlay (`BimSnapIndicatorOverlay3D`) draw the SAME ■/△/┘/▲/⊕ glyph, the SAME
 * «Γωνία/Μέσο/Κέντρο κολώνας» label (`resolveBimSnapLabelText`), and the SAME per-type
 * colour (`resolveSnapColor`). The ONLY thing the two callers differ in is how they project
 * the snap point to screen pixels: the 2D wrapper uses `CoordinateTransforms.worldToScreen`,
 * the 3D wrapper projects through the live Three.js camera. This component takes an already
 * SCREEN-SPACE position — it never projects. One render code = one source of truth.
 *
 * @see SnapIndicatorOverlay.tsx — the 2D wrapper (world→screen, then renders this).
 * @see bim-3d/viewport/snap/BimSnapIndicatorOverlay3D.tsx — the 3D wrapper (camera→screen).
 */
'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Point2D } from '../../rendering/types/Types';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
// 🏢 ENTERPRISE: Centralized layout tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-137 (geometry) + ADR-515 (χρώμα ανά τύπο) — ΕΝΑ snap-visual SSoT entry point
import {
  SNAP_ICON_GEOMETRY,
  getSnapIconQuarter,
  getTangentCircleRadius,
  getNodeDotRadius,
  resolveSnapColor
} from '../../rendering/ui/snap/snap-visual-config';
// ADR-363 Phase A + 5.5i + ADR-370 + Slice 2i: BIM description → i18n key (SSoT).
import { resolveBimSnapLabelText } from '../../snapping/snap-description-keys';

// 🏢 ADR-137: Using centralized snap icon geometry
const SNAP_INDICATOR_SIZE = SNAP_ICON_GEOMETRY.SIZE;
const SNAP_INDICATOR_HALF = SNAP_INDICATOR_SIZE * SNAP_ICON_GEOMETRY.HALF_RATIO;

/**
 * 🎯 ENTERPRISE: Renders industry-standard snap shape based on type.
 * Each snap type has a unique geometric symbol for instant recognition
 * (AutoCAD/MicroStation snap marker conventions, ADR-137).
 */
export function SnapShape({ type, color }: { type: string; color: string }) {
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

    // ⊕ BIM_CENTER: Circle + crosshair — structural centroid (column/slab/foundation/…).
    // Revit/Tekla plan-view convention: center shown as circle with cross (ADR-370).
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

export interface SnapIndicatorGlyphProps {
  /** Already-projected SCREEN-space position (px). Callers project; this never does. */
  screenPos: Point2D;
  /** Snap type (`bim_corner` | `bim_midpoint` | `endpoint` | …) → glyph + colour. */
  type: string;
  /** BIM snap description (`bim-column-corner` | …) → composed «Γωνία κολώνας» label, or empty. */
  description?: string;
  className?: string;
}

/**
 * The shared snap marker visual: a type glyph at `screenPos` + an optional BIM label to its
 * right. Identical pixels in 2D and 3D — the ONLY SSoT for «πώς δείχνει μια έλξη». ADR-542.
 */
export function SnapIndicatorGlyph({ screenPos, type, description, className = '' }: SnapIndicatorGlyphProps) {
  const { t } = useTranslation('dxf-viewer-shell');
  // ADR-370: BIM label = «Γωνία/Μέσο/Κέντρο» + entity noun (composition), or null for
  // «περίεργα σχήματα» (empty description) → glyph WITHOUT text (req #4).
  const bimLabel = resolveBimSnapLabelText(t, description) ?? undefined;
  // 🏢 ADR-515: type-specific χρώμα marker (Revit-rich) από το snap-visual SSoT.
  const snapColor = resolveSnapColor(type);

  return (
    // 🏢 ENTERPRISE: pointer-events-none ώστε να μην εμποδίζει mouse events στον καμβά από κάτω.
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
      {/* ADR-363 Phase A: BIM snap label — shown only for wall/slab/column/opening snaps */}
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
