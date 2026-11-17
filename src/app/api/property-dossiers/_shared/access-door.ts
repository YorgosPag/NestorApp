/**
 * @fileoverview **Το κοινό των πορτών πρόσβασης** του φακέλου (ADR-916 Φ-Ε1 Σ2): «δικός σου;» + μία μορφή απάντησης.
 * @module app/api/property-dossiers/_shared/access-door
 * @related `./respond.ts` (ο αδελφός των πορτών γέννησης/μεταβολής) · `services/property-dossier/dossier-access-host.service.ts`
 *
 * 🔑 **Γιατί χωριστό αρχείο**: τέσσερις πόρτες (θέσεις · πρόσκληση · ακύρωση · πράξη) ρωτούν την **ίδια** κρίση κατοχής
 *    και απαντούν το **ίδιο** σχήμα (`DossierAccessResponse`). Τέσσερα αντίγραφα θα απέκλιναν στο πρώτο νέο πεδίο.
 * 🔴 **Ο κάτοχος = `actor.ctx.uid`, ποτέ το σώμα.** Άκυρη ταυτότητα · ανύπαρκτος · **ξένος** ⇒ **ίδιο** 404
 *    (`dossierNotFound`) — ποτέ 403, που θα επιβεβαίωνε ότι υπάρχει ξένος φάκελος.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import type { ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { propertyDossierIdFrom } from '@/lib/property-dossier/property-dossier-request-schema';
import { readOwnedDossier, type DossierOwnerActor } from '@/services/property-dossier/dossier-access-host.service';
import type { DossierAccessResponse } from '@/types/dossier-access';
import type { PropertyDossier } from '@/types/property-dossier';

/** Οι κωδικοί άρνησης των πορτών πρόσβασης — κλειστό σύνολο, ίδιο λεξιλόγιο με το `{ error }` των αδελφών. */
export type DossierAccessError = 'NOT_FOUND' | 'DOSSIER_ARCHIVED' | 'SLOT_OCCUPIED' | 'NOT_ALLOWED';

export type DossierAccessBody = DossierAccessResponse | { readonly error: DossierAccessError };

/** Ο δρών κάτοχος, όπως τον χρειάζεται το ίχνος — από το σύνορο αυθεντικοποίησης. */
export function ownerActorOf(actor: ApiActor): DossierOwnerActor {
  return { uid: actor.ctx.uid, email: actor.ctx.email };
}

/** Ο φάκελος της διαδρομής **του αιτούντος**, μαζί με τη βάση που τον διάβασε. */
export interface OwnedDossierOfRoute {
  readonly db: Firestore;
  readonly dossier: PropertyDossier;
}

/**
 * **Ο φάκελος της διαδρομής, αν είναι του αιτούντος** — αλλιώς `null` (η πόρτα απαντά 404). Η ΜΙΑ είσοδος των τεσσάρων
 * πορτών: παράμετροι → ταυτότητα (`propertyDossierIdFrom`) → κρίση κατοχής (`readOwnedDossier`).
 */
export async function ownedDossierOfRoute(
  actor: ApiActor,
  routeContext: { readonly params: Promise<{ readonly dossierId: string }> } | undefined,
): Promise<OwnedDossierOfRoute | null> {
  const dossierId = propertyDossierIdFrom((await routeContext?.params)?.dossierId);
  if (dossierId === null) return null;
  const db = getAdminFirestore();
  const dossier = await readOwnedDossier(db, dossierId, actor.ctx.uid);
  return dossier === null ? null : { db, dossier };
}

/** Η επιτυχής απάντηση — πάντα **όλες** οι θέσεις. */
export function accessGranted(body: DossierAccessResponse, status: 200 | 201 = 200): NextResponse<DossierAccessBody> {
  return NextResponse.json(body, { status });
}

/** Η άρνηση — 404 για «δεν υπάρχει εδώ», 409 για «υπάρχει, αλλά η κατάστασή του δεν το επιτρέπει». */
export function accessRefused(error: DossierAccessError): NextResponse<DossierAccessBody> {
  return NextResponse.json({ error }, { status: error === 'NOT_FOUND' ? 404 : 409 });
}
