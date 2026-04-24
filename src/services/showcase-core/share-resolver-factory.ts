/**
 * =============================================================================
 * SHOWCASE CORE — Share Resolver Factory (ADR-321)
 * =============================================================================
 *
 * Config-driven generic lifted from `sharing/resolvers/property-showcase.
 * resolver.ts` (canonical baseline per ADR-321). The three legacy resolvers
 * (property / project / building) are 95 % identical — they differ only in:
 *
 *   1. `entityType` discriminator (`'property_showcase'` / `'project_showcase'`
 *      / `'building_showcase'`).
 *   2. Firestore collection under `COLLECTIONS.*`.
 *   3. Resolved-data shape (property has `propertyId` + `propertyTitle`,
 *      project has `projectId` + `projectTitle`, building has `buildingId` +
 *      `buildingTitle`).
 *   4. Error messages.
 *
 * The factory captures the shared 95 % and exposes the 5 % as config +
 * `buildResolvedData` hook.
 *
 * @module services/showcase-core/share-resolver-factory
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  AuthorizedUser,
  CreateShareInput,
  PublicShareData,
  ShareEntityDefinition,
  ShareEntityType,
  ShareRecord,
  ValidationResult,
} from '@/types/sharing';

export interface ShowcaseShareResolverConfig<TData> {
  /** Share entityType discriminator (e.g. `'property_showcase'`). */
  entityType: ShareEntityType;
  /** Firestore collection constant (e.g. `COLLECTIONS.PROPERTIES`). */
  collection: string;
  /** Human entity label for validation error messages (e.g. `'propertyId'`). */
  entityIdLabel: string;
  /** Module logger name (e.g. `'PropertyShowcaseShareResolver'`). */
  loggerName: string;
  /**
   * Build the resolver-specific resolved-data shape from the share record +
   * Firestore doc. Called once per `resolve`. Kept pure — no I/O.
   */
  buildResolvedData: (params: {
    share: ShareRecord;
    data: Record<string, unknown> | null;
    pdfStoragePath: string | null;
    pdfRegeneratedAt: string | null;
  }) => TData;
}

function normalizeRegenTimestamp(
  regen: unknown,
): string | null {
  if (!regen) return null;
  if (typeof regen === 'string') return regen;
  if (typeof regen === 'object' && regen !== null && 'toDate' in regen) {
    try {
      return (regen as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export function createShowcaseShareResolver<TData>(
  config: ShowcaseShareResolverConfig<TData>,
): ShareEntityDefinition<TData> {
  const logger = createModuleLogger(config.loggerName);

  async function resolve(share: ShareRecord): Promise<TData> {
    const ref = doc(db, config.collection, share.entityId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      logger.warn('Showcase share points to missing entity', {
        shareId: share.id,
        entityType: config.entityType,
        entityId: share.entityId,
      });
    }
    const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;

    return config.buildResolvedData({
      share,
      data,
      pdfStoragePath: share.showcaseMeta?.pdfStoragePath ?? null,
      pdfRegeneratedAt: normalizeRegenTimestamp(share.showcaseMeta?.pdfRegeneratedAt),
    });
  }

  function safePublicProjection(share: ShareRecord): PublicShareData {
    return {
      entityType: share.entityType,
      entityId: share.entityId,
      requiresPassword: share.requiresPassword,
      expiresAt: share.expiresAt,
      isActive: share.isActive,
      accessCount: share.accessCount,
      maxAccesses: share.maxAccesses,
      note: share.note ?? null,
      showcaseMeta: share.showcaseMeta ?? null,
    };
  }

  function validateCreateInput(input: CreateShareInput): ValidationResult {
    if (input.entityType !== config.entityType) {
      return {
        valid: false,
        reason: `Wrong resolver — expected entityType=${config.entityType}`,
      };
    }
    if (!input.entityId?.trim()) {
      return { valid: false, reason: `${config.entityIdLabel} required` };
    }
    if (!input.companyId?.trim()) return { valid: false, reason: 'companyId required' };
    if (!input.createdBy?.trim()) return { valid: false, reason: 'createdBy required' };
    if (!input.showcaseMeta?.pdfStoragePath?.trim()) {
      return {
        valid: false,
        reason: 'showcaseMeta.pdfStoragePath required',
      };
    }
    return { valid: true };
  }

  async function canShare(user: AuthorizedUser, entityId: string): Promise<boolean> {
    if (!user?.uid || !user?.companyId) return false;
    const ref = doc(db, config.collection, entityId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const entityCompanyId = (snap.data() as { companyId?: string }).companyId;
    return entityCompanyId === user.companyId;
  }

  return {
    resolve,
    safePublicProjection,
    validateCreateInput,
    canShare,
    renderPublic: () => null,
  };
}
