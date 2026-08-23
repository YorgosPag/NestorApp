import 'server-only';

/**
 * 🔐 PAGE AUTH — TENANT-SCOPED PROJECT GUARD
 *
 * Server Component helper that authenticates the user via session cookie and
 * verifies that `projectId` belongs to the user's tenant. Throws on any
 * failure — caller is expected to render `notFound()` or a denial UI.
 *
 * @module server/auth/require-project-for-page
 * @enterprise ADR-330 — Procurement Hub Scoped Split (Phase 1 / Session S1)
 * @see ADR-326 — Tenant Org Structure
 * @see src/lib/auth/tenant-isolation.ts (requireProjectInTenant SSoT)
 */

import { requireProjectInTenant, TenantIsolationError, type TenantProject } from '@/lib/auth/tenant-isolation';
import { type AuthContext } from '@/lib/auth/types';
import { readPageIdentity, type PageIdentityRejection } from '@/server/auth/page-identity';

export interface RequireProjectForPageResult {
  ctx: AuthContext;
  project: TenantProject;
}

/**
 * Ο λόγος απόρριψης → **το μήνυμα που έβγαζε αυτό το αρχείο πριν την εξαγωγή**.
 * Ρητός πίνακας, ώστε η κεντρικοποίηση να μην αλλάξει ούτε μία συμβολοσειρά.
 */
const REJECTION_MESSAGE: Readonly<Record<PageIdentityRejection, string>> = {
  'no-session': 'Not authenticated',
  'invalid-session': 'Invalid or expired session',
  'missing-companyId': 'Missing companyId claim',
  'invalid-role': 'Missing or invalid globalRole claim',
};

export async function requireProjectForPage(
  projectId: string,
  path: string,
): Promise<RequireProjectForPageResult> {
  // 🔑 Η ΑΝΑΓΝΩΣΗ ΤΑΥΤΟΤΗΤΑΣ ΕΞΗΧΘΗ (ADR-787 §5.3 ι) — ο ίδιος κώδικας έτρεχε ήδη
  //    εδώ· τώρα ζει στο `page-identity.ts` και τον μοιράζεται και ο φρουρός του
  //    χώρου. ⚠️ Τα μηνύματα σφάλματος μένουν **αυτούσια**: η αντιστοίχιση
  //    λόγου→μήνυμα είναι ρητή ακριβώς για να μη χαθεί διαγνωστικό που υπήρχε.
  const identity = await readPageIdentity();

  if (!identity.ok) {
    throw new TenantIsolationError(REJECTION_MESSAGE[identity.reason], 403, 'FORBIDDEN');
  }

  const { ctx } = identity;
  const project = await requireProjectInTenant({ ctx, projectId, path });
  return { ctx, project };
}
