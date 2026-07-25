/**
 * =============================================================================
 * SHARE RESOLVER PRIMITIVES — pure policy shared by every resolver (ADR-699)
 * =============================================================================
 *
 * Every `ShareEntityDefinition` in `sharing/resolvers/` answered the same three
 * questions with the same code, retyped per entity:
 *
 *   1. *What may an anonymous visitor see about this share?* → `safePublicProjection`
 *   2. *Is this create-input addressed to me, and is it complete?* → `validateCreateInput`
 *   3. *Does the caller's company own the entity?* → `canShare`
 *
 * (1) and (2) are pure. They live here, with **no Firestore import**, so the
 * whole policy layer is testable without mocking a database — the pattern
 * cycles #2/#3/#4 arrived at three times (pure logic split away from I/O).
 * (3) needs a document read and lives in `share-entity-access.ts`.
 *
 * ## Why the meta bag is a parameter and not a spread
 *
 * `ShareRecord` carries three optional meta bags (`showcaseMeta`, `contactMeta`,
 * `fileMeta`). Each hand-written resolver published **exactly one** of them and
 * left the others off the wire. Spreading `share` here would publish all three
 * — a contact's `includedFields` would start appearing on a file share. The
 * caller therefore names its bag, and this module copies that one only.
 *
 * @module services/sharing/resolver-core/share-resolver-primitives
 * @see adrs/ADR-699-share-resolver-declarations.md
 */

import type {
  CreateShareInput,
  PublicShareData,
  ShareEntityType,
  ShareRecord,
  ValidationResult,
} from '@/types/sharing';

// ============================================================================
// PUBLIC PROJECTION
// ============================================================================

/** The `ShareRecord` meta bag a surface is allowed to publish. */
export type ShareMetaField = 'showcaseMeta' | 'contactMeta' | 'fileMeta';

/**
 * Project a share record down to what an anonymous holder of the token may see.
 *
 * Tenant-identifying fields (`companyId`, `createdBy`, `passwordHash`) are
 * absent by construction: this builds a fresh object rather than deleting from
 * a copy, so a field added to `ShareRecord` cannot leak by default.
 *
 * @param share     The full record — never returned as-is.
 * @param metaField The single meta bag this surface publishes.
 */
export function buildSafePublicProjection(
  share: ShareRecord,
  metaField: ShareMetaField,
): PublicShareData {
  const projection: PublicShareData = {
    entityType: share.entityType,
    entityId: share.entityId,
    requiresPassword: share.requiresPassword,
    expiresAt: share.expiresAt,
    isActive: share.isActive,
    accessCount: share.accessCount,
    maxAccesses: share.maxAccesses,
    note: share.note ?? null,
  };

  switch (metaField) {
    case 'showcaseMeta':
      projection.showcaseMeta = share.showcaseMeta ?? null;
      return projection;
    case 'contactMeta':
      projection.contactMeta = share.contactMeta ?? null;
      return projection;
    case 'fileMeta':
      projection.fileMeta = share.fileMeta ?? null;
      return projection;
  }
}

// ============================================================================
// CREATE-INPUT VALIDATION
// ============================================================================

/** The two facts that make a base validation message entity-specific. */
export interface ShareBaseInputRules {
  /** Discriminator this resolver owns — anything else is a routing bug. */
  entityType: ShareEntityType;
  /** Label used in the "<label> required" message (e.g. `'propertyId'`). */
  entityIdLabel: string;
}

/**
 * The checks every resolver ran before its own: right resolver, non-empty
 * entity id, tenant, author.
 *
 * Returns the *first* failure so the reason strings stay identical to the
 * hand-written resolvers they replace — these strings reach the share dialog.
 */
export function validateShareBaseInput(
  input: CreateShareInput,
  rules: ShareBaseInputRules,
): ValidationResult {
  if (input.entityType !== rules.entityType) {
    return {
      valid: false,
      reason: `Wrong resolver — expected entityType=${rules.entityType}`,
    };
  }
  if (!input.entityId?.trim()) {
    return { valid: false, reason: `${rules.entityIdLabel} required` };
  }
  if (!input.companyId?.trim()) return { valid: false, reason: 'companyId required' };
  if (!input.createdBy?.trim()) return { valid: false, reason: 'createdBy required' };
  return { valid: true };
}

// ============================================================================
// RESOLVED-DATA HELPERS
// ============================================================================

/**
 * First non-empty string among `fields`, read off a Firestore document.
 *
 * Which fields, and in which order, is genuinely per-entity data (a property
 * titles itself with `title`, a project with `name`, a parking space with its
 * `number`) — so it is a declaration, not a hook.
 */
export function pickFirstStringField(
  data: Record<string, unknown> | null,
  fields: readonly string[],
): string | null {
  if (!data) return null;
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

/**
 * Normalise `showcaseMeta.pdfRegeneratedAt` — written as a Firestore
 * `Timestamp` by the server, but as an ISO string by older documents.
 */
export function normalizeRegenTimestamp(regen: unknown): string | null {
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
