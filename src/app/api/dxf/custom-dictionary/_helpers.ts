/**
 * ADR-344 Phase 8 — Shared helpers for custom-dictionary API routes.
 *
 * Three responsibilities (mirrors `text-templates/_helpers.ts`):
 *   1. Build a `CustomDictionaryActor` from the authenticated context.
 *   2. Serialise `CustomDictionaryEntryDoc` for JSON transport (admin-SDK
 *      `Timestamp` cannot cross the wire — converted to ISO strings).
 *   3. Map service-layer tagged errors to HTTP responses with a consistent
 *      shape (`{ success: false, error, code, details? }`) — **και** εφαρμόζει
 *      εδώ την απόφαση αποκάλυψης του ADR-742 (ξένος πόρος ⇒ σιωπή, εκτός
 *      bypass ρόλου).
 *
 * Route-local: not exported from any barrel because the shape is
 * API-internal.
 */
import type { NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import {
  mapDomainError,
  toErrorResponse,
  type MappedError,
} from '../_domain-error-mapping';
import { makeDxfRouteRunner } from '../_domain-route';
import { serializeAuditFields } from '../_serialize-audit-fields';
import {
  CustomDictionaryCrossTenantError,
  CustomDictionaryDuplicateError,
  CustomDictionaryNotFoundError,
  CustomDictionaryValidationError,
  type CustomDictionaryActor,
  type CustomDictionaryEntryDoc,
} from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.types';
import type { SpellLanguage } from '@/subapps/dxf-viewer/text-engine/spell/spell.types';

/** JSON-safe projection of `CustomDictionaryEntryDoc` for wire transport. */
export interface SerializedCustomDictionaryEntry {
  readonly id: string;
  readonly companyId: string;
  readonly term: string;
  readonly language: SpellLanguage;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
}

export function actorFromContext(ctx: AuthContext): CustomDictionaryActor {
  return {
    userId: ctx.uid,
    userName: ctx.email ?? null,
  };
}

export function serializeEntry(doc: CustomDictionaryEntryDoc): SerializedCustomDictionaryEntry {
  return {
    id: doc.id,
    companyId: doc.companyId,
    term: doc.term,
    language: doc.language,
    ...serializeAuditFields(doc),
  };
}

/**
 * Σφάλμα υπηρεσίας → HTTP. Ο κανόνας αποκάλυψης (ADR-742) ζει στο κοινό
 * `_domain-error-mapping`· εδώ δηλώνονται **μόνο οι τύποι σφάλματος αυτού του
 * πεδίου ορισμού** — μαζί με το `Duplicate`, που **δεν** μεταμφιέζεται: ο όρος
 * υπάρχει στο **δικό σου** λεξικό, δεν είναι μυστικό άλλου πελάτη.
 */
export function mapServiceError(
  err: unknown,
  ctx: Pick<AuthContext, 'globalRole'>,
): MappedError {
  return mapDomainError({
    err,
    ctx,
    notFoundClass: CustomDictionaryNotFoundError,
    crossTenantClass: CustomDictionaryCrossTenantError,
    extra: (e) => {
      if (e instanceof CustomDictionaryValidationError) {
        return {
          status: 400,
          body: { success: false, error: e.message, code: e.code, details: e.issues },
        };
      }
      if (e instanceof CustomDictionaryDuplicateError) {
        return { status: 409, body: { success: false, error: e.message, code: e.code } };
      }
      return null;
    },
  });
}

export function errorResponse(
  err: unknown,
  ctx: Pick<AuthContext, 'globalRole'>,
): NextResponse {
  return toErrorResponse(mapServiceError(err, ctx));
}

/**
 * Ο εκτελεστής route του λεξικού — ρυθμιστής ρυθμού + ταυτότητα + δικαιώματα +
 * `try/catch` + η απόφαση αποκάλυψης, δεμένα μία φορά (βλ. `_domain-route.ts`).
 */
export const runDictionaryRoute = makeDxfRouteRunner(errorResponse);
