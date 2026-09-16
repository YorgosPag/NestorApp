/**
 * =============================================================================
 * PDF Canvas Config — Types, constants, and PDF.js loader
 * =============================================================================
 *
 * Extracted from PdfCanvasViewer.tsx to satisfy the 500-line file size rule.
 * Contains: interfaces, zoom constants, and the lazy PDF.js loader.
 *
 * @module components/file-manager/pdf-canvas-config
 * @enterprise ADR-031 - Canonical File Storage System
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PdfCanvasViewerProps {
  /** PDF download URL (Firebase Storage) */
  url: string;
  /**
   * 🔑 **Το id του αρχείου, όταν υπάρχει** — η **προτιμώμενη** διαδρομή προς τα
   * bytes (ADR-862 Φ0 Β8).
   *
   * Όταν δίνεται, ο viewer ζητά `/api/download?fileId=…`: ο διακομιστής βρίσκει
   * **μόνος του** το αντικείμενο και περνά από τον φρουρό ορατότητας δοχείου. Όταν
   * λείπει, πέφτει στο `?url=`, που φυλάει **μισθωτή** αλλά όχι **δοχείο**.
   *
   * ⚠️ **Ο `FilePreviewRenderer` το είχε ΗΔΗ και δεν το προωθούσε** (μετρημένο
   * 2026-09-16): το κενό ήταν **μία γραμμή**, όχι έλλειψη δεδομένου.
   */
  fileId?: string;
  /** Accessible title */
  title: string;
  /** Optional className */
  className?: string;
}

export interface PdfState {
  numPages: number;
  currentPage: number;
  scale: number;
  rotation: number;
  loading: boolean;
  error: string | null;
}

// PDF.js types (minimal interface to avoid import issues)
export interface PdfDocProxy {
  numPages: number;
  getPage(num: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}

export interface PdfPageProxy {
  getViewport(opts: { scale: number; rotation?: number }): {
    width: number;
    height: number;
  };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void>; cancel(): void };
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 5;
export const WHEEL_ZOOM_FACTOR = 1.1;
export const WORKER_URL = '/pdf.worker.min.mjs';

// ============================================================================
// PDF.JS LOADER (lazy, avoids SSR issues)
// ============================================================================

type PdfjsLib = {
  getDocument(params: { url?: string; data?: Uint8Array; cMapUrl?: string; cMapPacked?: boolean }): {
    promise: Promise<PdfDocProxy>;
  };
  GlobalWorkerOptions: { workerSrc: string };
};

let pdfjsLib: PdfjsLib | null = null;

export async function loadPdfJs(): Promise<PdfjsLib> {
  if (pdfjsLib) return pdfjsLib;
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
  pdfjsLib = lib as unknown as PdfjsLib;
  return pdfjsLib;
}
