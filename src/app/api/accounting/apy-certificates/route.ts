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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { APYCertificate } from '@/subapps/accounting/types';
import { createModuleLogger } from '@/lib/telemetry/Logger';

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
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
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

        const { repository } = createAccountingServices();
        const certificates = await repository.listAPYCertificates(fiscalYear, customerId);

        return NextResponse.json({ success: true, data: certificates });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list APY certificates';
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
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        let body: CreateAPYCertificateBody;
        try {
          body = (await req.json()) as CreateAPYCertificateBody;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
          );
        }

        const {
          fiscalYear,
          customerId,
          provider,
          customer,
          lineItems,
          totalNetAmount,
          totalWithholdingAmount,
          notes,
        } = body;

        // ── Validation ──────────────────────────────────────────────────
        if (!fiscalYear || typeof fiscalYear !== 'number') {
          return NextResponse.json(
            { success: false, error: 'fiscalYear is required' },
            { status: 400 }
          );
        }
        if (!customer?.vatNumber) {
          return NextResponse.json(
            { success: false, error: 'customer.vatNumber is required' },
            { status: 400 }
          );
        }
        if (!lineItems || lineItems.length === 0) {
          return NextResponse.json(
            { success: false, error: 'lineItems cannot be empty' },
            { status: 400 }
          );
        }

        const { repository } = createAccountingServices();

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
          provider,
          customer,
          lineItems,
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
        const message = error instanceof Error ? error.message : 'Failed to create APY certificate';
        logger.error('APY certificate create error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
export const POST = withSensitiveRateLimit(handlePost);
