/**
 * =============================================================================
 * ENTERPRISE: Floorplan PDF Loader Hook
 * =============================================================================
 *
 * Loads a PDF file (page 1) into an HTMLImageElement for canvas rendering.
 * Mirrors useFloorplanSceneLoader for SRP compliance.
 *
 * @module components/shared/files/media/useFloorplanPdfLoader
 * @enterprise SPEC-237D
 */

import { useEffect, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';
import { loadPdfPage1 } from '@/components/shared/files/media/floorplan-pdf-renderer';

const logger = createModuleLogger('useFloorplanPdfLoader');

export interface FloorplanPdfLoaderResult {
  pdfImage: HTMLImageElement | null;
  /** Image pixel dimensions (PDF points × PDF_RENDER_SCALE) — editor's bounds. */
  pdfDimensions: { width: number; height: number } | null;
  isPdfLoading: boolean;
  pdfError: string | null;
}

export function useFloorplanPdfLoader(
  currentFile: FileRecord | null,
  isPdf: boolean,
): FloorplanPdfLoaderResult {
  const [pdfImage, setPdfImage] = useState<HTMLImageElement | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPdf || !currentFile?.downloadUrl) {
      setPdfImage(null);
      setPdfDimensions(null);
      setPdfError(null);
      setIsPdfLoading(false);
      return;
    }

    let cancelled = false;
    setIsPdfLoading(true);
    setPdfError(null);

    const url = currentFile.downloadUrl;

    loadPdfPage1(url)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setPdfError('Failed to load PDF');
          setIsPdfLoading(false);
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          setPdfImage(img);
          setPdfDimensions({ width: result.imageWidth, height: result.imageHeight });
          setIsPdfLoading(false);
        };
        img.onerror = () => {
          if (cancelled) return;
          setPdfError('Failed to decode PDF image');
          setIsPdfLoading(false);
        };
        img.src = result.imageUrl;
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('PDF load failed', { error: err });
        setPdfError(err instanceof Error ? err.message : 'Unknown error');
        setIsPdfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPdf, currentFile?.downloadUrl]);

  return { pdfImage, pdfDimensions, isPdfLoading, pdfError };
}
