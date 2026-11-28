/**
 * @fileoverview Τα **props** του `FloorplanGallery` — μόνο τύποι (ADR-954 §2).
 * @related ./floorplan-gallery-surfaces (το μητρώο) · ./FloorplanGallery (το component)
 * @module components/shared/files/media/floorplan-gallery-props
 *
 * ⚠️ **Γιατί χωριστό αρχείο** (ίδιος λόγος με το `photo-caption-surface-props`): ο γράφος της πύλης 3.34 μετρά και
 *   το `import type` ως ακμή. Αν το μητρώο εισήγαγε τον τύπο από το component (ή από το `floorplan-gallery-config`,
 *   που φέρνει εικονίδια), θα έσερνε πίσω στη στατική κλειστότητα κάθε σελίδας ό,τι το όριο υπάρχει για να κόψει.
 *   Εδώ ζουν μόνο τύποι, χωρίς κανένα component.
 */

import type { FileRecord } from '@/types/file-record';

export interface FloorplanGalleryProps {
  /** Floorplan files to display */
  files: FileRecord[];
  /** Callback for delete action */
  onDelete?: (file: FileRecord) => Promise<void>;
  /** Callback for download action */
  onDownload?: (file: FileRecord) => void;
  /** Callback to refresh files after processing */
  onRefresh?: () => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom className */
  className?: string;
  /**
   * **Ποιος κατέχει το ύψος της κάτοψης** — ίδιο λεξιλόγιο με το `MediaViewerLayout` (ADR-912 §12.17).
   * - `flow` (προεπιλογή): ο γονιός δεν δίνει ύψος ⇒ η κάτοψη κρατά δάπεδο 500px (καρτέλα αρχείων, σελίδα-έγγραφο).
   * - `fill`: ο γονιός δίνει ύψος (θεατής μέσων) ⇒ η κάτοψη γεμίζει **ό,τι υπάρχει**. 🔴 Με δάπεδο 500px σε χώρο 280px
   *   (κινητό 390×844) ο καμβάς ήταν 500px, κομμένος από τον πρόγονο: το σχέδιο κεντραριζόταν **133px** χαμηλότερα.
   */
  layout?: 'flow' | 'fill';
  /** Initial file index */
  initialIndex?: number;
  /** Polygon overlays to render on top of DXF floorplans (ADR-237 / SPEC-237B) */
  overlays?: ReadonlyArray<import('@/hooks/useFloorOverlays').FloorOverlayItem>;
  /** ID of unit highlighted externally (from list hover) — bidirectional sync (SPEC-237C) */
  highlightedOverlayUnitId?: string | null;
  /** Callback: mouse hovers overlay → passes linked propertyId (or null on leave) (SPEC-237C) */
  onHoverOverlay?: (propertyId: string | null) => void;
  /** Callback: user clicks overlay → passes linked propertyId (SPEC-237C) */
  onClickOverlay?: (propertyId: string) => void;
  /**
   * Pre-formatted labels to render inside the highlighted polygon on hover.
   * Map keyed by `linked.propertyId`. Strings are i18n/currency-formatted by
   * the caller — the renderer is locale-agnostic.
   */
  propertyLabels?: ReadonlyMap<string, import('@/components/shared/files/media/overlay-polygon-renderer').OverlayLabel>;
  /**
   * Native units per real-world meter, sourced from `floorplan_backgrounds.scale.unitsPerMeter`
   * (ADR-340 Phase 9 STEP D). When provided, the transient measure tool labels
   * distances in meters / m² / degrees; otherwise it falls back to native pixels.
   */
  unitsPerMeter?: number | null;
  /**
   * Active `floorplan_backgrounds` document id for the current floor. When
   * provided AND the current file is raster (PDF / Image), the gallery header
   * exposes a calibration affordance that opens `CalibrateScaleDialog`. DXF
   * files skip this UI (auto-detected via `$INSUNITS`).
   */
  backgroundId?: string | null;
  /**
   * ADR-370 — `FileRecord.id` used as `floorplanId` foreign key for read-only
   * BIM entity rendering. When supplied AND the current file is a DXF scene,
   * the gallery subscribes to walls/slabs/beams/columns/openings/slab-openings
   * for that floorplan and draws them above the DXF geometry. Synthetic
   * fallback ids (`floor_floorplan_*`) are detected internally and skipped.
   */
  floorplanId?: string | null;
  /**
   * ADR-371 — Firestore project id for the 3D read-only viewer (upload origin).
   * Falls back to ProjectHierarchyContext inside BimViewport3D; safe to omit
   * when render uploads are not needed.
   */
  projectId?: string | null;
}
