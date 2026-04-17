/**
 * =============================================================================
 * POST /api/properties/[id]/generate-description
 * =============================================================================
 *
 * Generates a Greek marketing description for a property unit using OpenAI.
 *
 * Security:
 *  - withAuth: authenticated user with 'properties:properties:update' permission
 *  - withStandardRateLimit: 60 req/min per user
 *  - Tenant isolation: property companyId must match ctx.companyId
 *
 * Body: { locale?: 'el' | 'en' }  (defaults to 'el')
 * Response: { success: true, data: { description, model, inputTokens, outputTokens } }
 *
 * @module app/api/properties/[id]/generate-description/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  generatePropertyDescription,
  PropertyDescriptionGenerationError,
} from '@/services/ai/property-description-generator.service';
import type { Property } from '@/types/property';

const logger = createModuleLogger('GeneratePropertyDescriptionRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z
  .object({
    locale: z.enum(['el', 'en']).optional(),
  })
  .strict();

interface GenerateDescriptionResponse {
  description: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { id } = await segmentData.params;

  const handler = withStandardRateLimit(
    withAuth<ApiSuccessResponse<GenerateDescriptionResponse>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
          throw new ApiError(400, 'Property ID is required');
        }

        let body: z.infer<typeof BodySchema> = {};
        try {
          const raw = await req.text();
          if (raw.trim().length > 0) {
            const parsed = JSON.parse(raw);
            body = BodySchema.parse(parsed);
          }
        } catch (parseError) {
          logger.warn('Invalid request body', {
            propertyId: id,
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
          throw new ApiError(400, 'Invalid request body');
        }

        const locale = body.locale ?? 'el';

        const adminDb = getAdminFirestore();
        if (!adminDb) {
          throw new ApiError(503, 'Database connection not available');
        }

        const propertyDoc = await adminDb
          .collection(COLLECTIONS.PROPERTIES)
          .doc(id)
          .get();

        if (!propertyDoc.exists) {
          throw new ApiError(404, 'Property not found');
        }

        const data = propertyDoc.data() ?? {};
        const propertyCompanyId = (data as { companyId?: string }).companyId;

        if (propertyCompanyId !== ctx.companyId) {
          logger.warn('TENANT ISOLATION VIOLATION', {
            uid: ctx.uid,
            propertyId: id,
            propertyCompanyId,
            userCompanyId: ctx.companyId,
          });
          throw new ApiError(403, 'Access denied');
        }

        const property = { id: propertyDoc.id, ...data } as Property;

        try {
          const result = await generatePropertyDescription(property, {
            locale,
            requestContext: {
              uid: ctx.uid,
              companyId: ctx.companyId,
            },
          });

          return apiSuccess<GenerateDescriptionResponse>(
            {
              description: result.description,
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            },
            'Property description generated'
          );
        } catch (aiError: unknown) {
          if (aiError instanceof PropertyDescriptionGenerationError) {
            logger.error('AI generation failed', {
              propertyId: id,
              error: aiError.message,
            });
            throw new ApiError(502, 'AI generation failed');
          }
          throw aiError;
        }
      },
      { permissions: 'properties:properties:update' }
    )
  );

  return handler(request);
}
