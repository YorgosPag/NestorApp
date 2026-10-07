/**
 * @fileoverview 🎬 **ΤΟ ΚΕΦΑΛΙ ΤΟΥ ΡΑΦΙΟΥ ΒΙΝΤΕΟ** — κάνε το πρόθεμα ίσο με το επιθυμητό σύνολο, χωρίς να φορτώσεις βίντεο στη μνήμη.
 * @related ADR-907 §10 · ADR-845 Φ4.2 (πρότυπο: `public-shelf-model.service`) · ADR-841 §7 Α12
 * @module services/listings/public-shelf-video.service
 *
 * 🔑 **ΤΡΙΤΟ ΚΕΦΑΛΙ, ΙΔΙΟΣ ΚΑΔΟΣ, ΙΔΙΑ ΜΝΗΜΗ**: σάρωση, σβήσιμο και «ποιο πρωτότυπο, με ποια συνταγή;» είναι τα
 * **κοινά** *(`public-shelf-bucket` · `public-shelf-origin`)*. Εδώ ζει μόνο ό,τι είναι **του βίντεο**: τα bytes
 * ανεβαίνουν ως **ροή**, και ό,τι μέτρησε ο ψήστης *(διάρκεια, διαστάσεις)* γράφεται ως μεταδεδομένο ώστε η γρήγορη
 * διαδρομή να το ξαναδώσει **χωρίς να ανοίξει το αρχείο**.
 *
 * ⚠️ **Δεν πετά ποτέ** — ίδιο συμβόλαιο με τα δύο αδέλφια: η αποτυχία του ραφιού δεν ακυρώνει την αποθήκευση του
 * ανθρώπου· επιστρέφεται **ονομαστικά** και η επόμενη συμφιλίωση τη διορθώνει.
 */

import type { File } from '@google-cloud/storage';

