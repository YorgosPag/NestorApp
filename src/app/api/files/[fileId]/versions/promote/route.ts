/**
 * =============================================================================
 * «ΟΡΙΣΜΟΣ ΩΣ ΤΡΕΧΟΥΣΑΣ» (ADR-862 Φ0 · ανοιχτό του Β10)
 * =============================================================================
 *
 * `POST /api/files/{fileId}/versions/promote`  ·  σώμα: `{ expectedHeadFileId }`
 *
 * Το `{fileId}` είναι η **παλιά** έκδοση. Γίνεται **νέα** έκδοση στην κορυφή (Box «Promote
 * file version», SharePoint «Restore») — ποτέ ανάσταση του αρχειοθετημένου. Η ροή και οι
 * εγγυήσεις ζουν στο `services/iso19650/version-promotion.ts`.
 *
 * 🔑 `expectedHeadFileId` = η προϋπόθεση (AIP-154 etag / HTTP `If-Match`): η οθόνη στέλνει
 * την κεφαλή που **έδειξε**. Αν άλλαξε ⇒ **409** `head-moved` — ποτέ σιωπηλή αντικατάσταση
 * δουλειάς που ο άνθρωπος δεν είδε.
 *
 * ⚡ `SENSITIVE` ρητά (CHECK 3.78): αλλάζει **ποια έκδοση ισχύει** για όλο το γραφείο.
 *
 * 🗂️ **ΔΥΟ ΔΙΑΜΕΡΙΣΜΑΤΑ** (ADR-866 2β.3β): `?custody=personal` ⇒ ο κάτοχος προβιβάζει **δική του**
 * έκδοση (Box «Promote file version» στον προσωπικό χώρο). Ο διάδοχος γεννιέται από τον **ίδιο**
 * builder, με το overload **του ανθρώπου** — κανένα `companyId`, κανένα πεδίο CDE, ρίζα `people/`.
 *
 * @module app/api/files/[fileId]/versions/promote
 */

import { NextRequest, NextResponse } from 'next/server';
import { containerVisibilityRefusal } from '@/lib/auth/container-visibility-guard';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  refreshListingsAfterFileChanges,
  type ChangedListingFile,
  type ListingRefreshReport,
} from '@/services/listings/listing-media-refresh';
import { ACT_SPEC } from '@/services/iso19650/container-transition-policy';
import {
  promoteVersion,
  type VersionPromotionOutcome,
} from '@/services/iso19650/version-promotion';
import {
  withFileCustodyAuth,
  type FileCustodyCaller,
} from '../../../_shared/file-custody-route';
import {
  authorityUnavailableResponse,
  fileNotFoundResponse,
  resolveContainerFile,
  type FileSegment,
} from '../../../_shared/container-route-responses';
import { fileResource } from '../../../_shared/file-ownership';

/**
 * 🌍 **Προώθηση που ΕΓΙΝΕ ⇒ η αγγελία του ακινήτου ξαναπροβάλλεται** (ADR-845 §7.17 Α3, κλάση Ο-35).
 *
 * Η προώθηση **αρχειοθετεί** την ως τώρα τρέχουσα έκδοση, και ο διάδοχος γεννιέται **χωρίς**
 * διαβάθμιση *(`version-promotion-policy`: το `classification` έχει ΕΝΑΝ γραφέα)*. Αν η τρέχουσα
 * ήταν δημοσιευμένη φωτογραφία, **φεύγει από το κοινό** — και ως την Α3 η αγγελία δεν το μάθαινε.
 *
 * 🔑 **Δύο αρχεία, όχι ένα**: η *θέση* του διαδόχου έρχεται από την **κεφαλή**, που μπορεί να έχει
 * μετακινηθεί σε άλλο ακίνητο από την πηγή. Ξαναπροβάλλονται τα ακίνητα **και των δύο**· ο βοηθός
 * κρατά ένα ανά ακίνητο. Η κεφαλή φορτώνεται από τον **ίδιο** PEP *(ξένη = ανύπαρκτη)*.
 *
 * ⚠️ Μόνο για εταιρεία: προσωπικό αρχείο δεν είναι υλικό αγγελίας γραφείου.
 */
