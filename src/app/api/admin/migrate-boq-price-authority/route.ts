/**
 * =============================================================================
 * ΜΕΤΑΠΤΩΣΗ `priceAuthority` BOQ — PROTECTED ROUTE (bypass role only)
 * =============================================================================
 *
 * GET  → dry-run preview: τι θα άλλαζε, χωρίς καμία εγγραφή.
 * POST → εκτέλεση.
 *
 * `createMigrationRoute`: guard (ADR-703) + audit + error body από το SSoT (ADR-704 §4.1).
 *
 * @see ./migration-operations για το «τι» και το «γιατί».
 */

import 'server-only';

import { createMigrationRoute } from '@/lib/admin-migration-runner';
import { migrateBoqPriceAuthority } from './migration-operations';

export const { GET, POST } = createMigrationRoute({
  name: 'migrate-boq-price-authority',
  category: 'SENSITIVE',
  run: async (db, { dryRun }) => {
    const report = await migrateBoqPriceAuthority(db, dryRun);
    return { body: { ...report }, audit: { affectedDocuments: report.affectedDocuments } };
  },
});
