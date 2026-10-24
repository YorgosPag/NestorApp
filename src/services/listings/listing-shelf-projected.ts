/**
 * @fileoverview **Ό,τι είδαν τα ράφια, στη γλώσσα της ΚΑΘΑΡΗΣ προβολής** — οι μεταφραστές `toProjected*`.
 * @related ./publish-public-listing-shelf (ο μόνος καταναλωτής) · ADR-920 §12 (εξαγωγή)
 * @module services/listings/listing-shelf-projected
 *
 * 🔑 **ΕΞΑΓΩΓΗ, ΟΧΙ ΤΡΙΜΜΑ (N.7.1)**: ζούσαν στο `publish-public-listing-shelf.ts`, που με το τρίτο κεφάλι (έδαφος) θα
 * περνούσε τις 500 γραμμές. Είναι **μία** ευθύνη — μετάφραση τύπων της υπηρεσίας σε τύπους της καθαρής προβολής,
 * καμία σημασιολογία — άρα δικό τους αρχείο. Τα σώματα μετακόμισαν **αυτούσια**.
 */

import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { ProjectedShelfImage } from './public-listing-projection';
import type { ProjectedShelfModel } from './public-listing-model-projection';
import type { ProjectedShelfVideo, ProjectedVideoPoster } from './public-listing-video-projection';
import type { ProjectedShelfFloorPlate, ShelfFloorPlate } from './public-listing-floor-plate-projection';
import type { ProjectedShelfTerrain } from './public-listing-terrain-projection';
import type { PublicShelfImage } from './public-shelf.service';
import type { PublishedShelfModel } from './public-shelf-model.service';
import type { PublishedShelfVideo } from './public-shelf-video.service';
import type { PublishedShelfTerrain } from './public-shelf-terrain.service';

/**
 * **Ό,τι είδε το ράφι ΕΙΚΟΝΩΝ, στη γλώσσα της ΚΑΘΑΡΗΣ προβολής** — μία γραμμή μετάφρασης.
 *
 * 🔑 Υπάρχει ώστε η προβολή να μη χρειαστεί ποτέ να εισαγάγει τον τύπο της υπηρεσίας: εκείνη
 * δηλώνει ρητά ότι είναι **καθαρή**, και η υπηρεσία σέρνει `firebase-admin` **και** `sharp`.
 *
 * ⚠️ Το `sources` παίρνει **όλα** τα παράγωγα, όχι μόνο το κανονικό: αυτό ακριβώς είναι το
 * `srcset`, και είναι ο λόγος που η αναφορά τα κρατά **ομαδοποιημένα** (Α2.2).
 */
export function toProjectedImage(image: PublicShelfImage<ListingMaterial>): ProjectedShelfImage {
  return {
    ...toProjectedFace(image),
    // 🔑 **Ταξιδεύει αυτούσιο, καμία κρίση εδώ** (ADR-841 §7 Α17.4): αυτή η γραμμή είναι
    //    μετάφραση τύπων, όχι σημασιολογία. Ο **ένας** τόπος που ρωτά «κάτοψη ή
    //    φωτογραφία;» είναι το `withPublishedGallery`.
    material: image.material,
    // 🎯 ADR-880 — και τα δύο ταξιδεύουν **αυτούσια**· η απόφαση ζει στο `withPublishedGallery`.
    declaredFocalPoint: image.declaredFocalPoint,
    detectedFocalPoint: image.focalPoint,
    // 📍 ADR-897 — αυτούσια· η ταυτότητα γίνεται δείκτης **μόνο** στο `withPublishedGallery`.
    sourceFileId: image.sourceFileId,
    declaredCaptureSpot: image.declaredCaptureSpot,
    declaredNorthRad: image.declaredNorthRad,
  };
}

