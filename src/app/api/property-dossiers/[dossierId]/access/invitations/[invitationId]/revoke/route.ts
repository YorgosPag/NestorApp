/**
 * @fileoverview **ΑΚΥΡΩΣΗ ΠΡΟΣΚΛΗΣΗΣ ΦΑΚΕΛΟΥ** — ο κάτοχος αποσύρει μια εκκρεμή πρόσκληση (ADR-916 Φ-Ε1 Σ2).
 * @module app/api/property-dossiers/[dossierId]/access/invitations/[invitationId]/revoke/route
 * @related `server/engagement-invitations/engagement-invitation-issue.ts` (`revokeDossierInvitation`)
 *
 * `POST /api/property-dossiers/{dossierId}/access/invitations/{invitationId}/revoke` — `pending` ⇒ `revoked`: ο σύνδεσμος
 * του email σταματά **αμέσως**. **Ποτέ διαγραφή** (το ίχνος μένει).
 *
 * | Έκβαση | Κωδικός |
 * |---|---|
 * | ακυρώθηκε · ήταν ήδη κλειστή (ιδεμποτής, καμία γραφή) | **200** `{ slots }` |
 * | φάκελος άκυρος/ανύπαρκτος/**ξένος** · πρόσκληση άλλου φακέλου/άλλου κατόχου/ανύπαρκτη | **404** |
 */

import type { NextRequest, NextResponse } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { engagementInvitationIdFrom } from '@/lib/property-dossier/dossier-access-request-schema';
import { cancelDossierInvitation } from '@/services/property-dossier/dossier-access-host.service';

import { accessGranted, accessRefused, ownedDossierOfRoute, ownerActorOf } from '../../../../../_shared/access-door';

type RouteContext = { params: Promise<{ dossierId: string; invitationId: string }> };

async function handler(_request: NextRequest, actor: ApiActor, routeContext?: RouteContext): Promise<NextResponse> {
  const invitationId = engagementInvitationIdFrom((await routeContext?.params)?.invitationId);
  if (invitationId === null) return accessRefused('NOT_FOUND');
  const owned = await ownedDossierOfRoute(actor, routeContext);
  if (owned === null) return accessRefused('NOT_FOUND');

  const outcome = await cancelDossierInvitation(owned.db, ownerActorOf(actor), owned.dossier, invitationId, Date.now());
  return outcome.found ? accessGranted({ slots: outcome.slots }) : accessRefused('NOT_FOUND');
}

export const POST = withStandardRateLimit(
  withPersonalOrOrgAuth<unknown, RouteContext>(handler),
);
