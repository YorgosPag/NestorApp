/**
 * @fileoverview **Από τα αρχεία της αγγελίας στο υλικό του χώρου εργασίας** — φωτογραφίες και κατόψεις (ADR-897 Φ3).
 * @related CaptureSpotControl.tsx · ListingMediaOrderPanel.tsx (γραφείο) · OwnerPropertyDossierPanel.tsx (φάκελος)
 * @module components/listings/capture-spots/capture-spot-material
 *
 * 🔑 **Ο ΙΔΙΟΣ κριτής με το ράφι, ποτέ δεύτερος**: ο φιλοξενούμενος δίνει τα αρχεία που **φεύγουν** μαζί με το **είδος**
 *   που τους έδωσε ο κριτής της δημοσίευσης (`agencyMediaMaterial` στο γραφείο, `publishedDossierFiles` στον φάκελο).
 *   Έτσι ο επεξεργαστής δεν μπορεί να δείξει ως «κάτοψη» κάτι που ο κόσμος θα δει ως φωτογραφία — ή καθόλου.
 * ⚠️ Τα bytes της κάτοψης διαβάζονται από τον **φρουρούμενο** δρόμο (`FocalPointPhoto.kind === 'file'`), όχι από το
 *   `downloadUrl` — ίδιο μάθημα με την εστίαση (ADR-880: παλιές εγγραφές χωρίς `downloadUrl`).
 */

import type { ListingMaterialKind } from '@/lib/listings/listing-material';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

import type { CaptureSpotFloorplan, CaptureSpotPhoto } from './capture-spot-types';

/** Ό,τι χρειάζεται από ένα αρχείο — δομικό, ώστε να το ικανοποιεί κάθε `FileRecord`. */
export interface CaptureSpotFile {
  readonly id: string;
  readonly displayName: string;
  readonly thumbnailUrl?: string | null;
}

/** Ένα αρχείο που **φεύγει**, με το είδος που του έδωσε ο κριτής της δημοσίευσης. */
export interface CaptureSpotSourceEntry {
  readonly file: CaptureSpotFile;
  readonly kind: ListingMaterialKind;
}

export interface CaptureSpotMaterial {
  readonly photos: readonly CaptureSpotPhoto[];
  readonly floorplans: readonly CaptureSpotFloorplan[];
}

/** Φωτογραφίες ⇒ ταινία · κατόψεις ⇒ καρτέλες · μοντέλα ⇒ τίποτα (δεν τοποθετούνται σε κάτοψη). */
export function captureSpotMaterialOf(
  entries: readonly CaptureSpotSourceEntry[],
  custody: CustodyKind,
): CaptureSpotMaterial {
  const photos: CaptureSpotPhoto[] = [];
  const floorplans: CaptureSpotFloorplan[] = [];
  for (const { file, kind } of entries) {
    if (kind === 'photo') {
      photos.push({ id: file.id, name: file.displayName, thumbnailUrl: file.thumbnailUrl ?? null });
    } else if (kind === 'floorplan') {
      floorplans.push({ id: file.id, name: file.displayName, source: { kind: 'file', fileId: file.id, custody } });
    }
  }
  return { photos, floorplans };
}