import { GCS_PUBLIC_MEDIA_BUCKET } from '@/config/gcs-buckets';
import type { Mp4Facts, Mp4Refusal } from '@/lib/media/mp4-boxes';
import { createModuleLogger } from '@/lib/telemetry';
import { shelfRecipe, type PublicShelfKind } from '@/services/upload/utils/public-shelf-kinds';
import { isVideoShelfKind, type VideoShelfKind } from '@/services/upload/utils/public-shelf-video-kind';
import {
  buildPublicShelfKey,
  publicShelfUrl,
  shelfExtension,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';

import { asLogMessage, shelfFailure, type ShelfStreamWrite } from './public-shelf-bucket';
import { readPrivateOrigin, reconcileOnePerSource, type ShelfOrigin } from './public-shelf-origin';
import { META_PIXEL_HEIGHT, META_PIXEL_WIDTH, META_RECIPE, META_SOURCE_REF } from './public-shelf-plan';
import {
  PUBLIC_SHELF_VIDEO_CACHE_CONTROL,
  PUBLIC_SHELF_VIDEO_CONTENT_TYPE,
  VideoBakeError,
  bakeVideo,
  type BakedVideo,
} from './public-shelf-video-bake';

const logger = createModuleLogger('public-shelf-video');

/** Η διάρκεια σε δευτερόλεπτα — το ένα μεταδεδομένο που είναι **μόνο** του βίντεο. */
const META_DURATION_SEC = 'shelfDurationSec';

// ---------------------------------------------------------------------------
// Τύποι
// ---------------------------------------------------------------------------

/** Ό,τι **μετρήθηκε** πάνω στα bytes και ταξιδεύει ως το δημόσιο έγγραφο. */
export type PublishedVideoFacts = Pick<Mp4Facts, 'durationSec' | 'width' | 'height'>;

/**
 * **Ένα δημοσιευμένο βίντεο.**
 *
 * 🔑 Οι διαστάσεις **δεν** είναι διακοσμητικές: η οθόνη κρατά το κουτί του βίντεο **πριν** κατέβει ένα byte του
 * *(μηδενική μετατόπιση διάταξης)*, και με `preload="none"` ο περιηγητής δεν έχει από πού αλλού να τις μάθει.
 */
export interface PublishedShelfVideo extends PublishedVideoFacts {
  readonly key: string;
  readonly url: string;
  /** ISO — *πότε εμφανίστηκαν αυτά τα bytes* (`timeCreated` του ιδιωτικού αντικειμένου), ποτέ ρολόι διακομιστή. */
  readonly at: string;
}

/** Τι έκανε η συμφιλίωση — ρητά, ώστε ο καλών να **μετρήσει**. */
export interface PublicShelfVideoReport {
  readonly outcome: 'reconciled' | 'failed';
  readonly published: readonly PublishedShelfVideo[];
  readonly removed: number;
  /** Πόσες πηγές **δεν** έγιναν δημοσιεύσιμες — λάθος codec, πάνω από 120″, κομμένο αρχείο… */
  readonly rejected: number;
}

/**
 * **Γιατί μια πηγή δεν έγινε δημοσιεύσιμη** — τα ονόματα του αναγνώστη κουτιών, συν τις δύο ερωτήσεις **αυτού** του
 * συνόρου *(«έχει στιγμή;»· «διαβάζεται;»)*. Ίδια τομή με το `ModelSourceRefusal`: ο ψήστης δεν μπορεί να τις παραγάγει.
 */
type VideoSourceRefusal = Mp4Refusal | 'undated-source' | 'unreadable-source';

/** Ό,τι έμαθε η συμφιλίωση για **μία** πηγή. */
interface AddressedVideo extends PublishedShelfVideo {
  /** `null` ⇒ τα bytes **κάθονται ήδη** στο ράφι· δεν διαβάστηκε ούτε ένα byte του πρωτοτύπου. */
  readonly upload: ShelfStreamWrite | null;
}

// ---------------------------------------------------------------------------
// Η μνήμη του ραφιού — ό,τι μετρήθηκε την πρώτη φορά
// ---------------------------------------------------------------------------

function positiveInteger(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * **Ό,τι είχε μετρηθεί όταν ψήθηκε αυτό το αντικείμενο** — ή `null` αν τα μεταδεδομένα δεν διαβάζονται.
 *
 * ⚠️ `null` σημαίνει **«ξαναψήσε»**, ποτέ «μάντεψε»: ένα βίντεο στο δημόσιο έγγραφο με `width: NaN` θα έδινε κουτί
 * μηδενικού ύψους σε κάθε επισκέπτη, και η γρήγορη διαδρομή θα το έκρυβε για πάντα.
 */
function cachedFacts(file: File): PublishedVideoFacts | null {
  const custom = file.metadata.metadata;
  const durationSec = Number(custom?.[META_DURATION_SEC]);
  const width = positiveInteger(custom?.[META_PIXEL_WIDTH]);
  const height = positiveInteger(custom?.[META_PIXEL_HEIGHT]);

  if (!Number.isFinite(durationSec) || durationSec <= 0 || width === null || height === null) return null;
  return { durationSec, width, height };
}

// ---------------------------------------------------------------------------
// Παραγωγή του επιθυμητού συνόλου
// ---------------------------------------------------------------------------

/**
 * Κοιτά ένα υποψήφιο βίντεο στον **ιδιωτικό** κάδο και το διευθυνσιοδοτεί — `null` όταν **δεν** δημοσιεύεται, με τον
 * λόγο γραμμένο **ονομαστικά**.
 *
 * 🔴 **Η ΓΡΗΓΟΡΗ ΔΙΑΔΡΟΜΗ ΚΟΣΤΙΖΕΙ ΕΝΑ `getMetadata()`**: καμία ανάγνωση bytes όταν το ίδιο πρωτότυπο (μονοπάτι +
 * γενιά) έχει ήδη ψηθεί με τη σημερινή συνταγή. Αυτό είναι που κάνει ανεκτή τη συμφιλίωση σε **κάθε αποθήκευση**.
 */
async function bakeOne<M>(
  kind: VideoShelfKind<M>,
  subjectId: string,
  source: PublicShelfSource<M>,
  own: readonly File[],
): Promise<AddressedVideo | null> {
  const path = source.privateStoragePath;

  try {
    const found = await readPrivateOrigin(source, shelfRecipe(kind.encoding), subjectId, own);
    const { meta, origin, hit } = found;
    if (origin === null) return refuse(subjectId, path, 'undated-source', 'no timeCreated');

    const remembered = hit === null ? null : cachedFacts(hit);
    if (hit !== null && remembered !== null) {
      const url = publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, hit.name);
      return { key: hit.name, url, at: origin.at, ...remembered, upload: null };
    }

    // 🔴 **Καρφωμένο στη γενιά των μεταδεδομένων**: τα δύο περάσματα του ψήστη διαβάζουν τα **ίδια** bytes.
    const pinned = found.original.bucket.file(path, { generation: Number(meta.generation) });
    const baked = await bakeVideo(pinned, Number(meta.size));
    return toUpload(kind, origin, baked);
  } catch (error) {
    const failure: VideoSourceRefusal = error instanceof VideoBakeError ? error.failure : 'unreadable-source';

    return refuse(subjectId, path, failure, asLogMessage(error));
  }
}

/** **Η ΜΙΑ διατύπωση της άρνησης** — καταγραφή και επιστροφή ως **μία** πράξη (μήνυμα αρχείου καταγραφής, όχι οθόνης). */
function refuse(subjectId: string, privateStoragePath: string, failure: VideoSourceRefusal, detail: string): null {
  logger.warn('Βίντεο ΔΕΝ δημοσιεύεται — ονομασμένη άρνηση', { subjectId, privateStoragePath, failure, detail });
  return null;
}

/** **Δεκτό βίντεο → διεύθυνση + εγγραφή ως ροή**, με τα μεταδεδομένα που κρατούν τη μνήμη. */
function toUpload(kind: VideoShelfKind<unknown>, origin: ShelfOrigin, baked: BakedVideo): AddressedVideo {
  const { durationSec, width, height } = baked.facts;
  const key = buildPublicShelfKey(kind, {
    subjectId: origin.subjectId,
    contentHash: baked.contentHash,
    ext: shelfExtension(kind.encoding),
  });

  return {
    key,
    url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, key),
    at: origin.at,
    durationSec,
    width,
    height,
    upload: {
      key,
      contentType: PUBLIC_SHELF_VIDEO_CONTENT_TYPE,
      cacheControl: PUBLIC_SHELF_VIDEO_CACHE_CONTROL,
      // ⚠️ Τα ονόματα πλάτους/ύψους είναι τα **ίδια** με του raster: απαντούν την ίδια ερώτηση («πόσα pixel;»).
      metadata: {
        [META_SOURCE_REF]: origin.sourceRef,
        [META_RECIPE]: origin.recipe,
        [META_PIXEL_WIDTH]: String(width),
        [META_PIXEL_HEIGHT]: String(height),
        [META_DURATION_SEC]: String(durationSec),
      },
      pipeTo: baked.pipeTo,
    },
  };
}

