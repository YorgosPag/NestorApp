/**
 * =============================================================================
 * PROPERTY SHOWCASE — TEXT DIGEST LOADER (ADR-312 Phase 9.18)
 * =============================================================================
 *
 * Server-only helper that loads the full showcase snapshot for a property,
 * reuses the SSoT labels resolver, and returns a chunked plain-text digest
 * ready to be sent through any text channel (Telegram sendMessage, WhatsApp
 * text message, etc.).
 *
 * Mirrors `loadShowcaseSources` in
 * `src/app/api/properties/[id]/showcase/generate/helpers.ts` but stays free
 * of Storage / PDF I/O — just the metadata needed by the digest formatter.
 *
 * @module services/property-showcase/load-text-digest
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import { loadShowcaseRelations, buildPropertyShowcaseSnapshot } from './snapshot-builder';
import { loadShowcasePdfLabels } from './labels';
import { buildTelegramTextDigest } from './telegram-text-digest';

const logger = createModuleLogger('ShowcaseTextDigestLoader');

export interface LoadTextDigestParams {
  propertyId: string;
  companyId: string;
  shareUrl?: string;
  locale?: 'el' | 'en';
}

export async function loadShowcaseTextDigest(
  params: LoadTextDigestParams,
): Promise<string[]> {
  const { propertyId, companyId, shareUrl, locale = 'el' } = params;
  const adminDb = getAdminFirestore();
  if (!adminDb) return [];

  const propertyDoc = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  if (!propertyDoc.exists) return [];
  const property = (propertyDoc.data() ?? {}) as Record<string, unknown>;
  if ((property as { companyId?: string }).companyId !== companyId) return [];

  const branding = await resolveShowcaseCompanyBranding({
    adminDb, propertyData: property, companyId,
  });
  const context = await loadShowcaseRelations({
    adminDb, propertyId, property, branding,
  });
  const snapshot = buildPropertyShowcaseSnapshot(context, locale);
  const labels = loadShowcasePdfLabels(locale);

  const chunks = buildTelegramTextDigest({ snapshot, labels, shareUrl, locale });
  logger.info('Showcase text digest built', {
    propertyId, companyId, chunks: chunks.length, totalChars: chunks.reduce((s, c) => s + c.length, 0),
  });
  return chunks;
}
