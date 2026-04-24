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
