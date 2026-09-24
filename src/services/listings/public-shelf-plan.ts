/**
 * @fileoverview 🏆 **ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ ΚΑΙ ΤΙ ΛΕΙΠΕΙ** — το σχέδιο του ραφιού, **χωρίς καμία I/O**.
 * @related ADR-841 §7 Α12 · Α21.10 · ADR-845 §3 (Φ4.0) · services/listings/public-shelf.service
 * @module services/listings/public-shelf-plan
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΧΩΡΙΣΕ ΑΠΟ ΤΟΝ ΓΡΑΦΕΑ *(ADR-845 Φ4.0, N.7.1)*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `public-shelf.service` απαντούσε **δύο** ερωτήσεις: *«τι πρέπει να γίνει;»* και
 * *«κάν' το»*. Η πρώτη είναι **καθαρή αριθμητική** — διευθύνσεις περιεχομένου, ταύτιση
 * συνταγής, ομαδοποίηση ταυτόσημων, κάλυψη πλατών. Η δεύτερη είναι **κάδος**.
 *
 * ⚠️ **Η αφορμή ήταν το όριο των 500 γραμμών, ο λόγος όχι.** Το ίδιο το αρχείο έγραφε
 * ότι η μνήμη του ραφιού *«δεν κατεβάζει bytes»* — δηλαδή περιέγραφε **ήδη** έναν
 * κάτοικο άλλου επιπέδου. Το όριο **μέτρησε** κάτι που ήταν αληθές πριν από αυτό.
 *
 * ✅ **Και έχει δώρο**: αυτές οι συναρτήσεις γίνονται ελέγξιμες **χωρίς GCS** — η
 * ταύτιση συνταγής και η συγχώνευση ταυτόσημων ήταν ως τώρα προσβάσιμες μόνο μέσω
 * ολόκληρης της συμφιλίωσης.
 *
 * ⛔ **ΜΗΔΕΝ `sharp`, ΜΗΔΕΝ Admin SDK, ΜΗΔΕΝ ανάγνωση κάδου.** Ό,τι μπαίνει εδώ πρέπει να
 * μπορεί να απαντηθεί με **δεδομένα στο χέρι**. Ο τύπος `File` εισάγεται **μόνο ως τύπος**:
 * τα μεταδεδομένα του διαβάζονται, ο κάδος **δεν** αγγίζεται.
 *
 * 🔴 **ΕΙΝΑΙ ΟΛΟ ΣΧΗΜΑΤΟΣ RASTER, ΚΑΙ ΤΟ ΔΗΛΩΝΕΙ** *(ADR-845 §3)*: η μνήμη έχει κλειδί το
 * **πλάτος**, τα μεταδεδομένα κουβαλούν `requestedWidths`, και η κάλυψη ρωτά *«υπάρχουν
 * ΟΛΑ τα πλάτη;»*. Γι' αυτό οι υπογραφές ζητούν {@link AnyRasterShelfKind} και όχι
 * `AnyPublicShelfKind`: η **πληθυντικότητα** των παραγώγων είναι ιδιότητα της εικόνας —
 * ένα μοντέλο δημοσιεύεται ως **ένα** αρχείο *(τα επίπεδα λεπτομέρειας ζουν μέσα του)*.
 */

import type { File } from '@google-cloud/storage';
import { createHash } from 'node:crypto';

