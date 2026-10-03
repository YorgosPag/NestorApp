/**
 * @fileoverview **ΟΙ ΚΛΗΣΕΙΣ ΤΗΣ ΡΟΗΣ ΦΩΤΟΓΡΑΦΟΥ ΑΠΟ ΤΗΝ ΟΘΟΝΗ** — ένας αναγνώστης αποτυχιών για όλες.
 * @related ADR-884 §4.5 (Κ3α) · `app/api/spatial-tours/**` · πρότυπο `services/workspace/workspace-invitation.client.ts`
 * @module services/spatial-tour/spatial-tour.client
 *
 * 🔑 **Τρεις εκβάσεις, κλειστό σύνολο**: `ok` · `refused` (ονομασμένη άρνηση του διακομιστή — η οθόνη λέει **τι να
 * κάνει** ο άνθρωπος) · `failed` (δίκτυο, 5xx, ή σώμα που δεν ονομάσαμε — γενικό μήνυμα). Κανένα `boolean`.
 * ⚠️ Τα email **δεν** κανονικοποιούνται εδώ — ο ΕΝΑΣ κανονικοποιητής ζει στον διακομιστή.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
// ⚠️ **TYPE-ONLY πέρα από το σύνορο του διακομιστή** — σβήνεται στη μεταγλώττιση (ζωντανό ιδίωμα του έργου).
import type { TourCaptureInvitationView } from '@/app/api/spatial-tours/[kind]/[subjectId]/capture-invitations/route';
import type { InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import type { TourCaptureGrantView } from '@/server/spatial-tour/tour-capture-invitation';
import {
  isTourGeneralRefusal,
  isTourRefusalName,
  type TourGeneralRefusal,
  type TourRefusalName,
} from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { CORE_INVITATION_REFUSALS, type InvitationCoreRefusal } from '@/types/invitation-core';
import type { CaptureLevelChoice } from '@/lib/spatial-tour/tour-capture-placement-hint';
import type { TourCapture, TourSubject } from '@/types/spatial-tour';

/**
 * `R` = το λεξιλόγιο αρνήσεων **της κλήσης** (AIP-193) — εξ ορισμού όλο **εκτός** του γραφέα σχημάτων (Γ3γ-1), στενότερο
 * όπου η λειτουργία το δηλώνει, πλήρες μόνο στον γράφο ({@link tourGraphCall}).
 */
export type TourCallResult<T, R extends TourRefusalName = TourGeneralRefusal> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'refused'; readonly reason: R }
  | { readonly kind: 'failed' };

/** **Ο ΕΝΑΣ αναγνώστης αποτυχιών** — το σώμα `TOUR_REFUSED` με **γνωστό** λόγο, ή τίποτα (γενικό μήνυμα). */
function refusalOf(cause: unknown): TourRefusalName | null {
  const body = apiErrorBodyOf(cause);
  if (body === null || body.error !== 'TOUR_REFUSED') return null;
  return isTourRefusalName(body.reason) ? body.reason : null;
}

function isInvitationCoreRefusal(value: unknown): value is InvitationCoreRefusal {
  return typeof value === 'string' && (CORE_INVITATION_REFUSALS as readonly string[]).includes(value);
}

/** Ολόκληρο το λεξιλόγιο — το {@link refusalOf} έχει ήδη απορρίψει κάθε άγνωστο λόγο. */
const anyTourRefusal = (_reason: TourRefusalName): _reason is TourRefusalName => true;

/** Η κλήση με **ρητό** συμβόλαιο αρνήσεων — λόγος εκτός συμβολαίου ⇒ `failed`. */
async function tourCallAs<T, R extends TourRefusalName>(
  request: () => Promise<T>,
  isContracted: (reason: TourRefusalName) => reason is R,
): Promise<TourCallResult<T, R>> {
  try {
    return { kind: 'ok', value: await request() };
  } catch (cause: unknown) {
    const reason = refusalOf(cause);
    return reason === null || !isContracted(reason) ? { kind: 'failed' } : { kind: 'refused', reason };
  }
}

