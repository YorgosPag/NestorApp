import 'server-only';

/**
 * @fileoverview **ΤΟ ΚΟΥΠΟΝΙ ΘΕΑΣΗΣ** — «αυτός ο browser κρίθηκε ότι βλέπει αυτή την περιήγηση» (ADR-884 Φ0.4 · Κ3β).
 * @related `server/access-grant/access-grant.ts` (ο ΕΝΑΣ πυρήνας) · `tour-view-session.ts` (ο μόνος εκδότης)
 * @module server/spatial-tour/tour-view-grant
 *
 * 🔑 **Πιο έξυπνο από τον Matterport**: η κρίση γίνεται **μία** φορά ανά επίσκεψη (`POST …/view-session`) και κάθε
 * πλακίδιο (`GET …/media/…`) ελέγχει **μόνο** την υπογραφή — καμία ανάγνωση Firestore ανά πλακίδιο. Απορρίφθηκαν:
 * V4 υπογεγραμμένο URL **ανά πλακίδιο** (εκατοντάδες υπογραφές ανά προβολή) και signed cookies του Cloud CDN
 * (η φιλοξενία είναι Netcup).
 *
 * 🔐 **Τι υπογράφεται**: `[tour-view, tourId, basis, basisId, λήξη]`. Η **βάση** ταξιδεύει ώστε το ίχνος και τα
 * αρχεία καταγραφής να λένε **γιατί** είδε κάποιος — ο κοινός κωδικός του Matterport δεν μπορεί να το πει.
 *
 * 🍪 Cookie **ανά περιήγηση** (`nestor_tour_{tourId}`), οριοθετημένο στη ρίζα API **αυτής** της περιήγησης: φτάνει
 * στα μέσα **και** στις δύο πόρτες `view-session` (αλλιώς η συνεδρία δεν αναγνωρίζει ποτέ «ίδια επίσκεψη» —
 * μετρημένο 2026-09-26: κάθε reload μετρούσε), σε κανένα αίτημα άλλης περιήγησης ή του υπόλοιπου ιστότοπου.
 */

import type { NextRequest, NextResponse } from 'next/server';

import {
  isTourMediaPlacement,
  isTourViewBasis,
  type TourMediaPlacement,
  type TourViewBasis,
} from '@/constants/spatial-tour-vocabulary';
import { API_ROUTES } from '@/config/domain-constants';
import {
  ACCESS_GRANT_TTL_SECONDS,
  attachAccessGrant,
  clearAccessGrant,
  issueAccessGrant,
  readAccessGrant,
  requestAccessGrant,
  type AccessGrantKind,
} from '@/server/access-grant/access-grant';
import { effectiveMediaPlacement } from '@/server/spatial-tour/tour-media-store';
import type { TourSubject } from '@/types/spatial-tour';

const TOUR_VIEW_GRANT: AccessGrantKind = { purpose: 'tour-view', subjectFieldCount: 4 };
const COOKIE_PREFIX = 'nestor_tour_';

export const TOUR_VIEW_GRANT_TTL_SECONDS = ACCESS_GRANT_TTL_SECONDS;

/** Τι αποδεικνύει ένα έγκυρο κουπόνι. */
export interface TourViewGrant {
  readonly tourId: string;
  readonly basis: TourViewBasis;
  readonly basisId: string;
  /**
   * Πού ζουν τα μέσα της περιήγησης (ADR-884 Φ2ζ ζ5) — **υπογεγραμμένο**, ώστε η διαδρομή μέσων να διαλέγει κάδο χωρίς να
   * διαβάσει τη βάση ανά πλακίδιο. Στην **έκδοση** απόν ⇒ `legacy-default`· στην **ανάγνωση** πάντα παρόν.
   */
  readonly mediaPlacement?: TourMediaPlacement;
}

export function tourViewCookieName(tourId: string): string {
  return `${COOKIE_PREFIX}${tourId}`;
}

/** `null` ⇒ λείπει το μυστικό — ο καλών απαντά «μη διαθέσιμο». */
export function issueTourViewGrant(grant: TourViewGrant, nowMs: number = Date.now()): string | null {
  const placement = effectiveMediaPlacement(grant.mediaPlacement);
  return issueAccessGrant(TOUR_VIEW_GRANT, [grant.tourId, grant.basis, grant.basisId, placement], nowMs);
}

/** Καθαρή ανάγνωση: η απόδειξη αν το κουπόνι είναι έγκυρο **για αυτή την περιήγηση**, αλλιώς `null`. */
export function readTourViewGrant(token: string, tourId: string, nowMs: number = Date.now()): TourViewGrant | null {
  const fields = readAccessGrant(TOUR_VIEW_GRANT, token, nowMs);
  if (fields === null) return null;
  const [grantedTourId, basis, basisId, placement] = fields;
  if (grantedTourId !== tourId || !isTourViewBasis(basis) || basisId === '') return null;
  // Η θέση είναι ΥΠΟΧΡΕΩΤΙΚΗ: το κουπόνι 3 πεδίων (πριν το ζ5) αφαιρέθηκε μετά από μία διάρκεια ζωής του — ο browser ξαναπαίρνει κουπόνι.
  if (!isTourMediaPlacement(placement)) return null;
  return { tourId: grantedTourId, basis, basisId, mediaPlacement: placement };
}

/** Το κουπόνι που φέρει το αίτημα για **αυτή** την περιήγηση, επαληθευμένο. */
export function requestTourViewGrant(request: NextRequest, tourId: string): TourViewGrant | null {
  const token = requestAccessGrant(request, tourViewCookieName(tourId));
  return token === null ? null : readTourViewGrant(token, tourId);
}

/** Το `Path` του cookie — η ρίζα της περιήγησης, κοινός πρόγονος μέσων και συνεδρίας θέασης. */
export function tourViewCookiePath(subject: TourSubject): string {
  return API_ROUTES.SPATIAL_TOURS.ROOT(subject.kind, subject.id);
}

export function attachTourViewGrant(response: NextResponse, subject: TourSubject, tourId: string, token: string): void {
  attachAccessGrant(response, { name: tourViewCookieName(tourId), path: tourViewCookiePath(subject) }, token);
}

/** Η συνεδρία αρνήθηκε ⇒ ο browser παύει **τώρα** να φέρνει πλακίδια (π.χ. μόλις ανακλήθηκε η πρόσβασή του). */
export function clearTourViewGrant(response: NextResponse, subject: TourSubject, tourId: string): void {
  clearAccessGrant(response, { name: tourViewCookieName(tourId), path: tourViewCookiePath(subject) });
}
