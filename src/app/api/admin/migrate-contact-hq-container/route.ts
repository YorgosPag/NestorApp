/**
 * =============================================================================
 * CONTACT HQ CONTAINER MIGRATION ROUTE — PROTECTED (ADR-332 §D30 Φάση 2)
 * =============================================================================
 *
 * GET  → dry-run: ο **μετρητής** εγγράφων παλαιού σχήματος, χωρίς καμία εγγραφή.
 * POST → εκτέλεση (υλοποίηση λίστας όπου λείπει + καθαρισμός κλειδιών διεύθυνσης ρίζας).
 *
 * Query: `?companyId=<id>` για περιορισμό σε έναν οργανισμό (προαιρετικό).
 *
 * Ίδιο πρότυπο με το `migrate-address-labels`: `runMigration` (guard ADR-703 + audit + error body
 * από το SSoT, ADR-704) και scope από το `resolveTenantListScopeFromUrl` (ADR-702).
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
import { migrateContactHqContainer } from './migration-operations';

const MIGRATION_NAME = 'migrate-contact-hq-container';

/** `undefined` = όλοι οι οργανισμοί (μόνο bypass role φτάνει εκεί, ADR-702). */
const scopedCompanyId = (req: NextRequest, ctx: AuthContext): string | undefined => {
  const scope = resolveTenantListScopeFromUrl(req.url, ctx);
  return scope.kind === 'company' ? scope.companyId : undefined;
};

const handle = (req: NextRequest, ctx: AuthContext, dryRun: boolean) =>
  runMigration(
    { ctx, dryRun, name: MIGRATION_NAME, request: dryRun ? undefined : req },
    async (db, performer) => {
      const report = await migrateContactHqContainer(db, dryRun, performer, scopedCompanyId(req, ctx));
      return {
        body: { ...report },
        audit: {
          affectedContacts: report.affectedContacts,
          materializedContacts: report.materializedContacts,
          cleanedContacts: report.cleanedContacts,
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