// ---------------------------------------------------------------------------
// Η μία δημόσια είσοδος
// ---------------------------------------------------------------------------

/**
 * **Κάνε το ράφι ΒΙΝΤΕΟ αυτού του υποκειμένου ΑΚΡΙΒΩΣ ίσο με το επιθυμητό σύνολο.**
 *
 * 🔑 **Η σειρά του `published` είναι η σειρά των `sources`** — η σειρά που **δήλωσε** ο άνθρωπος. Καμία ταξινόμηση.
 * Κενές πηγές ⇒ σάρωση και σβήσιμο, **καμία** ανάγνωση bytes: αυτή είναι η απόσυρση.
 */
export async function reconcilePublicVideoShelf<M>(
  kind: PublicShelfKind<M>,
  subjectId: string,
  sources: readonly PublicShelfSource<M>[],
): Promise<PublicShelfVideoReport> {
  if (!isVideoShelfKind(kind)) {
    return shelfFailure(
      logger,
      'Αυτό το κεφάλι δημοσιεύει ΜΟΝΟ βίντεο — η γραμμή δεν είναι βίντεο',
      { root: kind.root, subjectId, encoding: kind.encoding.kind },
      sources.length,
    );
  }

  try {
    const result = await reconcileOnePerSource(kind, subjectId, sources, (source: PublicShelfSource<M>, own) =>
      bakeOne(kind, subjectId, source, own),
    );
    const published = result.desired.map(({ key, url, at, durationSec, width, height }) => ({
      key, url, at, durationSec, width, height,
    }));

    return { outcome: 'reconciled', published, removed: result.removed, rejected: result.rejected };
  } catch (error) {
    return shelfFailure(
      logger,
      'Το ράφι ΒΙΝΤΕΟ ΔΕΝ συμφιλιώθηκε — μένει ΜΠΑΓΙΑΤΙΚΟ ως την επανασύνθεση',
      { root: kind.root, subjectId, error: asLogMessage(error) },
      0,
    );
  }
}
