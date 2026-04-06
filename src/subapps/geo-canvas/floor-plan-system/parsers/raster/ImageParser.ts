/**
 * 🖼️ IMAGE PARSER - Universal Image Handler
 *
 * Handles ALL raster image formats:
 * - PNG, JPG/JPEG, TIFF, BMP, GIF, WEBP
 *
 * Contact photo compression utilities extracted to
 * image-parser-compression.ts for SRP compliance (ADR-065).
 *
 * @module floor-plan-system/parsers/raster/ImageParser
 */

import type { ParserResult, FloorPlanFormat } from '../../types';
import type { SmartCompressionInfo } from './image-parser-compression';
import {
  compressContactPhoto as compressContactPhotoFn,
  smartCompressContactPhoto as smartCompressContactPhotoFn,
  shouldCompressContactPhoto as shouldCompressContactPhotoFn,
} from './image-parser-compression';

// Re-export compression types
export type { SmartCompressionInfo } from './image-parser-compression';

/**
 * Supported image formats
 */
export const SUPPORTED_IMAGE_FORMATS = {
  PNG: { extension: '.png', mimeType: 'image/png' },
  JPG: { extension: '.jpg', mimeType: 'image/jpeg' },
  JPEG: { extension: '.jpeg', mimeType: 'image/jpeg' },
  TIFF: { extension: '.tiff', mimeType: 'image/tiff' },
  TIF: { extension: '.tif', mimeType: 'image/tiff' },
  BMP: { extension: '.bmp', mimeType: 'image/bmp' },
  GIF: { extension: '.gif', mimeType: 'image/gif' },
  WEBP: { extension: '.webp', mimeType: 'image/webp' }
} as const;

/**
 * Image metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: FloorPlanFormat;
  mimeType: string;
  size: number;
  aspectRatio: number;
  hasAlpha: boolean;
}

/**
 * Image parser result (extends ParserResult)
 */
export interface ImageParserResult extends ParserResult {
  metadata: ImageMetadata;
  imageUrl: string;
  thumbnail?: string;
}

/** Format recommendation */
interface FormatRecommendation {
  useCase: string;
  pros: string[];
  cons: string[];
}

/**
 * Universal Image Parser
 *
 * ✅ Works for ALL image formats
 * ✅ Browser-native support (no external libraries)
 * ✅ Automatic format detection
 * ✅ Thumbnail generation
 * ✅ Quality optimization
 */
export class ImageParser {
  /**
   * Parse image file
   */
  async parse(file: File): Promise<ImageParserResult> {
    try {
      this.validateImageFile(file);
      const format = this.detectFormat(file);
      const img = await this.loadImage(file);
      const metadata = this.extractMetadata(img, file, format);
      const imageUrl = URL.createObjectURL(file);
      const thumbnail = await this.generateThumbnail(img, 400, 400);

      return {
        success: true,
        format,
        imageUrl,
        thumbnail,
        metadata,
        bounds: undefined,
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        format: 'PNG' as FloorPlanFormat,
        errors: [(error as Error).message]
      } as ImageParserResult;
    }
  }

