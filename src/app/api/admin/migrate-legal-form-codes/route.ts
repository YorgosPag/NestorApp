/**
 * =============================================================================
 * LEGAL FORM MIGRATION ROUTE — PROTECTED (`admin:migrations:execute`)
 * =============================================================================
 *
 * GET  → dry-run: ποιες επαφές, ποια τιμή ⇒ ποιον κωδικό, ποιες άγνωστες μένουν ανέγγιχτες. Καμία εγγραφή.
 * POST → εκτέλεση (ιδεμπότητη).
 *
 * Query: `?companyId=<id>` για περιορισμό σε έναν οργανισμό (προαιρετικό).
 *
 * Ίδιο σχήμα με το `migrate-address-labels` (ίδιος λόγος για `runMigration` αντί `createMigrationRoute`: ο στόχος-
 * οργανισμός διαβάζεται από το query string). ⏱️ Βαθμίδα `sensitive` ρητά (CHECK 3.78).
 *
 * @see ./migration-operations — το «τι» και το «γιατί» (ADR-948 §8 · CHECK 3.73)
 */

import 'server-only';

import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { resolveTenantListScopeFromUrl } from '@/lib/auth/tenant-scope';
import { runMigration } from '@/lib/admin-migration-runner';
import { migrateLegalFormCodes } from './migration-operations';

const MIGRATION_NAME = 'migrate-legal-form-codes';

/** `undefined` = όλοι οι οργανισμοί (μόνο bypass role φτάνει εκεί, ADR-702). */
const scopedCompanyId = (req: NextRequest, ctx: AuthContext): string | undefined => {
  const scope = resolveTenantListScopeFromUrl(req.url, ctx);
  return scope.kind === 'company' ? scope.companyId : undefined;
};

const handle = (req: NextRequest, ctx: AuthContext, dryRun: boolean) =>
  runMigration(
    { ctx, dryRun, name: MIGRATION_NAME, request: dryRun ? undefined : req },
    async (db, performer) => {
      const report = await migrateLegalFormCodes(db, dryRun, performer, scopedCompanyId(req, ctx));
      return {
        body: { ...report },
        audit: { affectedContacts: report.affectedContacts, unrecognized: report.unrecognized.length },
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
