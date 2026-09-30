import 'server-only';

/**
 * @fileoverview **ΣΕ ΠΟΙΟΝ ΚΑΔΟ ΖΟΥΝ ΤΑ ΜΕΣΑ ΜΙΑΣ ΠΕΡΙΗΓΗΣΗΣ** — ο ΕΝΑΣ επιλογέας (ADR-884 Φ2ζ ζ5 · §12 Δ11.6).
 * @related `config/gcs-buckets` (ονόματα) · `lib/firebaseAdmin` (accessors) · `server/storage/private-bucket-registry` (η δήλωση και η γέννηση του κάδου)
 * @module server/spatial-tour/tour-media-store
 *
 * 🔑 **Ρητή θέση, ποτέ σιωπηλό fallback**: ο ψήστης, η καραντίνα, τα παράγωγα κάτοψης και η διαδρομή μέσων ρωτούν **εδώ** με
 * τη θέση της περιήγησης (`SpatialTour.mediaPlacement`, ή της υπογεγραμμένης άδειας θέασης). Ένα «δοκίμασε τον έναν, αλλιώς
 * τον άλλον» θα έκρυβε αντικείμενα που δεν ψήθηκαν ποτέ στον νέο κάδο — εδώ η απουσία είναι **404**, ορατή.
 *
 * ⛔ Κανένα αρχείο του `server/spatial-tour` δεν καλεί `getAdminBucket()` για `tour-ingest/` ή `tour-tiles/`.
 * Το **πρωτότυπο** πανόραμα (`FileRecord`) **δεν** περνά από εδώ — ζει όπου λέει το `storagePlacement` του (ADR-895,
 * επιλογέας `server/files/file-record-bucket`)· η θέση του κρίνεται στη γέννηση από την καραντίνα (`lib/files/new-file-placement`).
 */

import type { Bucket } from '@google-cloud/storage';

import { TOUR_MEDIA_PLACEMENT_LEGACY, type TourMediaPlacement } from '@/constants/spatial-tour-vocabulary';
import { getAdminBucket, getTourMediaBucket } from '@/lib/firebaseAdmin';

/** Η θέση που **ισχύει** — απόν πεδίο (έγγραφο ή άδεια πριν το ζ5) ⇒ ο κανονικός κάδος. */
export function effectiveMediaPlacement(placement: TourMediaPlacement | undefined): TourMediaPlacement {
  return placement ?? TOUR_MEDIA_PLACEMENT_LEGACY;
}

/** Ο κάδος των μέσων για αυτή τη θέση. */
export function tourMediaBucket(placement: TourMediaPlacement | undefined): Bucket {
  return effectiveMediaPlacement(placement) === 'tour-eu' ? getTourMediaBucket() : getAdminBucket();
}