  private validateImageFile(file: File): void {
    if (!file) throw new Error('No file provided');

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`Image file too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 50MB)`);
    }

    const validMimeTypes: string[] = Object.values(SUPPORTED_IMAGE_FORMATS).map(f => f.mimeType);
    if (!validMimeTypes.includes(file.type)) {
      throw new Error(`Unsupported image format: ${file.type}`);
    }
  }

  private detectFormat(file: File): FloorPlanFormat {
    const extension = file.name.toLowerCase().split('.').pop() || '';
    const formatMap: Record<string, FloorPlanFormat> = {
      png: 'PNG', jpg: 'JPG', jpeg: 'JPG', tiff: 'TIFF', tif: 'TIFF'
    };

    const format = formatMap[extension];
    if (!format) throw new Error(`Unknown image format: .${extension}`);
    return format;
  }

  private async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Failed to load image')); };
      img.src = URL.createObjectURL(file);
    });
  }

  private extractMetadata(img: HTMLImageElement, file: File, format: FloorPlanFormat): ImageMetadata {
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      format,
      mimeType: file.type,
      size: file.size,
      aspectRatio: img.naturalWidth / img.naturalHeight,
      hasAlpha: this.checkAlphaSupport(format)
    };
  }

  private checkAlphaSupport(format: FloorPlanFormat): boolean {
    const alphaFormats: FloorPlanFormat[] = ['PNG', 'TIFF'];
    return alphaFormats.includes(format);
  }

  private async generateThumbnail(img: HTMLImageElement, maxWidth: number, maxHeight: number): Promise<string> {
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    let thumbWidth = maxWidth;
    let thumbHeight = maxHeight;

    if (aspectRatio > 1) {
      thumbHeight = maxWidth / aspectRatio;
    } else {
      thumbWidth = maxHeight * aspectRatio;
    }

    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');

    ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
    return canvas.toDataURL('image/png', 0.8);
  }

  /**
   * Optimize image for georeferencing.
   * Compresses large images to improve performance.
   */
  async optimizeImage(file: File, maxDimension = 4096, quality = 0.85): Promise<Blob> {
    const img = await this.loadImage(file);

    if (img.naturalWidth <= maxDimension && img.naturalHeight <= maxDimension) {
      return file;
    }

    const aspectRatio = img.naturalWidth / img.naturalHeight;
    let newWidth = maxDimension;
    let newHeight = maxDimension;

    if (aspectRatio > 1) {
      newHeight = maxDimension / aspectRatio;
    } else {
      newWidth = maxDimension * aspectRatio;
    }

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');

    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Failed to create optimized image')),
        'image/jpeg',
        quality
      );
    });
  }

  static isSupportedImageFormat(file: File): boolean {
    const validMimeTypes: string[] = Object.values(SUPPORTED_IMAGE_FORMATS).map(f => f.mimeType);
    return validMimeTypes.includes(file.type);
  }

  static getFormatRecommendations(format: FloorPlanFormat): FormatRecommendation {
    const recommendations: Record<string, FormatRecommendation> = {
      PNG: {
        useCase: 'Floor plans με text και sharp lines',
        pros: ['Lossless compression', 'Transparency support', 'Best for technical drawings'],
        cons: ['Larger files than JPG']
      },
      JPG: {
        useCase: 'Scanned floor plans, photos',
        pros: ['Small files (good compression)', 'Universal support'],
        cons: ['Lossy compression', 'No transparency', 'Artifacts on sharp lines']
      },
      TIFF: {
        useCase: 'Professional CAD exports, high-quality scans',
        pros: ['Highest quality', 'Transparency support', 'Professional standard'],
        cons: ['Very large files', 'Slower loading']
      }
    };

    return recommendations[format] || { useCase: 'General purpose', pros: ['Supported format'], cons: [] };
  }

  // ── Contact Photo Compression (delegated to image-parser-compression.ts) ──

  async compressContactPhoto(
    file: File,
    size: 'avatar' | 'thumbnail' | 'profile' = 'profile',
    quality = 0.85,
  ): Promise<{ blob: Blob; info: { originalSize: number; compressedSize: number; compressionRatio: number; dimensions: { width: number; height: number } } }> {
    return compressContactPhotoFn(file, size, quality);
  }

  async smartCompressContactPhoto(
    file: File,
    usage?: 'avatar' | 'list-item' | 'profile-modal' | 'print' | 'company-logo' | 'business-card' | 'document-scan' | 'technical-drawing' | 'archive',
  ): Promise<{ blob: Blob; info: SmartCompressionInfo }> {
    return smartCompressContactPhotoFn(file, usage);
  }

  static shouldCompressContactPhoto(file: File, maxSizeKB = 500) {
    return shouldCompressContactPhotoFn(file, maxSizeKB);
  }
}

/**
 * Factory function for easy usage
 */
export async function parseImage(file: File): Promise<ImageParserResult> {
  const parser = new ImageParser();
  return parser.parse(file);
}

/**
 * Quick compress for contact photos (static)
 */
export async function compressContactPhoto(
  file: File,
  size: 'avatar' | 'thumbnail' | 'profile' = 'profile',
  quality = 0.85,
): Promise<Blob> {
  const result = await compressContactPhotoFn(file, size, quality);
  return result.blob;
}

/**
 * Smart compress with automatic settings (static)
 */
export async function smartCompressContactPhoto(
  file: File,
  usage?: 'avatar' | 'list-item' | 'profile-modal' | 'print' | 'company-logo' | 'business-card' | 'document-scan' | 'technical-drawing' | 'archive',
): Promise<{ blob: Blob; compressionInfo: SmartCompressionInfo }> {
  const result = await smartCompressContactPhotoFn(file, usage);
  return { blob: result.blob, compressionInfo: result.info };
}
