/**
 * ADR-782 §23 — τα μαθηματικά της **χειροκίνητης τοποθέτησης** του υποβάθρου.
 *
 * ## 🔑 Καμία νέα τριγωνομετρία — και αυτό είναι ο κανόνας, όχι το αποτέλεσμα
 * Κάθε συνάρτηση εδώ είναι **σύνθεση** πάνω στο υπάρχον SSoT `geo-transform`: το `forwardRigidMap`
 * (+ `mapX`/`mapY`) για να ρωτηθεί «ποιο σημείο της Γης κάθεται τώρα εδώ;», και το
 * {@link fromTwoPointPairs} — το ίδιο που χρησιμοποιεί η **δηλωμένη** γεωαναφορά (ADR-650 M10,
 * Revit 2-point align) — για να συντεθεί το νέο πλαίσιο. Ένα `Math.cos` γραμμένο σε αυτό το
 * αρχείο θα ήταν **δεύτερη** υλοποίηση της ίδιας στροφής, που «δουλεύει» μέχρι τη μέρα που η μία
 * αποκτά διόρθωση προσήμου και η άλλη όχι.
 *
 * ## Το μοντέλο, σε μία πρόταση
 * Το σχέδιο **δεν μετακινείται ποτέ**: οι γραμμές του κρατούν τις συντεταγμένες τους, αλλιώς θα
 * άλλαζαν οι διαστάσεις του κτιρίου. Ό,τι αλλάζει είναι το **πλαίσιο** — δηλαδή ποιο σημείο του
 * κόσμου αντιστοιχεί σε ποιο σημείο του χαρτιού. Οπτικά αυτό διαβάζεται ως «γλιστράει ο χάρτης
 * από κάτω», που είναι και η αλήθεια.
 *
 * ## Δύο δρόμοι για τον ίδιο προορισμό (απόφαση Giorgio 2026-08-10)
 * | Δρόμος | Πράξη | Συνάρτηση |
 * |---|---|---|
 * | Άμεσος χειρισμός | πιάνω τον χάρτη και τον σέρνω / τον στρίβω | {@link panBasemapFrame} · {@link rotateBasemapFrame} |
 * | Αντιστοιχίες | δείχνω σημείο του σχεδίου και το ίδιο σημείο του χάρτη | {@link placeBasemapByPointPairs} |
 *
 * ⚠️ Και οι δύο γράφουν στο **ίδιο** store και παράγουν τον **ίδιο** τύπο. Δύο δρόμοι με δύο
 * αναπαραστάσεις θα ήταν δύο αλήθειες: το φινίρισμα με αντιστοιχίες θα «ξεχνούσε» το σύρσιμο, ή
 * αντίστροφα — και η βλάβη θα φαινόταν ως «πηδάει ο χάρτης όταν αλλάζω εργαλείο».
 *
 * Καθαρό module: μηδέν store, μηδέν React, μηδέν I/O. Όλα τα σημεία είναι σε **χαρτί** (τοπικά
 * canonical mm του σχεδίου) εκτός αν λέει διαφορετικά το όνομά τους.
 *
 * @see ../geo-referencing/geo-transform.ts — το SSoT του άκαμπτου μετασχηματισμού
 * @see ./basemap-placement-store.ts — πού αποθηκεύεται το αποτέλεσμα
 * @see ./basemap-frame.ts — πώς σταθμίζεται με τη δηλωμένη γεωαναφορά
 */

import type { Point2D } from '../../rendering/types/Types';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import {
  forwardRigidMap,
  fromTwoPointPairs,
  mapX,
  mapY,
  type GeoReference,
  type RigidMap,
} from '../geo-referencing/geo-transform';

/**
 * Κάτω από αυτό το μήκος (canonical mm) ένα διάνυσμα θεωρείται **εκφυλισμένο**.
 *
 * ⚠️ Δεν είναι κατώφλι διεπαφής («πολύ μικρή κίνηση, αγνόησέ την») αλλά **αριθμητικός** φρουρός:
 * το `Math.atan2(0, 0)` επιστρέφει `0` **χωρίς** να παραπονεθεί, οπότε μια στροφή γύρω από
 * μηδενικό μοχλό θα παρήγαγε απόλυτα εύλογη — και εντελώς αυθαίρετη — γωνία. Ένα νανόμετρο σε
 * σχέδιο κτιρίου είναι «ακριβώς μηδέν» με κάθε πρακτική έννοια.
 */
