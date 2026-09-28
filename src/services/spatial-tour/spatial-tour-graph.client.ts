/**
 * @fileoverview **Η ΚΛΗΣΗ ΤΟΥ ΓΡΑΦΟΥ ΑΠΟ ΤΗΝ ΟΘΟΝΗ** — τοποθέτηση/αφαίρεση λήψης, βελάκι, αποσύνδεση (ADR-884 Φ2δ · §4.10).
 * @related `spatial-tour.client.ts` (`tourCall` — ο ΕΝΑΣ αναγνώστης αποτυχιών) ·
 *   `app/api/spatial-tours/[kind]/[subjectId]/graph/route.ts` · `lib/spatial-tour/tour-graph-edit.ts` (`TourGraphCommand`)
 * @module services/spatial-tour/spatial-tour-graph.client
 *
 * 🔑 **Κανένα `Idempotency-Key` εδώ**: ο μεταφορέας (`api-client-transport.ts`) κόβει **ένα** κλειδί ανά λογική κλήση
 * και το ξαναστέλνει σε κάθε επανάληψη — ένα «νέο σημείο» που ξαναστέλνεται από το δίκτυο παίρνει την **ίδια** απάντηση.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { TourGraphCommand, TourGraphEditResponse, TourPlanCandidate } from '@/lib/spatial-tour/tour-graph-edit';
import type { TourSubject } from '@/types/spatial-tour';

import { tourCall, type TourCallResult } from './spatial-tour.client';

export function editTourGraphFromScreen(
  subject: TourSubject,
  command: TourGraphCommand,
): Promise<TourCallResult<TourGraphEditResponse>> {
  return tourCall(() => apiClient.post<TourGraphEditResponse>(API_ROUTES.SPATIAL_TOURS.GRAPH(subject.kind, subject.id), command));
}

/** Οι κατόψεις του ακινήτου που μπορεί να πάρει η περιήγηση (Φ2στ-β · §4.13) — ό,τι θα δεχτεί και ο γραφέας. */
export function listTourPlanFilesFromScreen(subject: TourSubject): Promise<TourCallResult<{ readonly plans: readonly TourPlanCandidate[] }>> {
  return tourCall(() => apiClient.get<{ readonly plans: readonly TourPlanCandidate[] }>(API_ROUTES.SPATIAL_TOURS.FLOORPLANS(subject.kind, subject.id)));
}
