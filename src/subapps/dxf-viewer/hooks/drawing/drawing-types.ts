/**
 * @module drawing-types
 * @description Type definitions for the unified drawing system.
 * Extracted from useUnifiedDrawing.tsx for clean separation of concerns.
 *
 * All types are re-exported from useUnifiedDrawing.tsx for backward compatibility,
 * so existing imports from 19+ consumer files continue to work unchanged.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, LineEntity, CircleEntity, PolylineEntity, ArcEntity } from '../../types/scene';
import type { WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';

// ─── Preview Point ──────────────────────────────────────────────────────────

/**
 * Preview-only point overlay (drawing tools).
 *
 * ADR-358 Phase 9D-5b-ii — `layer` (name backref) made optional to align with
 * BaseEntity dual-write window. `layerId` (`lyr_<UUID-v4>`) is the stable id.
 * Both fields collapse to `layerId` only at end of Phase 9D-5b-iii.
 */
export interface PreviewPoint {
  id: string;
  type: 'point';
  position: Point2D;
  size: number;
  visible: boolean;
  /** Stable layer id — `lyr_<UUID-v4>`. */
  layerId: string;
  preview: boolean;
}

// ─── Preview Text (annotation ghost) ─────────────────────────────────────────

/**
 * ADR-508 §text-parity (Giorgio 2026-07-07) — ελαφρύ preview-only φάντασμα για τα single-click
 * annotation εργαλεία «Κείμενο» (`text`) / «Πολυγραμμικό Κείμενο» (`mtext`): μια μικρή ημιδιάφανη
 * λέξη στη θέση εισαγωγής + (προαιρετικά) κυανές listening dims όταν το σημείο κουμπώνει flush σε
 * παρειά μέλους (ΙΔΙΟ `faceDimensions` πεδίο/SSoT με τη γραμμή → κοινός reader, μηδέν νέος μηχανισμός).
 *
 * N.11: η ίδια η λέξη ΔΕΝ αποθηκεύεται εδώ — ο generator είναι pure. Ο painter την επιλύει μέσω
 * `i18n.t('tools.text', { ns: 'dxf-viewer-shell' })` (render layer), μηδέν hardcoded «text»/«κείμενο».
 */
export interface PreviewText {
  id: string;
  type: 'text';
  /** Σημείο εισαγωγής (world) — ήδη flush-to-face όταν υπάρχει παρειά εντός capture. */
  position: Point2D;
  visible: boolean;
  /** Stable layer id — `lyr_<UUID-v4>`. */
  layerId: string;
  preview: boolean;
  /** ADR-508 §line-cyan (κοινό SSoT) — κυανές listening dims όταν το σημείο εισαγωγής κουμπώνει flush. */
  faceDimensions?: GhostFaceDimensionsMeta;
  /**
   * ADR-508 §text-parity (2-click place→rotate) — γωνία κλίσης της λέξης (CCW μοίρες, DXF σύμβαση) στη
   * rotation phase (μετά το 1ο κλικ). Απών/0 στη φάση τοποθέτησης (πριν το 1ο κλικ). Ο painter το
   * μετατρέπει σε γωνία canvas (`-rotationDeg` λόγω Y-flip, ίδια σύμβαση με τον `TextRenderer`).
   */
  rotationDeg?: number;
}

// ─── Extended Entity Types (preview-aware) ──────────────────────────────────

export interface ExtendedPolylineEntity extends PolylineEntity {
  showEdgeDistances?: boolean;
  /**
   * ADR-508 §polyline-parity (2026-07-07) — ζωντανό HUD μήκους+γωνίας του ΕΝΕΡΓΟΥ (τελευταίου)
   * segment της αλυσίδας, ΙΔΙΟ πεδίο/SSoT με τη γραμμή (`ExtendedLineEntity.liveDimHud`). Set στο
   * `applyPreviewStyling` για το `polyline` tool· ο tool-agnostic painter το ζωγραφίζει χωρίς αλλαγή.
   */
  liveDimHud?: WallHudMeta;
  /**
   * ADR-508 §polyline-parity (2026-07-07) — κυανές listening dimensions όταν η «ουρά» της
   * πολυγραμμής κουμπώνει flush/κάθετα σε υφιστάμενο μέλος. ΙΔΙΟ πεδίο/SSoT με τη γραμμή
   * (`ExtendedLineEntity.faceDimensions`) → κοινός reader, μηδέν νέος μηχανισμός.
   */
  faceDimensions?: GhostFaceDimensionsMeta;
}

export interface ExtendedCircleEntity extends CircleEntity {
  diameterMode?: boolean;
  twoPointDiameter?: boolean;
  /** Show radius/circumference/area labels during drawing preview */
  showPreviewMeasurements?: boolean;
  /** Cursor world position during preview — used to draw radius line toward cursor */
  previewCursorPoint?: Point2D;
}

