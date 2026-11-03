/**
 * Firestore Rules — `subcontract_trade_templates` (ADR-928 §5.3 · πρότυπα ειδικότητας)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/subcontracts/**`).
 * @since 2026-11-03 (ADR-928 Φ1)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'subcontract_trade_templates')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'plastering.three_coat',
  trade: 'plastering',
  title: { el: 'Επιχρίσματα τριών στρώσεων' },
  defaultDocumentMode: 'offer_then_agreement',
  lines: [],
  clauses: [],
  isArchived: false,
  revision: 1,
});

describe('subcontract_trade_templates.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
