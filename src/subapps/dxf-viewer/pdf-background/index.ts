/**
 * @module pdf-background
 * @description Enterprise PDF Background System for DXF Viewer
 *
 * Provides PDF background rendering with independent transform controls.
 * PDF pages can be loaded, positioned, scaled, and rotated independently
 * from the DXF canvas for precise alignment.
 *
 * @features
 * - PDF document loading via pdf.js
 * - Page selection for multi-page PDFs
 * - Independent pan/zoom/rotation
 * - Opacity control
 * - Z-index below DXF canvas
 *
 * @see ADR-002 for z-index hierarchy
 * @see ADR-003 for FloatingPanel pattern
 * @see centralized_systems.md for enterprise standards
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  PdfDocumentInfo,
  PdfPageDimensions,
  PdfBackgroundTransform,
  PdfBackgroundState,
  PdfBackgroundActions,
  PdfRenderOptions,
  PdfRenderResult,
  PdfControlsPanelProps,
  PdfBackgroundCanvasProps,
} from './types/pdf.types';

export {
  DEFAULT_PDF_STATE,
  DEFAULT_PDF_TRANSFORM,
  isPdfDocumentInfo,
  isPdfBackgroundTransform,
  clampPageNumber,
  clampOpacity,
  clampScale,
  normalizeRotation,
} from './types/pdf.types';

// ============================================================================
// STORE EXPORTS
// ============================================================================

export {
  usePdfBackgroundStore,
  selectPdfEnabled,
  selectPdfOpacity,
  selectPdfDocumentInfo,
  selectPdfCurrentPage,
  selectPdfTransform,
  selectPdfImageUrl,
  selectPdfIsLoading,
  selectPdfError,
  usePdfVisibility,
  usePdfNavigation,
  usePdfTransform,
} from './stores/pdfBackgroundStore';

// ============================================================================
// SERVICE EXPORTS
// ============================================================================

export { PdfRenderer } from './services/PdfRenderer';

// ============================================================================
// HOOK EXPORTS
// ============================================================================

export { usePdfBackground } from './hooks/usePdfBackground';

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================

export { PdfBackgroundCanvas } from './components/PdfBackgroundCanvas';
export { PdfControlsPanel } from './components/PdfControlsPanel';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Default export - PDF Background Canvas
 * Use named exports for specific components
 */
export { PdfBackgroundCanvas as default } from './components/PdfBackgroundCanvas';
