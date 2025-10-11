/**
 * 🔍 FORMAT DETECTION UTILITY
 *
 * Detect floor plan file format από extension και MIME type
 *
 * @module floor-plan-system/utils/format-detection
 */

/**
 * Supported floor plan formats
 */
export type FloorPlanFormat =
  | 'DXF'
  | 'DWG'
  | 'PDF'
  | 'PNG'
  | 'JPG'
  | 'TIFF'
  | 'UNKNOWN';

/**
 * Detect format από file extension και MIME type
 *
 * @param file - File object
 * @returns FloorPlanFormat
 */
export function detectFormat(file: File): FloorPlanFormat {
  // Get extension (lowercase, without dot)
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // Primary detection: Extension
  switch (extension) {
    case 'dxf':
      return 'DXF';

    case 'dwg':
      return 'DWG';

    case 'pdf':
      return 'PDF';

    case 'png':
      return 'PNG';

    case 'jpg':
    case 'jpeg':
      return 'JPG';

    case 'tiff':
    case 'tif':
      return 'TIFF';

    default:
      // Fallback: MIME type detection
      return detectFormatFromMimeType(file.type);
  }
}

/**
 * Fallback detection από MIME type
 */
function detectFormatFromMimeType(mimeType: string): FloorPlanFormat {
  // Normalize MIME type
  const mime = mimeType.toLowerCase();

  if (mime.includes('dxf')) {
    return 'DXF';
  }

  if (mime.includes('dwg')) {
    return 'DWG';
  }

  if (mime.includes('pdf')) {
    return 'PDF';
  }

  if (mime.includes('png')) {
    return 'PNG';
  }

  if (mime.includes('jpeg') || mime.includes('jpg')) {
    return 'JPG';
  }

  if (mime.includes('tiff') || mime.includes('tif')) {
    return 'TIFF';
  }

  return 'UNKNOWN';
}

/**
 * Check if format is vector (CAD)
 */
export function isVectorFormat(format: FloorPlanFormat): boolean {
  return format === 'DXF' || format === 'DWG';
}

/**
 * Check if format is raster (image)
 */
export function isRasterFormat(format: FloorPlanFormat): boolean {
  return format === 'PNG' || format === 'JPG' || format === 'TIFF';
}

/**
 * Get user-friendly format name
 */
export function getFormatDisplayName(format: FloorPlanFormat): string {
  switch (format) {
    case 'DXF':
      return 'AutoCAD DXF';
    case 'DWG':
      return 'AutoCAD DWG';
    case 'PDF':
      return 'PDF Document';
    case 'PNG':
      return 'PNG Image';
    case 'JPG':
      return 'JPEG Image';
    case 'TIFF':
      return 'TIFF Image';
    default:
      return 'Unknown Format';
  }
}