const DEGENERATE_MM = 1e-6;

/**
 * Μια αντιστοιχία «αυτό το σημείο του σχεδίου **είναι** εκείνο το σημείο της Γης».
 *
 * 🔑 Το δεύτερο μέλος είναι **απόλυτη** συντεταγμένη κόσμου (ΕΓΣΑ mm) και **όχι** σημείο του
 * χαρτιού, παρότι ο χρήστης δείχνει με το ποντίκι πάνω στο χαρτί. Η μετατροπή γίνεται **τη
 * στιγμή του κλικ**, με το πλαίσιο που ίσχυε τότε.
 *
 * ⚠️ Αν κρατούσαμε το σημείο του χαρτιού, η αντιστοιχία θα σήμαινε κάτι **διαφορετικό μετά από
 * κάθε μετακίνηση του χάρτη**: η πρώτη αντιστοιχία θα ακυρωνόταν σιωπηλά τη στιγμή που η ίδια
 * εφαρμοζόταν, και η δεύτερη θα λυνόταν πάνω σε ήδη ξεπερασμένα δεδομένα. Το ίδιο κάνει η
 * **δηλωμένη** γεωαναφορά (ADR-650 M10), όπου ο χρήστης πληκτρολογεί απόλυτες ΕΓΣΑ — εκεί η
 * ιδιότητα ήρθε δωρεάν, εδώ πρέπει να κατακτηθεί.
 */
export interface PlacementCorrespondence {
  /** Το σημείο πάνω στο **σχέδιο** (χαρτί, τοπικά mm) — π.χ. η γωνία του οικοπέδου. */
  readonly drawing: Point2D;
  /** Το σημείο της **Γης** που έδειξε ο χρήστης πάνω στον χάρτη (ΕΓΣΑ canonical mm). */
  readonly world: Point2D;
}

/** Το σημείο του **κόσμου** (ΕΓΣΑ mm) που κάθεται αυτή τη στιγμή κάτω από ένα σημείο του χαρτιού. */
function worldUnder(map: RigidMap, display: Point2D): Point2D {
  return { x: mapX(map, display.x, display.y), y: mapY(map, display.x, display.y) };
}

