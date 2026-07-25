/**
 * =============================================================================
 * SHOWCASE CORE — Unified public payload route (ADR-698)
 * =============================================================================
 *
 * `createPublicShowcasePayloadRoute` (ADR-321) already owns the HTTP shell:
 * token validation, 404/410, locale parsing, PDF-URL synthesis, error mapping.
 * Yet the four surfaces built on it stayed **near-identical 100-line files**
 * (322t / 320t / 233t / 94t of token-level clones, jscpd) because that factory
 * takes *hooks*, and all four hook implementations were the same code with a
 * different noun:
 *
 * ```
 * resolveShare   -> same `shares` query, one differing entityType string
 * loadXMedia     -> byte-identical, only the return type name changed
 * buildPayload   -> same snapshot call + same Promise.all + same object
 * GET            -> byte-identical
 * ```
 *
 * That is the over-parameterised-factory trap: the pipeline was extracted, the
 * *mechanics* were pushed back onto every caller. This second-order factory
 * takes **data** where the first took code, so a surface declares what it is
 * instead of restating how it works.
 *
 * ## The payload is derived, not assembled
 *
 * All four snapshots are exactly `{ <entityKey>: Info; company: Branding }`
 * (verified in each `*ShowcaseSnapshot`), and all four payloads were exactly
 * those two keys plus `photos` / `floorplans` / `pdfUrl` / `expiresAt`. So
 * `{ ...snapshot, ...media, pdfUrl, expiresAt }` reproduces every original
 * byte-for-byte with **no per-entity assembly lambda** — and no risk of
 * spreading an unexpected snapshot key into an anonymous public response.
 *
 * @module services/showcase-core/api/create-unified-public-payload-route
 * @enterprise ADR-698 — Public Showcase Token Surface SSoT
 */

import type { Firestore } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  createPublicShowcasePayloadRoute,
  type PublicShowcasePayloadHandler,
} from './create-public-payload-route';
import { lookupPublicShowcaseShare } from './public-share-lookup';
import { loadShowcaseMediaBuckets } from '../public-media';
import {
  assembleUnifiedShowcasePayload,
  type ShowcaseSnapshotShape,
  type UnifiedShowcasePayload,
} from '../unified-showcase-payload';

export interface UnifiedPublicPayloadRouteConfig<
  TSnapshot extends ShowcaseSnapshotShape,
  TEntityKey extends Exclude<keyof TSnapshot, 'company'>,
> {
  /** Share discriminator, e.g. `'building_showcase'`. */
  shareEntityType: string;
  /**
   * The snapshot's entity key — `'building'`, `'project'`, `'parking'`,
   * `'storage'`. Doubles as the public payload key and, suffixed with `Id`, as
   * the log field name (all four surfaces already logged `${key}Id`).
   */
  entityKey: TEntityKey;
  /** `ENTITY_TYPES.*` value used to look up this entity's media. */
  mediaEntityType: string;
  /** Module logger name — kept per surface so server logs stay greppable. */
  loggerName: string;
  /** 404 message. **Wire contract** — passed through verbatim. */
  shareNotFoundMessage: string;
  /**
   * Public PDF path for this surface, or `null` when it publishes no PDF
   * (parking and storage do not). Invoked only when the share carries a
   * storage path.
   */
  pdfUrlPath: (token: string) => string | null;
  /** The surface's snapshot builder — already centralised via ADR-321. */
  buildSnapshot: (
    entityId: string,
    locale: EnumLocale,
    adminDb: Firestore,
    companyId: string,
  ) => Promise<TSnapshot>;
}

/**
 * Build the `GET /api/{entity}-showcase/[token]` handler for one surface.
 *
 * @example
 * const route = createUnifiedPublicShowcasePayloadRoute({
 *   shareEntityType: 'building_showcase',
 *   entityKey: 'building',
 *   mediaEntityType: ENTITY_TYPES.BUILDING,
 *   loggerName: 'BuildingShowcasePublicApi',
 *   shareNotFoundMessage: 'Building showcase link not found or deactivated',
 *   pdfUrlPath: (token) => `/api/building-showcase/${token}/pdf`,
 *   buildSnapshot: buildBuildingShowcaseSnapshot,
 * });
 */
export function createUnifiedPublicShowcasePayloadRoute<
  TSnapshot extends ShowcaseSnapshotShape,
  TEntityKey extends Exclude<keyof TSnapshot, 'company'>,
>(
  config: UnifiedPublicPayloadRouteConfig<TSnapshot, TEntityKey>,
): PublicShowcasePayloadHandler {
  const {
    shareEntityType,
    entityKey,
    mediaEntityType,
    loggerName,
    shareNotFoundMessage,
    pdfUrlPath,
    buildSnapshot,
  } = config;

  const logger = createModuleLogger(loggerName);

  return createPublicShowcasePayloadRoute<UnifiedShowcasePayload<TSnapshot, TEntityKey>>({
    loggerName,
    shareNotFoundMessage,
    pdfUrlPath,

    resolveShare: (token, adminDb) =>
      lookupPublicShowcaseShare({ token, entityType: shareEntityType, adminDb, logger }),

    buildPayload: async ({ entityId, companyId, locale, expiresAt, pdfUrl, adminDb }) => {
      const snapshot = await buildSnapshot(entityId, locale, adminDb, companyId);
      const media = await loadShowcaseMediaBuckets({
        companyId,
        entityType: mediaEntityType,
        entityId,
      });

      logger.info('Showcase media loaded', {
        // All four surfaces already logged `${entityKey}Id` — derived, not configured.
        [`${String(entityKey)}Id`]: entityId,
        photoCount: media.photos.length,
        floorplanCount: media.floorplans.length,
      });

      return assembleUnifiedShowcasePayload(snapshot, entityKey, media, { pdfUrl, expiresAt });
    },
  });
}
