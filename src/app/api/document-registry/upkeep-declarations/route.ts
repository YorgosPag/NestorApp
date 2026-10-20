/**
 * @fileoverview `GET` · `PUT /api/document-registry/upkeep-declarations` — η μόνιμη υποχρέωση ακινήτου (ADR-915 §35 · §36 · §37).
 * @related services/document-registry/upkeep-declaration.service.ts (η πράξη) · lib/document-validity/upkeep-declaration-request.ts ·
 *   services/document-registry/upkeep-subject.server.ts (ο ΕΝΑΣ κριτής υποκειμένου)
 *
 * PUT { propertyId, documentKind, decision: 'required' | 'not-required' | null, exemptionReason } → `{ outcome }`
 *   - `decision: null` ⇒ «ξανά ρώτα»: η απόφαση σβήνεται, γυρίζει η πρόταση
 *   - εξαίρεση **πάντα** με λόγο (400 αλλιώς) · η πρόταση της στιγμής την υπολογίζει ο server, ποτέ ο πελάτης
 *   - ίδια απόφαση ξανά ⇒ `unchanged`, καμία εγγραφή, κανένα ίχνος· σύνορο ιδεμποτίας ADR-872 μέσα στο σύνορο
 *
 * GET ?propertyId=… → `{ items, canDecide }` (§36 · §37) — η ενότητα **ενός** ακινήτου: ο ΙΔΙΟΣ `upkeepItemsOf` με το
 *   μητρώο, πάνω στον ΙΔΙΟ κριτή υποκειμένου με το PUT. Το `canDecide` το κρίνει ο server με τον ΙΔΙΟ κανόνα που θα κρίνει
 *   το PUT (πρότυπο Google Drive `file.capabilities`): ο πελάτης δεν μαντεύει ποτέ αν θα του επιτραπεί.
 *
 * 🔑 §37 — **αποφασίζει όποιος διαχειρίζεται τον χώρο του ακινήτου** (`mayAdminister(custodyOf(…))`, CHECK 3.56):
 *   - **οργανισμός**: ακίνητα εταιρείας + ακίνητα ιδιωτών υπό θεματοφυλακή του· PUT με `properties:properties:update`
 *     (ο ΕΝΑΣ PDP `checkPermission`, ίδια άρνηση `createForbiddenResponse` με το `withAuth`).
 *   - **ιδιώτης χωρίς μεσίτη** (προσωπικός χώρος): **μόνο** το δικό του ακίνητο προσωπικής θεματοφυλακής. Δεν υπάρχει
 *     δικαίωμα εταιρείας να ζητηθεί — το `withPersonalOrOrgAuth` το κάνει **μη εκφράσιμο** (ADR-817)· τον κρίνει ο κριτής.
 * Ακίνητο που ο δρων **δεν** διαχειρίζεται ≡ ανύπαρκτο (404, ποτέ 403 που θα επιβεβαίωνε ότι υπάρχει).
 */

import type { NextRequest } from 'next/server';

import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { createForbiddenResponse } from '@/lib/auth/api-denial';
import { checkPermission } from '@/lib/auth/permissions';
import { listingActorOf, withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import type { PermissionId } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import {
  UPKEEP_DECLARATION_ERROR_CODES,
  upkeepDeclarationBody,
  upkeepPropertyQuery,
  type UpkeepDeclarationRefusal,
} from '@/lib/document-validity/upkeep-declaration-request';
import { declareRegistryUpkeep } from '@/services/document-registry/upkeep-declaration.service';
import { readPropertyUpkeep } from '@/services/document-registry/upkeep-subject.server';

/** Το δικαίωμα του **οργανισμού** για την απόφαση — η απόφαση αλλάζει γεγονός του ακινήτου που βλέπουν όλοι. */
const UPKEEP_DECIDE_PERMISSION: PermissionId = 'properties:properties:update';

/** Άρνηση → HTTP, κάθε λόγος ρητά (χωρίς `default`)· ο κωδικός από τον ΕΝΑ πίνακα που διαβάζει και η οθόνη. */
const REFUSAL_STATUS: Readonly<Record<UpkeepDeclarationRefusal, number>> = {
  absent: 404,
  retired: 409,
  'not-standing': 422,
};

function refused(refusal: UpkeepDeclarationRefusal, message: string): ApiError {
  return new ApiError(REFUSAL_STATUS[refusal], message, UPKEEP_DECLARATION_ERROR_CODES[refusal]);
}

/**
 * **Μπορεί αυτός ο δρων να αποφασίσει;** — ΕΝΑ σημείο για το `canDecide` του GET **και** τον φρουρό του PUT. Ο ιδιώτης
 * δεν έχει δικαιώματα εταιρείας: το «διαχειρίζεται;» τον έχει ήδη κρίνει ο κριτής υποκειμένου (`mayAdminister`).
 */
async function mayDecide(actor: ApiActor): Promise<boolean> {
  if (actor.scope === 'personal') return true;
  return (await checkPermission(actor.ctx, UPKEEP_DECIDE_PERMISSION)).granted;
}

async function propertyUpkeepHandler(request: NextRequest, actor: ApiActor) {
  const parsed = safeParseBody(upkeepPropertyQuery, { propertyId: request.nextUrl.searchParams.get('propertyId') ?? '' });
  if (parsed.error) return parsed.error;
  const reading = await readPropertyUpkeep(getAdminFirestore(), listingActorOf(actor), parsed.data.propertyId);
  if (reading.kind !== 'ready') throw refused(reading.kind, 'Property upkeep unavailable');
  return apiSuccess({ items: reading.items, canDecide: await mayDecide(actor) });
}

async function upkeepDeclarationHandler(request: NextRequest, actor: ApiActor) {
  if (!(await mayDecide(actor))) return createForbiddenResponse(UPKEEP_DECIDE_PERMISSION);
  const parsed = safeParseBody(upkeepDeclarationBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await declareRegistryUpkeep(
    getAdminFirestore(),
    { ...listingActorOf(actor), name: actor.ctx.email },
    parsed.data,
    new Date(),
  );
  if (!result.ok) {
    throw refused(result.refusal, 'Upkeep declaration refused');
  }
  return apiSuccess({ outcome: result.outcome });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(propertyUpkeepHandler));
export const PUT = withStandardRateLimit(withPersonalOrOrgAuth(upkeepDeclarationHandler));
