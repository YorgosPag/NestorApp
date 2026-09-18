/**
 * @fileoverview **Η ΠΟΡΤΑ ΜΕΤΑΒΟΛΗΣ ΦΑΚΕΛΟΥ** — μετονομασία/είδος · αρχειοθέτηση/επαναφορά.
 * @related ADR-866 Φ1.2 · §2.9.1 (Α2 · Α3) · §2.9.8 (Δ1 · Δ3) · services/property-dossier/property-dossier-write.service.ts
 * @module app/api/property-dossiers/[dossierId]/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ `PATCH`, ΔΥΟ ΠΡΑΞΕΙΣ — ΔΙΑΚΡΙΤΗ ΕΝΩΣΗ ΣΤΟ ΣΩΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `{ lifecycle }` **ή** `{ label, type }` (`propertyDossierPatchRequestSchema`, `.strict()`) — το ίδιο ιδίωμα με το
 * `api/owner-properties/[ownerPropertyId]`: και οι δύο πράξεις αλλάζουν τον **ίδιο** πόρο με τον **ίδιο** γραφέα.
 * Δύο διαδρομές θα ήταν δύο πόρτες που πρέπει να θυμούνται την ίδια κρίση κατοχής.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΚΑΤΟΧΟΣ ΔΕΝ ΕΡΧΕΤΑΙ ΠΟΤΕ ΑΠΟ ΤΟ ΑΙΤΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Όπως η γέννηση (`../route.ts`): `withPersonalOrOrgAuth` + κάτοχος = `actor.ctx.uid`. Η κρίση «δικός σου;» γίνεται
 * **μέσα** στη συναλλαγή του γραφέα με τον **έναν** κριτή (`isOwnedByCustody`). Κανένα `permission` — τα δικαιώματα
 * του έργου είναι εμβέλειας εταιρείας και ο ιδιώτης **δεν** έχει εταιρεία.
 *
 * | Έκβαση | Κωδικός |
 * |---|---|
 * | άλλαξε / ήταν ήδη έτσι (ιδεμπότητο) | **200** |
 * | σώμα που δεν είναι **ένα** από τα δύο σχήματα | **400** `MALFORMED_BODY` |
 * | άκυρο όνομα | **422** `INVALID_DOSSIER` + κωδικοί |
 * | άκυρη ταυτότητα · ανύπαρκτος · **ξένος** | **404** — ίδια απάντηση και στα τρία |
 * | αστοχία βάσης | **500** |
 */

import type { NextRequest, NextResponse } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  propertyDossierChangeOf,
  propertyDossierIdFrom,
  propertyDossierPatchRequestSchema,
} from '@/lib/property-dossier/property-dossier-request-schema';
import { updatePropertyDossier } from '@/services/property-dossier/property-dossier-write.service';

import { dossierNotFound, respondToDossierWrite } from '../_shared/respond';

type RouteContext = { params: Promise<{ dossierId: string }> };

async function handler(
  request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse> {
  const params = await routeContext?.params;
  const dossierId = propertyDossierIdFrom(params?.dossierId ?? '');
  if (dossierId === null) return dossierNotFound();

  const parsed = await readJsonBody(request, propertyDossierPatchRequestSchema);
  if ('rejected' in parsed) return parsed.rejected;

  return respondToDossierWrite(
    await updatePropertyDossier(
      getAdminFirestore(),
      // 🔴 Ο κάτοχος = ο αιτών — ποτέ από το σώμα (το `.strict()` απορρίπτει ήδη ένα `userId`).
      { dossierId, userId: actor.ctx.uid },
      propertyDossierChangeOf(parsed.data),
    ),
    'change',
  );
}

export const PATCH = withStandardRateLimit(
  withPersonalOrOrgAuth<unknown, RouteContext>(handler),
);
