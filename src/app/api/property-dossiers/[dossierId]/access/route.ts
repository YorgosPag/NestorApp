/**
 * @fileoverview **«ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΟΝ ΦΑΚΕΛΟ ΜΟΥ;»** — οι θέσεις πρόσβασης του φακέλου (ADR-916 Φ-Ε1 Σ2).
 * @module app/api/property-dossiers/[dossierId]/access/route
 * @related `services/property-dossier/dossier-access-host.service.ts` · `../../_shared/access-door.ts`
 *
 * `GET /api/property-dossiers/{dossierId}/access` ⇒ `{ slots, files }` — μία θέση ανά ρόλο (δικηγόρος · συμβολαιογράφος):
 * τρέχουσα συμμετοχή (με την κρίση **τώρα**) + πιο πρόσφατη πρόσκληση· και τα αρχεία του φακέλου με την καρτέλα τους
 * (Σ4 — προεπισκόπηση «θα δει N αρχεία» και εξαιρέσεις, από τον ΕΝΑ κριτή της πόρτας).
 *
 * | Έκβαση | Κωδικός |
 * |---|---|
 * | ο φάκελός σου | **200** `{ slots, files }` |
 * | άκυρη ταυτότητα · ανύπαρκτος · **ξένος** | **404** — ίδια απάντηση και στα τρία |
 *
 * 🔑 `withPersonalOrOrgAuth`: ο φάκελος είναι **προσωπικός** — ο ιδιώτης δεν έχει εταιρεία (δηλωμένο στο
 *    `personal-scope-consumers.test.ts`). Η απάντηση περιέχει email προσκεκλημένων ⇒ **μόνο** στον κάτοχο.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readDossierAccessView } from '@/services/property-dossier/dossier-access-host.service';

import { accessGranted, accessRefused, ownedDossierOfRoute } from '../../_shared/access-door';

type RouteContext = { params: Promise<{ dossierId: string }> };

async function handler(_request: NextRequest, actor: ApiActor, routeContext?: RouteContext): Promise<NextResponse> {
  const owned = await ownedDossierOfRoute(actor, routeContext);
  if (owned === null) return accessRefused('NOT_FOUND');
  return accessGranted(await readDossierAccessView(owned.db, owned.dossier, Date.now()));
}

export const GET = withStandardRateLimit(
  withPersonalOrOrgAuth<unknown, RouteContext>(handler),
);
