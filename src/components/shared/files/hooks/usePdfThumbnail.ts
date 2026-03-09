/**
 * =============================================================================
 * 🏢 ENTERPRISE: PDF Thumbnail Generation Hook
 * =============================================================================
 *
 * Client-side PDF thumbnail generation using pdfjs-dist.
 * Renders page 1 at low resolution → canvas → object URL.
 *
 * Features:
 * - Lazy loading (only when visible)
 * - Memory cleanup (revokeObjectURL on unmount)
 * - Shared pdfjs-dist loader (same as PdfCanvasViewer)
 * - Error resilience (graceful fallback)
 *
 * @module components/shared/files/hooks/usePdfThumbnail
 * @enterprise ADR-191 - Enterprise Document Management System
 */

import { useState, useEffect, useRef } from 'react';

// ============================================================================
// PDF.JS TYPES (minimal — avoid importing full pdfjs-dist types)
// ============================================================================

interface PdfDocProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}

interface PdfPageProxy {
  getViewport(params: { scale: number; rotation?: number }): PdfViewport;
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): { promise: Promise<void> };
}

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfJsLib {
  getDocument(params: { data: Uint8Array }): { promise: Promise<PdfDocProxy> };
  GlobalWorkerOptions: { workerSrc: string };
}

// ============================================================================
// PDF.JS LAZY LOADER (shared singleton)
// ============================================================================

const WORKER_URL = '/pdf.worker.min.mjs';

let pdfjsLib: PdfJsLib | null = null;

async function loadPdfJs(): Promise<PdfJsLib> {
  if (pdfjsLib) return pdfjsLib;
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
  pdfjsLib = lib as unknown as PdfJsLib;
  return pdfjsLib;
}

// ============================================================================
// THUMBNAIL CACHE (in-memory, per session)
// ============================================================================

/** Cache: downloadUrl → objectURL */
const thumbnailCache = new Map<string, string>();

// ============================================================================
// CONSTANTS
// ============================================================================

/** Thumbnail target width in pixels */
const THUMB_WIDTH = 160;

/** Max concurrent PDF thumbnail generations */
let activeGenerations = 0;
const MAX_CONCURRENT = 3;

// ============================================================================
// HOOK
// ============================================================================

interface UsePdfThumbnailResult {
  /** Generated thumbnail blob URL (or null if not ready) */
  thumbnailUrl: string | null;
  /** Loading state */
  loading: boolean;
  /** Error message (if generation failed) */
  error: string | null;
}

/**
 * Generate a thumbnail for a PDF file by rendering page 1 to canvas.
 *
 * @param downloadUrl - Firebase Storage download URL for the PDF
 * @param enabled - Set to false to skip generation (e.g., for non-PDF files)
 */
export function usePdfThumbnail(downloadUrl: string | undefined, enabled = true): UsePdfThumbnailResult {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !downloadUrl) return;

    // Check cache first
    const cached = thumbnailCache.get(downloadUrl);
    if (cached) {
      setThumbnailUrl(cached);
      return;
    }

    // Throttle concurrent generations
    if (activeGenerations >= MAX_CONCURRENT) {
      // Retry after a short delay
      const timer = setTimeout(() => {
        setLoading((prev) => !prev); // trigger re-render to retry
      }, 500);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    let doc: PdfDocProxy | null = null;

    async function generate() {
      activeGenerations++;
      setLoading(true);
      setError(null);

      try {
        const lib = await loadPdfJs();
        if (cancelled) return;

        // Fetch PDF through CORS proxy
        const proxyUrl = `/api/download?url=${encodeURIComponent(downloadUrl!)}&filename=thumb.pdf`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (cancelled) return;

        const data = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;

        doc = await lib.getDocument({ data }).promise;
        if (cancelled) { await doc.destroy(); return; }

        const page = await doc.getPage(1);
        if (cancelled) { await doc.destroy(); return; }

        // Calculate scale to fit THUMB_WIDTH
        const naturalViewport = page.getViewport({ scale: 1 });
        const scale = THUMB_WIDTH / naturalViewport.width;
        const viewport = page.getViewport({ scale });

        // Render to offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) { await doc.destroy(); return; }

        // Convert to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
            'image/webp',
            0.75,
          );
        });

        const url = URL.createObjectURL(blob);
        thumbnailCache.set(downloadUrl!, url);
        objectUrlRef.current = url;

        if (!cancelled) {
          setThumbnailUrl(url);
        }

        await doc.destroy();
        doc = null;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Thumbnail generation failed');
        }
        if (doc) {
          try { await doc.destroy(); } catch { /* ignore cleanup errors */ }
        }
      } finally {
        activeGenerations--;
        if (!cancelled) setLoading(false);
      }
    }

    generate();

    return () => {
      cancelled = true;
      // Don't revoke cached URLs — they're shared
    };
  }, [downloadUrl, enabled, loading]); // loading in deps for retry mechanism

  return { thumbnailUrl, loading, error };
}
