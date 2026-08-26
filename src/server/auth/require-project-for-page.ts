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
  'invalid-role': 'Missing or invalid globalRole claim',
};

/**
 * Το μήνυμα για τον άνθρωπο **χωρίς οργανισμό** — **αυτούσιο** από πριν το ADR-807.
 *
 * 🔑 **ΑΛΛΑΞΕ Η ΑΙΤΙΑ, ΟΧΙ Η ΣΥΜΠΕΡΙΦΟΡΑ.** Πριν, το `'missing-companyId'` ήταν
 * λόγος **αποτυχίας ταυτότητας** και έφτανε εδώ μαζί με τα «δεν είσαι
 * συνδεδεμένος». Πλέον είναι **έγκυρη ταυτότητα σε προσωπικό χώρο**, και η άρνηση
 * εδώ είναι **απόφαση τομέα**: ένα έργο ανήκει πάντα σε εταιρεία, ο προσωπικός
 * χώρος δεν έχει καμία, άρα δεν υπάρχει έργο να δειχθεί. Ίδιο 403, ίδιο κείμενο —
 * αλλά τώρα γραμμένο ως **κρίση**, όχι ως παρενέργεια σφάλματος αυθεντικοποίησης.
 */
const PERSONAL_SCOPE_MESSAGE = 'Missing companyId claim';

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

  // ADR-807 — δες το σχόλιο του `PERSONAL_SCOPE_MESSAGE`.
  if (identity.scope === 'personal') {
    throw new TenantIsolationError(PERSONAL_SCOPE_MESSAGE, 403, 'FORBIDDEN');
  }

  const { ctx } = identity;
  const project = await requireProjectInTenant({ ctx, projectId, path });
  return { ctx, project };
}
