/**
 * @fileoverview `GET` · `PUT /api/document-registry/issuance-requests` — το αίτημα προσφορών έκδοσης του ιδιώτη (ADR-945 §7.5).
 * @related services/document-registry/issuance-request.service.ts (η πράξη) ·
 *   lib/document-validity/issuance-bidding-request.ts (σύρμα · ο ΕΝΑΣ πίνακας αρνήσεων) ·
 *   services/document-registry/upkeep-subject.server.ts (ο ΕΝΑΣ κριτής υποκειμένου)
 *
 * PUT — `action`:
 *   - `invite` { propertyId, documentKind, professionalCompanyId, expectedCycle } ⇒ προσφορά από βιτρίνα του `/pro`·
 *     το προσόν το παράγει ο server από τη δηλωμένη άδεια της βιτρίνας.
 *   - `award` { …, bidId, expectedCycle, quoteRevision, expectedStages } ⇒ απόφαση στη νικήτρια + «δεν επιλέχθηκε» στις
 *     άλλες, σε **μία** συναλλαγή.
 *   - `cancel` { …, expectedCycle, expectedStages } ⇒ κλείνει το αίτημα και όλες οι προσφορές του κύκλου.
 *   CAS: ο κύκλος **και** το στάδιο κάθε προσφοράς που είδε ο άνθρωπος ⇒ αλλιώς `409 STALE`. Ίδια πράξη ξανά ⇒ `unchanged`.
 *   Σύνορο ιδεμποτίας ADR-872 μέσα στο `withPersonalOrOrgAuth` (CHECK 3.92).
 *
 * GET ?propertyId=…&documentKind=… → `{ request, bids, canAct }` — ο ΙΔΙΟΣ κριτής υποκειμένου με το PUT· το `canAct` το
 *   κρίνει ο server με τον ΙΔΙΟ κανόνα που θα κρίνει το PUT (πρότυπο Google Drive `file.capabilities`).
 *
 * 🔑 Αποφασίζει **όποιος διαχειρίζεται τον χώρο του ακινήτου** (`mayAdminister(custodyOf(…))`, CHECK 3.56). Φ1: μόνο
 *   βιβλίο ιδιώτη — ο ιδιώτης (προσωπικός χώρος) ή μέλος οργανισμού για το **δικό του** ακίνητο προσωπικής θεματοφυλακής.
 *   Ακίνητο που ο δρων **δεν** διαχειρίζεται ≡ ανύπαρκτο (404, ποτέ 403 που θα επιβεβαίωνε ότι υπάρχει).
 */

import type { NextRequest } from 'next/server';

import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { createForbiddenResponse } from '@/lib/auth/api-denial';
import { checkPermission } from '@/lib/auth/permissions';
import { listingActorOf, withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import type { PermissionId } from '@/lib/auth/types';
import {
  ISSUANCE_REQUEST_ERROR_CODES,
  issuanceRequestBody,
  issuanceRequestQuery,
  type IssuanceRequestServiceRefusal,
} from '@/lib/document-validity/issuance-bidding-request';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { actOnIssuanceRequest, readIssuanceRequest } from '@/services/document-registry/issuance-request.service';

/** Το δικαίωμα του **οργανισμού** — ίδιο με την ανάθεση έκδοσης §27 και τη μόνιμη υποχρέωση §37. */
const ISSUANCE_REQUEST_PERMISSION: PermissionId = 'properties:properties:update';

function refused(refusal: IssuanceRequestServiceRefusal, message: string): ApiError {
  const [status, code] = ISSUANCE_REQUEST_ERROR_CODES[refusal];
  return new ApiError(status, message, code);
}

/**
 * **Μπορεί αυτός ο δρων να πράξει;** — ΕΝΑ σημείο για το `canAct` του GET **και** τον φρουρό του PUT. Ο ιδιώτης δεν έχει
 * δικαιώματα εταιρείας: το «διαχειρίζεται;» τον έχει ήδη κρίνει ο κριτής υποκειμένου (`mayAdminister`).
 */
async function mayDecide(actor: ApiActor): Promise<boolean> {
  if (actor.scope === 'personal') return true;
  return (await checkPermission(actor.ctx, ISSUANCE_REQUEST_PERMISSION)).granted;
}

async function issuanceRequestReadHandler(request: NextRequest, actor: ApiActor) {
  const { searchParams } = request.nextUrl;
  const parsed = safeParseBody(issuanceRequestQuery, {
    propertyId: searchParams.get('propertyId') ?? '',
    documentKind: searchParams.get('documentKind') ?? '',
  });
  if (parsed.error) return parsed.error;
  const reading = await readIssuanceRequest(getAdminFirestore(), listingActorOf(actor), parsed.data.propertyId, parsed.data.documentKind, new Date());
  if (!reading.ok) throw refused(reading.refusal, 'Issuance request unavailable');
  return apiSuccess({ request: reading.view.request, bids: reading.view.bids, canAct: await mayDecide(actor) });
}

async function issuanceRequestActHandler(request: NextRequest, actor: ApiActor) {
  if (!(await mayDecide(actor))) return createForbiddenResponse(ISSUANCE_REQUEST_PERMISSION);
  const parsed = safeParseBody(issuanceRequestBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await actOnIssuanceRequest(
    getAdminFirestore(),
    { ...listingActorOf(actor), name: actor.ctx.email },
    parsed.data,
    new Date(),
  );
  if (!result.ok) throw refused(result.refusal, 'Issuance request refused');
  return apiSuccess({ outcome: result.outcome, cycle: result.cycle });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(issuanceRequestReadHandler));
export const PUT = withStandardRateLimit(withPersonalOrOrgAuth(issuanceRequestActHandler));
