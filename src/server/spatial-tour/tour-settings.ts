import 'server-only';

/**
 * @fileoverview **ΡΥΘΜΙΣΕΙΣ ΠΕΡΙΗΓΗΣΗΣ** — ορατότητα (Δ3) και κύκλος ζωής, από τον υπεύθυνο (ADR-884 Κ3β).
 * @related `lib/spatial-tour/tour-view-policy.ts` (τι σημαίνουν) · `tour-genesis.ts` (η προεπιλογή `draft` + `public`)
 * @module server/spatial-tour/tour-settings
 *
 * 🔴 **Το κενό που κλείνει**: μέχρι το Κ3β **κανένας κώδικας** δεν άλλαζε ορατότητα ή κύκλο ζωής — η γέννηση
 * γράφει `draft` + `public` και εκεί έμενε. Άρα καμία περιήγηση δεν μπορούσε να γίνει `on-request`, και το αίτημα
 * θέασης (Κ2α) ήταν **απρόσιτο**.
 *
 * 🔑 **Δημοσίευση μόνο με κάτι να δει ο επισκέπτης**: τουλάχιστον μία **στάση θεατή** — ο ΕΝΑΣ κριτής
 * `tour-viewer-stops.ts` (`publish-needs-capture`). Ο Matterport επιτρέπει «Public» σε άδειο χώρο — ο επισκέπτης βλέπει
 * μαύρη οθόνη. ⚠️ Ως το §4.7 Α8 η πύλη ρωτούσε δικό της κριτή («υπάρχει λήψη για το κοινό;», χωρίς tileset/κόμβο) ⇒
 * δημοσίευε περιήγηση που ο θεατής έδειχνε «ετοιμάζεται».
 *
 * 🔑 **Ιδεμπότητο**: ίδιες τιμές ⇒ `unchanged`, **καμία** εγγραφή (ούτε `updatedAt`) — διπλό κλικ δεν αφήνει ίχνος.
 * Το `revision` **δεν** αυξάνεται: είναι το CAS του **γράφου** (κόμβοι), όχι των ρυθμίσεων.
 *
 * ⏳ **Το ράφι της Φ0.4**: η αλλαγή «προς τα κάτω» (`public` → άλλο) πρέπει να αποσύρει τα δημόσια πλακίδια
 * **στην ίδια πράξη**. Δημόσιο ράφι περιήγησης δεν υπάρχει ακόμη (γεννιέται με τον ψήστη της Φ2) — το άγκιστρο
 * είναι εδώ, στο `reconcileTourShelf`, ώστε η Φ2 να το γεμίσει χωρίς να ψάξει πού.
 */

import type { Firestore } from 'firebase-admin/firestore';

import {
  TOUR_SPACE_AREA_DISPLAY_DEFAULT,
  type SpatialTourLifecycle,
  type SpatialTourVisibility,
  type TourSpaceAreaDisplay,
} from '@/constants/spatial-tour-vocabulary';
import { nowISO } from '@/lib/date-local';
import { spatialTourFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { mayManageTour, type TourActor } from '@/lib/spatial-tour/tour-authority';
import { supportedTourVisibilities } from '@/lib/spatial-tour/tour-view-policy';
import type { SpatialTour, TourSubject } from '@/types/spatial-tour';

import { locateManagedTour, refuseTourAccess, type TourAccessRefused } from './tour-access-shared';
import { ensureManagedTour, TOUR_GENESIS_SETTINGS } from './tour-genesis';
import { locateSpatialTour } from './tour-locate';
import { readViewerStops, readViewerStopsInTransaction } from './tour-viewer-stops';

export interface TourSettings {
  readonly visibility: SpatialTourVisibility;
  readonly lifecycle: SpatialTourLifecycle;
  /** Εμβαδά χώρων στη δημόσια σελίδα (ADR-884 Γ3β · Δ8.4) — διακόπτης ανά περιήγηση, προεπιλογή `shown`. */
  readonly spaceAreaDisplay: TourSpaceAreaDisplay;
}

/**
 * Ό,τι δέχεται η αλλαγή: ο διακόπτης εμβαδών είναι **προαιρετικός** — λείπει ⇒ μένει όπως είναι (μια καρτέλα ανοιχτή πριν
 * τη Γ3β στέλνει μόνο ορατότητα + κύκλο ζωής, και δεν επιτρέπεται να τον γυρίσει σιωπηλά).
 */
export type TourSettingsInput = Omit<TourSettings, 'spaceAreaDisplay'> & { readonly spaceAreaDisplay?: TourSpaceAreaDisplay };

/** Οι ρυθμίσεις μιας διαβασμένης περιήγησης — το απόν πεδίο εμβαδών διαβάζεται ως η προεπιλογή. */
function settingsOf(tour: Pick<SpatialTour, 'visibility' | 'lifecycle' | 'spaceAreaDisplay'>): TourSettings {
  return { visibility: tour.visibility, lifecycle: tour.lifecycle, spaceAreaDisplay: tour.spaceAreaDisplay ?? TOUR_SPACE_AREA_DISPLAY_DEFAULT };
}

const sameSettings = (a: TourSettings, b: TourSettings) =>
  a.visibility === b.visibility && a.lifecycle === b.lifecycle && a.spaceAreaDisplay === b.spaceAreaDisplay;

/** Οι ρυθμίσεις όπως είναι — και η ταυτότητα της περιήγησης (για τους συνδέσμους ανά παραλήπτη, ADR-315). */
export interface TourSettingsReading {
  readonly kind: 'read';
  readonly tourId: string;
  readonly settings: TourSettings;
  readonly exists: boolean;
  /**
   * Πόσες στάσεις έχει να δείξει ο θεατής (ο ΕΝΑΣ κριτής, `tour-viewer-stops.ts`). `0` ⇒ η οθόνη κρατά απενεργά τη
   * δημοσίευση **και** τους προσωπικούς συνδέσμους, με την εξήγηση — ποτέ κουμπί που ο διακομιστής θα αρνηθεί.
   */
  readonly viewerStopCount: number;
  /** Ό,τι δέχεται η εγγραφή — η οθόνη απενεργοποιεί τα υπόλοιπα **πριν** πατηθούν (ίδιος κριτής, ποτέ εικασία). */
  readonly supportedVisibilities: readonly SpatialTourVisibility[];
}

/** Ό,τι ταξιδεύει στην οθόνη — ένα σχήμα για διαδρομή **και** πελάτη. */
export type TourSettingsView = Omit<TourSettingsReading, 'kind'>;

export type TourSettingsOutcome =
  | { readonly kind: 'updated' | 'unchanged'; readonly settings: TourSettings }
  | TourAccessRefused;

/**
 * ⏳ Φ2: συμφιλίωση του δημόσιου ραφιού πλακιδίων με τις νέες ρυθμίσεις. Σήμερα **δεν υπάρχει ράφι** — καμία
 * πράξη. Κρατιέται ως ονομασμένο σημείο ώστε η απόσυρση να γίνει **στην ίδια** πράξη όταν έρθει.
 */
function reconcileTourShelf(_before: TourSettings, _after: TourSettings): void {
  // Κανένα δημόσιο ράφι περιήγησης ακόμη (ADR-884 Φ0.4 → Φ2).
}

/**
 * **Οι ρυθμίσεις όπως είναι τώρα** — για την οθόνη του υπευθύνου. Περιήγηση που δεν γεννήθηκε ακόμη ⇒ οι
 * ρυθμίσεις της γέννησης, **χωρίς** εγγραφή (μια ανάγνωση δεν γεννά τίποτα).
 */
export async function readManagedTourSettings(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly actor: TourActor },
): Promise<TourSettingsReading | TourAccessRefused> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') {
    return managed.reason === 'tour-absent' ? readUnbornSettings(db, input) : managed;
  }
  const snap = await managed.tourRef.get();
  const tour = snap.exists ? spatialTourFromDocument(snap.data(), managed.tourRef.id) : null;
  if (tour === null) return refuseTourAccess('tour-unreadable');
  return {
    kind: 'read', tourId: tour.id, settings: settingsOf(tour), exists: true,
    viewerStopCount: (await readViewerStops(managed.tourRef)).length,
    supportedVisibilities: supportedTourVisibilities(tour.custody),
  };
}

