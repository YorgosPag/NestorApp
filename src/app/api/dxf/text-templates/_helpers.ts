/**
 * ADR-344 Phase 7.D — Shared helpers for text-template API routes.
 *
 * Three responsibilities:
 *   1. Build a `TextTemplateActor` from the authenticated request context
 *      (Firestore service requires actor for audit attribution).
 *   2. Serialise `UserTextTemplateDoc` for JSON transport (admin-SDK
 *      `Timestamp` cannot cross the wire — converted to ISO strings).
 *   3. Map service-layer tagged errors to HTTP responses with a consistent
 *      shape (`{ success: false, error, code, details? }`).
 *
 * These helpers stay route-local: not exported from any barrel because the
 * shape is API-internal (clients consume the serialised JSON, not these
 * types).
 */
import { NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import {
  TextTemplateCrossTenantError,
  TextTemplateNotFoundError,
  TextTemplateValidationError,
  type TextTemplateActor,
  type UserTextTemplateDoc,
} from '@/subapps/dxf-viewer/text-engine/templates/text-template.types';

/** JSON-safe projection of `UserTextTemplateDoc` for wire transport. */
export interface SerializedUserTextTemplate {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly category: UserTextTemplateDoc['category'];
  readonly content: UserTextTemplateDoc['content'];
  readonly placeholders: readonly string[];
  readonly isDefault: false;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
}

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
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
    createdBy: doc.createdBy,
    createdByName: doc.createdByName,
    updatedBy: doc.updatedBy,
    updatedByName: doc.updatedByName,
  };
}

interface MappedError {
  readonly status: number;
  readonly body: {
    readonly success: false;
    readonly error: string;
    readonly code: string;
    readonly details?: readonly string[];
  };
}

export function mapServiceError(err: unknown): MappedError {
  if (err instanceof TextTemplateNotFoundError) {
    return { status: 404, body: { success: false, error: err.message, code: err.code } };
  }
  if (err instanceof TextTemplateCrossTenantError) {
    return { status: 403, body: { success: false, error: 'Forbidden', code: err.code } };
  }
  if (err instanceof TextTemplateValidationError) {
    return {
      status: 400,
      body: { success: false, error: err.message, code: err.code, details: err.issues },
    };
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  return { status: 500, body: { success: false, error: message, code: 'INTERNAL' } };
}

export function errorResponse(err: unknown): NextResponse {
  const { status, body } = mapServiceError(err);
  return NextResponse.json(body, { status });
}
