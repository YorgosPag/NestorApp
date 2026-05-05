/**
 * POST /api/quotes/[id]/commit-signatory — ADR-336
 *
 * Commits an AI-extracted (or user-edited) signatory onto an existing
 * IndividualContact (or creates a new one), then materializes a
 * vendor↔signatory relationship.
 *
 * Idempotent: re-clicking commit on the same quote is a no-op.
 *
 * Auth: withAuth | Rate: standard
 *
 * Response shapes:
 *  - 200 { success: true, data: CommitSignatoryResult }
 *  - 409 { success: false, requiresDisambiguation: true, candidates: WeakCandidate[] }
 *  - 400 / 404 / 503 on validation / not-found / Firestore failures
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { commitSignatory } from '@/subapps/procurement/services/commit-signatory-service';
import { RELATIONSHIP_METADATA } from '@/types/contacts/relationships/core/relationship-metadata';
import type { RelationshipType } from '@/types/contacts/relationships/core/relationship-types';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CommitSignatoryRoute');

// ============================================================================
// SCHEMA
// ============================================================================

const STATIC_TYPE_KEYS = Object.keys(RELATIONSHIP_METADATA) as [RelationshipType, ...RelationshipType[]];

const SignatoryFieldsSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).nullable().default(null),
  profession: z.string().trim().max(200).nullable().default(null),
  escoUri: z.string().trim().max(300).nullable().default(null),
  escoLabel: z.string().trim().max(200).nullable().default(null),
  iscoCode: z.string().trim().max(10).nullable().default(null),
  mobile: z.string().trim().max(40).nullable().default(null),
  email: z.string().trim().max(200).email().nullable().or(z.literal('')).transform((v) => (v ? v : null)).default(null),
  vatNumber: z.string().trim().max(40).nullable().default(null),
});

const RelationshipTypeStaticSchema = z.object({
  kind: z.literal('static'),
  type: z.enum(STATIC_TYPE_KEYS),
});

const RelationshipTypeCustomSchema = z.object({
  kind: z.literal('custom'),
  labelEl: z.string().trim().min(1).max(80),
  reverseLabelEl: z.string().trim().min(1).max(80).nullable().optional(),
});

const CommitSignatoryBodySchema = z.object({
  signatory: SignatoryFieldsSchema,
  relationshipType: z.discriminatedUnion('kind', [
    RelationshipTypeStaticSchema,
    RelationshipTypeCustomSchema,
  ]),
  linkToContactId: z.string().min(1).max(100).nullable().optional(),
  forceCreate: z.boolean().optional(),
});

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CommitSignatoryBodySchema, await req.json());
        if (parsed.error) return parsed.error;

        const result = await commitSignatory(id, parsed.data, ctx);

        if (!result.ok) {
          if ('requiresDisambiguation' in result) {
            return NextResponse.json(
              { success: false, requiresDisambiguation: true, candidates: result.candidates },
              { status: 409 }
            );
          }
          return NextResponse.json(
            { success: false, error: result.error },
            { status: result.status }
          );
        }

        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        logger.error('POST /api/quotes/[id]/commit-signatory failed', {
          quoteId: id,
          companyId: ctx.companyId,
          error: getErrorMessage(error),
        });
        return NextResponse.json(
          { success: false, error: 'Service unavailable' },
          { status: 503 }
        );
      }
    }
  );
  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
