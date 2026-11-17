/**
 * @fileoverview **ΠΡΟΣΚΛΗΣΗ ΣΤΟΝ ΦΑΚΕΛΟ** — ο κάτοχος καλεί με email δικηγόρο ή συμβολαιογράφο (ADR-916 Φ-Ε1 Σ2).
 * @module app/api/property-dossiers/[dossierId]/access/invitations/route
 * @related ADR-853 §20 (η ΜΙΑ μηχανή πρόσκλησης) · `services/property-dossier/dossier-access-host.service.ts`
 *
 * `POST /api/property-dossiers/{dossierId}/access/invitations` με `{ email, role, reach, shareDays }`
 * (`dossierInvitationRequestSchema`, `.strict()`). Ξανά-κλήση στον ίδιο ρόλο = **επαναποστολή** (νέο token, νέα λήξη·
 * η παλιά ανακαλείται ατομικά — Share του Drive/Box).
 *
 * | Έκβαση | Κωδικός |
 * |---|---|
 * | εκδόθηκε (η αποστολή του email επιστρέφει ονομασμένη στο `invited`) | **201** `{ slots, invited }` |
 * | σώμα εκτός σχήματος (άγνωστος ρόλος/καρτέλα/ημέρες · καμία καρτέλα · ξένο πεδίο) | **400** |
 * | άκυρη ταυτότητα · ανύπαρκτος · **ξένος** | **404** |
 * | αρχειοθετημένος φάκελος | **409** `DOSSIER_ARCHIVED` |
 * | ο ρόλος έχει ήδη ζωντανή συμμετοχή (και ληγμένη-ενεργή: ανανέωση ή ανάκληση πρώτα) | **409** `SLOT_OCCUPIED` |
 *
 * 🔑 `withSensitiveRateLimit`: η πόρτα στέλνει email σε τρίτο — ίδια κατηγορία με τις προσκλήσεις χώρου.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { dossierInvitationRequestSchema } from '@/lib/property-dossier/dossier-access-request-schema';
import { inviteToDossier } from '@/services/property-dossier/dossier-access-host.service';

import { accessGranted, accessRefused, ownedDossierOfRoute, ownerActorOf } from '../../../_shared/access-door';

type RouteContext = { params: Promise<{ dossierId: string }> };

async function handler(request: NextRequest, actor: ApiActor, routeContext?: RouteContext): Promise<NextResponse> {
  const owned = await ownedDossierOfRoute(actor, routeContext);
  if (owned === null) return accessRefused('NOT_FOUND');

  const parsed = await readJsonBody(request, dossierInvitationRequestSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const outcome = await inviteToDossier(owned.db, ownerActorOf(actor), owned.dossier, parsed.data, Date.now());
  if (!outcome.ok) return accessRefused(outcome.rejection === 'dossier-archived' ? 'DOSSIER_ARCHIVED' : 'SLOT_OCCUPIED');
  return accessGranted({ slots: outcome.slots, invited: outcome.invited }, 201);
}

export const POST = withSensitiveRateLimit(
  withPersonalOrOrgAuth<unknown, RouteContext>(handler),
);
