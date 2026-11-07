/**
 * ADR-933 — Η ΜΙΑ πόρτα «αυτό το πολύγωνο γίνεται περιοχή κάτοψης».
 *
 * Κάθε μέθοδος γεωμετρίας της εντολής «Περιοχή» (πολυγωνική · ορθογώνια · κλικ μέσα · από
 * επιλογή) καταλήγει ΕΔΩ — ώστε έλεγχος επιπέδου, είδος, ιδεμποτία, αποθήκευση και γεγονότα να
 * υπάρχουν μία φορά. Πριν, η λογική ζούσε μέσα στο `usePolygonCompletion` και ήξερε μόνο το
 * χειροκίνητο πολύγωνο.
 *
 * Το είδος διαβάζεται τη στιγμή της αποθήκευσης από το `overlayDrawSettingsStore` (ADR-040
 * κανόνας 2: getter τη στιγμή του γεγονότος, ποτέ στιγμιότυπο από render).
 *
 * Ιδεμποτία (Google N.7.2 #3): αν στο ίδιο επίπεδο υπάρχει ήδη περιοχή που είναι γεωμετρικά η
 * ΙΔΙΑ (εμβαδόν ±1% και το κέντρο βάρους της νέας μέσα στην παλιά), δεν γράφεται δεύτερη —
 * επιλέγεται η υπάρχουσα. Το «κλικ μέσα» σε ήδη ορισμένο δωμάτιο είναι το συνηθισμένο σενάριο.
 */

import { polygonArea, pointInPolygon } from '@/lib/geometry/planar-polygon';
import { polygonAreaCentroid } from '../bim/geometry/shared/polygon-utils';
import { OverlayPersistBlockedError } from './overlay-drawing-readiness';
import { overlayDrawSettingsStore } from '../stores/overlay-draw-settings-store';
import type { Overlay, CreateOverlayData } from './types';
import type { DrawingEventMap } from '../systems/events/drawing-event-map';

/** Σχετική ανοχή εμβαδού για «η ίδια περιοχή». */
export const EQUIVALENT_AREA_TOLERANCE = 0.01;

type Ring = ReadonlyArray<readonly [number, number]>;

export interface CommitOverlayPolygonDeps {
  readonly levelId: string | null | undefined;
  /**
   * Ο γραφέας του overlay store (`overlayStore.add`, που περνά από το readiness SSoT και
   * παράγει enterprise ID — ADR-921). Εγχέεται ως συνάρτηση: η πόρτα δεν ξέρει Firestore.
   */
  readonly createOverlay: (data: CreateOverlayData) => Promise<string>;
  readonly getLevelOverlays: (levelId: string) => Overlay[];
  readonly emit: <K extends 'overlay:polygon-saved' | 'overlay:save-error'>(
    event: K,
    payload: DrawingEventMap[K],
  ) => void;
}

export type CommitOverlayPolygonResult =
  | { readonly ok: true; readonly overlayId: string; readonly reused: boolean }
  | { readonly ok: false };

const toPoints = (ring: Ring) => ring.map(([x, y]) => ({ x, y }));

/** Η υπάρχουσα περιοχή του επιπέδου που είναι γεωμετρικά ίδια με το `polygon`, αν υπάρχει. */
export function findEquivalentOverlay(polygon: Ring, existing: readonly Overlay[]): Overlay | null {
  const points = toPoints(polygon);
  const area = polygonArea(points);
  if (area <= 0) return null;
  const centroid = polygonAreaCentroid(points);
  for (const overlay of existing) {
    const otherPoints = toPoints(overlay.polygon);
    const otherArea = polygonArea(otherPoints);
    if (otherArea <= 0) continue;
    const relativeDiff = Math.abs(area - otherArea) / Math.max(area, otherArea);
    if (relativeDiff <= EQUIVALENT_AREA_TOLERANCE && pointInPolygon(centroid, otherPoints)) return overlay;
  }
  return null;
}

export async function commitOverlayPolygon(
  polygon: Ring,
  deps: CommitOverlayPolygonDeps,
): Promise<CommitOverlayPolygonResult> {
  if (polygon.length < 3) return { ok: false };
  const { levelId } = deps;
  if (!levelId) {
    deps.emit('overlay:save-error', { reason: 'no-level' });
    return { ok: false };
  }

  const existing = findEquivalentOverlay(polygon, deps.getLevelOverlays(levelId));
  if (existing) {
    deps.emit('overlay:polygon-saved', { overlayId: existing.id, reused: true });
    return { ok: true, overlayId: existing.id, reused: true };
  }

  try {
    // ADR-258: το status δεν αποθηκεύεται — ο χρωματισμός έρχεται από τη συνδεδεμένη οντότητα.
    const overlayId = await deps.createOverlay({
      levelId,
      kind: overlayDrawSettingsStore.get().kind,
      polygon: polygon.map(([x, y]) => [x, y] as [number, number]),
      label: `Overlay ${Date.now()}`,
    });
    // ADR-258B: αυτόματη επιλογή ⇒ ανοίγει το πάνελ ιδιοτήτων για σύνδεση οντότητας.
    deps.emit('overlay:polygon-saved', { overlayId });
    return { ok: true, overlayId, reused: false };
  } catch (error) {
    // ADR-921 — η ΠΡΑΓΜΑΤΙΚΗ αιτία: μπλοκάρισμα του SSoT ή σφάλμα εγγραφής.
    deps.emit('overlay:save-error', {
      reason: error instanceof OverlayPersistBlockedError ? error.reason : 'persist-failed',
    });
    return { ok: false };
  }
}
