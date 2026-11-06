'use client';

/**
 * ADR-929 Φ5.3β — ο **πελάτης** των διαδρομών ανάγνωσης κάτοψης: προέλεγχος (Φ5.3α) και αποστολή (Φ3). Λεπτό περιτύλιγμα
 * πάνω στο `apiClient` (πρότυπο `floorplan-background-api-client.ts`): ταυτοποίηση, `Idempotency-Key` σε κάθε POST
 * (ADR-853/872, άρα μια αυτόματη επανάληψη δεν ξαναπληρώνει), σεβασμός του `Retry-After` στο 503 «τρέχει ήδη».
 *
 * 🔑 Τα σχήματα ζουν στο **ένα** συμβόλαιο (`plan-reading-contract.ts`), τα ονόματα πεδίων του multipart επίσης.
 *
 * @see ../../bim/plan-recognition/reading/plan-reading-contract.ts
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import {
  PLAN_READING_IMAGE_FIELD,
  PLAN_READING_REQUEST_FIELD,
  type PlanReadingPreflightRequest,
  type PlanReadingPreflightResponse,
  type PlanReadingPreflightResult,
  type PlanReadingRequest,
  type PlanReadingRouteResponse,
  type PlanReadingRouteResult,
} from '../../bim/plan-recognition/reading/plan-reading-contract';

/** Οι δύο ερωτήσεις προς τον διακομιστή — θύρα, ώστε ο ελεγκτής να δοκιμάζεται χωρίς δίκτυο. */
export interface PlanReadingApi {
  readonly preflight: (backgroundId: string, body: PlanReadingPreflightRequest) => Promise<PlanReadingPreflightResult>;
  readonly read: (backgroundId: string, image: Blob, request: PlanReadingRequest) => Promise<PlanReadingRouteResult>;
}

export const planReadingApi: PlanReadingApi = {
  async preflight(backgroundId, body) {
    const route = API_ROUTES.FLOORPLAN_BACKGROUNDS.PLAN_READING_PREFLIGHT(encodeURIComponent(backgroundId));
    const response = await apiClient.post<PlanReadingPreflightResponse>(route, body);
    return response.result;
  },

  async read(backgroundId, image, request) {
    const form = new FormData();
    // Το ΙΔΙΟ Blob που έγινε μικρογραφία και sha256 — κανένα αντίγραφο, καμία επανακωδικοποίηση.
    form.set(PLAN_READING_IMAGE_FIELD, image);
    form.set(PLAN_READING_REQUEST_FIELD, JSON.stringify(request));
    const route = API_ROUTES.FLOORPLAN_BACKGROUNDS.PLAN_READING(encodeURIComponent(backgroundId));
    const response = await apiClient.post<PlanReadingRouteResponse>(route, form);
    return response.result;
  },
};
