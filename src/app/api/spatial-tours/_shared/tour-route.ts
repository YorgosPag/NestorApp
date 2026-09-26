/**
 * @fileoverview **ΤΑ ΚΟΙΝΑ ΤΩΝ ΔΙΑΔΡΟΜΩΝ ΤΗΣ ΧΩΡΙΚΗΣ ΠΕΡΙΗΓΗΣΗΣ** — δράστης · ρίζα · άρνηση → HTTP, **μία** φορά.
 * @related ADR-884 §4.5 (Κ3α) · ADR-817 §5 (γιατί `withPersonalOrOrgAuth`) · `server/spatial-tour/*`
 * @module app/api/spatial-tours/_shared/tour-route
 *
 * 🔑 **Γιατί `withPersonalOrOrgAuth` σε ΟΛΕΣ**: ο υπεύθυνος αγγελίας **ιδιώτη** δεν έχει εταιρεία (Α14) και ο
 * **φωτογράφος** δεν είναι μέλος κανενός χώρου (Φ0.5) — το `withAuth` θα απαντούσε 401 ακριβώς στους δύο πληθυσμούς
 * που αυτές οι διαδρομές υπάρχουν για να εξυπηρετήσουν. Η εξουσιοδότηση **δεν** είναι του συνόρου: την κρίνουν οι
 * κριτές της περιήγησης (`mayManageTour` · `mayUploadTourCapture`) πάνω στη **ρίζα**, ποτέ σε `tourId` του πελάτη.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { isPlaceSource } from '@/constants/place-sources';
import { actorWorkspace, listingActorOf, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { decodeRouteParam } from '@/lib/routes/route-param';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import type { TourAccessRefused } from '@/server/spatial-tour/tour-access-shared';
import type { TourUploadRefusal } from '@/server/spatial-tour/tour-capture-upload';
import type { TourSubject } from '@/types/spatial-tour';

/** Τα τμήματα κάθε διαδρομής κάτω από `spatial-tours/[kind]/[subjectId]`. */
export type TourSegment = { params: Promise<{ kind: string; subjectId: string }> };

/**
 * **Ο δράστης της περιήγησης από το σύνορο** — όψη χώρου (`listingActorOf`, ο ΕΝΑΣ μεταφραστής) + όψη ρόλου.
 * 🔑 Ο προσωπικός χώρος **δεν** έχει ρόλο εταιρείας: `companyId: null` ⇒ ο κριτής ρόλων αρνείται κάθε εταιρική
 * αγγελία (ίδιο δόγμα με το `personalContainerActorOf`, ADR-866 Ε-Φ0-1).
 */
export function tourActorOf(actor: ApiActor): TourActor {
  return {
    listing: listingActorOf(actor),
    capability: {
      globalRole: actor.ctx.globalRole,
      permissions: actor.ctx.permissions ?? null,
      companyId: actorWorkspace(actor),
    },
  };
}

/** **Η ρίζα από τη διαδρομή** — `null` ⇒ άγνωστο είδος ή κενό id (ο καλών απαντά 400, ποτέ 500). */
export async function readTourSubject(segment: TourSegment | undefined): Promise<TourSubject | null> {
  if (!segment) return null;
  const { kind, subjectId } = await segment.params;
  const decodedKind = decodeRouteParam(kind);
  const id = decodeRouteParam(subjectId).trim();
  if (!isPlaceSource(decodedKind) || id.length === 0) return null;
  return { kind: decodedKind, id };
}

/**
 * **Η ρίζα ΚΑΙ μία εμφωλευμένη παράμετρος** (`invitationId` · `granteeUid`) — `null` ⇒ 400. Ένας δρόμος για κάθε
 * διαδρομή με δεύτερο τμήμα, ώστε κανένα τμήμα να μη διαβαστεί ποτέ με ωμό `decodeURIComponent`.
 */
export async function readTourSubjectWith<P extends string>(
  segment: { params: Promise<{ kind: string; subjectId: string } & Record<P, string>> } | undefined,
  param: P,
): Promise<{ readonly subject: TourSubject; readonly value: string } | null> {
  const subject = await readTourSubject(segment);
  if (subject === null || !segment) return null;
  const value = decodeRouteParam((await segment.params)[param]).trim();
  return value.length === 0 ? null : { subject, value };
}

