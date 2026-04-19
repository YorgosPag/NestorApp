/**
 * =============================================================================
 * 🏢 PROPERTY SHOWCASE — Brand logo assets loader (ADR-312 Phase 8)
 * =============================================================================
 *
 * Resolves the company + Nestor App logo bytes for PDF embedding. Shared by
 * every PDF entrypoint (generate, standalone pdf, regenerate) so the branding
 * shown in the header/footer is identical across surfaces.
 *
 * Sources, in order:
 *  - Company logo: absolute http(s) URL from `branding.logoUrl`, else the
 *    bundled `public/images/pagonis-energo-logo.png` fallback.
 *  - Nestor App logo: always the bundled `public/images/nestor-app-logo.png`.
 *
 * Never throws — a failure yields `undefined` and the renderer degrades to a
 * text-only header/footer.
 *
 * @module services/property-showcase/brand-logo-assets
 */

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ShowcasePhotoAsset } from '@/services/pdf/renderers/PropertyShowcaseRenderer';
import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('BrandLogoAssets');

export interface BrandLogoAssets {
  companyLogo?: ShowcasePhotoAsset;
  nestorAppLogo?: ShowcasePhotoAsset;
}

export async function loadBrandLogoAssets(
  branding: ShowcaseCompanyBranding,
): Promise<BrandLogoAssets> {
  const [companyLogo, nestorAppLogo] = await Promise.all([
    branding.logoUrl && /^https?:\/\//i.test(branding.logoUrl.trim())
      ? fetchLogoFromUrl('company-logo', branding.logoUrl.trim())
      : readLogoFromPublic('company-logo', 'pagonis-energo-logo.png'),
    readLogoFromPublic('nestor-app-logo', 'nestor-app-logo.png'),
  ]);
  return { companyLogo, nestorAppLogo };
}

async function readLogoFromPublic(
  id: string,
  filename: string,
): Promise<ShowcasePhotoAsset | undefined> {
  try {
    const fullPath = path.join(process.cwd(), 'public', 'images', filename);
    const buffer = await fs.readFile(fullPath);
    const lower = filename.toLowerCase();
    const format: 'JPEG' | 'PNG' = lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'JPEG' : 'PNG';
    return { id, bytes: new Uint8Array(buffer), format, displayName: filename };
  } catch (err) {
    logger.warn('Brand logo bundled asset read failed', {
      filename, error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

async function fetchLogoFromUrl(
  id: string,
  url: string,
): Promise<ShowcasePhotoAsset | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    const format: 'JPEG' | 'PNG' = ct.includes('jpeg') || /\.jpe?g($|\?)/i.test(url)
      ? 'JPEG'
      : 'PNG';
    return { id, bytes: buf, format, displayName: id };
  } catch (err) {
    logger.warn('Brand logo URL fetch failed', {
      url, error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
