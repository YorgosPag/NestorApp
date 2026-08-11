/**
 * ADR-782 §27.4 — **πού** κάθεται κάθε σημάδι της αντιστοίχισης υποβάθρου.
 *
 * Καθαρή γεωμετρία, μηδέν DOM: ο ζωγράφος ({@link BasemapCorrespondenceMarksLeaf}) παίρνει
 * έτοιμο σχέδιο και το βάφει. Ο διαχωρισμός δεν είναι κόσμημα — είναι ότι το «σε ποιο
 * εικονοστοιχείο προσγειώνεται το σημείο της Γης» είναι **αριθμητικό** ερώτημα με μία σωστή
 * απάντηση, και μια άγκυρα οφείλει να μπορεί να το ρωτήσει χωρίς να αποδώσει React.
 *
 * ## 🔑 ΤΡΕΙΣ ΧΩΡΟΙ, ΚΑΙ Η ΣΕΙΡΑ ΤΟΥΣ ΕΙΝΑΙ ΤΟ ΟΛΟ ΘΕΜΑ
 * | Τι | Χώρος | Πώς φτάνει στην οθόνη |
 * |---|---|---|
 * | `pendingDrawing`, `pair.drawing` | **χαρτί** (DXF display, canonical mm) | `worldToScreen` |
 * | `pair.world` | **ΕΓΣΑ mm** | `projector.project(...)` → χαρτί → `worldToScreen` |
 *
 * Το δεύτερο βήμα είναι ο **λόγος ύπαρξης** αυτού του αρχείου: ένα σημείο της Γης δεν έχει
 * θέση στην οθόνη μέχρι να ρωτηθεί το **τρέχον** πλαίσιο. Γι' αυτό ο προβολέας φτιάχνεται από
 * το `frame.geo` της στιγμής της σχεδίασης και **ποτέ** δεν αποθηκεύεται μαζί με το ζεύγος.
 *
 * ## 🏆 ΤΟ ΥΠΟΛΟΙΠΟ — ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟ QGIS
 * Το QGIS Georeferencer δείχνει τα υπόλοιπα (residuals) σε **πίνακα**, μακριά από τα σημεία·
 * το AutoCAD `ALIGN` και το Revit δεν τα δείχνουν καθόλου. Εδώ δεν χρειάζεται πίνακας: με
 * **άκαμπτο** μετασχηματισμό δύο ζεύγη δεν ικανοποιούνται ταυτόχρονα παρά μόνο αν οι δύο
 * αποστάσεις συμφωνούν — άρα η **απόσταση του τετραγώνου από τον κύκλο ΕΙΝΑΙ το υπόλοιπο**,
 * ζωγραφισμένη πάνω στο σημείο που την παράγει. Καμία νέα μαθηματική: το ίδιο σφάλμα που το
 * πάνελ δηλώνει αριθμητικά ως `pointPairScaleRatio` γίνεται εδώ **ορατό μήκος**.
 *
 * ⚠️ Κάτω από {@link RESIDUAL_VISIBLE_PX} δεν ζωγραφίζεται γραμμή. Δεν είναι κατώφλι ανοχής —
 * είναι ότι μια γραμμή μήκους μισού εικονοστοιχείου δεν λέει «μικρό υπόλοιπο», λέει θόρυβο.
 *
 * @see ../../config/color-config.ts — `BASEMAP_CORRESPONDENCE_MARKS`, το λεξιλόγιο (SSoT)
 * @see ./BasemapCorrespondenceMarksLeaf.tsx — ο ζωγράφος
 */

import { BASEMAP_CORRESPONDENCE_MARKS } from '../../config/color-config';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { makeWorldToDisplayProjector, type GeoReference } from '../../systems/geo-referencing/geo-transform';
import type { BasemapPlacementSession } from '../../systems/basemap/basemap-placement-session';

/** Οι τρεις καταστάσεις σημαδιού, όπως τις ονομάζει το λεξιλόγιο. */
export type BasemapMarkStateKey = keyof typeof BASEMAP_CORRESPONDENCE_MARKS.states;

/**
 * Κάτω από αυτό το μήκος (px οθόνης) το υπόλοιπο δεν ζωγραφίζεται — δες την κεφαλίδα.
 * Ένα εικονοστοιχείο είναι η ανάλυση της ίδιας της οθόνης: πιο κάτω δεν υπάρχει «γραμμή».
 */
export const RESIDUAL_VISIBLE_PX = 1;

