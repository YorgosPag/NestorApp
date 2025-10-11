/**
 * 🖼️ RASTER PARSERS - Barrel Export
 *
 * Raster formats (pixel-based images):
 * - PNG, JPG, TIFF (via ImageParser)
 * - PDF (future)
 */

// Image Parser (handles ALL image formats)
export { ImageParser, parseImage, SUPPORTED_IMAGE_FORMATS } from './ImageParser';
export type { ImageMetadata, ImageParserResult } from './ImageParser';

// PDF Parser (future)
// export { PdfParser } from './PdfParser';
