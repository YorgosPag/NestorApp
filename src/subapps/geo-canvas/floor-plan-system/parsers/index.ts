/**
 * 📦 PARSERS - Main Export
 *
 * Floor plan parsers organized by type:
 * - Vector Parsers (DXF, DWG) - Complex geometric entities
 * - Raster Parsers (Images, PDF) - Pixel-based formats
 */

// ============================================================================
// 🎨 VECTOR PARSERS
// ============================================================================

export { DxfParser, parseDxf } from './vector/DxfParser';
export { DwgParser, parseDwg } from './vector/DwgParser';

// ============================================================================
// 🖼️ RASTER PARSERS
// ============================================================================

export {
  ImageParser,
  parseImage,
  SUPPORTED_IMAGE_FORMATS
} from './raster/ImageParser';

export type { ImageMetadata, ImageParserResult } from './raster/ImageParser';

// PDF Parser (future)
// export { PdfParser, parsePdf } from './raster/PdfParser';

// ============================================================================
// 🔧 UTILITY: Format Detection
// ============================================================================

import type { FloorPlanFormat, ParserResult } from '../types';

/**
 * Detect format from file
 */
export function detectFormat(file: File): FloorPlanFormat {
  const extension = file.name.toLowerCase().split('.').pop() || '';

  const formatMap: Record<string, FloorPlanFormat> = {
    dxf: 'DXF',
    dwg: 'DWG',
    pdf: 'PDF',
    png: 'PNG',
    jpg: 'JPG',
    jpeg: 'JPG',
    tiff: 'TIFF',
    tif: 'TIFF'
  };

  const format = formatMap[extension];
  if (!format) {
    throw new Error(`Unsupported file format: .${extension}`);
  }

  return format;
}

/**
 * Check if format is vector-based
 */
export function isVectorFormat(format: FloorPlanFormat): boolean {
  return ['DXF', 'DWG'].includes(format);
}

/**
 * Check if format is raster-based
 */
export function isRasterFormat(format: FloorPlanFormat): boolean {
  return ['PNG', 'JPG', 'TIFF', 'PDF'].includes(format);
}

/**
 * Get appropriate parser για format
 * 🏢 ENTERPRISE: Returns parser with proper ParserResult type
 */
export async function getParser(
  format: FloorPlanFormat
): Promise<{ parse: (file: File) => Promise<ParserResult> }> {
  switch (format) {
    case 'DXF':
      return { parse: parseDxf };
    case 'DWG':
      return { parse: parseDwg };
    case 'PNG':
    case 'JPG':
    case 'TIFF':
      return { parse: parseImage };
    // case 'PDF':
    //   return { parse: parsePdf };
    default:
      throw new Error(`No parser available for format: ${format}`);
  }
}
