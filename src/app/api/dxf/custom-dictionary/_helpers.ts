/**
 * ADR-344 Phase 8 — Shared helpers for custom-dictionary API routes.
 *
 * Three responsibilities (mirrors `text-templates/_helpers.ts`):
 *   1. Build a `CustomDictionaryActor` from the authenticated context.
 *   2. Serialise `CustomDictionaryEntryDoc` for JSON transport (admin-SDK
 *      `Timestamp` cannot cross the wire — converted to ISO strings).
 *   3. Map service-layer tagged errors to HTTP responses with a consistent
 *      shape (`{ success: false, error, code, details? }`).
 *
 * Route-local: not exported from any barrel because the shape is
 * API-internal.
 */
import { NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
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
  if (err instanceof CustomDictionaryNotFoundError) {
    return { status: 404, body: { success: false, error: err.message, code: err.code } };
  }
  if (err instanceof CustomDictionaryCrossTenantError) {
    return { status: 403, body: { success: false, error: 'Forbidden', code: err.code } };
  }
  if (err instanceof CustomDictionaryValidationError) {
    return {
      status: 400,
      body: { success: false, error: err.message, code: err.code, details: err.issues },
    };
  }
  if (err instanceof CustomDictionaryDuplicateError) {
    return { status: 409, body: { success: false, error: err.message, code: err.code } };
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  return { status: 500, body: { success: false, error: message, code: 'INTERNAL' } };
}

export function errorResponse(err: unknown): NextResponse {
  const { status, body } = mapServiceError(err);
  return NextResponse.json(body, { status });
}