async function listingsAfter(
  outcome: VersionPromotionOutcome,
  caller: FileCustodyCaller,
  source: ChangedListingFile | undefined,
): Promise<readonly ListingRefreshReport[]> {
  if (outcome.kind !== 'promoted' || caller.custody !== 'company') return [];

  const head = await fileResource.load({
    docId: outcome.previousHeadFileId,
    caller: caller.ctx,
    action: 'promote-version:listing',
    refusal: fileNotFoundResponse,
  });
  const changed = head.refusal === undefined ? [source ?? {}, head.doc.data ?? {}] : [source ?? {}];
  return refreshListingsAfterFileChanges(getAdminFirestore(), changed);
}

/** Η έκβαση → HTTP. Σύγκρουση προϋπόθεσης = **409**, άρνηση πολιτικής = **403 με όνομα**. */
function toResponse(
  outcome: VersionPromotionOutcome,
  listings: readonly ListingRefreshReport[],
): NextResponse {
  switch (outcome.kind) {
    case 'promoted':
      return NextResponse.json({ success: true, ...outcome, listings }, { status: 200 });
    case 'noop':
      return NextResponse.json({ success: true, ...outcome }, { status: 200 });
    case 'refused':
      if (outcome.why === 'not-found' || outcome.why === 'tenant-mismatch') return fileNotFoundResponse();
      return NextResponse.json(
        { success: false, refused: outcome.why },
        { status: outcome.why === 'head-moved' || outcome.why === 'predecessor-not-active' ? 409 : 403 },
      );
  }
}

async function handlePost(request: NextRequest, caller: FileCustodyCaller, segment?: FileSegment) {
  const body: unknown = await request.json().catch(() => null);
  const expectedHeadFileId = (body as { expectedHeadFileId?: unknown } | null)?.expectedHeadFileId;
  if (typeof expectedHeadFileId !== 'string' || expectedHeadFileId.length === 0) {
    return NextResponse.json({ error: 'expectedHeadFileId is required' }, { status: 400 });
  }

  const resolved = await resolveContainerFile(segment, caller, 'promote-version');
  if (resolved.refusal) return resolved.refusal;
  const { fileId, actor } = resolved;

  // 🔒 Βλέπει καν την παλιά έκδοση; — με τον διακόπτη ιστορικού, και την ικανότητα της
  //    ΠΡΑΞΗΣ που θα ασκηθεί (αντικατάσταση), όχι γενικό «δες».
  // 🔑 **Μόνο για εταιρεία** (ADR-866 Ε-Φ0-1): στον προσωπικό χώρο δεν υπάρχει φάση να κριθεί,
  //    και η ικανότητα `iso19650:containers:supersede` δεν υπάρχει να δοθεί σε πολίτη — εκεί η
  //    εξουσία είναι η **ιδιοκτησία**, που κρίθηκε μόλις (`personalFileResource`) και ξανά μέσα
  //    στον γραφέα (`isOwnedByCustody`, βήμα 2).
  if (caller.custody === 'company') {
    const refusal = await containerVisibilityRefusal({
      fileId,
      caller: caller.ctx,
      action: ACT_SPEC.supersede.capability,
      raw: resolved.doc.data,
      notFound: fileNotFoundResponse,
      unavailable: authorityUnavailableResponse,
      historyRequested: true,
    });
    if (refusal) return refusal;
  }

  const outcome = await promoteVersion({ actor, sourceFileId: fileId, expectedHeadFileId });
  return toResponse(outcome, await listingsAfter(outcome, caller, resolved.doc.data));
}

export const POST = withSensitiveRateLimit(
  withFileCustodyAuth<FileSegment>(handlePost, { permissions: ACT_SPEC.supersede.capability }),
);
