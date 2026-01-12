/**
 * 🖼️ IMAGE PARSER - Universal Image Handler
 *
 * Handles ALL raster image formats:
 * - PNG (Portable Network Graphics)
 * - JPG/JPEG (Joint Photographic Experts Group)
 * - TIFF (Tagged Image File Format)
 * - BMP (Bitmap)
 * - GIF (Graphics Interchange Format)
 * - WEBP (Google WebP)
 *
 * @module floor-plan-system/parsers/raster/ImageParser
 *
 * 💡 KEY INSIGHT: Όλες οι εικόνες είναι RASTER (pixel-based),
 *    οπότε χειρίζονται με τον ΙΔΙΟ τρόπο! Browser APIs handle all formats.
 */

import type { ParserResult, FloorPlanFormat } from '../../types';

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
  size: number; // bytes
  aspectRatio: number;
  hasAlpha: boolean; // Transparency support
}

/**
 * Image parser result (extends ParserResult)
 */
export interface ImageParserResult extends ParserResult {
  metadata: ImageMetadata;
  imageUrl: string; // Data URL or Object URL
  thumbnail?: string; // Optional thumbnail για preview
}

/**
 * 🏢 ENTERPRISE: Format recommendation structure
 */
interface FormatRecommendation {
  useCase: string;
  pros: string[];
  cons: string[];
}

/**
 * 🏢 ENTERPRISE: Compression settings interface
 */
interface CompressionSettings {
  maxDimension: number;
  quality: number;
  size: 'avatar' | 'thumbnail' | 'profile';
}

/**
 * 🏢 ENTERPRISE: Compression statistics interface
 */
interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dimensions: { width: number; height: number };
}

/**
 * 🏢 ENTERPRISE: Smart compression info interface
 */
export interface SmartCompressionInfo {
  strategy: string;
  settings: CompressionSettings;
  stats: CompressionStats;
}

/**
 * Universal Image Parser
 *
 * ✅ Works για ΟΛΕΣ τις image formats
 * ✅ Browser-native support (no external libraries needed)
 * ✅ Automatic format detection
 * ✅ Thumbnail generation
 * ✅ Quality optimization
 */
