/**
 * ADR-782 §23 — Η **ΜΙΑ** απάντηση στο «πού κάθεται ο κόσμος πάνω στο χαρτί, **για τον χάρτη**;».
 *
 * ## 🔴 Τι διόρθωσε: η κατάσταση «κατά προσέγγιση» ζωγράφιζε στο ΕΓΣΑ'87 (0,0)
 * Το §21 συνέδεσε την κατά προσέγγιση θέση με το **store** και με την **οθόνη**, αλλά όχι με τον
 * **προβολέα**. Η αλυσίδα ήταν κλειστή και μονοσήμαντη: `'approximate'` **συνεπάγεται**
 * ταυτοτική γεωαναφορά (αλλιώς η κατάσταση θα ήταν `'exact'`) ⇒ ο `getTopoDisplayProjector()`
 * επέστρεφε `null` ⇒ χαρτί ≡ κόσμος ⇒ ζητούνταν τα πλακίδια του `(0, 0)`. Δηλαδή **ακριβώς** η
 * βλάβη που η επικεφαλίδα του `basemap-availability` υπάρχει για να αποκλείσει, φτασμένη από την
 * άλλη πόρτα. Το γεωγραφικό πλάτος/μήκος της άγκυρας είχε **δύο** καταναλωτές, και οι δύο
 * ετικέτες· **κανείς δεν το μετέτρεπε ποτέ σε θέση**.
 *
 * ## 🔑 Μία κρίση, δύο προβολές της — και γιατί όχι δύο κρίσεις
 * Η προτεραιότητα («ακριβής ⟩ χειροκίνητη ⟩ διεύθυνση») κρίνεται **εδώ, μία φορά**. Η
 * {@link getBasemapAvailability} δεν ξανακρίνει τίποτα: είναι **ετικέτα** του πλαισίου. Έτσι το
 * αναλλοίωτο που παραβιάστηκε παραπάνω γίνεται **δομικά αδύνατο** να ξαναπαραβιαστεί:
 *
 *     διαθεσιμότητα ≠ 'unknown'  ⟺  υπάρχει πλαίσιο
 *
 * Δύο ξεχωριστές συναρτήσεις που διάβαζαν τις **ίδιες** εισόδους σε **δική** τους σειρά η καθεμία
 * είναι το σχήμα του ADR-749: δεν αποκλίνουν την ημέρα που γράφονται, αποκλίνουν την ημέρα που
 * κάποιος προσθέτει τρίτη πηγή σε **μία** από τις δύο — όπως ακριβώς έγινε με τη χειροκίνητη
 * τοποθέτηση. Άγκυρα: `Φ4`.
 *
 * ## Η άγκυρα κάθεται στην **αρχή του σχεδίου**, όχι στο κέντρο του περιεχομένου
 * Η διεύθυνση δίνει ένα σημείο της Γης και **καμία** πληροφορία για το ποιο σημείο του σχεδίου
 * του αντιστοιχεί. Η σύμβαση είναι η ίδια με ArchiCAD «Project Location» και SketchUp «Add
 * Location»: το σημείο προσγειώνεται στην **τοπική αρχή (0,0)** του σχεδίου.
 *
 * ⚠️ Το κέντρο του **περιεχομένου** απορρίφθηκε, και ο λόγος δεν είναι προτίμηση: το περιεχόμενο
 * αλλάζει κάθε φορά που ο χρήστης τραβά μια γραμμή. Ένα πλαίσιο δεμένο σε αυτό θα μετακινούσε
 * τον χάρτη **ενώ σχεδιάζεις** — υπόβαθρο αναφοράς που γλιστράει μόνο του είναι χειρότερο από
 * υπόβαθρο που το τοποθετείς μια φορά. Και ακριβώς γι' αυτό υπάρχει η **χειροκίνητη**
 * τοποθέτηση: όταν η αρχή του DXF είναι μακριά από το κτίριο, ο χρήστης το διορθώνει **μία**
 * φορά, ρητά.
 *
 * ## Απομνημόνευση — δεν είναι βελτιστοποίηση, είναι **συμβόλαιο**
 * Η {@link getBasemapFrame} συνθέτει αντικείμενο. Ένα `getSnapshot` του `useSyncExternalStore`
 * που επιστρέφει **νέα** αναφορά σε κάθε κλήση προκαλεί ατέρμονο βρόχο απόδοσης — γι' αυτό το
 * αποτέλεσμα κλειδώνεται πάνω στις **ταυτότητες** των τριών εισόδων. Δευτερευόντως, γλιτώνει τη
 * μετάθεση datum + την προβολή σε κάθε καρέ. Άγκυρα: `Φ7`.
 *
 * @see ./basemap-availability.ts — η άγκυρα (πού είναι το έργο πάνω στη Γη)
 * @see ./basemap-placement-store.ts — η χειροκίνητη τοποθέτηση (πώς κάθεται ο χάρτης)
 * @see ../geo-referencing/geo-reference-store.ts — η **δηλωμένη** γεωαναφορά (νομικό παραδοτέο)
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  fromOnePointPair,
  isIdentityGeoReference,
  makeWorldToDisplayProjector,
  type GeoReference,
  type WorldToDisplayProjector,
} from '../geo-referencing/geo-transform';
import {
  getGeoReference,
  subscribeGeoReference,
} from '../geo-referencing/geo-reference-store';
import {
  getApproximateAnchor,
  subscribeProjectAnchor,
  type ApproximateAnchor,
  type BasemapAvailability,
} from './basemap-availability';
import {
  getBasemapPlacement,
  subscribeBasemapPlacement,
} from './basemap-placement-store';
import { geographicToWorldMm } from './basemap-projection';

/**
 * Ποιος **έβαλε** τον χάρτη εκεί που είναι.
 *
 * ⚠️ Δεν είναι το ίδιο ερώτημα με το `ApproximateAnchorOrigin`, και τα δύο **δεν** συγχωνεύονται:
 * εκείνο απαντά «από πού ήρθε το γεωγραφικό πλάτος/μήκος» (γεωκωδικοποιητής · πινέζα στη
 * διεύθυνση · αποθηκευμένο), αυτό απαντά «τι καθορίζει τη θέση **και τη στροφή** του χάρτη τώρα».
 * Ένα έργο μπορεί κάλλιστα να έχει άγκυρα από γεωκωδικοποιητή και πλαίσιο από χειροκίνητη
 * τοποθέτηση — δύο αληθινές απαντήσεις σε δύο διαφορετικές ερωτήσεις.
 */