/** **Η ΜΙΑ περιτύλιξη κλήσης** — την μοιράζονται η ροή φωτογράφου και η θέαση (`spatial-tour-viewing.client.ts`). */
export function tourCall<T>(request: () => Promise<T>): Promise<TourCallResult<T>> {
  return tourCallAs(request, isTourGeneralRefusal);
}

/** Η κλήση του **γράφου** — ο μόνος που μπορεί να πει και τις αρνήσεις σχημάτων (`TOUR_SHAPE_REFUSALS`, Γ3γ-1). */
export function tourGraphCall<T>(request: () => Promise<T>): Promise<TourCallResult<T, TourRefusalName>> {
  return tourCallAs(request, anyTourRefusal);
}

/**
 * **Στένωση στο λεξιλόγιο της λειτουργίας** — λόγος **εκτός** συμβολαίου ⇒ `failed` (γενικό μήνυμα), όπως κάθε άγνωστος
 * λόγος στο {@link refusalOf}: η οθόνη δεν ονομάζει ποτέ κάτι που η κλήση της δεν υπόσχεται.
 */
export function narrowTourRefusal<T, R extends TourRefusalName>(
  result: TourCallResult<T, TourRefusalName>,
  isContracted: (reason: TourRefusalName) => reason is R,
): TourCallResult<T, R> {
  if (result.kind !== 'refused') return result;
  return isContracted(result.reason) ? { kind: 'refused', reason: result.reason } : { kind: 'failed' };
}

/**
 * **Λίστα, ή «δεν υπάρχει ακόμη περιήγηση» = κενό** — `tour-absent` σε λίστα **δεν** είναι σφάλμα (η περιήγηση
 * γεννιέται με την πρώτη πράξη)· `null` ⇒ πραγματική αποτυχία (η οθόνη λέει «δεν φορτώθηκε», ποτέ κενή λίστα).
 */
export function tourListOrEmpty<T>(result: TourCallResult<readonly T[]>): readonly T[] | null {
  if (result.kind === 'ok') return result.value;
  return result.kind === 'refused' && result.reason === 'tour-absent' ? [] : null;
}

const routes = API_ROUTES.SPATIAL_TOURS;

// ── Ο υπεύθυνος ─────────────────────────────────────────────────────────────

export interface IssuedTourCaptureInvitation {
  readonly invitation: TourCaptureInvitationView;
  readonly supersededCount: number;
  /** ⚠️ `accepted` = «ο πάροχος το δέχτηκε», **όχι** «παραδόθηκε». */
  readonly delivery: InvitationNoticeOutcome;
}

/** Έκδοση **και** επαναποστολή (ίδια πράξη — η παλιά ανακαλείται στην ίδια συναλλαγή). */
export function issueTourCaptureInvitationFromScreen(
  subject: TourSubject,
  input: { readonly email: string; readonly grantExpiresOn: string; readonly reason: string },
): Promise<TourCallResult<IssuedTourCaptureInvitation>> {
  return tourCall(() => apiClient.post<IssuedTourCaptureInvitation>(routes.CAPTURE_INVITATIONS(subject.kind, subject.id), input));
}

export function listTourCaptureInvitationsFromScreen(subject: TourSubject): Promise<TourCallResult<readonly TourCaptureInvitationView[]>> {
  return tourCall(async () =>
    (await apiClient.get<{ invitations: readonly TourCaptureInvitationView[] }>(routes.CAPTURE_INVITATIONS(subject.kind, subject.id))).invitations);
}

/** Ανάκληση πρόσκλησης. Ήδη λυμένη ή ξένη ⇒ `failed` με ανανέωση λίστας (η οθόνη δείχνει την αλήθεια). */
export function revokeTourCaptureInvitationFromScreen(subject: TourSubject, invitationId: string): Promise<TourCallResult<null>> {
  return tourCall(async () => {
    await apiClient.post(routes.CAPTURE_INVITATION_REVOKE(subject.kind, subject.id, invitationId), {});
    return null;
  });
}

