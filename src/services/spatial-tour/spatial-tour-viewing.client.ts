/**
 * @fileoverview **ΟΙ ΚΛΗΣΕΙΣ ΤΗΣ ΘΕΑΣΗΣ ΑΠΟ ΤΗΝ ΟΘΟΝΗ** — ρυθμίσεις · αιτήματα · συνεδρία θέασης · παρουσία (ADR-884 Κ3β).
 * @related `spatial-tour.client.ts` (ο ΕΝΑΣ αναγνώστης αποτυχιών, `tourCall`) · `app/api/spatial-tours/**`
 * @module services/spatial-tour/spatial-tour-viewing.client
 *
 * 🔑 Ίδιες τρεις εκβάσεις με τη ροή φωτογράφου (`ok` · `refused` · `failed`) — **ίδιος** κώδικας (`tourCall`), όχι
 * αντίγραφο. Οι σύνδεσμοι `link-only` περνούν από την **πρόσοψη κοινοποιήσεων** (`UnifiedSharingService`), όχι από εδώ.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
// ⚠️ **TYPE-ONLY πέρα από το σύνορο του διακομιστή** — σβήνεται στη μεταγλώττιση (ζωντανό ιδίωμα του έργου).
import type { MyTourAccessView } from '@/app/api/spatial-tours/[kind]/[subjectId]/my-access/route';
import type { TourViewSessionView } from '@/app/api/spatial-tours/_shared/tour-view-route';
import type { TourAccessContactOutcome } from '@/server/spatial-tour/tour-access-contact';
import type { TourAccessInboxRow } from '@/server/spatial-tour/tour-access-inbox';
import type { TourPresence } from '@/server/spatial-tour/tour-presence';
import type { TourSettings } from '@/server/spatial-tour/tour-settings';
import type { TourAccessRequestState } from '@/constants/spatial-tour-vocabulary';
import type { TourRefusalName } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import type { TourSubject } from '@/types/spatial-tour';

import { tourCall, type TourCallResult } from './spatial-tour.client';

const routes = API_ROUTES.SPATIAL_TOURS;

// ── Ο υπεύθυνος: ρυθμίσεις ─────────────────────────────────────────────────

export function readTourSettingsFromScreen(
  subject: TourSubject,
): Promise<TourCallResult<{ readonly tourId: string; readonly settings: TourSettings; readonly exists: boolean }>> {
  return tourCall(() => apiClient.get<{ tourId: string; settings: TourSettings; exists: boolean }>(routes.SETTINGS(subject.kind, subject.id)));
}

export function updateTourSettingsFromScreen(
  subject: TourSubject,
  settings: TourSettings,
): Promise<TourCallResult<{ readonly settings: TourSettings; readonly changed: boolean }>> {
  return tourCall(() => apiClient.patch<{ settings: TourSettings; changed: boolean }>(routes.SETTINGS(subject.kind, subject.id), settings));
}

// ── Ο υπεύθυνος: αιτήματα θέασης ───────────────────────────────────────────

export function listTourAccessRequestsFromScreen(
  subject: TourSubject,
  state: TourAccessRequestState,
): Promise<TourCallResult<readonly TourAccessInboxRow[]>> {
  const url = `${routes.ACCESS_REQUESTS(subject.kind, subject.id)}?state=${encodeURIComponent(state)}`;
  return tourCall(async () => (await apiClient.get<{ requests: readonly TourAccessInboxRow[] }>(url)).requests);
}

/** Αποτέλεσμα **ανά άνθρωπο** — ένας που αποσύρθηκε στο μεταξύ δεν ρίχνει τους άλλους. */
export type TourDecisionRow =
  | { readonly requesterUid: string; readonly kind: 'decided'; readonly state: 'approved' | 'declined'; readonly contact: TourAccessContactOutcome; readonly expiresAt: string | null }
  | { readonly requesterUid: string; readonly kind: 'refused'; readonly reason: TourRefusalName };

export function decideTourAccessFromScreen(
  subject: TourSubject,
  input: { readonly requesterUids: readonly string[]; readonly decision: 'approved' | 'declined'; readonly expiresAt: string | null },
): Promise<TourCallResult<readonly TourDecisionRow[]>> {
  return tourCall(async () =>
    (await apiClient.post<{ results: readonly TourDecisionRow[] }>(routes.ACCESS_REQUESTS(subject.kind, subject.id), input)).results);
}

export function revokeTourAccessFromScreen(subject: TourSubject, requesterUid: string): Promise<TourCallResult<null>> {
  return tourCall(async () => {
    await apiClient.post(routes.ACCESS_REQUEST_REVOKE(subject.kind, subject.id, requesterUid), {});
    return null;
  });
}

// ── Ο αιτών ─────────────────────────────────────────────────────────────────

export function readMyTourAccessFromScreen(subject: TourSubject): Promise<TourCallResult<MyTourAccessView>> {
  return tourCall(() => apiClient.get<MyTourAccessView>(routes.MY_ACCESS(subject.kind, subject.id)));
}

export function requestTourAccessFromScreen(subject: TourSubject, message: string | null): Promise<TourCallResult<MyTourAccessView>> {
  return tourCall(() => apiClient.post<MyTourAccessView>(routes.MY_ACCESS(subject.kind, subject.id), { message }));
}

export function withdrawTourAccessFromScreen(subject: TourSubject): Promise<TourCallResult<null>> {
  return tourCall(async () => {
    await apiClient.delete(routes.MY_ACCESS(subject.kind, subject.id));
    return null;
  });
}

// ── Θέαση ───────────────────────────────────────────────────────────────────

/**
 * **Άνοιξε επίσκεψη** — `signedIn` διαλέγει πόρτα (με λογαριασμό: υπεύθυνος/εγκεκριμένος· χωρίς: δημόσιο/σύνδεσμος).
 * `shareId` μόνο από τη σελίδα `/shared/[token]` — μετρά αν ο browser φέρει το κουπόνι επίσκεψης του συνδέσμου.
 */
export function openTourViewSessionFromScreen(
  subject: TourSubject,
  input: { readonly signedIn: boolean; readonly shareId: string | null },
): Promise<TourCallResult<TourViewSessionView>> {
  const base = routes.VIEW_SESSION(subject.kind, subject.id);
  return tourCall(() => apiClient.post<TourViewSessionView>(input.signedIn ? base : `${base}/public`, { shareId: input.shareId }));
}

/** Δημόσιο: έχει η αγγελία περιήγηση που φαίνεται; */
export function readTourPresenceFromScreen(listingId: string): Promise<TourCallResult<TourPresence | null>> {
  return tourCall(async () => (await apiClient.get<{ tour: TourPresence | null }>(routes.LISTING_PRESENCE(listingId))).tour);
}