/** Ένα σημάδι, έτοιμο για σχεδίαση. */
export interface PlannedMark {
  readonly state: BasemapMarkStateKey;
  /** Θέση σε **εικονοστοιχεία οθόνης** του καμβά. */
  readonly x: number;
  readonly y: number;
  /**
   * Η σειρά της αντιστοιχίας (1-based), ή `null` για το εκκρεμές σημείο.
   *
   * ⚠️ Δεν είναι διακόσμηση: οι αντιστοιχίες κρατούνται `slice(-2)`, άρα μια **τρίτη** διώχνει
   * την πρώτη. Χωρίς αριθμό, ο χρήστης βλέπει «τρία σημάδια έγιναν δύο» και δεν ξέρει **ποιο**
   * έφυγε· με αριθμό, βλέπει το «1» να εξαφανίζεται και το «2» να γίνεται «1». Η σιωπηλή
   * απώλεια του §27.5 β γίνεται ορατή **χωρίς να αλλάξει η λογική** που την προκαλεί.
   */
  readonly ordinal: number | null;
}

/** Η ορατή απόκλιση ενός ζεύγους: από το σημείο **σχεδίου** προς το σημείο **χάρτη**. */
export interface PlannedResidual {
  readonly ordinal: number;
  readonly from: Point2D;
  readonly to: Point2D;
}

export interface CorrespondenceMarkPlan {
  readonly marks: readonly PlannedMark[];
  readonly residuals: readonly PlannedResidual[];
}

const EMPTY_PLAN: CorrespondenceMarkPlan = { marks: [], residuals: [] };

/** Χαρτί (DXF display mm) → εικονοστοιχεία οθόνης, με το SSoT του viewer. */
function toScreen(point: Point2D, transform: ViewTransform, viewport: Viewport): Point2D {
  return CoordinateTransforms.worldToScreen(point, transform, viewport);
}

/**
 * «Υπάρχει κάτι να ζωγραφιστεί;» — **μία** αυθεντία, δύο καταναλωτές.
 *
 * 🔴 Ήταν γραμμένο **δύο φορές** (εδώ και στην πύλη προσάρτησης του ζωγράφου) και το έπιασε
 * μετάλλαξη: σβήνοντας τη μία, οι άγκυρες έμειναν **πράσινες** επειδή η άλλη κρατούσε. Δύο
 * σώματα του ίδιου κανόνα δεν είναι πλεονασμός ασφαλείας — είναι δύο σημεία που θα δώσουν
 * διαφορετική απάντηση στην πρώτη αλλαγή, και ένα ελάττωμα που καμία άγκυρα δεν βλέπει.
 *
 * `false` εκτός του εργαλείου `match`: το `drag` έχει τη δική του συνεχή ανάδραση (πυξίδα) και
 * σημάδια αντιστοίχισης εκεί θα δήλωναν κατάσταση που κανείς δεν επεξεργάζεται — τα ζεύγη
 * επιβιώνουν της εναλλαγής εργαλείου, αλλά μόνο το `match` τα διαβάζει.
 */
export function hasCorrespondenceMarks(session: BasemapPlacementSession): boolean {
  if (session.tool !== 'match') return false;
  return session.pendingDrawing !== null || session.correspondences.length > 0;
}

/** Το σχέδιο σχεδίασης για την τρέχουσα συνεδρία, σε εικονοστοιχεία οθόνης. */
export function planCorrespondenceMarks(
  session: BasemapPlacementSession,
  geo: GeoReference,
  transform: ViewTransform,
  viewport: Viewport,
): CorrespondenceMarkPlan {
  if (!hasCorrespondenceMarks(session)) return EMPTY_PLAN;

  const projector = makeWorldToDisplayProjector(geo);
  const marks: PlannedMark[] = [];
  const residuals: PlannedResidual[] = [];

  session.correspondences.forEach((pair, index) => {
    const ordinal = index + 1;
    const drawing = toScreen(pair.drawing, transform, viewport);
    const onPaper = projector.project(pair.world.x, pair.world.y);
    const map = toScreen(onPaper, transform, viewport);

    marks.push({ state: 'drawingSettled', x: drawing.x, y: drawing.y, ordinal });
    marks.push({ state: 'mapSettled', x: map.x, y: map.y, ordinal });
    if (Math.hypot(map.x - drawing.x, map.y - drawing.y) >= RESIDUAL_VISIBLE_PX) {
      residuals.push({ ordinal, from: drawing, to: map });
    }
  });

  if (session.pendingDrawing) {
    const pending = toScreen(session.pendingDrawing, transform, viewport);
    marks.push({ state: 'drawingPending', x: pending.x, y: pending.y, ordinal: null });
  }

  return { marks, residuals };
}