export type BasemapFrameSource =
  /** Η **δηλωμένη** γεωαναφορά του έργου (τοπογραφικό / ευθυγράμμιση) — μετρημένη, νομική. */
  | 'geo-reference'
  /** Η διεύθυνση του έργου, με την αρχή του σχεδίου πάνω στο σημείο της. */
  | 'project-anchor'
  /** Ο χρήστης το τοποθέτησε με το χέρι πάνω στον χάρτη — **ποτέ** νομικό παραδοτέο. */
  | 'manual-placement';

/** Το πλαίσιο του υποβάθρου: ο μετασχηματισμός **και** το ποιος τον όρισε. */
export interface BasemapFrame {
  readonly source: BasemapFrameSource;
  readonly geo: GeoReference;
}

/** Η τοπική αρχή του σχεδίου — το σημείο που αντιστοιχίζεται στην άγκυρα. */
const LOCAL_ORIGIN: Point2D = { x: 0, y: 0 };

/**
 * Το πλαίσιο που προκύπτει από μια κατά προσέγγιση άγκυρα: η αρχή του σχεδίου **είναι** το
 * σημείο της διεύθυνσης, χωρίς στροφή (η διεύθυνση δεν δίνει καμία).
 *
 * Περνά από το SSoT {@link fromOnePointPair} και όχι από αντικείμενο γραμμένο εδώ, ώστε η
 * **πρόθεση** («αυτό το τοπικό σημείο είναι αυτό το σημείο του κόσμου») να είναι το κείμενο, όχι
 * σχόλιο δίπλα σε δύο πεδία.
 */
function frameFromAnchor(anchor: ApproximateAnchor): GeoReference {
  return fromOnePointPair(LOCAL_ORIGIN, geographicToWorldMm(anchor.lat, anchor.lon));
}

/** Οι τρεις είσοδοι, όπως ήταν την τελευταία φορά — το κλειδί της απομνημόνευσης. */
interface FrameCache {
  readonly geo: GeoReference | null;
  readonly anchor: ApproximateAnchor | null;
  readonly placement: GeoReference | null;
  readonly frame: BasemapFrame | null;
}

let cache: FrameCache | null = null;

/**
 * Η **ΜΙΑ** απόφαση. `null` σημαίνει «κανείς δεν έχει πει πού είναι αυτό το σχέδιο» — και τότε ο
 * χάρτης **δεν ζωγραφίζεται** (`basemap-paint-decision`), γιατί το ΕΓΣΑ'87 `(0,0)` δεν είναι
 * ουδέτερο σημείο: είναι ένα **λάθος** σημείο που μοιάζει απόλυτα σωστό στην οθόνη.
 *
 * Η σειρά είναι συμβόλαιο:
 *   1. **Δηλωμένη γεωαναφορά** — μετρημένη· υπερισχύει πάντα. Μια χειροκίνητη τοποθέτηση που
 *      επιβίωνε εδώ θα ξεκόλλαγε τον χάρτη από το **τοπογραφικό** μετά την ευθυγράμμιση,
 *      δηλαδή η δουλειά του χρήστη δεν θα φαινόταν (άγκυρα `Φ6`).
 *   2. **Χειροκίνητη τοποθέτηση** — ανθρώπινη πρόθεση, υπερισχύει της αυτόματης εικασίας.
 *   3. **Άγκυρα διεύθυνσης** — η εικασία.
 *
 * ⚠️ Η χειροκίνητη τοποθέτηση κρίνεται **μέσα** στο σκέλος της άγκυρας και όχι πριν από αυτό:
 * είναι **διόρθωση** μιας κατά προσέγγιση θέσης, όχι ανεξάρτητη πηγή. Χωρίς άγκυρα δεν υπάρχει
 * χάρτης να συρθεί, άρα δεν υπάρχει τίποτα να διορθωθεί — και ένα πλαίσιο που θα προέκυπτε από
 * σκέτη τοποθέτηση θα δήλωνε θέση που **κανείς δεν ισχυρίστηκε ποτέ**.
 */
