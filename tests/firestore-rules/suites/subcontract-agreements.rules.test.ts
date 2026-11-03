/**
 * Firestore Rules — `subcontract_agreements` + υποσυλλογή `subcontract_agreement_revisions` (ADR-928 §5.4–§5.6 · Φ2)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/subcontracts/**`).
 * Ο κύκλος ζωής, οι αποκλίσεις με διάκριση καθηκόντων και τα στιγμιότυπα μερών ΔΕΝ εκφράζονται σε κανόνα ⇒ ο πελάτης
 * δεν γράφει ποτέ. Οι αμετάβλητες αναθεωρήσεις: ίδιες άγκυρες στη δική τους διαδρομή.
 * @since 2026-11-03 (ADR-928 Φ2)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenNestedAnchors,
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'subcontract_agreements')!;

const REVISIONS_PATH = 'subcontract_agreements/sca_seed/subcontract_agreement_revisions';

const agreementPayload: TenantPayload = (companyId) => ({
  companyId,
  documentNumber: 'ΠΡΟΣ-2026-001',
  role: 'offer',
  status: 'issued',
  projectIds: ['proj_seed'],
  issuedRevision: 1,
  revision: 3,
});

const revisionPayload: TenantPayload = (companyId) => ({
  companyId,
  agreementId: 'sca_seed',
  revisionNumber: 1,
  amends: null,
  snapshot: { documentNumber: 'ΠΡΟΣ-2026-001', frozenClauses: [] },
  contentHash: '0'.repeat(64),
  pdfFileId: null,
  sealed: false,
});

describe('subcontract_agreements.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, agreementPayload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, agreementPayload);

  describe('υποσυλλογή subcontract_agreement_revisions — αμετάβλητη', () => {
    defineServerWrittenNestedAnchors(env, REVISIONS_PATH, 'scrv_seed_1', revisionPayload);
  });
});
