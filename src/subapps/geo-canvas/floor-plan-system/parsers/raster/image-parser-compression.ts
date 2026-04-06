/**
 * @module floor-plan-system/parsers/raster/image-parser-compression
 * @description Contact photo compression utilities.
 * Extracted from ImageParser.ts for SRP compliance (ADR-065).
 *
 * Provides specialized compression for contact photos, avatars,
 * and profile images with smart quality/size optimization.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CompressionSettings {
  maxDimension: number;
  quality: number;
  size: 'avatar' | 'thumbnail' | 'profile';
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dimensions: { width: number; height: number };
}

export interface SmartCompressionInfo {
  strategy: string;
  settings: CompressionSettings;
  stats: CompressionStats;
}

// ============================================================================
// SIZE CONFIGURATIONS
// ============================================================================

const SIZE_CONFIG = {
  avatar: { maxDimension: 200, quality: 0.8 },
  thumbnail: { maxDimension: 400, quality: 0.82 },
  profile: { maxDimension: 800, quality: 0.85 },
} as const;

// ============================================================================
// COMPRESSION FUNCTIONS
// ============================================================================

/**
 * Load image using browser Image API.
 * Works for ALL browser-supported image formats.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Failed to load image')); };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio.
 */
function calculateDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  const aspectRatio = naturalWidth / naturalHeight;
  if (aspectRatio > 1) {
    return { width: maxDimension, height: maxDimension / aspectRatio };
  }
  return { width: maxDimension * aspectRatio, height: maxDimension };
}

/**
 * Draw image to canvas and convert to blob.
 */
async function drawAndConvert(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Failed to create compressed image')),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Compress contact photo with optimized settings for profile pictures.
 */
export async function compressContactPhoto(
  file: File,
  size: 'avatar' | 'thumbnail' | 'profile' = 'profile',
  quality?: number,
): Promise<{ blob: Blob; info: CompressionStats }> {
  const img = await loadImage(file);
  const config = SIZE_CONFIG[size];
  const targetQuality = quality ?? config.quality;
  const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight, config.maxDimension);

  const blob = await drawAndConvert(img, width, height, targetQuality);

  const compressionRatio = Math.round(((file.size - blob.size) / file.size) * 100);

  return {
    blob,
    info: {
      originalSize: file.size,
      compressedSize: blob.size,
      compressionRatio,
      dimensions: { width, height },
    },
  };
}

/**
 * Smart compression — automatically chooses best settings based on file size and usage.
 */
export async function smartCompressContactPhoto(
  file: File,
  usage?: 'avatar' | 'list-item' | 'profile-modal' | 'print' | 'company-logo' | 'business-card' | 'document-scan' | 'technical-drawing' | 'archive',
): Promise<{ blob: Blob; info: SmartCompressionInfo }> {
  const effectiveUsage = usage ?? 'profile-modal';
  const megabytes = file.size / (1024 * 1024);

  const { strategy, settings } = resolveCompressionStrategy(effectiveUsage, megabytes);
  const result = await compressContactPhoto(file, settings.size, settings.quality);

  return {
    blob: result.blob,
    info: { strategy, settings, stats: result.info },
  };
}

/**
 * Resolve compression strategy based on usage and file size.
 */
function resolveCompressionStrategy(
  usage: string,
  megabytes: number,
): { strategy: string; settings: CompressionSettings } {
  switch (usage) {
    case 'avatar':
      return { strategy: 'tiny-avatar', settings: { maxDimension: 150, quality: 0.75, size: 'avatar' } };
    case 'list-item':
      return { strategy: 'list-thumbnail', settings: { maxDimension: 300, quality: 0.8, size: 'thumbnail' } };
    case 'print':
    case 'technical-drawing':
      return { strategy: 'high-quality', settings: { maxDimension: 1200, quality: 0.9, size: 'profile' } };
    case 'document-scan':
      return { strategy: 'document-quality', settings: { maxDimension: 1000, quality: 0.88, size: 'profile' } };
    case 'company-logo':
    case 'business-card':
      return { strategy: 'branding-quality', settings: { maxDimension: 800, quality: 0.88, size: 'profile' } };
    case 'archive':
      return { strategy: 'archive-quality', settings: { maxDimension: 2000, quality: 0.95, size: 'profile' } };
    default:
      // profile-modal — adaptive based on file size
      if (megabytes > 5) return { strategy: 'aggressive-compression', settings: { maxDimension: 600, quality: 0.75, size: 'profile' } };
      if (megabytes > 2) return { strategy: 'moderate-compression', settings: { maxDimension: 700, quality: 0.82, size: 'profile' } };
      return { strategy: 'light-compression', settings: { maxDimension: 800, quality: 0.87, size: 'profile' } };
  }
}

/**
 * Check if contact photo needs compression.
 */
export function shouldCompressContactPhoto(file: File, maxSizeKB = 500): {
  shouldCompress: boolean;
  reason: string;
  currentSizeKB: number;
  recommendedAction: string;
} {
  const currentSizeKB = Math.round(file.size / 1024);

  if (currentSizeKB <= maxSizeKB) {
    return { shouldCompress: false, reason: 'File size is acceptable', currentSizeKB, recommendedAction: 'No compression needed' };
  }

  const recommendedAction = currentSizeKB > 2000
    ? 'Aggressive compression recommended (file is very large)'
    : currentSizeKB > 1000
      ? 'Moderate compression recommended'
      : 'Light compression recommended';

  return {
    shouldCompress: true,
    reason: `File size (${currentSizeKB}KB) exceeds limit (${maxSizeKB}KB)`,
    currentSizeKB,
    recommendedAction,
  };
}