/**
 * **Ένα ερώτημα του υπευθύνου/φωτογράφου πάνω σε μία ρίζα** — ρίζα → υπηρεσία → άρνηση με όνομα ή σώμα. Ο ΕΝΑΣ
 * σκελετός για τις λίστες (προσκλήσεις · άδειες · λήψεις), ώστε η σειρά «πρώτα η ρίζα, μετά ο κριτής της
 * υπηρεσίας» να μη γράφεται τρεις φορές.
 */
export async function tourSubjectResponse<R extends { readonly kind: string }, B>(
  segment: TourSegment | undefined,
  actor: ApiActor,
  run: (db: Firestore, input: { readonly subject: TourSubject; readonly actor: TourActor }) => Promise<R | TourAccessRefused>,
  ok: (result: R) => B,
): Promise<NextResponse<TourSubjectBody<B>>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const result = await run(getAdminFirestore(), { subject, actor: tourActorOf(actor) });
  if (isTourAccessRefused(result)) return tourRefusedResponse(result.reason);
  return NextResponse.json(ok(result));
}

function isTourAccessRefused(value: { readonly kind: string }): value is TourAccessRefused {
  return value.kind === 'refused';
}

/**
 * **Άρνηση → κωδικός HTTP** — `Record`: νέα άρνηση **δεν μεταγλωττίζεται** μέχρι να αποκτήσει σημασία στο δίκτυο.
 * Ο λόγος **ταξιδεύει** στο σώμα: κάθε άρνηση στέλνει τον άνθρωπο σε **άλλη** ενέργεια (ADR-853 §5 #7).
 */
export const STATUS_BY_TOUR_REFUSAL: Readonly<Record<TourUploadRefusal, number>> = {
  'tour-absent': 404,
  'not-requestable': 409,
  'not-manager': 403,
  'expiry-required': 422,
  'expiry-past': 422,
  'expiry-too-far': 422,
  'request-absent': 404,
  'not-pending': 409,
  'not-active': 409,
  'reason-required': 422,
  'grant-absent': 404,
  /** Η αγγελία άλλαξε χέρια — ο κόσμος άλλαξε, όχι το αίτημα. */
  'tour-custody-mismatch': 409,
  /** Έγγραφο που δεν καταλάβαμε — **δικό μας** πρόβλημα, όχι του ανθρώπου. */
  'tour-unreadable': 503,
  // ── Ο κριτής ανεβάσματος: ο φωτογράφος ξέρει αν ζητήσει ΝΕΑ πρόσκληση ──────
  'no-capture-grant': 403,
  'revoked': 403,
  'expired': 403,
  'unreadable-expiry': 403,
  'scope-missing': 403,
  // ── Τα bytes ─────────────────────────────────────────────────────────────
  'not-jpeg': 415,
  'too-large': 413,
  'not-equirect': 422,
  'too-small': 422,
  'wrong-projection': 422,
  // ── Η ροή ανεβάσματος ────────────────────────────────────────────────────
  'ticket-invalid': 422,
  'ticket-foreign': 403,
  'upload-missing': 409,
  'upload-incomplete': 409,
  'declaration-invalid': 400,
};

export type TourRefusedBody = { readonly error: 'TOUR_REFUSED'; readonly reason: TourUploadRefusal };

/** Το σώμα μιας διαδρομής πάνω σε ρίζα: η επιτυχία `B`, ή κακή ρίζα, ή ονομασμένη άρνηση. */
export type TourSubjectBody<B> = B | TourBadSubjectBody | TourRefusedBody;

export function tourRefusedResponse(reason: TourUploadRefusal): NextResponse<TourRefusedBody> {
  return NextResponse.json({ error: 'TOUR_REFUSED', reason } as const, { status: STATUS_BY_TOUR_REFUSAL[reason] });
}

/** **«Δεν μπόρεσα»** — ποτέ ονομασμένη άρνηση (μυστικό που λείπει · αποθήκευση · Firestore). */
export type TourUnavailableBody = { readonly error: 'TOUR_UNAVAILABLE' };

export function tourUnavailableResponse(): NextResponse<TourUnavailableBody> {
  return NextResponse.json({ error: 'TOUR_UNAVAILABLE' } as const, { status: 503 });
}

/** Η ρίζα της διαδρομής δεν διαβάζεται — **σφάλμα αιτήματος**. */
export type TourBadSubjectBody = { readonly error: 'TOUR_SUBJECT_INVALID' };

export function tourBadSubjectResponse(): NextResponse<TourBadSubjectBody> {
  return NextResponse.json({ error: 'TOUR_SUBJECT_INVALID' } as const, { status: 400 });
}