export class ImageParser {
  /**
   * Parse image file
   *
   * @param file - Image file (PNG, JPG, TIFF, etc.)
   * @returns Promise<ImageParserResult>
   *
   * @example
   * const parser = new ImageParser();
   * const result = await parser.parse(file);
   * console.log('Image dimensions:', result.metadata.width, result.metadata.height);
   */
  async parse(file: File): Promise<ImageParserResult> {
    try {
      // 1. Validate file
      this.validateImageFile(file);

      // 2. Detect format
      const format = this.detectFormat(file);

      // 3. Load image
      const img = await this.loadImage(file);

      // 4. Extract metadata
      const metadata = this.extractMetadata(img, file, format);

      // 5. Create image URL (για rendering)
      const imageUrl = URL.createObjectURL(file);

      // 6. Generate thumbnail (για preview - 400x400 to match DXF thumbnails)
      const thumbnail = await this.generateThumbnail(img, 400, 400);

      return {
        success: true,
        format,
        imageUrl,
        thumbnail,
        metadata,
        bounds: undefined, // Will be set after georeferencing
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

  /**
   * Validate image file
   */
  private validateImageFile(file: File): void {
    // Check if file exists
    if (!file) {
      throw new Error('No file provided');
    }

    // Check file size (max 50MB για images)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error(
        `Image file too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 50MB)`
      );
    }

    // Check mime type
    const validMimeTypes = Object.values(SUPPORTED_IMAGE_FORMATS).map(f => f.mimeType);
    if (!validMimeTypes.includes(file.type)) {
      throw new Error(`Unsupported image format: ${file.type}`);
    }
  }

  /**
   * Detect image format from file
   */
  private detectFormat(file: File): FloorPlanFormat {
    const extension = file.name.toLowerCase().split('.').pop() || '';

    // Map extension to format
    const formatMap: Record<string, FloorPlanFormat> = {
      png: 'PNG',
      jpg: 'JPG',
      jpeg: 'JPG',
      tiff: 'TIFF',
      tif: 'TIFF'
    };

    const format = formatMap[extension];
    if (!format) {
      throw new Error(`Unknown image format: .${extension}`);
    }

    return format;
  }

  /**
   * Load image using browser Image API
   *
   * 💡 This works για ΟΛΕΣ τις image formats που υποστηρίζει ο browser!
   */
  private async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(img.src); // Cleanup
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src); // Cleanup
        reject(new Error('Failed to load image'));
      };

      // Create object URL και φόρτωσε image
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract metadata from loaded image
   */
  private extractMetadata(
    img: HTMLImageElement,
    file: File,
    format: FloorPlanFormat
  ): ImageMetadata {
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

  /**
   * Check if format supports transparency (alpha channel)
   */
  private checkAlphaSupport(format: FloorPlanFormat): boolean {
    const alphaFormats: FloorPlanFormat[] = ['PNG', 'TIFF'];
    return alphaFormats.includes(format);
  }

  /**
   * Generate thumbnail για preview
   *
   * @param img - Source image
   * @param maxWidth - Max thumbnail width
   * @param maxHeight - Max thumbnail height
   * @returns Data URL of thumbnail
   */
  private async generateThumbnail(
    img: HTMLImageElement,
    maxWidth: number,
    maxHeight: number
  ): Promise<string> {
    // Calculate thumbnail dimensions (maintain aspect ratio)
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    let thumbWidth = maxWidth;
    let thumbHeight = maxHeight;

    if (aspectRatio > 1) {
      // Landscape
      thumbHeight = maxWidth / aspectRatio;
    } else {
      // Portrait
      thumbWidth = maxHeight * aspectRatio;
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    // Draw resized image
    ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);

    // Convert to data URL (PNG format για quality)
    return canvas.toDataURL('image/png', 0.8);
  }

  /**
   * Optimize image για georeferencing
   *
   * Compresses large images to improve performance
   *
   * @param file - Original image file
   * @param maxDimension - Max width/height (default: 4096px)
   * @param quality - JPEG quality 0-1 (default: 0.85)
   * @returns Optimized image blob
   */
  async optimizeImage(
    file: File,
    maxDimension: number = 4096,
    quality: number = 0.85
  ): Promise<Blob> {
    const img = await this.loadImage(file);

    // Check if optimization needed
    if (img.naturalWidth <= maxDimension && img.naturalHeight <= maxDimension) {
      return file; // No optimization needed
    }

    // Calculate new dimensions
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    let newWidth = maxDimension;
    let newHeight = maxDimension;

    if (aspectRatio > 1) {
      newHeight = maxDimension / aspectRatio;
    } else {
      newWidth = maxDimension * aspectRatio;
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    // Draw resized image
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create optimized image'));
          }
        },
        'image/jpeg', // Use JPEG για better compression
        quality
      );
    });
  }

  /**
   * Check if file is a supported image format
   */
  static isSupportedImageFormat(file: File): boolean {
    const validMimeTypes = Object.values(SUPPORTED_IMAGE_FORMATS).map(f => f.mimeType);
    return validMimeTypes.includes(file.type);
  }

  /**
   * Get recommended settings για διάφορα image formats
   */
  static getFormatRecommendations(format: FloorPlanFormat): {
    useCase: string;
    pros: string[];
    cons: string[];
  } {
    // 🏢 ENTERPRISE: Proper type for format recommendations
    const recommendations: Record<string, FormatRecommendation> = {
      PNG: {
        useCase: 'Floor plans με text και sharp lines',
        pros: [
          'Lossless compression (καλύτερη ποιότητα)',
          'Transparency support (alpha channel)',
          'Best για technical drawings'
        ],
        cons: ['Μεγαλύτερα files από JPG']
      },
      JPG: {
        useCase: 'Scanned floor plans, photos',
        pros: ['Μικρά files (good compression)', 'Universal support'],
        cons: [
          'Lossy compression (χειρότερη ποιότητα)',
          'No transparency',
          'Artifacts σε sharp lines'
        ]
      },
      TIFF: {
        useCase: 'Professional CAD exports, high-quality scans',
        pros: [
          'Highest quality',
          'Transparency support',
          'Professional standard'
        ],
        cons: ['Πολύ μεγάλα files', 'Slower loading']
      }
    };

    return (
      recommendations[format] || {
        useCase: 'General purpose',
        pros: ['Supported format'],
        cons: []
      }
    );
  }

  /**
   * 🔥 CONTACT PHOTO COMPRESSION METHODS
   * Specialized compression για contact photos, avatars, and profile images
   */

  /**
   * Compress contact photo με optimized settings for profile pictures
   *
   * @param file - Original image file
   * @param size - Target size ('avatar' | 'thumbnail' | 'profile')
   * @param quality - JPEG quality 0-1 (default: 0.85)
   * @returns Optimized image blob optimized for contacts
   */
  async compressContactPhoto(
    file: File,
    size: 'avatar' | 'thumbnail' | 'profile' = 'profile',
    quality: number = 0.85
  ): Promise<{ blob: Blob; info: { originalSize: number; compressedSize: number; compressionRatio: number; dimensions: { width: number; height: number } } }> {
    const img = await this.loadImage(file);

    // Contact photo size configurations
    const sizeConfig = {
      avatar: { maxDimension: 200, quality: 0.8 },    // Small avatars
      thumbnail: { maxDimension: 400, quality: 0.82 }, // List thumbnails
      profile: { maxDimension: 800, quality: 0.85 }    // Full profile photos
    };

    const config = sizeConfig[size];
    const maxDimension = config.maxDimension;
    const targetQuality = quality || config.quality;

    // Calculate new dimensions (always maintain aspect ratio)
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    let newWidth = maxDimension;
    let newHeight = maxDimension;

    if (aspectRatio > 1) {
      newHeight = maxDimension / aspectRatio;
    } else {
      newWidth = maxDimension * aspectRatio;
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context για contact photo compression');
    }

    // Enable smooth scaling για better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw resized image
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create compressed contact photo'));
          }
        },
        'image/jpeg', // Always use JPEG for contacts (better compression)
        targetQuality
      );
    });

    // Calculate compression info
    const originalSize = file.size;
    const compressedSize = blob.size;
    const compressionRatio = Math.round(((originalSize - compressedSize) / originalSize) * 100);

    return {
      blob,
      info: {
        originalSize,
        compressedSize,
        compressionRatio,
        dimensions: { width: newWidth, height: newHeight }
      }
    };
  }

  /**
   * Smart compression - automatically chooses best settings based on file size και usage
   *
   * @param file - Original image file
   * @param usage - Intended usage context
   * @returns Optimized image with smart compression
   */
  async smartCompressContactPhoto(
    file: File,
    usage: 'avatar' | 'list-item' | 'profile-modal' | 'print' = 'profile-modal'
  ): Promise<{ blob: Blob; info: SmartCompressionInfo }> {
    const img = await this.loadImage(file);
    const fileSize = file.size;
    const megabytes = fileSize / (1024 * 1024);

    // Smart compression strategy based on file size και usage
    let strategy: string;
    let settings: { maxDimension: number; quality: number; size: 'avatar' | 'thumbnail' | 'profile' };

    if (usage === 'avatar') {
      strategy = 'tiny-avatar';
      settings = { maxDimension: 150, quality: 0.75, size: 'avatar' as const };
    } else if (usage === 'list-item') {
      strategy = 'list-thumbnail';
      settings = { maxDimension: 300, quality: 0.8, size: 'thumbnail' as const };
    } else if (usage === 'print') {
      strategy = 'high-quality';
      settings = { maxDimension: 1200, quality: 0.9, size: 'profile' as const };
    } else {
      // profile-modal - adaptive based on original file size
      if (megabytes > 5) {
        strategy = 'aggressive-compression';
        settings = { maxDimension: 600, quality: 0.75, size: 'profile' as const };
      } else if (megabytes > 2) {
        strategy = 'moderate-compression';
        settings = { maxDimension: 700, quality: 0.82, size: 'profile' as const };
      } else {
        strategy = 'light-compression';
        settings = { maxDimension: 800, quality: 0.87, size: 'profile' as const };
      }
    }

    const result = await this.compressContactPhoto(file, settings.size, settings.quality);

    return {
      blob: result.blob,
      info: {
        strategy,
        settings,
        stats: result.info
      }
    };
  }

  /**
   * Check if contact photo needs compression
   *
   * @param file - Image file to check
   * @param maxSizeKB - Maximum acceptable size in KB (default: 500KB)
   * @returns Whether compression is recommended
   */
  static shouldCompressContactPhoto(file: File, maxSizeKB: number = 500): {
    shouldCompress: boolean;
    reason: string;
    currentSizeKB: number;
    recommendedAction: string;
  } {
    const currentSizeKB = Math.round(file.size / 1024);

    if (currentSizeKB <= maxSizeKB) {
      return {
        shouldCompress: false,
        reason: 'File size is acceptable',
        currentSizeKB,
        recommendedAction: 'No compression needed'
      };
    }

    let recommendedAction: string;
    if (currentSizeKB > 2000) { // > 2MB
      recommendedAction = 'Aggressive compression recommended (file is very large)';
    } else if (currentSizeKB > 1000) { // > 1MB
      recommendedAction = 'Moderate compression recommended';
    } else {
      recommendedAction = 'Light compression recommended';
    }

    return {
      shouldCompress: true,
      reason: `File size (${currentSizeKB}KB) exceeds limit (${maxSizeKB}KB)`,
      currentSizeKB,
      recommendedAction
    };
  }
}

/**
 * Factory function για εύκολη χρήση
 */
export async function parseImage(file: File): Promise<ImageParserResult> {
  const parser = new ImageParser();
  return parser.parse(file);
}

/**
 * 🎯 CONTACT PHOTO COMPRESSION UTILITIES
 * Static methods για direct usage χωρίς instantiation
 */

/**
 * Quick compress για contact photos (static method)
 */
export async function compressContactPhoto(
  file: File,
  size: 'avatar' | 'thumbnail' | 'profile' = 'profile',
  quality: number = 0.85
): Promise<Blob> {
  const parser = new ImageParser();
  const result = await parser.compressContactPhoto(file, size, quality);
  return result.blob;
}

/**
 * Smart compress with automatic settings (static method)
 */
export async function smartCompressContactPhoto(
  file: File,
  usage: 'avatar' | 'list-item' | 'profile-modal' | 'print' = 'profile-modal'
): Promise<{ blob: Blob; compressionInfo: SmartCompressionInfo }> {
  const parser = new ImageParser();
  const result = await parser.smartCompressContactPhoto(file, usage);
  return {
    blob: result.blob,
    compressionInfo: result.info
  };
}
