/**
 * @fileoverview 🖼️ **ΤΟ ΕΞΩΦΥΛΛΟ ΤΟΥ ΒΙΝΤΕΟ ΣΤΟ RASTER ΡΑΦΙ** — ποια πηγή του αντιστοιχεί, και πώς ξαναβρίσκεται.
 * @related ADR-907 §10.8 · lib/files/file-companion-objects (`videoPoster`) · publish-public-listing-shelf (`writeWithShelf`)
 * @module services/listings/listing-video-poster
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΔΙΑΔΡΟΜΗ ΤΟΥ ΕΞΩΦΥΛΛΟΥ **ΠΑΡΑΓΕΤΑΙ ΕΔΩ** — ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ ΠΟΤΕ ΑΠΟ ΤΗΝ ΕΓΓΡΑΦΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το καρέ το γράφει ο browser του εκδότη. Αν η εγγραφή κρατούσε «δείκτη προς το εξώφυλλο», ο δείκτης θα ήταν
 * **γραμμένος από πελάτη**, και ο γραφέας του ραφιού διαβάζει με Admin SDK: ένας δείκτης προς αρχείο **άλλης εταιρείας**
 * θα δημοσιευόταν ως εξώφυλλο. Γι' αυτό η διαδρομή βγαίνει **μόνο** από τη διαδρομή του ίδιου του βίντεο, μέσω του
 * μητρώου συνοδευτικών — ίδιος φάκελος, ίδιο αναγνωριστικό αρχείου. Ό,τι επιτρέπεται να δημοσιευτεί το έχει ήδη κρίνει
 * ο κριτής του **βίντεο**· το εξώφυλλο δεν αποκτά δική του εξουσιοδότηση.
 *
 * 🔑 **Μόνο για βίντεο που ΔΗΜΟΣΙΕΥΤΗΚΕ.** Η είσοδος είναι η αναφορά του ραφιού βίντεο, όχι οι υποψήφιες πηγές: βίντεο
 * που ο ψήστης αρνήθηκε (HEVC, πάνω από 120″) δεν αφήνει καρέ του στον δημόσιο κάδο χωρίς έγγραφο να το δείχνει.
 *
 * 🔑 **Το υλικό του εξωφύλλου είναι `VIDEO_MATERIAL`** — είναι η raster **όψη** του ίδιου υλικού, όχι πέμπτο είδος. Ένα
 * νέο είδος θα έμπαινε στο σύρμα του ιδιώτη, στη σειρά που ορίζει ο άνθρωπος και στο αποτύπωμα των μέσων, ενώ κανείς
 * δεν «ανεβάζει εξώφυλλο». Στο raster ράφι «βίντεο» σημαίνει **εξώφυλλο**, και ο {@link splitVideoPosters} είναι ο
 * **ένας** τόπος που το ξέρει.
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — καμία I/O: η κρίση δοκιμάζεται χωρίς κάδο.
 */

import { fileCompanionPath } from '@/lib/files/file-companion-objects';
import { VIDEO_MATERIAL, type ListingMaterial } from '@/lib/listings/listing-material';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

/** Ό,τι χρειάζεται από ένα **δημοσιευμένο** βίντεο — δομικά, ώστε το module να μη σέρνει την υπηρεσία του ραφιού. */
interface PublishedVideoIdentity {
  readonly sourceFileId: string | null;
}

/** Ό,τι χρειάζεται από μια εικόνα του raster ραφιού για να κριθεί «εξώφυλλο ή συλλογή;». */
interface ShelfImageIdentity {
  readonly material: ListingMaterial;
  readonly sourceFileId: string | null;
}

/**
 * **Οι πηγές εξωφύλλου των βίντεο που δημοσιεύτηκαν** — μία ανά βίντεο με γνωστή ταυτότητα πηγής.
 *
 * ⚠️ **Δεν ρωτά αν το καρέ υπάρχει**: βίντεο ανεβασμένο πριν από το ADR-907 §10.8, ή από browser που δεν το
 * αποκωδικοποίησε, δεν έχει. Το raster ράφι το μετρά ως `rejected` και το βίντεο δημοσιεύεται με `poster: null` — ένα
 * `getMetadata` που αποτυγχάνει, όχι δεύτερη διαδρομή με δικά της σφάλματα.
 *
 * ⚠️ **Χωρίς `storagePlacement`, επίτηδες**: το μητρώο δηλώνει το εξώφυλλο `client-default`, δηλαδή ζει **πάντα** στον
 * κανονικό κάδο, όπου κι αν μετακινηθεί το πρωτότυπο (ADR-895).
 */
export function videoPosterSources(
  published: readonly PublishedVideoIdentity[],
  videoSources: readonly PublicShelfSource<ListingMaterial>[],
): readonly PublicShelfSource<ListingMaterial>[] {
  const posters: PublicShelfSource<ListingMaterial>[] = [];

  for (const video of published) {
    if (video.sourceFileId === null) continue;
    const source = videoSources.find((candidate) => candidate.sourceFileId === video.sourceFileId);
    if (source === undefined) continue;

    posters.push({
      privateStoragePath: fileCompanionPath(source.privateStoragePath, 'videoPoster'),
      material: VIDEO_MATERIAL,
      sourceFileId: video.sourceFileId,
    });
  }

  return posters;
}

/** Η αναφορά του raster ραφιού, χωρισμένη: ό,τι πάει στη συλλογή, και τα εξώφυλλα ανά ταυτότητα βίντεο. */
export interface SplitShelfImages<T> {
  readonly gallery: readonly T[];
  readonly posterByVideo: ReadonlyMap<string, T>;
}

/**
 * **«Εξώφυλλο ή συλλογή;»** — ΕΝΑ πέρασμα, κάθε εικόνα σε **ακριβώς ένα** από τα δύο (ποτέ δύο `filter` με άρνηση).
 *
 * 🔴 Χωρίς αυτό το βήμα το εξώφυλλο θα έφτανε στο `withPublishedGallery`, που **πετά ονομαστικά** σε υλικό βίντεο —
 * δηλαδή μία αγγελία με βίντεο δεν θα γραφόταν καθόλου. Ο δεύτερος φρουρός μένει εκεί, απροσπέλαστος.
 */
export function splitVideoPosters<T extends ShelfImageIdentity>(images: readonly T[]): SplitShelfImages<T> {
  const gallery: T[] = [];
  const posterByVideo = new Map<string, T>();

  for (const image of images) {
    if (image.material.kind !== 'video') {
      gallery.push(image);
    } else if (image.sourceFileId !== null) {
      posterByVideo.set(image.sourceFileId, image);
    }
  }

  return { gallery, posterByVideo };
}
