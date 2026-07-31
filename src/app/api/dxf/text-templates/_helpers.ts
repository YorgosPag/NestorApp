/**
 * ADR-344 Phase 7.D — Shared helpers for text-template API routes.
 *
 * Three responsibilities:
 *   1. Build a `TextTemplateActor` from the authenticated request context
 *      (Firestore service requires actor for audit attribution).
 *   2. Serialise `UserTextTemplateDoc` for JSON transport (admin-SDK
 *      `Timestamp` cannot cross the wire — converted to ISO strings).
 *   3. Map service-layer tagged errors to HTTP responses with a consistent
 *      shape (`{ success: false, error, code, details? }`) — **και** εφαρμόζει
 *      εδώ την απόφαση αποκάλυψης του ADR-742 (ξένος πόρος ⇒ σιωπή, εκτός
 *      bypass ρόλου). Αυτό είναι το σύνορο: το μόνο στρώμα που ξέρει *ποιος*
 *      ρωτάει.
 *
 * These helpers stay route-local: not exported from any barrel because the
 * shape is API-internal (clients consume the serialised JSON, not these
 * types).
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
  TextTemplateCrossTenantError,
  TextTemplateNotFoundError,
  TextTemplateValidationError,
  type TextTemplateActor,
  type UserTextTemplateDoc,
} from '@/subapps/dxf-viewer/text-engine/templates/text-template.types';
import type { SerializedUserTextTemplate } from '@/subapps/dxf-viewer/text-engine/templates/template.types';

/**
 * JSON-safe projection of `UserTextTemplateDoc`.
 *
 * ⚠️ ADR-651 Φάση Θ: **δεν** δηλώνεται πια εδώ. Είναι το ΙΔΙΟ σχήμα πεδίων με το έγγραφο, με
 * τον χρόνο σε ISO strings — και ζει στο ουδέτερο `template.types.ts` ως
 * `UserTextTemplateFields<string>`. Τρεις πανομοιότυπες λίστες πεδίων (doc / wire / route)
 * ξέφευγαν σιωπηλά η μία από την άλλη σε κάθε νέο πεδίο· τώρα είναι μία (N.18).
 */
export type { SerializedUserTextTemplate };

export function actorFromContext(ctx: AuthContext): TextTemplateActor {
  return {
    userId: ctx.uid,
    userName: ctx.email ?? null,
  };
}

export function serializeTemplate(doc: UserTextTemplateDoc): SerializedUserTextTemplate {
  return {
    id: doc.id,
    companyId: doc.companyId,
    name: doc.name,
    category: doc.category,
    content: doc.content,
    placeholders: doc.placeholders,
    isDefault: doc.isDefault,
    // Τα legacy έγγραφα (γραμμένα πριν τη Φάση Θ) δεν φέρουν scope — τα βλέπουμε ως πρότυπα
    // **γραφείου**, το ίδιο default με μια νέα εγγραφή. Άμυνα, όχι μετανάστευση: το
    // `text_templates` ήταν άδειο στη Φάση Θ (επαληθευμένο), αλλά ο serializer δεν δικαιούται
    // να επιστρέψει `undefined` σε πεδίο που ο client θεωρεί δεδομένο.
    // ADR-651 Φάση Κ — ίδια άμυνα: πρότυπο γραμμένο πριν το πεδίο ⇒ γλώσσα άγνωστη (`null`),
    // ποτέ `undefined` σε πεδίο που ο client θεωρεί δεδομένο.
    locale: doc.locale ?? null,
    scope: doc.scope ?? 'company',
    projectId: doc.projectId ?? null,
    parentId: doc.parentId ?? null,
    parentSyncedAt: doc.parentSyncedAt ?? null,
    ...(doc.titleBlock ? { titleBlock: doc.titleBlock } : {}),
    ...serializeAuditFields(doc),
  };
}

/**
 * Σφάλμα υπηρεσίας → HTTP. Ο κανόνας αποκάλυψης (ADR-742) ζει στο κοινό
 * `_domain-error-mapping`· εδώ δηλώνονται **μόνο οι τύποι σφάλματος αυτού του
 * πεδίου ορισμού**, ώστε τα `code` και τα μηνύματα — δημόσιο συμβόλαιο που ήδη
 * καταναλώνουν clients — να μείνουν αναλλοίωτα.
 */
export function mapServiceError(
  err: unknown,
  ctx: Pick<AuthContext, 'globalRole'>,
): MappedError {
  return mapDomainError({
    err,
    ctx,
    notFoundClass: TextTemplateNotFoundError,
    crossTenantClass: TextTemplateCrossTenantError,
    extra: (e) =>
      e instanceof TextTemplateValidationError
        ? {
            status: 400,
            body: { success: false, error: e.message, code: e.code, details: e.issues },
          }
        : null,
  });
}

export function errorResponse(
  err: unknown,
  ctx: Pick<AuthContext, 'globalRole'>,
): NextResponse {
  return toErrorResponse(mapServiceError(err, ctx));
}

/**
 * Ο εκτελεστής route των προτύπων — ρυθμιστής ρυθμού + ταυτότητα + δικαιώματα +
 * `try/catch` + η απόφαση αποκάλυψης, δεμένα μία φορά (βλ. `_domain-route.ts`).
 */
export const runTemplateRoute = makeDxfRouteRunner(errorResponse);