/** Μήκος διανύσματος `a → b`. */
function span(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * **Σύρσιμο**: το σημείο του χάρτη που φαίνεται τώρα στο `from` μετακινείται στο `to`.
 *
 * Η στροφή **δεν αλλάζει** — γι' αυτό η πράξη είναι διαφορά δύο κόσμων και όχι νέα σύνθεση:
 * όποιος έσερνε μέσω `fromOnePointPair` θα μηδένιζε σιωπηλά τη στροφή που ο χρήστης μόλις
 * ρύθμισε, δηλαδή το σύρσιμο θα «ξεστρίβωνε» τον χάρτη.
 */
export function panBasemapFrame(geo: GeoReference, from: Point2D, to: Point2D): GeoReference {
  const map = forwardRigidMap(geo);
  const worldFrom = worldUnder(map, from);
  const worldTo = worldUnder(map, to);
  return {
    originWorld: {
      x: geo.originWorld.x + (worldFrom.x - worldTo.x),
      y: geo.originWorld.y + (worldFrom.y - worldTo.y),
    },
    rotationDeg: geo.rotationDeg,
  };
}

/**
 * **Στροφή** γύρω από το `pivot`: το σημείο του χάρτη που φαίνεται τώρα στο `from` έρχεται στη
 * **διεύθυνση** του `to`.
 *
 * Εκφράζεται ως δύο αντιστοιχίες και λύνεται από το SSoT:
 *   - `pivot` ↦ ο κόσμος που ήδη κάθεται εκεί  ⇒ ο άξονας **δεν κουνιέται**
 *   - `to` ↦ ο κόσμος που καθόταν στο `from`   ⇒ η γωνία που έσυρε ο χρήστης
 *
 * ⚠️ Η **απόσταση** του δείκτη από τον άξονα αγνοείται, και αυτό είναι το σωστό: ο άκαμπτος
 * μετασχηματισμός δεν έχει κλίμακα, οπότε το σημείο προσγειώνεται στη νέα διεύθυνση κρατώντας
 * την ακτίνα του. Μια λαβή στροφής που μεγέθυνε τον χάρτη όταν απομακρύνεσαι θα ήταν παραμόρφωση
 * αναφοράς — ακριβώς αυτό που κανένας από τους μεγάλους δεν επιτρέπει σε γεωαναφορά.
 */
export function rotateBasemapFrame(
  geo: GeoReference,
  pivot: Point2D,
  from: Point2D,
  to: Point2D,
): GeoReference {
  if (span(pivot, from) < DEGENERATE_MM || span(pivot, to) < DEGENERATE_MM) return geo;
  const map = forwardRigidMap(geo);
  const next = fromTwoPointPairs(pivot, to, worldUnder(map, pivot), worldUnder(map, from));
  return { originWorld: next.originWorld, rotationDeg: normalizeAngleDeg(next.rotationDeg) };
}

/**
 * Το `R(θ)·p` του τρέχοντος πλαισίου — η στροφή **χωρίς** τη μετατόπισή του.
 *
 * Βγαίνει ως διαφορά δύο τιμών του ίδιου προετοιμασμένου χάρτη, ώστε το `cos/sin` να μένει εκεί
 * όπου ζει (SSoT `geo-transform`) και να μην ξαναγραφεί εδώ.
 */
function rotateOnly(map: RigidMap, p: Point2D): Point2D {
  return { x: mapX(map, p.x, p.y) - map.tx, y: mapY(map, p.x, p.y) - map.ty };
}

/**
 * **Αντιστοιχίες σημείων**: το φινίρισμα.
 *
 * | Πλήθος | Τι λύνεται | Γιατί |
 * |---|---|---|
 * | 0 | τίποτα | καμία δήλωση του χρήστη· επιστρέφεται το πλαίσιο ως έχει |
 * | 1 | **μόνο μετατόπιση** | ένα σημείο δεν περιέχει καμία πληροφορία στροφής — μια στροφή που θα «προέκυπτε» από αυτό θα ήταν εφεύρεση |
 * | ≥2 | μετατόπιση **και** στροφή | δύο σημεία ορίζουν διεύθυνση (Revit 2-point align) |
 *
 * ⚠️ Με **ένα** ζεύγος διατηρείται η υπάρχουσα στροφή αντί να μηδενιστεί: ο χρήστης μπορεί να
 * έχει ήδη στρίψει τον χάρτη με τη λαβή και τώρα να διορθώνει μόνο τη θέση. Το `fromOnePointPair`
 * του SSoT κάνει το αντίθετο **σκόπιμα** — εκεί το ένα σημείο *είναι* ολόκληρη η δήλωση, ενώ εδώ
 * είναι διόρθωση πάνω σε υπάρχουσα τοποθέτηση.
 *
 * ⚠️ Λαμβάνονται υπόψη οι **δύο πρώτες** αντιστοιχίες. Μια τρίτη θα ήταν υπερκαθορισμός που ζητά
 * ελαχιστοποίηση σφάλματος — υπάρχει μηχανή γι' αυτό (`geo-similarity-solve`), αλλά απαντά **άλλο
 * ερώτημα**: εκεί συνταιριάζονται **μετρημένα** σημεία, εδώ δείχνει ο χρήστης με το ποντίκι πάνω
 * σε ράστερ. Μέση τιμή τριών μαντεψιών δεν είναι μέτρηση.
 */
export function placeBasemapByCorrespondences(
  geo: GeoReference,
  pairs: readonly PlacementCorrespondence[],
): GeoReference {
  const [first, second] = pairs;
  if (!first) return geo;

  if (!second) {
    const rotated = rotateOnly(forwardRigidMap(geo), first.drawing);
    return {
      originWorld: { x: first.world.x - rotated.x, y: first.world.y - rotated.y },
      rotationDeg: geo.rotationDeg,
    };
  }

  if (span(first.drawing, second.drawing) < DEGENERATE_MM) return geo;
  if (span(first.world, second.world) < DEGENERATE_MM) return geo;

  const next = fromTwoPointPairs(first.drawing, second.drawing, first.world, second.world);
  return { originWorld: next.originWorld, rotationDeg: normalizeAngleDeg(next.rotationDeg) };
}