export function getBasemapFrame(): BasemapFrame | null {
  const geo = getGeoReference();
  const anchor = getApproximateAnchor();
  const placement = getBasemapPlacement();

  const hit = cache;
  if (hit && hit.geo === geo && hit.anchor === anchor && hit.placement === placement) {
    return hit.frame;
  }

  const frame = resolveFrame(geo, anchor, placement);
  cache = { geo, anchor, placement, frame };
  return frame;
}

/** Η κρίση, χωρίς την απομνημόνευση — καθαρή ως προς τα ορίσματά της. */
function resolveFrame(
  geo: GeoReference | null,
  anchor: ApproximateAnchor | null,
  placement: GeoReference | null,
): BasemapFrame | null {
  if (geo && !isIdentityGeoReference(geo)) return { source: 'geo-reference', geo };
  if (!anchor) return null;
  if (placement) return { source: 'manual-placement', geo: placement };
  return { source: 'project-anchor', geo: frameFromAnchor(anchor) };
}

/**
 * Η κατάσταση διαθεσιμότητας — **ετικέτα** του πλαισίου, όχι δεύτερη κρίση.
 *
 * Δες την επικεφαλίδα: όσο ήταν ανεξάρτητη συνάρτηση πάνω στις ίδιες εισόδους, μπορούσε να πει
 * «έχω θέση» ενώ ο προβολέας δεν είχε καμία — και το είπε.
 */
export function getBasemapAvailability(): BasemapAvailability {
  const frame = getBasemapFrame();
  if (!frame) return 'unknown';
  return frame.source === 'geo-reference' ? 'exact' : 'approximate';
}

/** Το τελευταίο πλαίσιο για το οποίο ετοιμάστηκε προβολέας — η τριγωνομετρία πληρώνεται μία φορά. */
let projectorCache: { readonly frame: BasemapFrame; readonly projector: WorldToDisplayProjector } | null = null;

/**
 * Ο προβολέας «κόσμος (ΕΓΣΑ mm) → χαρτί (τοπικά mm)» **του υποβάθρου**, ή `null` όταν κανείς δεν
 * έχει πει πού είναι το σχέδιο.
 *
 * ⚠️ **Δεν** είναι ο `getTopoDisplayProjector`, και η διαφορά είναι όλη η ουσία αυτού του αρχείου:
 * εκείνος απαντά **μόνο** για τη δηλωμένη γεωαναφορά, γιατί ό,τι τον χρησιμοποιεί (ισοϋψείς,
 * πίνακες, εξαγωγές) οφείλει να σιωπά όταν αυτή λείπει. Ο χάρτης είναι το μόνο στρώμα που
 * επιτρέπεται να δείξει **κατά προσέγγιση** θέση — αρκεί να το **δηλώνει**, και το δηλώνει.
 */
export function getBasemapDisplayProjector(): WorldToDisplayProjector | null {
  const frame = getBasemapFrame();
  if (!frame) return null;
  const hit = projectorCache;
  if (hit && hit.frame === frame) return hit.projector;
  const projector = makeWorldToDisplayProjector(frame.geo);
  projectorCache = { frame, projector };
  return projector;
}

/**
 * Εγγραφή σε **κάθε** πηγή που μπορεί να μετακινήσει τον χάρτη.
 *
 * ⚠️ Οι τρεις πηγές απαριθμούνται **μόνο εδώ**. Όσο η λίστα ζούσε στο `basemap-availability`, ο
 * γραφέας της χειροκίνητης τοποθέτησης θα προσγειωνόταν χωρίς κανείς να τον ακούει: το υπόβαθρο
 * θα έμενε **σιωπηλά παγωμένο** στην προηγούμενη θέση, δηλαδή το σύρσιμο δεν θα «δούλευε» —
 * βλάβη που θα κυνηγιόταν στη διάδραση, όπου δεν θα ήταν.
 */
export function subscribeBasemapFrame(listener: () => void): () => void {
  const unsubscribes = [
    subscribeGeoReference(listener),
    subscribeProjectAnchor(listener),
    subscribeBasemapPlacement(listener),
  ];
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}

/**
 * Ο ιστορικός δίδυμος της {@link subscribeBasemapFrame}, για τους καταναλωτές που ρωτούν
 * **διαθεσιμότητα** και όχι πλαίσιο. Ίδιο σύνολο πηγών, εξ ορισμού: η διαθεσιμότητα είναι
 * ετικέτα του πλαισίου, άρα δεν μπορεί να αλλάξει χωρίς να αλλάξει εκείνο.
 */
export const subscribeBasemapAvailability = subscribeBasemapFrame;
