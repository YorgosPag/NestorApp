/**
 * @fileoverview **Οι κατόψεις ενός ακινήτου με τα σημεία λήψης των φωτογραφιών του** — ο προσαρμογέας της εσωτερικής
 * πλευράς προς το ουδέτερο σχήμα του πάνελ (ADR-897 · ADR-899 §4). Καθαρό: κανένα I/O, κανένα React.
 * @module lib/properties/property-floorplan-spots
 * @related lib/media/photo-floorplan-spots (το σχήμα) · lib/properties/property-photos (η σειρά της γκαλερί) ·
 *          lib/listings/listing-capture-spots (ο δίδυμος προσαρμογέας της δημόσιας αγγελίας)
 *
 * 🔑 **Ίδιοι κανόνες με τη δημόσια πλευρά**, για να λέει η «Κάτοψη N» το ίδιο πράγμα και στις δύο:
 * - ο δείκτης κάθε φωτογραφίας είναι η θέση της **στη σειρά που τη βλέπει ο άνθρωπος** (`propertyPhotosOf`)·
 * - οι κατόψεις μετρώνται με τη **δηλωμένη** σειρά (`publishedFloorplans`), οι αδήλωτες μετά, με σειρά ανάγνωσης·
 * - κάτοψη χωρίς καμία τοποθετημένη φωτογραφία **δεν** μπαίνει στο πάνελ, αλλά **κρατά** τον αριθμό της.
 *
 * ⛔ **Μόνο κατόψεις-εικόνες**: μια κάτοψη PDF/DXF δεν έχει εικόνα πάνω στην οποία να σταθεί σημείο ⇒ δεν μετρά.
 * ⛔ **Καμία διάσταση**: `width/height = null` — τις μετρά η εικόνα στη φόρτωση (`FloorplanFigure`).
 * ⚠️ Σημείο που δείχνει σε κάτοψη που **δεν** υπάρχει (σβήστηκε) αγνοείται — ο αναγνώστης δεν εμπιστεύεται τον γραφέα.
 */

import { fileDisplayUrlOf } from '@/lib/files/file-display-url';
import type { FloorplanSpotsEntry, PlacedPhoto } from '@/lib/media/photo-floorplan-spots';
import { orderByDeclaration } from '@/lib/ordering/declared-order';
import { agencyMediaDeclaration } from '@/services/listings/agency-media-publication';

import type { PropertyPhoto, PropertyPhotoFile } from './property-photos';

export interface PropertyFloorplanDeclarationSource {
  readonly publishedFloorplans?: unknown;
  readonly publishedPhotoCaptureSpots?: unknown;
  readonly publishedFloorplanNorth?: unknown;
}

const KEEP_READ_ORDER = (): number => 0;

/** Οι φωτογραφίες ανά κάτοψη — κλειδί η ταυτότητα του αρχείου κάτοψης. */
function placedByFloorplan(
  photos: readonly PropertyPhoto[],
  captureSpots: ReturnType<typeof agencyMediaDeclaration>['captureSpots'],
): ReadonlyMap<string, readonly PlacedPhoto[]> {
  const byFloorplan = new Map<string, PlacedPhoto[]>();
  photos.forEach((photo, imageIndex) => {
    const spot = captureSpots?.get(photo.fileId);
    if (spot === undefined) return;
    const placed = byFloorplan.get(spot.floorplanFileId) ?? [];
    placed.push({ imageIndex, spot: { x: spot.x, y: spot.y, headingRad: spot.headingRad, fovRad: spot.fovRad } });
    byFloorplan.set(spot.floorplanFileId, placed);
  });
  return byFloorplan;
}

export function propertyFloorplanSpotsOf(
  photos: readonly PropertyPhoto[],
  floorplanFiles: readonly PropertyPhotoFile[],
  declaration: PropertyFloorplanDeclarationSource,
): readonly FloorplanSpotsEntry[] {
  const { floorplans, captureSpots, floorplanNorth } = agencyMediaDeclaration(declaration);
  const byFloorplan = placedByFloorplan(photos, captureSpots);
  const ordered = orderByDeclaration(floorplanFiles, (file) => file.id, floorplans, KEEP_READ_ORDER);

  let ordinal = 0;
  return ordered.flatMap((file) => {
    const resolved = fileDisplayUrlOf(file);
    if (resolved.kind === 'unavailable' || resolved.preview === null) return [];
    ordinal += 1;
    const placed = byFloorplan.get(file.id);
    if (placed === undefined) return [];
    return [{
      key: file.id,
      ordinal,
      figure: {
        src: resolved.preview.src,
        srcSet: resolved.preview.srcSet,
        alt: file.displayName || file.originalFilename || file.id,
        width: resolved.dimensions?.width ?? null,
        height: resolved.dimensions?.height ?? null,
        northRad: floorplanNorth?.get(file.id) ?? null,
      },
      photos: placed,
    }];
  });
}
