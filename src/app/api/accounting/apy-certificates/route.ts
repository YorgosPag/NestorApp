/**
 * =============================================================================
 * GET /api/accounting/apy-certificates  — List APY Certificates
 * POST /api/accounting/apy-certificates — Create APY Certificate
 * =============================================================================
 *
 * GET: Returns list of APY certificates, optionally filtered by fiscalYear + customerId.
 * POST: Creates a new APY certificate (Annual Grouped — one per customer per fiscal year).
 *   Duplicate check: 409 if (customerId, fiscalYear) already exists.
 *
 * Auth: withAuth (authenticated users)
 * Rate: GET → withStandardRateLimit | POST → withSensitiveRateLimit
 *
 * @module api/accounting/apy-certificates
 * @enterprise ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type {
  APYCertificate,
  APYCertificateProvider,
  APYCertificateCustomer,
  APYCertificateLineItem,
} from '@/subapps/accounting/types';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreateAPYSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2099),
  customerId: z.string().max(128).nullable(),
  provider: z.object({
    name: z.string().max(200),
    vatNumber: z.string().max(20),
    taxOffice: z.string().max(200).optional(),
  }).passthrough(),
  customer: z.object({
    name: z.string().max(200),
    vatNumber: z.string().min(1).max(20),
    taxOffice: z.string().max(200).optional(),
  }).passthrough(),
  lineItems: z.array(z.record(z.unknown())).min(1),
  totalNetAmount: z.number().min(0).max(999_999_999),
  totalWithholdingAmount: z.number().min(0).max(999_999_999),
  notes: z.string().max(5000).nullable().optional(),
});

const logger = createModuleLogger('APY_CERTIFICATES');

// =============================================================================
// TYPES
// =============================================================================

interface CreateAPYCertificateBody {
  fiscalYear: number;
  customerId: string | null;
  provider: APYCertificate['provider'];
  customer: APYCertificate['customer'];
  lineItems: APYCertificate['lineItems'];
  totalNetAmount: number;
  totalWithholdingAmount: number;
  notes?: string | null;
}

// =============================================================================
// GET — List Certificates
// =============================================================================

async function handleGet(
  request: NextRequest
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const fiscalYearParam = url.searchParams.get('fiscalYear');
        const customerId = url.searchParams.get('customerId') ?? undefined;

        const fiscalYear = fiscalYearParam ? parseInt(fiscalYearParam, 10) : undefined;

        if (fiscalYearParam && isNaN(fiscalYear!)) {
          return NextResponse.json(
            { success: false, error: 'Invalid fiscalYear parameter' },
            { status: 400 }
          );
        }

        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const certificates = await repository.listAPYCertificates(fiscalYear, customerId);

        return NextResponse.json({ success: true, data: certificates });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list APY certificates');
        logger.error('APY certificates list error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// =============================================================================
// POST — Create Certificate
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateAPYSchema, await req.json());
        if (parsed.error) return parsed.error;
        const {
          fiscalYear,
          customerId,
          provider,
          customer,
          lineItems,
          totalNetAmount,
          totalWithholdingAmount,
          notes,
        } = parsed.data;

        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });

        // ── Duplicate check — one per customerId + fiscalYear ───────────
        if (customerId) {
          const existing = await repository.listAPYCertificates(fiscalYear, customerId);
          if (existing.length > 0) {
            return NextResponse.json(
              {
                success: false,
                error: 'Certificate already exists for this customer and fiscal year',
                existingCertificateId: existing[0].certificateId,
              },
              { status: 409 }
            );
          }
        }

        // ── Create ───────────────────────────────────────────────────────
        const result = await repository.createAPYCertificate({
          fiscalYear,
          customerId: customerId ?? null,
          provider: provider as unknown as APYCertificateProvider,
          customer: customer as unknown as APYCertificateCustomer,
          lineItems: lineItems as unknown as APYCertificateLineItem[],
          totalNetAmount,
          totalWithholdingAmount,
          isReceived: false,
          receivedAt: null,
          notes: notes ?? null,
        });

        logger.info('APY certificate created', {
          certificateId: result.id,
          fiscalYear,
          customerId,
        });

        return NextResponse.json({ success: true, data: { id: result.id } }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create APY certificate');
        logger.error('APY certificate create error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
export const POST = withSensitiveRateLimit(handlePost);
