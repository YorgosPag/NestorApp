/**
 * Vendor Logo Extractor — ADR-327 §6.
 *
 * Strategy (belt-and-suspenders):
 *   1. PRIMARY: Extract largest DCTDecode Image XObject from PDF page 1.
 *      Gives the clean embedded logo without rasterization artifacts.
 *   2. FALLBACK: Rasterize page 1 → crop top-left quadrant (22%×45%).
 *      Logos in B2B invoices are almost universally top-left; the right side
 *      carries customer details and quote title which we explicitly exclude.
 * Server-side only — uses pdf-lib + @napi-rs/canvas.
 */

import 'server-only';

import { rasterizePdfPages, RasterizeUnavailableError } from '@/services/pdf/pdf-rasterize.service';
import { uploadPublicFile } from '@/services/storage-admin/public-upload.service';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('VendorLogoExtractor');

const LOGO_CROP_HEIGHT_PCT = 0.22;
const LOGO_CROP_WIDTH_PCT = 0.45;
const LOGO_DPI = 200;
const LOGO_MAX_WIDTH_PX = 1600;

interface NapiImage { width: number; height: number; }
interface NapiCtx { drawImage(image: NapiImage, dx: number, dy: number): void; }
interface NapiCanvas { getContext(type: '2d'): NapiCtx; toBuffer(mime: 'image/png'): Buffer; }
interface NapiCanvasMod {
  createCanvas(w: number, h: number): NapiCanvas;
  loadImage(src: Buffer): Promise<NapiImage>;
}

async function extractEmbeddedLogoFromPdf(pdfBuffer: Buffer): Promise<Buffer | null> {
  try {
    const { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFNumber } = await import('pdf-lib');
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pages = doc.getPages();
    if (!pages.length) return null;

    const resources = pages[0].node.Resources();
    if (!resources) return null;
    const xObjDict = resources.lookupMaybe(PDFName.of('XObject'), PDFDict);
    if (!xObjDict) return null;

    let bestBuf: Uint8Array | null = null;
    let bestArea = 0;

    for (const [, ref] of xObjDict.entries()) {
      const obj = doc.context.lookup(ref);
      if (!(obj instanceof PDFRawStream)) continue;
      if (obj.dict.get(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
      if (obj.dict.get(PDFName.of('ImageMask'))?.toString() === 'true') continue;
      if (!obj.dict.get(PDFName.of('Filter'))?.toString().includes('DCTDecode')) continue;
      const wObj = obj.dict.get(PDFName.of('Width'));
      const hObj = obj.dict.get(PDFName.of('Height'));
      if (!(wObj instanceof PDFNumber) || !(hObj instanceof PDFNumber)) continue;
      const area = wObj.asNumber() * hObj.asNumber();
      if (area > bestArea) { bestArea = area; bestBuf = obj.contents; }
    }

    if (!bestBuf) return null;

    const mod = (await import('@napi-rs/canvas')) as unknown as NapiCanvasMod;
    const img = await mod.loadImage(Buffer.from(bestBuf));
    const canvas = mod.createCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toBuffer('image/png');
  } catch (e) {
    logger.warn('Embedded logo extraction failed, will fallback to crop', { error: String(e) });
    return null;
  }
}

async function cropToLogoQuadrant(imageBuffer: Buffer): Promise<Buffer | null> {
  try {
    const mod = (await import('@napi-rs/canvas')) as unknown as NapiCanvasMod;
    const img = await mod.loadImage(imageBuffer);
    const cropH = Math.max(10, Math.floor(img.height * LOGO_CROP_HEIGHT_PCT));
    const cropW = Math.max(10, Math.floor(img.width * LOGO_CROP_WIDTH_PCT));
    const canvas = mod.createCanvas(cropW, cropH);
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toBuffer('image/png');
  } catch (e) {
    logger.warn('Logo crop failed', { error: String(e) });
    return null;
  }
}

export async function extractAndUploadVendorLogo(
  fileBuffer: Buffer,
  mimeType: string,
  companyId: string,
  quoteId: string,
): Promise<string | null> {
  try {
    let logoBuffer: Buffer | null = null;

    if (mimeType === 'application/pdf') {
      logoBuffer = await extractEmbeddedLogoFromPdf(fileBuffer);
      if (!logoBuffer) {
        const pages = await rasterizePdfPages(fileBuffer, { dpi: LOGO_DPI, maxPages: 1, maxWidthPx: LOGO_MAX_WIDTH_PX });
        if (pages.length) logoBuffer = await cropToLogoQuadrant(pages[0]);
      }
    } else if (mimeType.startsWith('image/') && mimeType !== 'image/heic') {
      logoBuffer = await cropToLogoQuadrant(fileBuffer);
    }

    if (!logoBuffer) return null;

    const { path: storagePath } = buildStoragePath({
      companyId,
      entityType: ENTITY_TYPES.QUOTE,
      entityId: quoteId,
      domain: FILE_DOMAINS.SALES,
      category: FILE_CATEGORIES.DOCUMENTS,
      fileId: 'vendor-logo',
      ext: 'png',
    });

    const { url } = await uploadPublicFile({
      storagePath,
      buffer: logoBuffer,
      contentType: 'image/png',
      cacheControl: 'public, max-age=86400',
    });
    return url;
  } catch (err) {
    if (err instanceof RasterizeUnavailableError) {
      logger.warn('Logo extraction skipped — rasterizer unavailable');
    } else {
      logger.warn('Logo extraction failed', { error: String(err) });
    }
    return null;
  }
}
