/**
 * @module PdfBackgroundTypes
 * @description Enterprise-grade TypeScript types for PDF Background System
 *
 * @features
 * - Independent transform (separate from DXF canvas)
 * - Scale/rotation for alignment
 * - Page selection support
 * - Type-safe PDF.js integration
 *
 * @see ADR-002 for z-index hierarchy (PDF at z-[-10])
 * @see centralized_systems.md for enterprise patterns
 */

import type { ViewTransform, Point2D } from '../../rendering/types/Types';

// ============================================================================
// PDF DOCUMENT TYPES
// ============================================================================

/**
 * PDF document metadata after loading
 */
export interface PdfDocumentInfo {
  /** Total number of pages in the document */
  numPages: number;
  /** Original filename */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Loading timestamp */
  loadedAt: number;
}

/**
 * PDF page dimensions (in PDF points, 72 points = 1 inch)
 */
export interface PdfPageDimensions {
  /** Page width in PDF points */
  width: number;
  /** Page height in PDF points */
  height: number;
  /** Page rotation from PDF metadata (0, 90, 180, 270) */
  rotation: number;
}

// ============================================================================
// PDF BACKGROUND TRANSFORM TYPES
// ============================================================================

/**
 * Independent transform for PDF background
 * Separate from DXF canvas transform for alignment flexibility
 */
export interface PdfBackgroundTransform {
  /** Scale factor for PDF rendering */
  scale: number;
  /** X offset in canvas pixels */
  offsetX: number;
  /** Y offset in canvas pixels */
  offsetY: number;
  /** Rotation in degrees (0-360) */
  rotation: number;
}

/**
 * Default PDF transform values
 */
export const DEFAULT_PDF_TRANSFORM: Readonly<PdfBackgroundTransform> = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
} as const;

// ============================================================================
// 🏢 ENTERPRISE: CENTRALIZED PDF RENDER CONSTANTS
// ============================================================================

/**
 * PDF rendering configuration
 * Used by PdfRenderer and PdfControlsPanel for consistent behavior
 */
export const PDF_RENDER_CONFIG = {
  /** Default render scale for quality (2x = retina quality) */
  DEFAULT_RENDER_SCALE: 2,
  /** Maximum render scale to prevent memory issues */
  MAX_RENDER_SCALE: 4,
  /** Minimum render scale */
  MIN_RENDER_SCALE: 0.5,
  /** Padding factor for fit-to-view calculation (0.9 = 10% padding) */
  FIT_TO_VIEW_PADDING: 0.9,
} as const;

// ============================================================================
// PDF BACKGROUND STATE TYPES
// ============================================================================

/**
 * PDF background visibility and rendering state
 */
export interface PdfBackgroundState {
  /** Whether PDF background is enabled/visible */
  enabled: boolean;
  /** Opacity (0-1) */
  opacity: number;
  /** Currently loaded PDF document info */
  documentInfo: PdfDocumentInfo | null;
  /** Currently selected page (1-indexed) */
  currentPage: number;
  /** Current page dimensions */
  pageDimensions: PdfPageDimensions | null;
  /** Independent transform for PDF */
  transform: PdfBackgroundTransform;
  /** Loading state */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Rendered image data URL for current page */
  renderedImageUrl: string | null;
  /** 🏢 ENTERPRISE: Canvas viewport dimensions for fit-to-view */
  viewport: { width: number; height: number };
}

/**
 * Default PDF background state
 */
export const DEFAULT_PDF_STATE: Readonly<PdfBackgroundState> = {
  enabled: true,
  opacity: 0.5,
  documentInfo: null,
  currentPage: 1,
  pageDimensions: null,
  transform: DEFAULT_PDF_TRANSFORM,
  isLoading: false,
  error: null,
  renderedImageUrl: null,
  viewport: { width: 0, height: 0 },
} as const;

// ============================================================================
// PDF STORE ACTIONS TYPES
// ============================================================================

/**
 * Actions for PDF background store
 */
export interface PdfBackgroundActions {
  // Document actions
  loadPdf: (file: File) => Promise<void>;
  unloadPdf: () => void;

  // Page actions
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;

