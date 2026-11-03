import 'server-only';

/**
 * «ΣΕ ΠΟΙΟ ΕΡΓΟ ΑΝΗΚΕΙ ΑΥΤΟ ΤΟ ΣΥΜΦΩΝΗΤΙΚΟ;» — ο πόρος του κριτή για τις διαδρομές συμφωνητικού (ADR-928 §5.15 · ADR-926 Κ3).
 *
 * Πρακτική (AIA A421/A422 · ConsensusDocs 755/756 · Procore Commitments): **κύρια σύμβαση** της εταιρείας + **εντολή
 * εργασίας** ανά έργο. Άρα:
 *
 * | Πράξη | Έργο-πόρος |
 * |---|---|
 * | γέννηση `single_project` | το έργο του σώματος, μέσα από τον φράχτη χώρου |
 * | γέννηση `multi_project` (κύρια σύμβαση) | κανένα ⇒ κρίνει μόνο η εταιρεία |
 * | πρόχειρο · μετάβαση σε `single_project` | το έργο του **εγγράφου** |
 * | πρόχειρο που αλλάζει έργο ή εμβέλεια | κανένα ⇒ μόνο η εταιρεία (ο ρόλος έργου δεν «μετακομίζει» έγγραφο) |
 * | ανάθεση εργοταξίου | το **έργο-στόχος** της ανάθεσης |
 *
 * 🔑 Fail-closed: χαλασμένο σώμα, άγνωστο είδος, απόν id ⇒ {@link NO_PROJECT}. Δεν υπάρχει κλάδος όπου η άγνοια ανοίγει
 * τον ρόλο έργου. Ανύπαρκτο ή ξένο συμφωνητικό ⇒ 404 πριν από κρίση ρόλου, ίδιο με το ανύπαρκτο.
 *
 * @module server/subcontracts/agreement-resource
 * @see lib/auth/resource-project — οι κοινοί κρίκοι
 */

import type { NextRequest } from 'next/server';

import { bodyText, bodyTextAt, NO_PROJECT, type PermissionResource } from '@/lib/auth/resource-project';
import { requireProjectInTenant } from '@/lib/auth/tenant-isolation';
import { TenantIsolationError } from '@/lib/auth/tenant-isolation-error';
import type { AuthContext } from '@/lib/auth/types';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { readAgreementForAuthorization } from './subcontract-store.server';

const AGREEMENT_SEGMENT = /\/api\/subcontracts\/agreements\/([^/?#]+)/;
const DRAFT_SCOPE = ['draft', 'scope'] as const;

/** Το id του συμφωνητικού από τη διαδρομή `…/agreements/[id]/…`, ή `null`. */
export function agreementIdOf(url: string): string | null {
  const match = AGREEMENT_SEGMENT.exec(new URL(url).pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Το έργο της εμβέλειας του σώματος, **μόνο** αν η εμβέλεια είναι `single_project`. */
async function bodyScopeProjectOf(request: NextRequest): Promise<string | null> {
  const kind = await bodyTextAt(request, [...DRAFT_SCOPE, 'kind']);
  return kind === 'single_project' ? bodyTextAt(request, [...DRAFT_SCOPE, 'projectId']) : null;
}

/** Το έργο της εμβέλειας του εγγράφου, ή `null` για κύρια σύμβαση. */
export function agreementProjectOf(agreement: Pick<SubcontractAgreement, 'scope'>): string | null {
  return agreement.scope.kind === 'single_project' ? agreement.scope.project.projectId : null;
}

async function targetProject(ctx: AuthContext, projectId: string | null, path: string): Promise<PermissionResource> {
  if (projectId === null) return NO_PROJECT;
  await requireProjectInTenant({ ctx, projectId, path });
  return { projectId };
}

/** Το συμφωνητικό της διαδρομής μέσα από τον φράχτη χώρου. @throws TenantIsolationError(404) */
async function requireAgreement(request: NextRequest, ctx: AuthContext): Promise<SubcontractAgreement> {
  const agreementId = agreementIdOf(request.url);
  const agreement = agreementId === null ? null : await readAgreementForAuthorization(ctx, agreementId);
  if (agreement === null) throw new TenantIsolationError('Agreement not found', 404, 'NOT_FOUND');
  return agreement;
}

/** `POST /agreements` — γέννηση. */
export async function projectOfAgreementCreate(request: NextRequest, ctx: AuthContext): Promise<PermissionResource> {
  return targetProject(ctx, await bodyScopeProjectOf(request), '/api/subcontracts/agreements (POST)');
}

/** `POST …/[id]/transitions/[transition]` — το έργο του εγγράφου. */
export async function projectOfAgreement(request: NextRequest, ctx: AuthContext): Promise<PermissionResource> {
  const projectId = agreementProjectOf(await requireAgreement(request, ctx));
  return projectId === null ? NO_PROJECT : { projectId };
}

/** `PATCH …/[id]` — το έργο του εγγράφου, **μόνο** αν το πρόχειρο μένει στο ίδιο έργο. */
export async function projectOfAgreementEdit(request: NextRequest, ctx: AuthContext): Promise<PermissionResource> {
  const current = agreementProjectOf(await requireAgreement(request, ctx));
  if (current === null || (await bodyScopeProjectOf(request)) !== current) return NO_PROJECT;
  return { projectId: current };
}

/** `POST …/[id]/assignments` — το έργο-στόχος της εντολής εργασίας. */
export async function projectOfAssignmentTarget(request: NextRequest, ctx: AuthContext): Promise<PermissionResource> {
  await requireAgreement(request, ctx);
  return targetProject(ctx, await bodyText(request, 'projectId'), '/api/subcontracts/agreements/[id]/assignments (POST)');
}
