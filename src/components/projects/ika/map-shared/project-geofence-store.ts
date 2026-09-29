/**
 * =============================================================================
 * Project Geofence Store — ΜΙΑ αλήθεια για τη ζώνη εργοταξίου ανά έργο
 * =============================================================================
 *
 * 🔴 **ΤΙ ΗΤΑΝ ΠΡΙΝ, ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-09-29 (ADR-891 §10.3).** Οι δύο χάρτες του
 * «Παρουσιολογίου» διάβαζαν το **ίδιο** `GET /api/attendance/geofence` από **δύο** hooks,
 * με **δύο** ανεξάρτητες stale caches (`geofence-config` · `project-live-worker-map`).
 * Αποθήκευση ζώνης στον `GeofenceConfigMap` ⇒ ο `LiveWorkerMap` **στην ίδια οθόνη** έμενε
 * χωρίς κύκλο μέχρι να ξαναφορτωθεί η σελίδα· και η cache του ίδιου του επεξεργαστή δεν
 * ενημερωνόταν ποτέ με την αποθήκευση.
 *
 * ✅ **ΤΩΡΑ.** Ένα κατάστημα (`createExternalStore`, το SSoT pub/sub της εφαρμογής):
 * - **Stale-while-revalidate**: ζει σε module scope ⇒ επιβιώνει της πλοήγησης (ADR-300).
 * - **Ένα αίτημα ανά έργο**: παράλληλοι αναγνώστες μοιράζονται την ίδια υπόσχεση.
 * - **Η αποθήκευση δημοσιεύει**: ο γραφέας γράφει την απάντηση του διακομιστή εδώ, και κάθε
 *   αναγνώστης αντιδρά αμέσως.
 * - **Κανένα μπαγιάτικο GET δεν νικά μια εγγραφή**: κάθε δημοσίευση ανεβάζει την εποχή του
 *   έργου· ένα GET που ξεκίνησε πριν απορρίπτει το αποτέλεσμά του.
 *
 * `undefined` = «δεν έχει φορτωθεί» · `null` = «φορτώθηκε, δεν υπάρχει ζώνη».
 *
 * @module components/projects/ika/map-shared/project-geofence-store
 * @enterprise ADR-170 — QR Code + GPS Geofencing · ADR-891 §10.3
 */

import { useEffect, useSyncExternalStore } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { createExternalStore } from '@/lib/state/createExternalStore';
import type { GeofenceConfig } from '../contracts';
import type { GeofenceApiResponse } from './geofence-api-types';

type GeofenceByProject = Readonly<Record<string, GeofenceConfig | null>>;

const store = createExternalStore<GeofenceByProject>({});
const inFlight = new Map<string, Promise<void>>();
const epochs = new Map<string, number>();

function isLoaded(projectId: string): boolean {
  return store.get()[projectId] !== undefined;
}

function write(projectId: string, geofence: GeofenceConfig | null): void {
  store.set({ ...store.get(), [projectId]: geofence });
}

/** Ο γραφέας (αποθήκευση) δημοσιεύει την απάντηση του διακομιστή — νικά κάθε GET σε πτήση. */
export function publishProjectGeofence(projectId: string, geofence: GeofenceConfig | null): void {
  epochs.set(projectId, (epochs.get(projectId) ?? 0) + 1);
  write(projectId, geofence);
}

async function fetchGeofence(projectId: string): Promise<GeofenceConfig | null> {
  const res = await fetch(`${API_ROUTES.ATTENDANCE.GEOFENCE}?projectId=${encodeURIComponent(projectId)}`);
  const data = (await res.json()) as GeofenceApiResponse;
  if (!data.success) throw new Error(data.error ?? 'geofence read failed');
  return data.geofence;
}

/** Σιωπηλή επαναφόρτωση· ιδεμποτική (ένα αίτημα σε πτήση ανά έργο). */
export function revalidateProjectGeofence(projectId: string): Promise<void> {
  const pending = inFlight.get(projectId);
  if (pending) return pending;

  const startEpoch = epochs.get(projectId) ?? 0;
  const run = fetchGeofence(projectId)
    .then((geofence) => {
      if ((epochs.get(projectId) ?? 0) === startEpoch) write(projectId, geofence);
    })
    .catch(() => {
      // Ο χάρτης δουλεύει και χωρίς ζώνη· ΠΟΤΕ δεν σβήνουμε γνωστή τιμή λόγω σφάλματος δικτύου.
      if (!isLoaded(projectId)) write(projectId, null);
    })
    .finally(() => {
      inFlight.delete(projectId);
    });

  inFlight.set(projectId, run);
  return run;
}

export interface ProjectGeofenceState {
  readonly geofence: GeofenceConfig | null;
  readonly hasLoaded: boolean;
}

/** Ο αναγνώστης: τιμή από το κατάστημα αμέσως, επαναφόρτωση στο παρασκήνιο. */
export function useProjectGeofence(projectId: string): ProjectGeofenceState {
  const byProject = useSyncExternalStore(store.subscribe, store.get, store.get);

  useEffect(() => {
    void revalidateProjectGeofence(projectId);
  }, [projectId]);

  const entry = byProject[projectId];
  return { geofence: entry ?? null, hasLoaded: entry !== undefined };
}

/** Μόνο για tests: καθαρό κατάστημα, χωρίς ειδοποίηση. */
export function resetProjectGeofenceStoreForTests(): void {
  store.reset({});
  inFlight.clear();
  epochs.clear();
}
