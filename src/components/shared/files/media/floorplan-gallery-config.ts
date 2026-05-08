/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery Configuration
 * =============================================================================
 *
 * Types, constants, and utility functions for the FloorplanGallery component.
 * Extracted from FloorplanGallery.tsx for SRP compliance (ADR-033).
 *
 * @module components/shared/files/media/floorplan-gallery-config
 */

import React from 'react';
import { Map, FileText, Image as ImageIcon } from 'lucide-react';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

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
}

/**
 * Drawing mode for DXF rendering in floorplan tabs.
 * - dark: Dark background + colored lines (layer colors)
 * - light: White background + black lines (technical drawing)
 */
export type DxfDrawingMode = 'dark' | 'light';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Supported floorplan file extensions (includes 'json' for scene data saved by FloorplanSaveOrchestrator) */
export const FLOORPLAN_EXTENSIONS = ['dxf', 'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'json'];

/** Zoom configuration for the useZoomPan hook */
export const ZOOM_CONFIG = {
  minZoom: 0.25,
  maxZoom: 4,
  zoomStep: 0.25,
  defaultZoom: 1,
} as const;

// ============================================================================
// UTILITIES
// ============================================================================

/** Filter files to only include floorplan-compatible formats */
export function filterFloorplanFiles(files: FileRecord[]): FileRecord[] {
  return files.filter(file => {
    const ext = file.ext?.toLowerCase() || '';
    return FLOORPLAN_EXTENSIONS.includes(ext);
  });
}

/** Get file type icon based on extension */
export function getFileIcon(ext: string): React.ReactNode {
  const iconClass = 'w-5 h-5';
  switch (ext?.toLowerCase()) {
    case 'dxf':
      return React.createElement(Map, { className: iconClass, 'aria-hidden': 'true' });
    case 'pdf':
      return React.createElement(FileText, { className: iconClass, 'aria-hidden': 'true' });
    default:
      return React.createElement(ImageIcon, { className: iconClass, 'aria-hidden': 'true' });
  }
}
