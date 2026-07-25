/**
 * =============================================================================
 * SHOWCASE CORE — Unified public PDF proxy route (ADR-698)
 * =============================================================================
 *
 * `api/building-showcase/[token]/pdf/route.ts` and its project twin were **85
 * lines each and identical except for six tokens** (446t of clones, the largest
 * cross-file cluster in `src/` at the time of measurement). Both already called
 * `createPublicShowcasePdfRoute` (ADR-321) — the duplication was entirely in
 * the five hooks it demands, every one of which was the same code:
 *
 * ```
 * resolveShare      -> same `shares` query, one differing entityType string
 * loadEntityHeader  -> same doc read, one differing collection
 * checkTenant       -> byte-identical
 * buildFilename     -> byte-identical sanitiser, one differing fallback slug
 * incrementCounter  -> byte-identical
 * ```
 *
 * This factory supplies all five from data. It deliberately covers only the
 * **unified-`shares`** surfaces; the property surface keeps its own hooks
 * because it genuinely differs (legacy `file_shares` dual-read, code+name
 * filename, dual-write counter) — see ADR-698 §4.
 *
 * @module services/showcase-core/api/create-unified-public-pdf-route
 * @enterprise ADR-698 — Public Showcase Token Surface SSoT
 */

import type { Firestore } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  createPublicShowcasePdfRoute,
  type PublicShowcasePdfHandler,
} from './create-public-pdf-route';
import { incrementPublicShareAccess, lookupPublicShowcaseShare } from './public-share-lookup';
import { sanitizeShowcaseFilenameStem } from '../showcase-filename';

/** The minimum entity facts the PDF proxy needs: tenant check + filename. */
interface ShowcasePdfEntityHeader {
  companyId: string;
  name: string;
}

export interface UnifiedPublicPdfRouteConfig {
  /** Share discriminator, e.g. `'building_showcase'`. */
  shareEntityType: string;
  /** Firestore collection holding the entity, e.g. `COLLECTIONS.BUILDINGS`. */
  entityCollection: string;
  /** Module logger name — kept per surface so server logs stay greppable. */
  loggerName: string;
  /** 404 message when the share is missing. **Wire contract** — verbatim. */
  shareNotFoundMessage: string;
  /** 404 message when the entity is missing. **Wire contract** — verbatim. */
  entityNotFoundMessage: string;
  /**
   * Filename stem used when the entity has no usable name, e.g.
   * `'building-showcase'`. Both originals used it twice: as the header
   * fallback and as the sanitised-to-empty fallback.
   */
  filenameFallback: string;
}

/**
 * Build the `GET /api/{entity}-showcase/[token]/pdf` handler for one surface.
 *
 * @example
 * const route = createUnifiedPublicShowcasePdfRoute({
 *   shareEntityType: 'building_showcase',
 *   entityCollection: COLLECTIONS.BUILDINGS,
 *   loggerName: 'BuildingShowcasePdfProxy',
 *   shareNotFoundMessage: 'Building showcase link not found or deactivated',
 *   entityNotFoundMessage: 'Building not found',
 *   filenameFallback: 'building-showcase',
 * });
 */
export function createUnifiedPublicShowcasePdfRoute(
  config: UnifiedPublicPdfRouteConfig,
): PublicShowcasePdfHandler {
  const {
    shareEntityType,
    entityCollection,
    loggerName,
    shareNotFoundMessage,
    entityNotFoundMessage,
    filenameFallback,
  } = config;

  const logger = createModuleLogger(loggerName);

  return createPublicShowcasePdfRoute<ShowcasePdfEntityHeader>({
    loggerName,
    shareNotFoundMessage,
    entityNotFoundMessage,

    resolveShare: async (token, adminDb) => {
      const share = await lookupPublicShowcaseShare({
        token,
        entityType: shareEntityType,
        adminDb,
        logger,
        requirePdfPath: true,
      });
      // `requirePdfPath` guarantees the path; restate it for the narrower type.
      return share?.pdfStoragePath ? { ...share, pdfStoragePath: share.pdfStoragePath } : null;
    },

    loadEntityHeader: (entityId, adminDb) =>
      loadEntityHeader(entityCollection, entityId, adminDb, filenameFallback),

    checkTenant: (header, companyId) => header.companyId === companyId,

    buildFilename: header => {
      const stem = sanitizeShowcaseFilenameStem(header.name);
      return `${stem || filenameFallback}-showcase.pdf`;
    },

    incrementCounter: incrementPublicShareAccess,
  });
}

// =============================================================================
// Internals
// =============================================================================

/**
 * Read the entity's `companyId` + `name`.
 *
 * Both originals defaulted a missing `companyId` to `''` rather than returning
 * `null`, which makes the tenant check fail closed (`'' !== share.companyId`)
 * and answer 403. Preserved: failing closed is correct, and changing it to a
 * 404 would alter the public response for a corrupt document.
 */
async function loadEntityHeader(
  collection: string,
  entityId: string,
  adminDb: Firestore,
  nameFallback: string,
): Promise<ShowcasePdfEntityHeader | null> {
  const snap = await adminDb.collection(collection).doc(entityId).get();
  if (!snap.exists) return null;

  const data = snap.data() as Record<string, unknown>;
  return {
    companyId: (data.companyId as string | undefined) ?? '',
    name: (data.name as string | undefined) ?? nameFallback,
  };
}