export interface ExtendedLineEntity extends LineEntity {
  showEdgeDistances?: boolean;
  /**
   * ADR-508 §line-hud — ζωντανό HUD μήκους + γωνίας κατά τη σχεδίαση γραμμής, ΙΔΙΟ με τον τοίχο
   * (aligned ISO-129 διάσταση + γωνία), μέσω του ΚΟΙΝΟΥ `paintWallHudCore` SSoT. Η γραμμή δεν έχει
   * πάχος/ύψος (όχι BIM στερεό) → `thicknessMm/heightMm = 0`, κανένα spec label. Όταν υπάρχει, η
   * `renderLine` παραλείπει τα δικά της inline labels (μηδέν διπλό). Set ΜΟΝΟ για το line tool
   * (όχι measure-distance) στο `applyPreviewStyling`.
   */
  liveDimHud?: WallHudMeta;
  /**
   * ADR-508 §line-cyan — κυανές listening dimensions (gap-left / gap-right / κέντρο-προς-κέντρο
   * κατά μήκος της παρειάς υπάρχοντος μέλους) όταν το φάντασμα της γραμμής κουμπώνει flush/κάθετα
   * πάνω σε υφιστάμενη γραμμή/μέλος. ΙΔΙΟ πεδίο (`faceDimensions`) με το canonical `PlacementOverlayFields`
   * του τοίχου → ο tool-agnostic reader στο `drawing-hover-handler` τις ζωγραφίζει χωρίς νέο μηχανισμό.
   * Set στο line preview helper μέσω του ΚΟΙΝΟΥ `resolveGhostFaceDimensionsMeta`.
   */
  faceDimensions?: GhostFaceDimensionsMeta;
}

// Extended Arc Entity for preview with construction lines
// Shows both the arc shape AND the rubber band lines connecting clicked points
export interface ExtendedArcEntity extends ArcEntity {
  // Construction vertices: all clicked points + cursor position
  // Used to draw rubber band lines during arc drawing
  constructionVertices?: Point2D[];
  showConstructionLines?: boolean;
  showEdgeDistances?: boolean;
  // Arc direction flag for Canvas 2D rendering
  // true = draw counterclockwise (anticlockwise), false = draw clockwise
  counterclockwise?: boolean;
  // Construction line drawing mode
  // 'polyline': Connect points in sequence (arc-3p: start -> mid -> end)
  // 'radial': Draw radii from center (arc-cse/arc-sce: center -> start, center -> end)
  constructionLineMode?: 'polyline' | 'radial';
}

// ─── Union Type ─────────────────────────────────────────────────────────────

export type ExtendedSceneEntity =
  | ExtendedPolylineEntity
  | ExtendedCircleEntity
  | ExtendedLineEntity
  | ExtendedArcEntity
  | PreviewPoint
  | PreviewText
  | AnySceneEntity;

// ─── Drawing Tool & State ───────────────────────────────────────────────────

// ADR-059: Arc tools, ADR-083: Circle variants, ADR-358 Phase 5a: Stair tool, ADR-363 Phase 1B: Wall tool
export type DrawingTool =
  | 'select' | 'line' | 'line-perpendicular' | 'rectangle'
  | 'circle' | 'circle-diameter' | 'circle-2p-diameter'
  | 'circle-3p' | 'circle-chord-sagitta' | 'circle-2p-radius' | 'circle-best-fit'
  | 'polyline' | 'polygon'
  | 'sketch' // ADR-658 M1 — «Μολύβι» freehand drag-to-draw → PolylineEntity
  | 'hatch' // ADR-507 S2 — γραμμοσκίαση (κλειστό όριο, N-click + Enter)
  | 'measure-distance' | 'measure-distance-continuous' | 'measure-area' | 'measure-angle'
  | 'measure-angle-line-arc' | 'measure-angle-two-arcs' | 'measure-angle-measuregeom' | 'measure-angle-constraint'
  | 'arc-3p' | 'arc-cse' | 'arc-sce'
  | 'stair'
  | 'wall'
  | 'slab'
  | 'column'
  | 'beam'
  // ADR-436 Slice 2 — foundation line tools (rubber-band band preview).
  | 'foundation-strip'
  | 'foundation-tie-beam'
  // ADR-514 Φ6c — foundation pad (single-click WYSIWYG live ghost, flush σε παρειά κολόνας).
  | 'foundation-pad'
  | 'xline'
  | 'ray'
  | 'slab-opening'
  | 'roof'
  | 'floor-finish'
  | 'wall-covering'
  | 'mep-underfloor'
  | 'thermal-space'
  | 'space-separator'
  // ADR-508 §text-parity — annotation single-click tools (ghost-word + placement indicators).
  | 'text'
  | 'mtext'
  // ADR-583 Φ2 — Graphic scale-bar: generic 2-click accumulator tool (mirror 'line').
  | 'scale-bar'
  // ADR-612 — Opening info tag: generic SINGLE-CLICK accumulator tool (mirror 'annotation-symbol'
  // click-count, scale-bar's accumulator plumbing).
  | 'opening-info-tag'
  // ADR-652 §M7 — Block Library placement (single-click free-point WYSIWYG ghost, mirror 'column').
  | 'block-library';

export interface DrawingState {
  currentTool: DrawingTool;
  isDrawing: boolean;
  previewEntity: ExtendedSceneEntity | null;
  tempPoints: Point2D[];
  measurementId?: string;
  isOverlayMode?: boolean;
  currentPoints: Point2D[];
  snapPoint: Point2D | null;
  snapType: string | null;
}