/** `tour-absent` σημαίνει **ή** «δεν υπάρχει αγγελία» **ή** «δεν γεννήθηκε περιήγηση» — τα ξεχωρίζει ο κριτής. */
async function readUnbornSettings(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly actor: TourActor },
): Promise<TourSettingsReading | TourAccessRefused> {
  const location = await locateSpatialTour(db, input.subject);
  if (location.kind !== 'found') return refuseTourAccess('tour-absent');
  if (mayManageTour(location.record, input.actor) !== 'granted') return refuseTourAccess('not-manager');
  return {
    kind: 'read', tourId: location.tourRef.id, settings: settingsOf(TOUR_GENESIS_SETTINGS), exists: false, viewerStopCount: 0,
    supportedVisibilities: supportedTourVisibilities(location.custody),
  };
}

/**
 * **Αλλαγή ρυθμίσεων** — μόνο ο υπεύθυνος, σε συναλλαγή. Η επιλογή ορατότητας **είναι** πρώτη πράξη (πρότυπο
 * Matterport: ο χώρος γεννιέται με την πρώτη πράξη) ⇒ `ensureManagedTour`, όχι «πρώτα προσκαλέστε φωτογράφο».
 */
export async function updateTourSettings(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly actor: TourActor; readonly settings: TourSettingsInput },
): Promise<TourSettingsOutcome> {
  const managed = await ensureManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  const { tourRef } = managed;

  const outcome = await db.runTransaction<TourSettingsOutcome>(async (tx) => {
    const snap = await tx.get(tourRef);
    const tour = snap.exists ? spatialTourFromDocument(snap.data(), tourRef.id) : null;
    if (tour === null) return refuseTourAccess(snap.exists ? 'tour-unreadable' : 'tour-absent');
    const before = settingsOf(tour);
    const next: TourSettings = { ...input.settings, spaceAreaDisplay: input.settings.spaceAreaDisplay ?? before.spaceAreaDisplay };
    // 🔑 Ο ΙΔΙΟΣ κριτής με την οθόνη (`supportedVisibilities` της ανάγνωσης) — π.χ. `link-only` μόνο για γραφείο.
    if (!supportedTourVisibilities(tour.custody).includes(next.visibility)) return refuseTourAccess('visibility-unsupported');
    if (sameSettings(before, next)) return { kind: 'unchanged', settings: before };
    if (next.lifecycle === 'published' && before.lifecycle !== 'published') {
      // 🔑 Ο ΙΔΙΟΣ κριτής με τον θεατή (§4.7 Α8), μέσα στη συναλλαγή: ό,τι δημοσιεύεται, **δείχνεται**.
      if ((await readViewerStopsInTransaction(tx, tourRef)).length === 0) return refuseTourAccess('publish-needs-capture');
    }
    tx.update(tourRef, {
      visibility: next.visibility,
      lifecycle: next.lifecycle,
      spaceAreaDisplay: next.spaceAreaDisplay,
      updatedAt: nowISO(),
      updatedBy: input.actor.listing.uid,
    });
    reconcileTourShelf(before, next);
    return { kind: 'updated', settings: next };
  });
  return outcome;
}
