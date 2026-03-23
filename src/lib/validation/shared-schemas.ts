/**
 * =============================================================================
 * Shared Zod Schemas — Single Source of Truth for API Input Validation
 * =============================================================================
 *
 * Reusable schemas for common API input patterns.
 * All API routes MUST validate input using Zod before processing.
 *
 * @module lib/validation/shared-schemas
 * @enterprise ADR-255 SPEC-255D — Input Validation
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';

// =============================================================================
// PRIMITIVE SCHEMAS
// =============================================================================

/** Firestore document ID (non-empty, max 128 chars) */
export const IdSchema = z.string().min(1).max(128);

/** Optional Firestore document ID */
export const OptionalIdSchema = IdSchema.optional();

/** Non-empty string with reasonable max length */
export const RequiredStringSchema = z.string().min(1).max(1000);

/** Optional string with max length */
export const OptionalStringSchema = z.string().max(5000).optional();

/** Optional nullable string */
export const NullableStringSchema = z.string().max(5000).nullable().optional();

/** ISO date string */
export const ISODateSchema = z.string().min(10).max(30);

/** Optional ISO date */
export const OptionalISODateSchema = ISODateSchema.optional();

/** Nullable ISO date */
export const NullableISODateSchema = ISODateSchema.nullable().optional();

/** Positive monetary amount (max €999M) */
export const MoneySchema = z.number().min(0).max(999_999_999);

/** Optional monetary amount */
export const OptionalMoneySchema = MoneySchema.optional();

/** Nullable monetary amount */
export const NullableMoneySchema = MoneySchema.nullable().optional();

/** Positive percentage (0-100) */
export const PercentageSchema = z.number().min(0).max(100);

/** Page size limiter (1-100, default 20) — prevents abuse */
export const PageSizeSchema = z.number().int().min(1).max(100).default(20);

/** Common pagination params */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: PageSizeSchema,
});

/** Sort params */
export const SortSchema = z.object({
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// =============================================================================
// SAFE PARSE UTILITY
// =============================================================================

/**
 * Parse request body with a Zod schema, returning structured 400 on failure.
 *
 * Usage:
 * ```typescript
 * const parsed = safeParseBody(MySchema, rawBody);
 * if (parsed.error) return parsed.error;
 * const body = parsed.data; // fully typed
 * ```
 */
export function safeParseBody<T extends z.ZodTypeAny>(
  schema: T,
  rawBody: unknown
): { data: z.infer<T>; error?: never } | { data?: never; error: NextResponse } {
  const result = schema.safeParse(rawBody);

  if (!result.success) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: result.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { data: result.data };
}

// =============================================================================
// SAFE JSON + PARSE — Defensive request.json() wrapper
// =============================================================================

/**
 * Safely extract JSON from a Request and validate it against a Zod schema.
 *
 * Handles:
 * - Empty body (`Unexpected end of JSON input`)
 * - Malformed JSON (syntax errors)
 * - Zod validation failures (type/field mismatches)
 *
 * Returns a structured 400 on any failure — the caller never sees an exception.
 *
 * Usage:
 * ```typescript
 * const parsed = await safeJsonBody(MySchema, request);
 * if (parsed.error) throw new ApiError(400, 'Validation failed');
 * const body = parsed.data; // fully typed
 * ```
 */
export async function safeJsonBody<T extends z.ZodTypeAny>(
  schema: T,
  request: Request,
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return {
      error: NextResponse.json(
        { success: false, error: 'Invalid or empty JSON body' },
        { status: 400 }
      ),
    };
  }

  return safeParseBody(schema, rawBody);
}