  // Transform actions
  setTransform: (transform: Partial<PdfBackgroundTransform>) => void;
  resetTransform: () => void;
  setScale: (scale: number) => void;
  setRotation: (rotation: number) => void;
  setOffset: (offset: Point2D) => void;

  // Visibility actions
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  setOpacity: (opacity: number) => void;

  // Viewport actions
  setViewport: (viewport: { width: number; height: number }) => void;

  // Internal actions
  _setLoading: (isLoading: boolean) => void;
  _setError: (error: string | null) => void;
  _setDocumentInfo: (info: PdfDocumentInfo | null) => void;
  _setPageDimensions: (dimensions: PdfPageDimensions | null) => void;
  _setRenderedImageUrl: (url: string | null) => void;
}

// ============================================================================
// PDF RENDERER TYPES
// ============================================================================

/**
 * Options for rendering a PDF page
 */
export interface PdfRenderOptions {
  /** Target scale for rendering (affects quality) */
  scale: number;
  /** Page number to render (1-indexed) */
  pageNumber: number;
  /** Optional: specific canvas to render to */
  canvas?: HTMLCanvasElement;
}

/**
 * Result of PDF page rendering
 */
export interface PdfRenderResult {
  /** Success flag */
  success: boolean;
  /** Data URL of rendered image (if success) */
  imageUrl?: string;
  /** Page dimensions after rendering */
  dimensions?: PdfPageDimensions;
  /** Error message (if failed) */
  error?: string;
}

// ============================================================================
// PDF CONTROLS TYPES
// ============================================================================

/**
 * PDF controls panel props
 */
export interface PdfControlsPanelProps {
  /** Current PDF state */
  state: PdfBackgroundState;
  /** Callback when file is selected */
  onFileSelect: (file: File) => void;
  /** Callback to unload PDF */
  onUnload: () => void;
  /** Callback to change page */
  onPageChange: (page: number) => void;
  /** Callback to change transform */
  onTransformChange: (transform: Partial<PdfBackgroundTransform>) => void;
  /** Callback to toggle visibility */
  onToggleEnabled: () => void;
  /** Callback to change opacity */
  onOpacityChange: (opacity: number) => void;
  /** Optional className for styling */
  className?: string;
}

// ============================================================================
// PDF CANVAS TYPES
// ============================================================================

/**
 * PDF background canvas props
 */
export interface PdfBackgroundCanvasProps {
  /** Rendered image URL to display */
  imageUrl: string | null;
  /** PDF-specific transform */
  pdfTransform: PdfBackgroundTransform;
  /** DXF canvas transform (for reference/sync if needed) */
  canvasTransform: ViewTransform;
  /** Canvas viewport dimensions */
  viewport: { width: number; height: number };
  /** Whether PDF background is enabled */
  enabled: boolean;
  /** Opacity (0-1) */
  opacity: number;
  /** Optional className for styling */
  className?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for PdfDocumentInfo
 */
export function isPdfDocumentInfo(value: unknown): value is PdfDocumentInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PdfDocumentInfo).numPages === 'number' &&
    typeof (value as PdfDocumentInfo).fileName === 'string' &&
    typeof (value as PdfDocumentInfo).fileSize === 'number' &&
    typeof (value as PdfDocumentInfo).loadedAt === 'number'
  );
}

/**
 * Type guard for PdfBackgroundTransform
 */
export function isPdfBackgroundTransform(value: unknown): value is PdfBackgroundTransform {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PdfBackgroundTransform).scale === 'number' &&
    typeof (value as PdfBackgroundTransform).offsetX === 'number' &&
    typeof (value as PdfBackgroundTransform).offsetY === 'number' &&
    typeof (value as PdfBackgroundTransform).rotation === 'number'
  );
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Clamp page number to valid range
 */
export function clampPageNumber(page: number, numPages: number): number {
  return Math.max(1, Math.min(page, numPages));
}

/**
 * Clamp opacity to valid range
 */
export function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

/**
 * Clamp scale to valid range
 */
export function clampScale(scale: number): number {
  // Reasonable limits for PDF background scale
  const MIN_SCALE = 0.01;
  const MAX_SCALE = 10;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

/**
 * Normalize rotation to 0-360 range
 */
export function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}
