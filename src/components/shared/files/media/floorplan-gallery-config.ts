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
import type { ZoomPanSettings } from '@/hooks/useZoomPan';

// ============================================================================
// TYPES
// ============================================================================

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

/**
 * Zoom configuration for the useZoomPan hook (SSoT — feeds BOTH the inline and the
 * fullscreen-modal viewports + the zoom-control buttons).
 *
 * `maxZoom` = deepest zoom-in. Raised 4 → 32 so dense areas (title-blocks, small
 * annotations) can be read up close. Safe for vector DXF (redrawn crisp per zoom via
 * `renderDxfToCanvas`, and text now scales purely with zoom — ADR-370 Phase 9.2); raster
 * backgrounds (PDF/image) simply get more magnification.
 *
 * `zoomFactor: 1.5` makes the +/- BUTTONS multiplicative (big-players pattern —
 * Figma/Revit/ArchiCAD): each click ×1.5 / ÷1.5, so ~9 clicks span 1 → 32 instead of ~124
 * additive 0.25 steps. Wheel/pinch are already multiplicative and reach the ceiling smoothly.
 */
export const ZOOM_CONFIG = {
  minZoom: 0.25,
  maxZoom: 32,
  zoomStep: 0.25,
  zoomFactor: 1.5,
  defaultZoom: 1,
} as const satisfies ZoomPanSettings;

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
