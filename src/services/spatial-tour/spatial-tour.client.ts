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
import { isTourRefusalName, type TourRefusalName } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { CORE_INVITATION_REFUSALS, type InvitationCoreRefusal } from '@/types/invitation-core';
import type { TourCapture, TourSubject } from '@/types/spatial-tour';

export type TourCallResult<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'refused'; readonly reason: TourRefusalName }
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

async function call<T>(request: () => Promise<T>): Promise<TourCallResult<T>> {
  try {
    return { kind: 'ok', value: await request() };
  } catch (cause: unknown) {
    const reason = refusalOf(cause);
    return reason === null ? { kind: 'failed' } : { kind: 'refused', reason };
  }
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
  input: { readonly email: string; readonly grantExpiresAt: string; readonly reason: string },
): Promise<TourCallResult<IssuedTourCaptureInvitation>> {
  return call(() => apiClient.post<IssuedTourCaptureInvitation>(routes.CAPTURE_INVITATIONS(subject.kind, subject.id), input));
}

export function listTourCaptureInvitationsFromScreen(subject: TourSubject): Promise<TourCallResult<readonly TourCaptureInvitationView[]>> {
  return call(async () =>
    (await apiClient.get<{ invitations: readonly TourCaptureInvitationView[] }>(routes.CAPTURE_INVITATIONS(subject.kind, subject.id))).invitations);
}

/** Ανάκληση πρόσκλησης. Ήδη λυμένη ή ξένη ⇒ `failed` με ανανέωση λίστας (η οθόνη δείχνει την αλήθεια). */
export function revokeTourCaptureInvitationFromScreen(subject: TourSubject, invitationId: string): Promise<TourCallResult<null>> {
  return call(async () => {
    await apiClient.post(routes.CAPTURE_INVITATION_REVOKE(subject.kind, subject.id, invitationId), {});
    return null;
  });
}

export function listTourCaptureGrantsFromScreen(subject: TourSubject): Promise<TourCallResult<readonly TourCaptureGrantView[]>> {
  return call(async () =>
    (await apiClient.get<{ grants: readonly TourCaptureGrantView[] }>(routes.CAPTURE_GRANTS(subject.kind, subject.id))).grants);
}

export function revokeTourCaptureGrantFromScreen(subject: TourSubject, granteeUid: string): Promise<TourCallResult<null>> {
  return call(async () => {
    await apiClient.post(routes.CAPTURE_GRANT_REVOKE(subject.kind, subject.id, granteeUid), {});
    return null;
  });
}

export function listTourCapturesFromScreen(
  subject: TourSubject,
): Promise<TourCallResult<{ readonly captures: readonly TourCapture[]; readonly asManager: boolean }>> {
  return call(() => apiClient.get<{ captures: readonly TourCapture[]; asManager: boolean }>(routes.CAPTURES(subject.kind, subject.id)));
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
  return call(() => apiClient.post<StartedTourUpload>(routes.UPLOADS(subject.kind, subject.id), input));
}

export function finalizeTourUploadFromScreen(
  subject: TourSubject,
  input: { readonly ticket: string; readonly declaration: unknown },
): Promise<TourCallResult<{ readonly capture: TourCapture; readonly replayed: boolean }>> {
  return call(() => apiClient.post<{ capture: TourCapture; replayed: boolean }>(routes.UPLOADS_FINALIZE(subject.kind, subject.id), input));
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
