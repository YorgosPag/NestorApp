/**
 * =============================================================================
 * ENTERPRISE: Floorplan Image Loader Hook
 * =============================================================================
 *
 * Loads a raster image (PNG/JPEG/WEBP/TIFF) into an HTMLImageElement for
 * canvas rendering. Mirrors `useFloorplanPdfLoader` so the canvas render
 * pipeline can treat PDF and Image as a unified "raster" source.
 *
 * @module components/shared/files/media/useFloorplanImageLoader
 */

import { useEffect, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';

const logger = createModuleLogger('useFloorplanImageLoader');

export interface FloorplanImageLoaderResult {
  imageElement: HTMLImageElement | null;
  imageDimensions: { width: number; height: number } | null;
  isImageLoading: boolean;
  imageError: string | null;
}

export function useFloorplanImageLoader(
  currentFile: FileRecord | null,
  isImage: boolean,
): FloorplanImageLoaderResult {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage || !currentFile?.downloadUrl) {
      setImageElement(null);
      setImageDimensions(null);
      setImageError(null);
      setIsImageLoading(false);
      return;
    }

    let cancelled = false;
    setIsImageLoading(true);
    setImageError(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      setImageElement(img);
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setIsImageLoading(false);
    };
    img.onerror = (err) => {
      if (cancelled) return;
      logger.error('Image load failed', { url: currentFile.downloadUrl, err });
      setImageError('Failed to load image');
      setIsImageLoading(false);
    };
    img.src = currentFile.downloadUrl;

    return () => {
      cancelled = true;
    };
  }, [isImage, currentFile?.downloadUrl]);

  return { imageElement, imageDimensions, isImageLoading, imageError };
}