export function listTourCaptureGrantsFromScreen(subject: TourSubject): Promise<TourCallResult<readonly TourCaptureGrantView[]>> {
  return tourCall(async () =>
    (await apiClient.get<{ grants: readonly TourCaptureGrantView[] }>(routes.CAPTURE_GRANTS(subject.kind, subject.id))).grants);
}

export function revokeTourCaptureGrantFromScreen(subject: TourSubject, granteeUid: string): Promise<TourCallResult<null>> {
  return tourCall(async () => {
    await apiClient.post(routes.CAPTURE_GRANT_REVOKE(subject.kind, subject.id, granteeUid), {});
    return null;
  });
}

/**
 * Τα εισερχόμενα — με τους ορόφους της περιήγησης, ώστε η πρόταση θέσης να λέει αν ο όροφος υπάρχει (ADR-904 Κ8) και να δείχνει
 * το σημείο πάνω στη βαθμονομημένη κάτοψη (Κ9).
 */
export interface TourCapturesListing {
  readonly captures: readonly TourCapture[];
  readonly asManager: boolean;
  readonly levels: readonly CaptureLevelChoice[];
}

/** **Τα bytes μιας βαθμονομημένης κάτοψης** (ADR-904 Κ9) — η ίδια διαδρομή με την εφαρμογή κινητού, αμετάβλητη ανά hash. */
export function fetchCapturePlanImageFromScreen(subject: TourSubject, contentHash: string): Promise<TourCallResult<Blob>> {
  return tourCall(() => apiClient.get<Blob>(routes.CAPTURE_PLAN(subject.kind, subject.id, contentHash), { responseType: 'blob' }));
}

export function listTourCapturesFromScreen(
  subject: TourSubject,
): Promise<TourCallResult<TourCapturesListing>> {
  return tourCall(() => apiClient.get<TourCapturesListing>(routes.CAPTURES(subject.kind, subject.id)));
}

// ── Το ανέβασμα (υπεύθυνος ΚΑΙ φωτογράφος) ─────────────────────────────────

export interface StartedTourUpload {
  readonly uploadId: string;
  readonly ticket: string;
  /** ⛔ Κλειδί εγγραφής — ποτέ σε log, ποτέ σε αποθήκευση. */
  readonly sessionUri: string;
  readonly expiresAt: string;
}

export function startTourUploadFromScreen(
  subject: TourSubject,
  input: { readonly contentType: string; readonly contentLength: number },
): Promise<TourCallResult<StartedTourUpload>> {
  return tourCall(() => apiClient.post<StartedTourUpload>(routes.UPLOADS(subject.kind, subject.id), input));
}

export function finalizeTourUploadFromScreen(
  subject: TourSubject,
  input: { readonly ticket: string; readonly declaration: unknown },
): Promise<TourCallResult<{ readonly capture: TourCapture; readonly replayed: boolean }>> {
  return tourCall(() => apiClient.post<{ capture: TourCapture; replayed: boolean }>(routes.UPLOADS_FINALIZE(subject.kind, subject.id), input));
}

// ── Ο φωτογράφος: η απάντηση στην πρόσκληση ────────────────────────────────

export type TourInvitationRedeemResult =
  | { readonly kind: 'accepted' | 'declined' }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'failed' };

export async function redeemTourCaptureInvitationFromScreen(
  token: string,
  action: 'accept' | 'decline',
): Promise<TourInvitationRedeemResult> {
  try {
    const body = await apiClient.post<{ status: 'accepted' | 'declined' }>(routes.REDEEM, { token, action });
    return { kind: body.status };
  } catch (cause: unknown) {
    const body = apiErrorBodyOf(cause);
    const reason = body?.error === 'LINK_REFUSED' ? body.reason : null;
    return isInvitationCoreRefusal(reason) ? { kind: 'refused', reason } : { kind: 'failed' };
  }
}
