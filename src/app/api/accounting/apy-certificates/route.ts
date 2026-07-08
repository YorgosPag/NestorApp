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
 * Rate: GET → standard | POST → sensitive
 *
 * @module api/accounting/apy-certificates
 * @enterprise ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @enterprise ADR-602 API Route-Handler Factory SSoT (pilot migration)
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, created, badRequest, conflict } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type {
  APYCertificateProvider,
  APYCertificateCustomer,
  APYCertificateLineItem,
} from '@/subapps/accounting/types';
import { createModuleLogger } from '@/lib/telemetry/Logger';

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
// GET — List Certificates
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list APY certificates',
  handler: async ({ req, auth }) => {
    const url = new URL(req.url);
    const fiscalYearParam = url.searchParams.get('fiscalYear');
    const customerId = url.searchParams.get('customerId') ?? undefined;

    const fiscalYear = fiscalYearParam ? parseInt(fiscalYearParam, 10) : undefined;

    if (fiscalYearParam && isNaN(fiscalYear!)) {
      badRequest('Invalid fiscalYear parameter');
    }

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const certificates = await repository.listAPYCertificates(fiscalYear, customerId);

    return ok(certificates);
  },
});

// =============================================================================
// POST — Create Certificate
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'sensitive',
  schema: CreateAPYSchema,
  fallbackError: 'Failed to create APY certificate',
  handler: async ({ auth, body }) => {
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

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // ── Duplicate check — one per customerId + fiscalYear ───────────
    if (customerId) {
      const existing = await repository.listAPYCertificates(fiscalYear, customerId);
      if (existing.length > 0) {
        conflict('Certificate already exists for this customer and fiscal year', {
          existingCertificateId: existing[0].certificateId,
        });
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

    return created({ id: result.id });
  },
});