/**
 * **Ό,τι είδε το ράφι ΜΟΝΤΕΛΩΝ, στη γλώσσα της ΚΑΘΑΡΗΣ προβολής** — ο αδελφός από πάνω.
 *
 * ⚠️ **Το `key` ΔΕΝ ταξιδεύει**: είναι η διεύθυνση **μέσα στον κάδο**, χρήσιμη μόνο στον
 * σβήστη. Στο δημόσιο έγγραφο πηγαίνει το **URL**, και τίποτε άλλο που να μοιάζει με
 * εσωτερικό αναγνωριστικό.
 *
 * 🔑 **Και ΚΑΝΕΝΑ `material`** — δες `PublicShelfModelReport` για το γιατί η ασυμμετρία με τον
 * αδελφό του είναι σωστή: ένα μοντέλο έχει **ένα** κουτί, άρα δεν υπάρχει τι να δρομολογηθεί.
 */
export function toProjectedModel(model: PublishedShelfModel): ProjectedShelfModel {
  return { url: model.url, at: model.at };
}

/**
 * **Ό,τι είδε το ράφι ΒΙΝΤΕΟ, στη γλώσσα της καθαρής προβολής** — το `key` και η ταυτότητα της πηγής **δεν** ταξιδεύουν.
 *
 * 🖼️ Το εξώφυλλο βρίσκεται με την **ταυτότητα της πηγής**, ποτέ με τη θέση στον πίνακα: ό,τι απορρίφθηκε λείπει από
 * την αναφορά, άρα «το πρώτο εξώφυλλο» δεν είναι απαραίτητα του «πρώτου βίντεο».
 */
export function toProjectedVideo(
  video: PublishedShelfVideo,
  posterByVideo: ReadonlyMap<string, PublicShelfImage<ListingMaterial>>,
): ProjectedShelfVideo {
  const { url, at, durationSec, width, height, sourceFileId } = video;
  const image = sourceFileId === null ? undefined : posterByVideo.get(sourceFileId);

  return { url, at, durationSec, width, height, poster: image === undefined ? null : toProjectedFace(image) };
}

/**
 * **Ό,τι είδε το ράφι για την ΚΑΤΟΨΗ ΟΡΟΦΟΥ, στη γλώσσα της καθαρής προβολής** — η όψη από το ράφι, όλα τα άλλα από το
 * υλικό που ταξίδεψε μαζί της. Καμία ταυτότητα πηγής δεν περνά.
 */
export function toProjectedFloorPlate(
  plate: ShelfFloorPlate<PublicShelfImage<ListingMaterial>>,
): ProjectedShelfFloorPlate {
  const { at, provenance, units } = plate.material;
  return { image: toProjectedFace(plate.image), at, provenance, units };
}

/**
 * **Η όψη μιας εικόνας του ραφιού** — διεύθυνση, διαστάσεις και **όλα** τα παράγωγα (αυτό ακριβώς είναι το `srcset`).
 *
 * 🔑 Ένα σώμα για φωτογραφία, κάτοψη, κάτοψη ορόφου **και** εξώφυλλο (N.18): το εξώφυλλο είναι αυτό και **τίποτε άλλο** — καμία δήλωση
 * ανθρώπου (σημείο εστίασης, σημείο λήψης, βορράς) δεν το αφορά· οι εικόνες της συλλογής τις προσθέτουν από πάνω.
 */
function toProjectedFace(image: PublicShelfImage<ListingMaterial>): ProjectedVideoPoster {
  return {
    url: image.canonical.url,
    width: image.canonical.width,
    height: image.canonical.height,
    sources: image.variants.map((variant) => ({ url: variant.url, width: variant.width })),
  };
}

/**
 * **Ό,τι είδε το ράφι ΕΔΑΦΟΥΣ** (ADR-920 Β3β) — ένα ανά αγγελία· `null` ⇒ δεν δημοσιεύτηκε (ή αποσύρθηκε). Το `key`
 * δεν ταξιδεύει, για τον λόγο του μοντέλου.
 */
export function toProjectedTerrain(published: readonly PublishedShelfTerrain[]): ProjectedShelfTerrain | null {
  const [terrain] = published;
  return terrain === undefined ? null : { url: terrain.url, at: terrain.at, card: terrain.card };
}
