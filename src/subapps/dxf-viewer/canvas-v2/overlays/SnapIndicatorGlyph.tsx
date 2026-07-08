/**
 * SnapIndicatorGlyph — the ONE screen-space presentational SSoT for a snap marker
 * (glyph + BIM label + type colour). ADR-542.
 *
 * Extracted from `SnapIndicatorOverlay` so BOTH the 2D canvas overlay AND the 3D BIM
 * viewport overlay (`BimSnapIndicatorOverlay3D`) draw the SAME glyph, the SAME
 * «Γωνία/Μέσο/Κέντρο κολώνας» label (`resolveBimSnapLabelText`), and the SAME per-type
 * colour (`resolveSnapColor`). ADR-597 §unified-glyph (2026-07-05): a BIM corner/midpoint/
 * centre reuses the SAME ■/△/○ symbol as the geometric endpoint/midpoint/centre (Revit/
 * AutoCAD convention) — the entity noun lives ONLY in the label, not in a distinct shape.
 * The ONLY thing the two callers differ in is how they project
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
  getSnapIconSize,
  getSnapIconHalf,
  getSnapIconQuarter,
  getTangentCircleRadius,
  getNodeDotRadius,
  resolveSnapColor
} from '../../rendering/ui/snap/snap-visual-config';
// ADR-363 Phase A + 5.5i + ADR-597 + Slice 2i: BIM description → i18n key (SSoT).
import { resolveBimSnapLabelText } from '../../snapping/snap-description-keys';
// ADR-508 §label-layout (Case A) — το snap label σε ΞΕΧΩΡΙΣΤΗ baseline πάνω από το glyph ώστε να
// μην πέφτει στο canvas dim pill (cross-layer separate-baselines contract).
import { snapLabelTop } from '../preview-canvas/overlay-label-layout';

/**
 * 🎯 ENTERPRISE: Renders industry-standard snap shape based on type.
 * Each snap type has a unique geometric symbol for instant recognition
 * (AutoCAD/MicroStation snap marker conventions, ADR-137).
 */
export function SnapShape({ type, color }: { type: string; color: string }) {
  // 🏢 ADR-133: Centralized SVG stroke width
  const strokeWidth = PANEL_LAYOUT.SVG_ICON.STROKE_WIDTH.STANDARD;
  // Per-type box size (dimension glyphs are bumped; all others fall back to base).
  const size = getSnapIconSize(type);
  const half = getSnapIconHalf(size);

  switch (type.toLowerCase()) {
    // ■ ENDPOINT: Square - AutoCAD/MicroStation standard.
    // ADR-597 §unified-glyph (2026-07-05): μια BIM «γωνία» (`bim_corner`) είναι σημείο
    // endpoint-class → ΙΔΙΟ ■ σύμβολο με το γεωμετρικό endpoint, όπως Revit/AutoCAD. Η
    // σημασιολογία («Γωνία κολώνας») ζει στην ετικέτα (`bimLabel`) — ΟΧΙ σε ξεχωριστό σχήμα.
    case 'endpoint':
    case 'bim_corner':
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

    // △ MIDPOINT: Triangle - AutoCAD/MicroStation standard.
    // ADR-597 §unified-glyph: `bim_midpoint` = midpoint-class σημείο → ΙΔΙΟ △ (outline).
    case 'midpoint':
    case 'bim_midpoint':
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

    // ○ CENTER: Circle - AutoCAD/MicroStation standard.
    // ADR-597 §unified-glyph: `bim_center` = center-class σημείο → ΙΔΙΟ ○.
    case 'center':
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

    // ⊕/┘/▲ BIM_CENTER / BIM_CORNER / BIM_MIDPOINT — ADR-597 §unified-glyph (2026-07-05):
    // ΔΕΝ έχουν πλέον ξεχωριστό σχήμα. Μια BIM γωνία/μέσο/κέντρο είναι το ΙΔΙΟ ΕΙΔΟΣ σημείου
    // με το γεωμετρικό endpoint/midpoint/center → μοιράζονται το ίδιο ■/△/○ glyph (βλ. τα
    // ενοποιημένα `case 'endpoint'|'bim_corner'`, `case 'midpoint'|'bim_midpoint'`,
    // `case 'center'|'bim_center'` παραπάνω). Η διάκριση οντότητας («Γωνία κολώνας») ζει
    // ΜΟΝΟ στην ετικέτα `bimLabel` — Revit/AutoCAD convention. Τα connector/wall-face/text/
    // rotation παραμένουν ξεχωριστά ΕΙΔΗ σημείου (δικό τους glyph, κάτω).

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

    // ⊢────⊣ DIM_LINE: dimension line with witness end-ticks — ADR-362 / ADR-378 Step 3.
    // The universal "dimension line" iconography (horizontal line capped by two vertical
    // extension-line ticks). Distinct from ═ guide (center tick + double line) and ║ parallel.
    case 'dim_line': {
      const dimTick = getSnapIconQuarter(size); // half-height of each end tick
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <line x1={strokeWidth} y1={half} x2={size - strokeWidth} y2={half} stroke={color} strokeWidth={strokeWidth} />
          <line x1={strokeWidth} y1={half - dimTick} x2={strokeWidth} y2={half + dimTick} stroke={color} strokeWidth={strokeWidth} />
          <line x1={size - strokeWidth} y1={half - dimTick} x2={size - strokeWidth} y2={half + dimTick} stroke={color} strokeWidth={strokeWidth} />
        </svg>
      );
    }

    // ⊡ DIM_DEF_POINT: Square with center dot — ADR-362 / ADR-378 Step 3.
    // A dimension "definition point" (AutoCAD DIMSNAP anchor). Distinct from ■ endpoint
    // (adds the dot) and ⊙ node/insertion (square vs circle); the fuchsia/orange DIM colour
    // + "Dimension Def Point" label complete the disambiguation.
    case 'dim_def_point':
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
          <circle cx={half} cy={half} r={getNodeDotRadius()} fill={color} />
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

    // ▪ SELECTED_GRIP: Square + centre dot — ADR-580 selected-object grip snap.
    // Reads as "the grip you are aiming for": the ■ grip square (echoes the on-canvas grip
    // handle) with a filled centre so it disambiguates from a plain ■ endpoint underneath it.
    case 'selected_grip':
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
          <circle cx={half} cy={half} r={getNodeDotRadius()} fill={color} />
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
  // ADR-597: BIM label = «Γωνία/Μέσο/Κέντρο» + entity noun (composition), or null for
  // «περίεργα σχήματα» (empty description) → glyph WITHOUT text (req #4).
  const bimLabel = resolveBimSnapLabelText(t, description) ?? undefined;
  // 🏢 ADR-515: type-specific χρώμα marker (Revit-rich) από το snap-visual SSoT.
  const snapColor = resolveSnapColor(type);
  // Per-type box size (dimension glyphs enlarged) — MUST match `SnapShape` so the
  // centering offset + label anchor track the actual rendered glyph size.
  const glyphSize = getSnapIconSize(type);
  const glyphHalf = getSnapIconHalf(glyphSize);

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
          left: screenPos.x - glyphHalf,
          top: screenPos.y - glyphHalf,
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
            left: screenPos.x + glyphSize,
            // ADR-508 §label-layout (Case A): ετικέτα σε δική της baseline ΠΑΝΩ από το glyph ώστε
            // να μην επικαλύπτει το entity dim pill (που κάθεται ΚΑΤΩ από το κέντρο) — separate baselines.
            top: snapLabelTop(screenPos.y, glyphHalf),
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
