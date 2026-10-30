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
import {
  apyProviderOf,
  computeAPYCertificateDraft,
} from '@/subapps/accounting/services/apy/apy-certificate-draft';
import { createModuleLogger } from '@/lib/telemetry/Logger';

/**
 * 🔴 Το σώμα λέει **ποιον** και **ποια χρήση** — ΟΧΙ ποσά. Ως 2026-10-30 ο browser έστελνε γραμμές, σύνολα και
 * στοιχεία παρόχου/πελάτη και ο διακομιστής τα αποθήκευε τυφλά (`as unknown as …`): φορολογικό έγγραφο με αριθμούς
 * που κανείς στον διακομιστή δεν είχε υπολογίσει. Τώρα τα παράγει το `computeAPYCertificateDraft` (ADR-ACC-020).
 */
const CreateAPYSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2099),
  customerId: z.string().trim().min(1).max(128),
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
    const { fiscalYear, customerId, notes } = body;

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // ── Duplicate check — one per customerId + fiscalYear ───────────
    const existing = await repository.listAPYCertificates(fiscalYear, customerId);
    if (existing.length > 0) {
      conflict('Certificate already exists for this customer and fiscal year', {
        existingCertificateId: existing[0].certificateId,
      });
    }

    // ── Compute — ίδια συνάρτηση με την προεπισκόπηση (`…/draft`) ────
    const [profile, draft] = await Promise.all([
      repository.getCompanySetup(),
      computeAPYCertificateDraft(repository, customerId, fiscalYear),
    ]);
    if (!profile) badRequest('Company setup is required to issue an APY certificate');
    if (!draft.customer) badRequest('No invoices with withholding for this customer and fiscal year');

    // ── Create ───────────────────────────────────────────────────────
    const result = await repository.createAPYCertificate({
      fiscalYear,
      customerId,
      provider: apyProviderOf(profile),
      customer: draft.customer,
      lineItems: [...draft.lineItems],
      totalNetAmount: draft.totalNetAmount,
      totalWithholdingAmount: draft.totalWithholdingAmount,
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
