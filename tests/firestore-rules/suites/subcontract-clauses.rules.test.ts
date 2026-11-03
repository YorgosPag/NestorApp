/**
 * Firestore Rules — `subcontract_clauses` + υποσυλλογή `subcontract_clause_versions` (ADR-928 §5.2 · βιβλιοθήκη ρητρών)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/subcontracts/**`).
 * Η υποσυλλογή των εκδόσεων είναι ένθετη (εκτός μήτρας του CHECK 3.16)· την ελέγχουν οι ΙΔΙΕΣ άγκυρες πάνω στη
 * διαδρομή της (`defineServerWrittenNestedAnchors`) — αλλιώς ένας κανόνας που θα ξεχνούσε το μπλοκ θα έμενε πράσινος.
 * @since 2026-11-03 (ADR-928 Φ1)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenNestedAnchors,
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'subcontract_clauses')!;

const VERSIONS_PATH = 'subcontract_clauses/sccl_seed/subcontract_clause_versions';

const clausePayload: TenantPayload = (companyId) => ({
  companyId,
  clauseKey: 'retention.performance',
  title: { el: 'Κράτηση καλής εκτέλεσης' },
  currentVersion: 1,
  latestVersion: 1,
  openProposal: null,
  isArchived: false,
  revision: 2,
});

const versionPayload: TenantPayload = (companyId) => ({
  companyId,
  clauseId: 'sccl_seed',
  version: 1,
  state: 'approved',
  professionalReview: 'needs_professional_review',
  body: { heading: 'Κράτηση καλής εκτέλεσης', blocks: [] },
  parameters: [],
  translations: {},
  contentHash: '0'.repeat(64),
  sourceHash: '0'.repeat(64),
  revision: 2,
});

describe('subcontract_clauses.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, clausePayload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, clausePayload);

  describe('υποσυλλογή subcontract_clause_versions', () => {
    defineServerWrittenNestedAnchors(env, VERSIONS_PATH, 'sccv_seed_1', versionPayload);
  });
});
