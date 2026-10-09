/**
 * @fileoverview 🎬 **Ο ΓΡΑΦΕΑΣ ΤΟΥ `videos[]`** — ο τρίτος, αδελφός του `withPublishedModels`.
 * @related ADR-907 §10 · ADR-845 §7.3 (Α-7) · CHECK 3.76 (επιμέλεια) · lib/listings/listing-authorship
 * @module services/listings/public-listing-video-projection
 *
 * 🔴 **ΔΕΧΕΤΑΙ ΜΟΝΟ Ο,ΤΙ ΔΕΧΤΗΚΕ Ο ΨΗΣΤΗΣ.** Η είσοδος είναι {@link ProjectedShelfVideo}, που παράγεται **αποκλειστικά**
 * από το `PublicShelfVideoReport.published` — και εκεί το `url` γεννιέται από το αποτύπωμα bytes που πέρασαν τον
 * αναγνώστη κουτιών. ⛔ Γι' αυτό **δεν** δέχεται σκέτα URL: ένας τύπος που δέχεται *οποιοδήποτε* URL **επιτρέπει**
 * τη διαφήμιση βίντεο που κανείς δεν έλεγξε (HEVC που δεν παίζει, 20 λεπτά, YouTube).
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — καμία I/O, κανένα `firebase-admin`: η **κρίση** δοκιμάζεται χωρίς κάδο.
 */

import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import type { ListingImage, ListingVideo, PublicListing } from '@/types/public-listing';

/**
 * **Το εξώφυλλο, όπως το έβγαλε το raster ράφι** — ό,τι χρειάζεται ένα `ListingImage` εκτός από το `altKey`, που το
 * διαλέγει ο γραφέας. Χωρίς σημείο εστίασης: το εξώφυλλο αποδίδεται **ολόκληρο** (`object-contain`), δεν κόβεται ποτέ.
 */
export type ProjectedVideoPoster = Pick<ListingImage, 'url' | 'width' | 'height' | 'sources'>;

/**
 * **Ένα δημοσιευμένο βίντεο, όπως το μαθαίνει ο γραφέας από το ράφι.** Δομικός τύπος και όχι ο τύπος της υπηρεσίας
 * *(που σέρνει `firebase-admin`)* — ίδια σύμβαση με το `ProjectedShelfModel`.
 */
export interface ProjectedShelfVideo {
  readonly url: string;
  /** ISO — *«πότε το έμαθε **η πηγή**»*, ποτέ *«πότε το πρόβαλα»*. */
  readonly at: string;
  readonly durationSec: number;
  readonly width: number;
  readonly height: number;
  /** `null` ⇒ το raster ράφι **δεν** δημοσίευσε καρέ για αυτό το βίντεο — ποτέ εικόνα που δεν κάθεται στον κάδο. */
  readonly poster: ProjectedVideoPoster | null;
}

/**
 * **Η αγγελία με το βίντεό της δεμένο.**
 *
 * 🔑 **`declared`, ΟΧΙ `measured` — και η διαφορά από το μοντέλο είναι πραγματική**: το μοντέλο το **παράγει μηχανή**
 * από το BIM μας· το βίντεο το **ανέβασε άνθρωπος**. Ο ψήστης μέτρησε τη *μορφή* του (codec, διάρκεια), όχι το
 * *περιεχόμενό* του — δεν ξέρουμε αν δείχνει αυτό το σπίτι. Η ετικέτα «μετρημένο» θα υποσχόταν ακριβώς αυτό.
 *
 * 🔑 **Το `poster` χτίζεται ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ του raster ραφιού, όπως και το ίδιο το βίντεο** (ADR-907 §10.8): `null` όταν
 * το ράφι δεν δημοσίευσε καρέ — η οθόνη δείχνει τότε ουδέτερο πλαίσιο, ποτέ δεν κατεβάζει βίντεο για να φτιάξει εικόνα.
 * Το `altKey` του είναι **του βίντεο**: το καρέ δείχνει το ίδιο υλικό, του ίδιου παραγωγού.
 *
 * ⚠️ **Η σειρά ταξιδεύει αυτούσια** από τη συμφιλίωση — η σειρά που δήλωσε ο άνθρωπος. Καμία ταξινόμηση.
 */
export function withPublishedVideos(
  listing: PublicListing,
  videos: readonly ProjectedShelfVideo[],
): PublicListing {
  const altKey = LISTING_MATERIAL_KEYS[listing.authorship].videoAlt;

  const published: readonly ListingVideo[] = videos.map((video) => ({
    provenance: 'declared',
    value: {
      url: video.url,
      altKey,
      width: video.width,
      height: video.height,
      durationSec: video.durationSec,
      poster: video.poster === null ? null : { ...video.poster, altKey },
    },
    at: video.at,
  }));

  return { ...listing, videos: published };
}
