/**
 * Vendor Logo Extractor — ADR-327 §6.
 *
 * Crops the top header band (22%) of a quote document's first page
 * and uploads it to Storage as the vendor's logo candidate.
 * Server-side only — uses @napi-rs/canvas + pdf-rasterize service.
 */

import 'server-only';

import { getAdminBucket } from '@/lib/firebaseAdmin';
import { rasterizePdfPages, RasterizeUnavailableError } from '@/services/pdf/pdf-rasterize.service';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('VendorLogoExtractor');

const LOGO_CROP_HEIGHT_PCT = 0.22;
const LOGO_DPI = 120;
const LOGO_MAX_WIDTH_PX = 900;

interface NapiImage { width: number; height: number; }
interface NapiCtx { drawImage(image: NapiImage, dx: number, dy: number): void; }
interface NapiCanvas { getContext(type: '2d'): NapiCtx; toBuffer(mime: 'image/png'): Buffer; }
interface NapiCanvasMod {
  createCanvas(w: number, h: number): NapiCanvas;
  loadImage(src: Buffer): Promise<NapiImage>;
}

async function cropToHeaderBand(imageBuffer: Buffer): Promise<Buffer | null> {
  try {
    const mod = (await import('@napi-rs/canvas')) as unknown as NapiCanvasMod;
    const img = await mod.loadImage(imageBuffer);
    const cropH = Math.max(10, Math.floor(img.height * LOGO_CROP_HEIGHT_PCT));
    const canvas = mod.createCanvas(img.width, cropH);
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
    let firstPageBuffer: Buffer;

    if (mimeType === 'application/pdf') {
      const pages = await rasterizePdfPages(fileBuffer, {
        dpi: LOGO_DPI,
        maxPages: 1,
        maxWidthPx: LOGO_MAX_WIDTH_PX,
      });
      if (!pages.length) return null;
      firstPageBuffer = pages[0];
    } else if (mimeType.startsWith('image/') && mimeType !== 'image/heic') {
      firstPageBuffer = fileBuffer;
    } else {
      return null;
    }

    const logoBuffer = await cropToHeaderBand(firstPageBuffer);
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

    const bucket = getAdminBucket();
    const fileRef = bucket.file(storagePath);
    await fileRef.save(logoBuffer, {
      metadata: { contentType: 'image/png', cacheControl: 'private, max-age=86400' },
    });
    await fileRef.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  } catch (err) {
    if (err instanceof RasterizeUnavailableError) {
      logger.warn('Logo extraction skipped — rasterizer unavailable');
    } else {
      logger.warn('Logo extraction failed', { error: String(err) });
    }
    return null;
  }
}
