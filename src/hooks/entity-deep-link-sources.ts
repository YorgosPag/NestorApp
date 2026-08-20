/**
 * =============================================================================
 * ΠΗΓΕΣ ΕΦΕΔΡΙΚΗΣ ΕΠΙΛΥΣΗΣ — μία ανά οντότητα (ADR-777 §8.31)
 * =============================================================================
 *
 * *«Ζητήθηκε αυτή η ταυτότητα και δεν είναι στη φορτωμένη λίστα — υπάρχει;»*
 *
 * ⚠️ **ΚΑΘΕ πηγή εδώ ΠΡΕΠΕΙ να ελέγχει εταιρεία.** Οι διαδρομές που
 * χρησιμοποιούνται περνούν από `requireStorageInTenant` /
 * `requireParkingInTenant` / `loadOwnedBuilding`, και το «δεν βρέθηκε» με το
 * «δεν είναι δικό σου» είναι **το ίδιο** σφάλμα — αλλιώς μπορεί κανείς να
 * απαριθμήσει ξένες ταυτότητες ρωτώντας τη μία μετά την άλλη.
 *
 * ⛔ **ΜΗΝ χρησιμοποιήσεις το `getStorageUnitById`** (`services/storage.service.ts`):
 * Admin SDK με σκέτο `db.collection(...).doc(id).get()`, **κανέναν** έλεγχο
 * `companyId`, και το Admin SDK **παρακάμπτει** τους κανόνες Firestore ⇒
 * διαρροή μεταξύ εταιρειών αν κληθεί από οθόνη (CHECK 3.35).
 *
 * 🔑 **Σταθερή ταυτότητα, επίτηδες σε επίπεδο module**: το
 * `useEntityFallbackResolution` τις έχει στις εξαρτήσεις μιας `useEffect`.
 * Συνάρτηση φτιαγμένη μέσα σε render θα γεννούσε **νέο αίτημα σε κάθε απόδοση**.
 *
 * @module hooks/entity-deep-link-sources
 * @enterprise ADR-777 §8.31
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { isTrashed } from '@/lib/firestore/trashed-status';
import type { Building } from '@/types/building/contracts';
import type { Storage } from '@/types/storage/contracts';
import type { ParkingSpot } from './useFirestoreParkingSpots';

const resolveOne = async <T>(url: string): Promise<T | null> =>
  (await apiClient.get<T>(url)) ?? null;

/** `GET /api/storages/:id` — φύλακας `requireStorageInTenant`. */
export const resolveStorageById = (id: string): Promise<Storage | null> =>
  resolveOne<Storage>(API_ROUTES.STORAGES.BY_ID(id));

/** `GET /api/parking/:id` — φύλακας `requireParkingInTenant`. */
export const resolveParkingById = (id: string): Promise<ParkingSpot | null> =>
  resolveOne<ParkingSpot>(API_ROUTES.PARKING.BY_ID(id));

/** `GET /api/buildings/:id` — φύλακας `loadOwnedBuilding` (ADR-777 §8.31). */
export const resolveBuildingById = (id: string): Promise<Building | null> =>
  resolveOne<Building>(API_ROUTES.BUILDINGS.BY_ID(id));

/**
 * Ό,τι έφερε η εφεδρεία δεν ξέρει από ποια λίστα προήλθε — το κρίνει η **μορφή**
 * του. Οι διαδρομές επιστρέφουν **και** τα αρχειοθετημένα επίτηδες, ώστε ο
 * σύνδεσμος να καταλήγει σε **πανό επαναφοράς** αντί για «δεν βρέθηκε».
 */
export const isArchivedEntity = (entity: { readonly status?: string | null }): boolean =>
  isTrashed(entity);
