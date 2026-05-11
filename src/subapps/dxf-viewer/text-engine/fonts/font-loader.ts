/**
 * FontLoader — async font loading pipeline (ADR-344 Phase 2, Q18 + Q20).
 *
 * Handles TTF/OTF/WOFF/WOFF2 via opentype.js.
 * Company fonts are fetched from Firebase Storage signed URLs.
 * Missing SHX fonts are recorded in MissingFontReport for banner + highlight.
 *
 * @module text-engine/fonts/font-loader
 */

import * as opentype from 'opentype.js';
import type { Font } from 'opentype.js';
import { fontCache } from './font-cache';
import { lookupSubstitute } from './font-substitution-table';
import { FIRESTORE_COLLECTIONS } from '@/config/firestore-collections';
import { db, storage } from '@/lib/firebase/client';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MissingFontReport {
  /** SHX/font names that were not found. */
  readonly missing: string[];
  /** missing name → substitute family name. */
  readonly substitutions: Record<string, string>;
  /** DXF entity IDs whose rendering used a substitute. */
  readonly affectedEntityIds: string[];
}

export interface CompanyFontMeta {
  id: string;
  companyId: string;
  name: string;
  fileName: string;
  format: 'ttf' | 'otf' | 'woff' | 'woff2' | 'shx';
}

// ─── URL → Font ───────────────────────────────────────────────────────────────

/** Fetch a font URL → parse with opentype.js → cache by name. */
export async function loadFont(url: string, cacheName?: string): Promise<Font> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FontLoader: HTTP ${response.status} fetching ${url}`);
  }
  const buffer = await response.arrayBuffer();
  return loadFontFromBuffer(buffer, cacheName);
}

/** Parse an ArrayBuffer → opentype.Font → cache by name (if provided). */
export function loadFontFromBuffer(buffer: ArrayBuffer, cacheName?: string): Font {
  const cached = fontCache.getByBuffer(buffer);
  if (cached) return cached;

  const font = opentype.parse(buffer);
  if (cacheName) {
    fontCache.set(cacheName, font, buffer);
  }
  return font;
}

// ─── Company font (Firebase Storage) ─────────────────────────────────────────

/**
 * Load a company-scoped font from Firebase Storage.
 * Uses fontCache to skip re-fetching on subsequent calls.
 */
export async function loadCompanyFont(
  companyId: string,
  fileName: string,
): Promise<Font> {
  const cacheKey = `company:${companyId}:${fileName}`;
  const cached = fontCache.get(cacheKey);
  if (cached) return cached;

  const storageRef = ref(storage, `fonts/${companyId}/${fileName}`);
  const url = await getDownloadURL(storageRef);
  return loadFont(url, cacheKey);
}

// ─── Missing font report ──────────────────────────────────────────────────────

/**
 * Build a MissingFontReport for a set of style names that could not be resolved.
 * sceneEntities is typed loosely — the caller provides what it has.
 */
export function buildMissingFontReport(
  missingStyleNames: string[],
  sceneEntities: Array<{ id: string; styleName?: string }>,
): MissingFontReport {
  if (missingStyleNames.length === 0) {
    return { missing: [], substitutions: {}, affectedEntityIds: [] };
  }

  const substitutions: Record<string, string> = {};
  for (const name of missingStyleNames) {
    const entry = lookupSubstitute(name);
    substitutions[name] = entry.substituteFamily;
  }

  const missingSet = new Set(missingStyleNames.map((n) => n.toLowerCase()));
  const affectedEntityIds = sceneEntities
    .filter((e) => e.styleName && missingSet.has(e.styleName.toLowerCase()))
    .map((e) => e.id);

  return { missing: missingStyleNames, substitutions, affectedEntityIds };
}

// ─── Company font list helper ─────────────────────────────────────────────────

/** Fetch all registered company fonts from Firestore (metadata only). */
export async function listCompanyFontsMeta(
  companyId: string,
): Promise<CompanyFontMeta[]> {
  const q = query(
    collection(db, FIRESTORE_COLLECTIONS.COMPANY_FONTS),
    where('companyId', '==', companyId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CompanyFontMeta);
}
