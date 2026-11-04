/**
 * POST   /api/procurement/[poId]/share — Create share link
 * DELETE /api/procurement/[poId]/share — Revoke share link
 *
 * Auth: withAuth | Rate: sensitive
 * Tenant: both verbs load the PO through `findOwnedPO` (service layer); a foreign PO, or a share of another
 *   PO/company, answers 404 exactly like a missing one (ADR-923 κύμα 3 Λ5)
 * @see ADR-267 Phase B — Share Link
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, created, badRequest, notFound, httpError } from '@/lib/api/define-route';
import { findOwnedPO } from '@/services/procurement';
import { publicUrl } from '@/lib/http/public-origin';
import { createPOShare, revokePOShare, PO_SHARE_NOT_FOUND_MESSAGE } from '@/services/procurement/po-share-service';
import { PO_NOT_FOUND_MESSAGE } from '@/subapps/procurement/services/procurement-rule-error';

const RevokeSchema = z.object({
  shareId: z.string().min(1),
});

// ============================================================================
// POST — Create share link (404 wrong tenant, 201 with token URL)
// ============================================================================

export const POST = defineRoute<z.ZodTypeAny, { poId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Unknown error',
  handler: async ({ auth, params }) => {
    const { poId } = params;

    // ADR-742 §7undecies · ADR-923 Λ5 — ο φράχτης εταιρείας στην υπηρεσία: ξένο PO = ανύπαρκτο (404).
    const po = await findOwnedPO({ caller: auth, poId, action: 'share', intent: 'write' });
    if (!po) notFound(PO_NOT_FOUND_MESSAGE);

    // Ο σύνδεσμος ανήκει στην εταιρεία της ΠΑΡΑΓΓΕΛΙΑΣ — αυτό ακριβώς ελέγχει η ανάκληση.
    const result = await createPOShare(poId, auth.uid, po.companyId);

    // ADR-853 §19 Θ6 — ο νεκρός host έφυγε· `null` όταν δεν ξέρουμε ποιοι είμαστε, ώστε η
    // οθόνη να μην προσφέρει «αντιγραφή συνδέσμου» που δείχνει σε ξένο domain.
    const shareUrl = publicUrl(`/shared/po/${result.token}`);

    return created({
      shareId: result.shareId,
      token: result.token,
      url: shareUrl,
      expiresAt: result.expiresAt,
    });
  },
});

// ============================================================================
// DELETE — Revoke share link (bespoke parse → 400, foreign/missing → 404, revoke-fail → 500)
// ============================================================================

export const DELETE = defineRoute<z.ZodTypeAny, { poId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Unknown error',
  handler: async ({ req, auth, params: { poId } }) => {
    let body: z.infer<typeof RevokeSchema>;
    try {
      body = RevokeSchema.parse(await req.json());
    } catch {
      badRequest('shareId is required');
    }

    // ADR-923 Λ5 — ήταν ανοιχτό: κάθε συνδεδεμένος ανακαλούσε ΟΠΟΙΟΝΔΗΠΟΤΕ σύνδεσμο από το `shareId` του.
    const po = await findOwnedPO({ caller: auth, poId, action: 'share-revoke', intent: 'write' });
    if (!po) notFound(PO_NOT_FOUND_MESSAGE);

    // Η PO πέρασε τον φράχτη ⇒ ο κάτοχός της ανακαλεί κάθε σύνδεσμό της, όποιος κι αν τον έφτιαξε (Λ5β).
    const outcome = await revokePOShare({ shareId: body!.shareId, poId });
    if (outcome === 'not_found') notFound(PO_SHARE_NOT_FOUND_MESSAGE);
    if (outcome === 'failed') httpError(500, 'Failed to revoke share');

    return ok();
  },
});
