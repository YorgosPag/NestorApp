/**
 * @fileoverview **ΠΡΑΞΗ ΚΑΤΟΧΟΥ ΣΕ ΣΥΜΜΕΤΟΧΗ** — ανάκληση · ανανέωση · αλλαγή εύρους (ADR-916 Φ-Ε1 Σ2).
 * @module app/api/property-dossiers/[dossierId]/access/[engagementId]/route
 * @related `lib/auth/engagement-write.ts` (ο ΕΝΑΣ γραφέας: `end` · `renew` · `reach`) ·
 *          `lib/auth/engagement-dossier-plan.ts` (οι καθαροί σχεδιασμοί)
 *
 * `POST /api/property-dossiers/{dossierId}/access/{engagementId}` — **μία** πόρτα, διακριτή ένωση στο σώμα
 * (`dossierEngagementChangeSchema`, `.strict()`), όπως το `PATCH` του φακέλου:
 * - `{ action: 'revoke' }` — **άμεσα**, καμία περίοδος χάριτος (ADR-787 Ε-2 §5)· ό,τι κατέβηκε ήδη δεν «σβήνεται».
 * - `{ action: 'renew', shareDays }` — νέα λήξη **από σήμερα** από το κλειστό μενού (Drive «extend expiry»)· μόνο ενεργή.
 * - `{ action: 'reach', reach }` — νέες καρτέλες/εξαιρέσεις· ισχύουν στο **επόμενο** άνοιγμα (το εύρος κρίνεται σε κάθε ανάγνωση).
 *
 * | Έκβαση | Κωδικός |
 * |---|---|
 * | άλλαξε · ήταν ήδη έτσι (ιδεμποτής, κανένα ίχνος) | **200** `{ slots }` |
 * | σώμα εκτός σχήματος | **400** |
 * | φάκελος άκυρος/ανύπαρκτος/**ξένος** · συμμετοχή ανύπαρκτη ή άλλου φακέλου | **404** |
 * | η πράξη δεν επιτρέπεται από την κατάσταση (π.χ. ανανέωση ανακλημένης — θέλει νέα πρόσκληση) | **409** `NOT_ALLOWED` |
 *
 * ⚠️ Ο στατικός αδελφός `access/invitations` προηγείται του `[engagementId]` (Next.js)· οι ταυτότητες συμμετοχής έχουν
 *    πρόθεμα `eng_` (`engagementIdFrom`), άρα δεν συγκρούονται ποτέ με το όνομα του αδελφού.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { dossierEngagementChangeSchema, engagementIdFrom } from '@/lib/property-dossier/dossier-access-request-schema';
import { changeDossierEngagement } from '@/services/property-dossier/dossier-access-host.service';

import { accessGranted, accessRefused, ownedDossierOfRoute, ownerActorOf } from '../../../_shared/access-door';

type RouteContext = { params: Promise<{ dossierId: string; engagementId: string }> };

async function handler(request: NextRequest, actor: ApiActor, routeContext?: RouteContext): Promise<NextResponse> {
  const engagementId = engagementIdFrom((await routeContext?.params)?.engagementId);
  if (engagementId === null) return accessRefused('NOT_FOUND');
  const owned = await ownedDossierOfRoute(actor, routeContext);
  if (owned === null) return accessRefused('NOT_FOUND');

  const parsed = await readJsonBody(request, dossierEngagementChangeSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const outcome = await changeDossierEngagement(owned.db, ownerActorOf(actor), owned.dossier, { engagementId, change: parsed.data, nowMs: Date.now() });
  if (!outcome.ok) return accessRefused(outcome.rejection === 'not-found' ? 'NOT_FOUND' : 'NOT_ALLOWED');
  return accessGranted({ slots: outcome.slots });
}

export const POST = withStandardRateLimit(
  withPersonalOrOrgAuth<unknown, RouteContext>(handler),
);
