/**
 * ADR-650 §M10g — Η ΤΑΥΤΟΤΗΤΑ του πλαισίου συντεταγμένων, ως δεδομένο.
 *
 * ── Η κλάση του σφάλματος που κλείνει αυτό το module ────────────────────────────────────────
 * Το §M10f έβαλε ΟΛΟΥΣ τους παραγωγούς να περνούν τη γέφυρα WORLD→DISPLAY. Έμεινε όμως το
 * βαθύτερο: **η ψημένη οντότητα δεν κουβαλά την ταυτότητα του πλαισίου στο οποίο ψήθηκε.**
 * Ο κώδικας *υπέθετε* σε ποιο σύστημα κάθεται ένας ψημένος κάναβος — και μια υπόθεση δεν
 * μπορεί να επαληθευτεί ούτε να διορθωθεί. Εδώ η υπόθεση γίνεται **σφραγίδα**:
 *
 *   ψήσιμο ⇒ γράψε το πλαίσιο· αλλαγή πλαισίου ⇒ σύγκρινε, υπολόγισε delta, μετακίνησε.
 *
 * ## Γιατί σφραγίδα ΠΕΡΙΕΧΟΜΕΝΟΥ και όχι μονότονος counter
 * Το blueprint (ADR-650 v31 §5.2) πρότεινε μονότονο `version` στο `setGeoReference`. Ένας
 * runtime counter όμως **μηδενίζεται σε κάθε session**: μια σφραγίδα που τον κουβαλά και
 * επιστρέφει από το Firestore αύριο συγκρίνεται με counter που ξεκίνησε από το 0 — δηλαδή
 * παίρνει **σιωπηλά λάθος απόφαση** ακριβώς εκεί που ο §M10g απαγορεύει τη σιωπή. Η
 * ταυτότητα του πλαισίου ΕΙΝΑΙ το περιεχόμενό του (origin + στροφή): σταθερή μεταξύ
 * sessions, συγκρίσιμη, και ταυτόχρονα **αυτή που χρειάζεται ο υπολογισμός του delta** —
 * ένας αριθμός-ετικέτα δεν θα αρκούσε ποτέ για να μετακινήσει οντότητα.
 *
 * ## Το μοντέλο των μεγάλων (ADR-650 §M10g.1)
 * Revit: οι θέσεις ζουν στο Internal Origin· τα Shared Coordinates είναι μετασχηματισμός από
 * πάνω. Cesium `CESIUM_RTC`: θέσεις σχετικά με κέντρο, το κέντρο στη model-view matrix. Και
 * στις δύο περιπτώσεις το «πλαίσιο» είναι πρωτεύον αντικείμενο — όχι υπόθεση του κώδικα.
 *
 * Καθαρό module: μηδέν store/React/Firestore. Η **μία** είσοδος που διαβάζει store είναι το
 * `getActiveProjectFrame()` στο {@link ../geo-referencing/geo-reference-store}.
 *
 * @see ./geo-transform.ts — ο rigid μετασχηματισμός (SSoT· μηδέν νέα μαθηματικά εδώ)
 * @see ../topography/persistence/topo-frame-reconcile.ts — ο ΕΝΑΣ καταναλωτής του delta
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GeoReference } from './geo-transform';
import { inverseRigidMap, mapX, mapY } from './geo-transform';

/**
 * Η ταυτότητα ενός πλαισίου συντεταγμένων, σε **σειριοποιήσιμη** μορφή (Firestore-safe:
 * επίπεδοι αριθμοί, καμία ένθετη δομή που να μπορεί να γυρίσει `undefined`).
 *
 * Ταυτόσημο περιεχόμενο με το {@link GeoReference} — και αυτό είναι σκόπιμο: η σφραγίδα
 * ΔΕΝ είναι ετικέτα που δείχνει κάπου αλλού, είναι **το ίδιο το πλαίσιο**, ώστε ένα
 * έγγραφο που φορτώνεται μήνες μετά να μπορεί να υπολογίσει το delta χωρίς να χρειάζεται
 * κανένα άλλο αρχείο.
 */
export interface ProjectFrameStamp {
  /** WORLD (ΕΓΣΑ, canonical mm) X του project local origin (0,0). */
  readonly originWorldXMm: number;
  /** WORLD (ΕΓΣΑ, canonical mm) Y του project local origin (0,0). */
  readonly originWorldYMm: number;
  /** Στροφή local→world σε μοίρες (CCW-θετική σε Y-up πλαίσιο). */
  readonly rotationDeg: number;
}

/** Το πλαίσιο του **μη-γεωαναφερμένου** έργου: WORLD ≡ DISPLAY. */
export const UNREFERENCED_FRAME: ProjectFrameStamp = {
  originWorldXMm: 0,
  originWorldYMm: 0,
  rotationDeg: 0,
};

/**
 * Ανοχή ταυτότητας πλαισίου.
 *
 * Το `1e-6` mm είναι **νανόμετρο** — δεκάδες τάξεις κάτω από οτιδήποτε τοπογραφικά ορατό,
 * αλλά αρκετό ώστε ένα ξανα-υπολογισμένο auto-align που δίνει `407565290.0000000001` να
 * μην θεωρηθεί «νέο πλαίσιο» και να σκορπίσει άσκοπες εγγραφές σκηνής. Το ίδιο για τη
 * στροφή: `1e-9°` σε ακτίνα 1 χλμ. είναι ~17 νανόμετρα.
 */
