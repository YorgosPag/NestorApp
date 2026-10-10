/**
 * @fileoverview 🏢 **Ο ΓΡΑΦΕΑΣ ΤΟΥ `floorPlates[]`** — ο τέταρτος, αδελφός του `withPublishedVideos`.
 * @related ADR-907 §11.5 · CHECK 3.76 (επιμέλεια) · lib/listings/floor-plate · ./listing-video-poster (`splitVideoPosters`)
 * @module services/listings/public-listing-floor-plate-projection
 *
 * Η κάτοψη ορόφου είναι **raster**: περνά από το **υπάρχον** ράφι εικόνων της αγγελίας, στην **ίδια** συμφιλίωση με τις
 * φωτογραφίες (δεύτερη κλήση στο ίδιο πρόθεμα θα έσβηνε τις φωτογραφίες ως «εκτός επιθυμητού συνόλου»). Τρεις ερωτήσεις
 * ζουν εδώ, με τη σειρά που τις κάνει ο ενορχηστρωτής:
 *
 * | Πότε | Ερώτηση | Συνάρτηση |
 * |---|---|---|
 * | **πριν** το ράφι | «φεύγει αυτή η κάτοψη ορόφου;» | {@link withinFloorPlateAdmission} |
 * | **μετά** το ράφι | «κάτοψη ορόφου ή κάτι άλλο;» | {@link splitFloorPlateImages} |
 * | στη γραφή | «τι γράφεται στο έγγραφο;» | {@link withPublishedFloorPlates} |
 *
 * 🔴 **Η ΑΡΝΗΣΗ ΓΙΝΕΤΑΙ ΠΡΙΝ ΤΟ ΡΑΦΙ, ΠΟΤΕ ΜΕΤΑ.** Ό,τι δημοσιεύσει το ράφι αποκτά δημόσια, μόνιμη διεύθυνση. Κάτοψη που
 * θα αρνιόταν ο γραφέας **αφού** ανέβηκε θα άφηνε την εικόνα ολόκληρου του ορόφου στον δημόσιο κάδο χωρίς έγγραφο να τη
 * δείχνει — και ο σβήστης δεν θα την άγγιζε, γιατί ανήκει στο επιθυμητό σύνολο.
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — καμία I/O, κανένα `firebase-admin`: η κρίση δοκιμάζεται χωρίς κάδο.
 */

import { LISTING_FLOOR_PLATE_ALT_KEY } from '@/lib/listings/floor-plate/floor-plate-keys';
import {
  LISTING_FLOOR_PLATE_MAX_COUNT,
  isPublishableFloorPlateUnits,
} from '@/lib/listings/floor-plate/floor-plate-publication';
import type { FloorPlateMaterial, ListingMaterial } from '@/lib/listings/listing-material';
import type { FloorPlateUnit, ListingFloorPlate, PublicListing } from '@/types/public-listing';

import type { ProjectedVideoPoster } from './public-listing-video-projection';

// ---------------------------------------------------------------------------
// ΠΡΙΝ ΤΟ ΡΑΦΙ — «φεύγει;»
// ---------------------------------------------------------------------------

/** Ό,τι χρειάζεται από μια πηγή ή μια εικόνα του ραφιού για να κριθεί — δομικά, χωρίς την υπηρεσία του ραφιού. */
interface CarriesListingMaterial {
  readonly material: ListingMaterial;
}

/**
 * **Οι πηγές που φεύγουν προς το raster ράφι** — κάθε άλλο υλικό περνά αυτούσιο, η κάτοψη ορόφου κρίνεται.
 *
 * 🔑 Ίδιο σχήμα με το `withinVideoLimit` της επιλογής: το πρώτο στη σειρά μένει, τα επόμενα κόβονται. Η κύρια κοπή
 * ανήκει στον αναγνώστη του ορόφου (που παράγει το πολύ μία)· εδώ είναι το δίχτυ, στο **ένα** σημείο από όπου περνούν
 * όλοι οι παραγωγοί.
 */
export function withinFloorPlateAdmission<T extends CarriesListingMaterial>(sources: readonly T[]): readonly T[] {
  let plates = 0;

  return sources.filter((source) => {
    const material = source.material;
    if (material.kind !== 'floorPlate') return true;
    if (!isPublishableFloorPlateUnits(material.units)) return false;
    plates += 1;
    return plates <= LISTING_FLOOR_PLATE_MAX_COUNT;
  });
}

// ---------------------------------------------------------------------------
// ΜΕΤΑ ΤΟ ΡΑΦΙ — «κάτοψη ορόφου ή κάτι άλλο;»
// ---------------------------------------------------------------------------

/** Μια εικόνα του ραφιού που **είναι** κάτοψη ορόφου, μαζί με το υλικό της ήδη στενεμένο. */
export interface ShelfFloorPlate<T> {
  readonly image: T;
  readonly material: FloorPlateMaterial;
}

