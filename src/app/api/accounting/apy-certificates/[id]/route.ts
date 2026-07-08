/**
 * =============================================================================
 * GET  /api/accounting/apy-certificates/[id] — Get APY Certificate
 * PATCH /api/accounting/apy-certificates/[id] — Update APY Certificate
 * =============================================================================
 *
 * GET: Returns a single APY certificate by ID.
 * PATCH: Updates mutable fields only: isReceived, receivedAt, notes.
 *   Immutable fields (lineItems, totals, provider, customer) cannot be changed after creation.
 *
 * Auth: withAuth (authenticated users)
 * Rate: GET → standard | PATCH → sensitive
 *
 * @module api/accounting/apy-certificates/[id]
 * @enterprise ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { logAuditEvent } from '@/lib/auth';
import { defineRoute, ok, notFound } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const PatchAPYSchema = z.object({
  isReceived: z.boolean().optional(),
  receivedAt: z.string().max(30).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const logger = createModuleLogger('APY_CERTIFICATE_DETAIL');

// =============================================================================
// GET — Single Certificate
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to get APY certificate',
  handler: async ({ auth, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const cert = await repository.getAPYCertificate(id);

    if (!cert) notFound('APY certificate not found');

    return ok(cert);
  },
});

// =============================================================================
// PATCH — Update Mutable Fields
// =============================================================================

export const PATCH = defineRoute({
  rateLimit: 'sensitive',
  schema: PatchAPYSchema,
  fallbackError: 'Failed to update APY certificate',
  handler: async ({ auth, body, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // Verify exists
    const existing = await repository.getAPYCertificate(id);
    if (!existing) notFound('APY certificate not found');

    await repository.updateAPYCertificate(id, body);

    await logAuditEvent(auth, 'data_updated', id, 'apy_certificate', {
      metadata: { reason: 'APY certificate updated' },
    }).catch(() => {/* non-blocking */});

    logger.info('APY certificate updated', { id, updates: Object.keys(body) });

    return ok();
  },
});