const ORIGIN_EPSILON_MM = 1e-6;
const ROTATION_EPSILON_DEG = 1e-9;

/** `GeoReference` (ή `null` = μη-γεωαναφερμένο) → η σφραγίδα του. */
export function stampOfGeoReference(geo: GeoReference | null | undefined): ProjectFrameStamp {
  if (!geo) return UNREFERENCED_FRAME;
  return {
    originWorldXMm: geo.originWorld.x,
    originWorldYMm: geo.originWorld.y,
    rotationDeg: geo.rotationDeg,
  };
}

/** Σφραγίδα → `GeoReference` (η αντίστροφη κατεύθυνση· το delta χρειάζεται και τις δύο). */
export function geoReferenceOfStamp(stamp: ProjectFrameStamp): GeoReference {
  return {
    originWorld: { x: stamp.originWorldXMm, y: stamp.originWorldYMm },
    rotationDeg: stamp.rotationDeg,
  };
}

/**
 * Είναι έγκυρη σφραγίδα αυτό που ήρθε από το έγγραφο;
 *
 * **Fail-closed guard**: ένα legacy έγγραφο δεν έχει καθόλου σφραγίδα, αλλά ένα κατεστραμμένο
 * (ή χειρόγραφα πειραγμένο) μπορεί να έχει `null`/string/NaN. Και τα δύο σημαίνουν «δεν ξέρω
 * το πλαίσιο» — και το §M10g απαγορεύει το μάντεμα. Ό,τι δεν περνά από εδώ αντιμετωπίζεται
 * ως **ασφράγιστο**, ποτέ ως «μάλλον το τρέχον».
 */
export function isValidFrameStamp(value: unknown): value is ProjectFrameStamp {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<Record<keyof ProjectFrameStamp, unknown>>;
  return (
    typeof s.originWorldXMm === 'number' && Number.isFinite(s.originWorldXMm) &&
    typeof s.originWorldYMm === 'number' && Number.isFinite(s.originWorldYMm) &&
    typeof s.rotationDeg === 'number' && Number.isFinite(s.rotationDeg)
  );
}

/** Ίδιο πλαίσιο (εντός ανοχής); Ίδιο ⇒ ο reconciler είναι **no-op** (ιδιότητα idempotency). */
export function isSameFrame(a: ProjectFrameStamp, b: ProjectFrameStamp): boolean {
  return (
    Math.abs(a.originWorldXMm - b.originWorldXMm) <= ORIGIN_EPSILON_MM &&
    Math.abs(a.originWorldYMm - b.originWorldYMm) <= ORIGIN_EPSILON_MM &&
    Math.abs(a.rotationDeg - b.rotationDeg) <= ROTATION_EPSILON_DEG
  );
}

/**
 * Ο rigid μετασχηματισμός που μεταφέρει μια οντότητα **ψημένη στο πλαίσιο `from`** στη θέση
 * που της αναλογεί **στο πλαίσιο `to`** — δηλαδή στο ίδιο σημείο του πραγματικού κόσμου.
 *
 * Πρώτα σε **στροφή γύρω από την αρχή**, μετά σε **μετατόπιση** — ακριβώς η σειρά που
 * εκτελεί ο reconciler με τα δύο υπάρχοντα SSoT (`rotateEntity` γύρω από το (0,0), μετά
 * `translateEntityByAnchor`).
 */
export interface FrameDelta {
  /** Στροφή γύρω από την αρχή (μοίρες). `0` ⇒ καθαρή μετατόπιση (η συνήθης περίπτωση). */
  readonly rotationDeg: number;
  /** Μετατόπιση σε canonical mm, **μετά** τη στροφή. */
  readonly translationMm: Point2D;
}

/**
 * Το delta `from → to`, ή `null` όταν τα δύο πλαίσια ταυτίζονται (⇒ ο καλών δεν αγγίζει τίποτα).
 *
 * ## Η παραγωγή (μηδέν νέα μαθηματικά — σύνθεση των δύο υπαρχόντων κατευθύνσεων)
 * Μια ψημένη οντότητα κάθεται σε DISPLAY του `from`. Το πραγματικό της σημείο είναι
 * `world = forward(from)(display)`. Στο νέο πλαίσιο η θέση της είναι
 * `display′ = inverse(to)(world)`. Άρα:
 *
 *     display′ = inverse(to) ∘ forward(from) (display)
 *              = R(θ_from − θ_to) · display + R(−θ_to)·(O_from − O_to)
 *
 * Το δεύτερο μέρος είναι **ακριβώς** το `inverseRigidMap(to)` εφαρμοσμένο στο `O_from` — γι'
 * αυτό εδώ δεν γράφεται ούτε ένα `cos`: ο πυρήνας είναι ο ίδιος του `geo-transform` (N.18).
 */
export function frameDelta(from: ProjectFrameStamp, to: ProjectFrameStamp): FrameDelta | null {
  if (isSameFrame(from, to)) return null;
  const inverseOfTarget = inverseRigidMap(geoReferenceOfStamp(to));
  return {
    rotationDeg: from.rotationDeg - to.rotationDeg,
    translationMm: {
      x: mapX(inverseOfTarget, from.originWorldXMm, from.originWorldYMm),
      y: mapY(inverseOfTarget, from.originWorldXMm, from.originWorldYMm),
    },
  };
}