/** Η αναφορά του raster ραφιού, χωρισμένη: οι κατόψεις ορόφου, και ό,τι συνεχίζει προς συλλογή και εξώφυλλα. */
export interface SplitFloorPlateImages<T> {
  readonly floorPlates: readonly ShelfFloorPlate<T>[];
  readonly rest: readonly T[];
}

/**
 * **«Κάτοψη ορόφου ή κάτι άλλο;»** — ΕΝΑ πέρασμα, κάθε εικόνα σε **ακριβώς ένα** από τα δύο.
 *
 * 🔴 Χωρίς αυτό το βήμα η κάτοψη ορόφου θα έφτανε στο `withPublishedGallery`, που **πετά ονομαστικά** σε αυτό το υλικό —
 * η αγγελία δεν θα γραφόταν καθόλου. Ο δεύτερος φρουρός μένει εκεί, απροσπέλαστος.
 *
 * ⚠️ Τρέχει **πριν** από το `splitVideoPosters`: εκείνο στέλνει στη συλλογή ό,τι **δεν** είναι βίντεο.
 */
export function splitFloorPlateImages<T extends CarriesListingMaterial>(images: readonly T[]): SplitFloorPlateImages<T> {
  const floorPlates: ShelfFloorPlate<T>[] = [];
  const rest: T[] = [];

  for (const image of images) {
    const material = image.material;
    if (material.kind === 'floorPlate') {
      floorPlates.push({ image, material });
    } else {
      rest.push(image);
    }
  }

  return { floorPlates, rest };
}

// ---------------------------------------------------------------------------
// Η ΓΡΑΦΗ
// ---------------------------------------------------------------------------

/**
 * **Μια δημοσιευμένη κάτοψη ορόφου, όπως τη μαθαίνει ο γραφέας από το ράφι.** Δομικός τύπος και όχι ο τύπος της
 * υπηρεσίας *(που σέρνει `firebase-admin` και `sharp`)* — ίδια σύμβαση με το `ProjectedShelfVideo`.
 */
export interface ProjectedShelfFloorPlate {
  /** Η όψη της εικόνας όπως την έβγαλε το ράφι — το **ίδιο** σχήμα με το εξώφυλλο του βίντεο, χωρίς σημείο εστίασης. */
  readonly image: ProjectedVideoPoster;
  /** ISO — *«πότε το έμαθε **η πηγή**»*, ποτέ *«πότε το πρόβαλα»*. */
  readonly at: string;
  readonly provenance: FloorPlateMaterial['provenance'];
  readonly units: readonly FloorPlateUnit[];
}

/**
 * Η μονάδα **ξαναχτισμένη πεδίο προς πεδίο**. Ό,τι άλλο κουβαλούσε το αντικείμενο (όνομα, τιμή, ταυτότητα μονάδας που
 * κάποιος παραγωγός άφησε πάνω του) **δεν μπορεί** να φτάσει στο δημόσιο έγγραφο — ο τύπος δεν το εμποδίζει σε χρόνο
 * εκτέλεσης, αυτή η γραμμή ναι.
 */
function toPublicUnit(unit: FloorPlateUnit): FloorPlateUnit {
  const { outline, state, listingId } = unit;
  return listingId === undefined ? { outline, state } : { outline, state, listingId };
}

/**
 * **Η αγγελία με την κάτοψη του ορόφου της δεμένη.**
 *
 * 🔑 **Η προέλευση έρχεται από το υλικό**, όπως στην κάτοψη του ακινήτου: `measured` όταν η εικόνα παρήχθη από το
 * σχέδιο, `declared` όταν την ανέβασε άνθρωπος. Δεν καρφώνεται εδώ.
 *
 * 🔴 **Πάνω από το όριο ⇒ άρνηση με όνομα.** Απροσπέλαστο στην παραγωγή — το {@link withinFloorPlateAdmission} κόβει
 * πριν από το ράφι· υπάρχει ως δεύτερος φρουρός, ώστε ένας καλών που το παρέκαμψε να μη γράψει δεύτερο όροφο σιωπηλά.
 */
export function withPublishedFloorPlates(
  listing: PublicListing,
  plates: readonly ProjectedShelfFloorPlate[],
): PublicListing {
  if (plates.length > LISTING_FLOOR_PLATE_MAX_COUNT) {
    throw new Error(
      `withPublishedFloorPlates: ${plates.length} κατόψεις ορόφου για μία αγγελία — το όριο είναι ` +
        `${LISTING_FLOOR_PLATE_MAX_COUNT} και το κόβει το \`withinFloorPlateAdmission\` πριν από το ράφι (ADR-907 §11.5).`,
    );
  }

  const floorPlates: readonly ListingFloorPlate[] = plates.map((plate) => ({
    provenance: plate.provenance,
    value: {
      image: { ...plate.image, altKey: LISTING_FLOOR_PLATE_ALT_KEY },
      units: plate.units.map(toPublicUnit),
    },
    at: plate.at,
  }));

  return { ...listing, floorPlates };
}
