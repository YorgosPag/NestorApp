/**
 * =============================================================================
 * GET /api/accounting/apy-certificates/draft?customerId=…&fiscalYear=… — Προεπισκόπηση Βεβαίωσης Παρακράτησης
 * =============================================================================
 *
 * Ο υπολογισμός της βεβαίωσης (γραμμές · σύνολα · στοιχεία πελάτη) από ΟΛΑ τα παραστατικά του πελάτη — η ΙΔΙΑ
 * συνάρτηση που τρέχει το `POST /api/accounting/apy-certificates`, άρα ό,τι βλέπει ο χρήστης είναι ό,τι αποθηκεύεται.
 * Ίδιο ιδίωμα με τις αποσβέσεις χρήσης (`assets/depreciation-run`: GET προεπισκόπηση · POST καταχώριση).
 *
 * Auth: withAuth · Rate: standard
 *
 * @module api/accounting/apy-certificates/draft
 * @enterprise ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου · ADR-ACC-010 §2.1.1 («σελίδα ≠ καθολικό»)
 */

import 'server-only';

import { badRequest, defineRoute, ok } from '@/lib/api/define-route';
import { computeAPYCertificateDraft } from '@/subapps/accounting/services/apy/apy-certificate-draft';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { resolveYearInRange } from '../../_shared/fiscal-year-param';

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to preview APY certificate',
  handler: async ({ req, auth }) => {
    const fiscalYear = resolveYearInRange(req, 'fiscalYear', 'fiscalYear');
    const customerId = new URL(req.url).searchParams.get('customerId')?.trim();
    if (!customerId) badRequest('customerId is required');

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    return ok(await computeAPYCertificateDraft(repository, customerId, fiscalYear));
  },
});
