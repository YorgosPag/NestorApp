/**
 * =============================================================================
 * ADDRESS LABEL MIGRATION ROUTE — PROTECTED (bypass role only)
 * =============================================================================
 *
 * GET  → dry-run preview: τι θα άλλαζε, χωρίς καμία εγγραφή.
 * POST → εκτέλεση.
 *
 * Query: `?companyId=<id>` για περιορισμό σε έναν οργανισμό (προαιρετικό).
 *
 * ΓΙΑΤΙ `runMigration` ΚΑΙ ΟΧΙ `createMigrationRoute`: το factory δεν δίνει το
 * `NextRequest` στο `run`, ενώ εδώ ο στόχος-οργανισμός διαβάζεται από το query
 * string. Κρατάμε λοιπόν τους δικούς μας wrappers και καλούμε τον χαμηλότερου
 * επιπέδου envelope — guard (ADR-703) + audit + error body έρχονται από το SSoT,
 * κανένα διπλότυπο (ADR-704 §4.1).
 *
 * ΤΟ SCOPE ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ ΜΕ ΤΟ ΧΕΡΙ: `resolveTenantListScopeFromUrl` — ο
 * super admin που δεν ονομάτισε οργανισμό εννοεί «όλους» (browse doctrine,
 * ADR-702), και το Admin SDK παρακάμπτει τους Firestore rules, οπότε το scope
 * εφαρμόζεται ρητά στο query της μετάπτωσης.
 *
 * @see ./migration-operations για το «τι» και το «γιατί».
 */

import 'server-only';

import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { resolveTenantListScopeFromUrl } from '@/lib/auth/tenant-scope';
import { runMigration } from '@/lib/admin-migration-runner';
import { migrateAddressLabels } from './migration-operations';

const MIGRATION_NAME = 'migrate-address-labels';

/** `undefined` = όλοι οι οργανισμοί (μόνο bypass role φτάνει εκεί, ADR-702). */
const scopedCompanyId = (req: NextRequest, ctx: AuthContext): string | undefined => {
  const scope = resolveTenantListScopeFromUrl(req.url, ctx);
  return scope.kind === 'company' ? scope.companyId : undefined;
};

const handle = (req: NextRequest, ctx: AuthContext, dryRun: boolean) =>
  runMigration(
    { ctx, dryRun, name: MIGRATION_NAME, request: dryRun ? undefined : req },
    async (db) => {
      const report = await migrateAddressLabels(db, dryRun, scopedCompanyId(req, ctx));
      return {
        body: { ...report },
        audit: {
          affectedContacts: report.affectedContacts,
          affectedAddresses: report.affectedAddresses,
        },
      };
    },
  );

export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handle(req, ctx, true),
  { permissions: 'admin:migrations:execute' },
));

export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handle(req, ctx, false),
  { permissions: 'admin:migrations:execute' },
));