import { GCS_PUBLIC_MEDIA_BUCKET } from '@/config/gcs-buckets';
import {
  buildPublicShelfKey,
  publicShelfUrl,
  shelfExtension,
} from '@/services/upload/utils/storage-path-public-shelf';
import type { AnyRasterShelfKind } from '@/services/upload/utils/public-shelf-kinds';
import { readPhotoFocalPoint, type PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

// ⚠️ **`import type`, και η καθαρότητα ΔΕΝ σπάει** — ίδια σύμβαση με το `File` από πάνω *(που
//    σέρνει ολόκληρο το `@google-cloud/storage`)*: ο τύπος **σβήνεται** στη μεταγλώττιση, άρα
//    κανένα `firebaseAdmin` δεν φτάνει ποτέ σε καταναλωτή αυτού του module. Ο τύπος ζει **δίπλα
//    στη μηχανή που τον καταναλώνει**, όχι δίπλα σε αυτήν που τον γεμίζει.
import type { ShelfWrite } from './public-shelf-bucket';

// ---------------------------------------------------------------------------
// Τύποι
// ---------------------------------------------------------------------------

/** Ένα δημοσιευμένο αντικείμενο, όπως το βλέπει ο κόσμος. */
export interface PublicShelfObject {
  readonly key: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

/** Ένα παράγωγο έτοιμο να **ανέβει** — υπάρχει μόνο όταν δεν βρέθηκε ήδη στο ράφι. */
export interface PendingUpload {
  readonly key: string;
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly sourceRef: string;
  readonly width: number;
  readonly height: number;
  /** Τα **ζητούμενα** πλάτη που εξυπηρετεί αυτό το ένα αντικείμενο (δες `groupUploads`). */
  readonly requestedWidths: readonly number[];
  /**
   * 🔴 **Η ΥΠΟΓΡΑΦΗ ΤΑΞΙΔΕΥΕΙ ΜΕ ΤΑ BYTES, ΚΑΙ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ ΟΧΙ ΒΟΛΗ** *(Α21.10)*.
   *
   * Ως την Α21.9 ο {@link uploadMissing} την **ξαναϋπολόγιζε** από το είδος — σωστό όσο
   * η συνταγή ήταν συνάρτηση **μόνο** της κωδικοποίησης, δηλαδή ίδια για κάθε
   * αντικείμενο της ρίζας. Με το πλαισίωμα να εξαρτάται από το **υλικό**, ο γραφέας
   * δέχεται **ισοπεδωμένο** πίνακα από **πολλές** πηγές: ένας υπολογισμός εκεί θα
   * έγραφε τη **μία** συνταγή πάνω σε bytes που παρήχθησαν με **άλλη**.
   *
   * 🔑 Και το λάθος θα ήταν **αόρατο**, με τον χειρότερο τρόπο: η γρήγορη διαδρομή δεν
   * αποκωδικοποιεί τίποτα, άρα ένα **άτριφτο** πορτρέτο θα περνούσε για τριμμένο
   * λογότυπο και **δεν θα ξαναπαραγόταν ποτέ**.
   */
  readonly recipe: string;
  /**
   * 🎯 **Το αυτόματο σημείο εστίασης της ΠΗΓΗΣ** (ADR-880) — ίδιο σε όλα τα παράγωγά της.
   *
   * ⚠️ **Τρεις καταστάσεις, και η τρίτη μετρά**: σημείο · `null` *(«ψάχτηκε, κανένα σήμα»)* ·
   * `undefined` *(«δεν ρωτήθηκε» — σήμα γραφείου, κάτοψη)*. Η απουσία δεν γράφεται στον κάδο, ώστε η
   * αυτοθεραπεία να ξεχωρίζει *«δεν ρωτήθηκε ποτέ»* από *«ρωτήθηκε και δεν βρήκε»*.
   */
  readonly focalPoint: PhotoFocalPoint | null | undefined;
}
// ---------------------------------------------------------------------------
// Μεταδεδομένα του ραφιού — τα ονόματα γράφονται **μία** φορά
// ---------------------------------------------------------------------------

export const META_SOURCE_REF = 'shelfSourceRef';
export const META_RECIPE = 'shelfRecipe';
export const META_REQUESTED_WIDTHS = 'shelfRequestedWidths';
export const META_PIXEL_WIDTH = 'shelfPixelWidth';
export const META_PIXEL_HEIGHT = 'shelfPixelHeight';
/** ADR-880 — `"x,y"` ή {@link FOCAL_POINT_NONE}. Απόν ⇒ δεν υπολογίστηκε ποτέ. */
export const META_FOCAL_POINT = 'shelfFocalPoint';
const FOCAL_POINT_NONE = 'none';

/** Σημείο → τιμή μεταδεδομένου. Ο **μόνος** γραφέας της μορφής. */
export function encodeFocalPointMeta(point: PhotoFocalPoint | null): string {
  return point === null ? FOCAL_POINT_NONE : `${point.x},${point.y}`;
}

/**
 * Τιμή μεταδεδομένου → σημείο. Ο **μόνος** αναγνώστης· γείτονας του γραφέα.
 * `undefined` ⇒ *«δεν υπολογίστηκε ποτέ»* (αντικείμενα γραμμένα πριν το ADR-880).
 */
export function decodeFocalPointMeta(raw: unknown): PhotoFocalPoint | null | undefined {
  if (typeof raw !== 'string') return undefined;
  if (raw === FOCAL_POINT_NONE) return null;
  const [x, y] = raw.split(',').map(Number);
  return readPhotoFocalPoint({ x, y }) ?? undefined;
}
// ---------------------------------------------------------------------------
// Ταυτότητα — sha256, δύο ερωτήσεις
// ---------------------------------------------------------------------------
/** sha256 των bytes, πεζό δεκαεξαδικό — **το κλειδί γεννιέται εδώ**. */
export function contentAddress(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * **Ποιο πρωτότυπο, σε ποια έκδοση** — χασαρισμένο, γιατί το αποτέλεσμα γίνεται
 * **δημόσιο μεταδεδομένο** (δες το σκεπτικό του module).
 *
 * 🔑 Η **γενιά** του GCS αλλάζει σε κάθε επανεγγραφή του ιδιωτικού αρχείου, άρα ένα
 * αντικατεστημένο πρωτότυπο παίρνει **νέα** αναφορά και τα παλιά παράγωγα παύουν να
 * ταιριάζουν — αυτο-ακύρωση, χωρίς κανέναν να τη θυμηθεί.
 */
export function sourceReference(privateStoragePath: string, generation: string): string {
  return createHash('sha256').update(`${privateStoragePath}#${generation}`).digest('hex');
}

// ---------------------------------------------------------------------------

/**
 * **Τα παράγωγα αυτής της πηγής που ΥΠΑΡΧΟΥΝ ΗΔΗ**, ανά ζητούμενο πλάτος.
 *
 * ⚠️ Απαιτεί ταύτιση **και** στη συνταγή: αλλαγή ποιότητας ή γκάμας πλατών **οφείλει**
 * να ακυρώσει τα παλιά παράγωγα, και το {@link shelfRecipe} είναι παραγόμενο ακριβώς για
 * να μην μπορεί να ξεχαστεί.
 *
 * 🔴 **Η συνταγή έρχεται από ΤΟ ΕΙΔΟΣ, και αυτό είναι το πιο λεπτό σημείο του Σταδίου 2.**
 * Μια σταθερή συνταγή θα έκανε τα παράγωγα του **ενός** είδους να μοιάζουν έγκυρα για το
 * **άλλο** — και επειδή η γρήγορη διαδρομή δεν αποκωδικοποιεί τίποτα, το λάθος θα ήταν
 * **αόρατο**: σήμα 256px θα περνούσε για γκαλερί 2560px χωρίς κανείς να το μετρήσει.
 *
 * ⚠️ **Δέχεται τη ΣΥΝΤΑΓΗ, όχι το είδος** *(Α21.10)*: από τη στιγμή που το πλαισίωμα
 * εξαρτάται από το **υλικό** *(λογότυπο τρίβεται, πορτρέτο όχι)*, δύο αντικείμενα της
 * **ίδιας** ρίζας έχουν **διαφορετική** συνταγή. Ένα `kind` εδώ θα ήταν πρόσκληση να
 * ξαναϋπολογιστεί από λάθος είσοδο.
 */
export function cachedVariants(
  existing: readonly File[],
  sourceRef: string,
  recipe: string,
): ReadonlyMap<number, PublicShelfObject> {
  const byWidth = new Map<number, PublicShelfObject>();

  for (const file of existing) {
    const custom = file.metadata.metadata;
    if (custom?.[META_SOURCE_REF] !== sourceRef) continue;
    if (custom[META_RECIPE] !== recipe) continue;

    const object: PublicShelfObject = {
      key: file.name,
      url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, file.name),
      width: Number(custom[META_PIXEL_WIDTH]),
      height: Number(custom[META_PIXEL_HEIGHT]),
    };
    if (!Number.isFinite(object.width) || !Number.isFinite(object.height)) continue;

    for (const requested of String(custom[META_REQUESTED_WIDTHS] ?? '').split(',')) {
      const width = Number(requested);
      if (Number.isFinite(width)) byWidth.set(width, object);
    }
  }

  return byWidth;
}

/**
 * 🎯 **Το αυτόματο σημείο εστίασης που ΘΥΜΑΤΑΙ ήδη το ράφι για αυτή την πηγή** (ADR-880).
 *
 * Ίδια ταύτιση με το {@link cachedVariants} (πηγή **και** συνταγή)· το σημείο είναι ιδιότητα
 * της **πηγής**, άρα οποιοδήποτε παράγωγό της το λέει. `undefined` ⇒ κανένα δεν το ξέρει.
 */
export function cachedFocalPoint(
  existing: readonly File[],
  sourceRef: string,
  recipe: string,
): PhotoFocalPoint | null | undefined {
  for (const file of existing) {
    const custom = file.metadata.metadata;
    if (custom?.[META_SOURCE_REF] !== sourceRef || custom[META_RECIPE] !== recipe) continue;
    const point = decodeFocalPointMeta(custom[META_FOCAL_POINT]);
    if (point !== undefined) return point;
  }
  return undefined;
}

/**
 * **Παράγωγα → αντικείμενα προς ανέβασμα**, με τα ταυτόσημα **συγχωνευμένα**.
 *
 * 🔑 Μια φωτογραφία 800px δίνει για τα 1280 **και** τα 2560 τα **ίδια bytes** ⇒ ίδιο
 * sha256 ⇒ **ένα** αντικείμενο. Η συγχώνευση δεν είναι βελτιστοποίηση: χωρίς αυτήν, δύο
 * παράλληλες εγγραφές θα διεκδικούσαν το **ίδιο** κλειδί, και το `requestedWidths` του
 * νικητή θα έλεγε ψέματα στην επόμενη συμφιλίωση.
 */
export function groupUploads(
  kind: AnyRasterShelfKind,
  subjectId: string,
  sourceRef: string,
  recipe: string,
  assets: readonly { bytes: Buffer; contentType: string; width: number; height: number }[],
  focalPoint: PhotoFocalPoint | null | undefined,
): readonly PendingUpload[] {
  const byKey = new Map<string, PendingUpload>();

  assets.forEach((asset, index) => {
    const key = buildPublicShelfKey(kind, {
      subjectId,
      contentHash: contentAddress(asset.bytes),
      ext: shelfExtension(kind.encoding),
    });
    const requested = kind.encoding.widths[index];
    const already = byKey.get(key);

    byKey.set(key, {
      key,
      bytes: asset.bytes,
      contentType: asset.contentType,
      sourceRef,
      width: asset.width,
      height: asset.height,
      requestedWidths: [...(already?.requestedWidths ?? []), requested],
      recipe,
      focalPoint,
    });
  });

  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Κάλυψη και προβολή
// ---------------------------------------------------------------------------

/**
 * **Καλύπτονται ΟΛΑ τα ζητούμενα πλάτη;** — `null` αν λείπει έστω ένα.
 *
 * ⚠️ **Όλα ή τίποτα, επίτηδες**: μερική επαναχρησιμοποίηση θα ήταν δεύτερη διαδρομή με
 * δικά της σφάλματα, για να γλιτώσει **μία** κωδικοποίηση από τρεις — ενώ το ακριβό
 * βήμα (κατέβασμα + αποκωδικοποίηση) θα πληρωνόταν ούτως ή άλλως.
 */
export function fullCacheHit(
  kind: AnyRasterShelfKind,
  cached: ReadonlyMap<number, PublicShelfObject>,
): readonly PublicShelfObject[] | null {
  const found: PublicShelfObject[] = [];

  for (const width of kind.encoding.widths) {
    const object = cached.get(width);
    if (object === undefined) return null;
    found.push(object);
  }

  return found;
}

/**
 * 🏆 **ΤΑ ΔΟΜΗΜΕΝΑ ΠΕΔΙΑ ΤΟΥ RASTER, ΣΤΗ ΓΛΩΣΣΑ ΤΟΥ ΚΑΔΟΥ** — μία γραμμή μετάφρασης *(Φ4.2β)*.
 *
 * 🔑 **Ζει ΕΔΩ, δίπλα στον μοναδικό ΑΝΑΓΝΩΣΤΗ αυτών των ονομάτων** *({@link cachedVariants})*.
 * Γραφέας και αναγνώστης των πέντε `META_*` είναι πλέον **γείτονες σε ένα αρχείο**: μια αλλαγή
 * ονόματος που θα έσπαγε τη γρήγορη διαδρομή είναι **ορατή στην ίδια οθόνη**.
 *
 * 🔴 **ΚΑΙ ΓΙ' ΑΥΤΟ ΤΟ {@link PendingUpload} ΔΕΝ ΑΠΕΚΤΗΣΕ ΠΕΔΙΟ `metadata`**: θα ήταν **δύο
 * αλήθειες για τον ίδιο αριθμό** *(το `width` και το `shelfPixelWidth`)*, ελεύθερες να
 * αποκλίνουν — και το {@link toObject} διαβάζει το **δομημένο**. Μία πηγή, δύο προβολές.
 *
 * ⚠️ **Ίδιο ακριβώς ιδίωμα με το `toProjectedImage`** του `publish-public-listing-shelf`: μια
 * γραμμή μετάφρασης στο σύνορο είναι φθηνότερη από έναν τύπο που ξέρει και τις δύο πλευρές.
 */
export function toShelfWrite(upload: PendingUpload): ShelfWrite {
  return {
    key: upload.key,
    bytes: upload.bytes,
    contentType: upload.contentType,
    metadata: {
      [META_SOURCE_REF]: upload.sourceRef,
      [META_RECIPE]: upload.recipe,
      [META_REQUESTED_WIDTHS]: upload.requestedWidths.join(','),
      [META_PIXEL_WIDTH]: String(upload.width),
      [META_PIXEL_HEIGHT]: String(upload.height),
      // ⚠️ «Δεν ρωτήθηκε» ΔΕΝ γράφεται — η απουσία είναι το περιεχόμενο (δες `PendingUpload.focalPoint`).
      ...(upload.focalPoint === undefined
        ? {}
        : { [META_FOCAL_POINT]: encodeFocalPointMeta(upload.focalPoint) }),
    },
  };
}

/** Ένα αντικείμενο προς ανέβασμα, όπως θα το δει ο κόσμος. */
export function toObject(upload: PendingUpload): PublicShelfObject {
  return {
    key: upload.key,
    url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, upload.key),
    width: upload.width,
    height: upload.height,
  };
}

/**
 * **Τα διακριτά παράγωγα, αύξον πλάτος.**
 *
 * ⚠️ Η ταυτότητα είναι το **κλειδί**, ποτέ το πλάτος: δύο ζητούμενα πλάτη που έδωσαν τα
 * ίδια bytes είναι **ένα** αντικείμενο, και μια δεύτερη γραμμή `srcset` για το ίδιο URL
 * θα ζητούσε από τον περιηγητή να διαλέξει ανάμεσα σε δύο ταυτόσημα.
 */
export function distinctByKey(objects: readonly PublicShelfObject[]): readonly PublicShelfObject[] {
  return [...new Map(objects.map((object) => [object.key, object])).values()].sort(
    (a, b) => a.width - b.width,
  );
}

