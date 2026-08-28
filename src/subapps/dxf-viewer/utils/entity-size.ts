/**
 * Λεξιλόγιο μεγέθους — το ΕΝΑ όνομα για την ερώτηση «σε τι μετριέται αυτό το μέγεθος;».
 *
 * ## Γιατί υπάρχει
 * Ένα σχέδιο κουβαλά **τρεις** διαφορετικές σημασιολογίες μεγέθους, και ως τώρα καμία δεν είχε
 * όνομα — ζούσαν διάσπαρτες ως συμβάσεις σε σχόλια:
 *
 * | βάση     | σημασία                                   | παραδείγματα                        |
 * |----------|-------------------------------------------|-------------------------------------|
 * | `model`  | μονάδες κόσμου· ό,τι **μετράει** το κτίριο | γεωμετρία, εισαγόμενο DXF           |
 * | `paper`  | mm **χαρτιού** × κλίμακα σχεδίου           | κείμενα, διαστάσεις, πίνακες        |
 * | `screen` | pixels οθόνης· αμετάβλητο **και** από ζουμ | λαβές, δείκτες, βοηθήματα           |
 *
 * Η διαφορά τους δεν είναι ακαδημαϊκή: είναι ακριβώς αυτή που έκανε την κλίμακα σχεδίου να
 * μεγαλώνει τους πίνακες αλλά **όχι** τα κείμενα. Ο πίνακας αποθήκευε την **πρόθεση**
 * («2,5 mm στο χαρτί») και μετέφραζε στο render· το κείμενο αποθήκευε το **αποτέλεσμα**
 * («250 μονάδες»), οπότε η κλίμακα δεν είχε τίποτα να ξαναϋπολογίσει.
 *
 * ## Η αρχή
 * **Αποθηκεύουμε πρόθεση, παράγουμε αποτέλεσμα.** Αυτή είναι η διαφορά Revit ↔ AutoCAD: το
 * AutoCAD αποθηκεύει λίστα προϋπολογισμένων υψών ανά κλίμακα, γι' αυτό χρειάζεται εντολές
 * συγχρονισμού (`ANNOUPDATE`, `OBJECTSCALE`) και γι' αυτό η ίδια η Autodesk συντηρεί σελίδες
 * υποστήριξης για «το ύψος δεν ενημερώνεται αυτόματα». Όταν το αποθηκευμένο είναι η πρόθεση,
 * **δεν υπάρχει τίποτα να συγχρονιστεί** — δομικά, όχι κατά σύμβαση.
 *
 * ## Τι ΔΕΝ είναι αυτό το αρχείο
 * ⚠️ **Δεν αντικαθιστά** το `utils/annotation-scale.ts` — το **τυλίγει**. Ο υπολογισμός
 * paper→model παραμένει ο ΕΝΑΣ (`paperHeightToModel`), τον οποίο ήδη μοιράζονται διαστάσεις,
 * scale-bar, σύμβολα και πίνακες. Εδώ προστίθεται μόνο η **ερώτηση** «ποια βάση;», όχι δεύτερη
 * μηχανή μετατροπής (N.18: δεύτερη μηχανή = δύο αριθμοί για το ίδιο πράγμα).
 *
 * @see utils/annotation-scale.ts — `paperHeightToModel`, ο ΕΝΑΣ υπολογισμός paper→model
 * @see utils/scene-units.ts — `mmToSceneUnits`, το ΕΝΑ σύστημα μονάδων
 * @see bim/table/table-entity-geometry.ts — `tableMmToWorld` / `…Live`, το πρότυπο που μιμείται
 */

import { paperHeightToModel } from './annotation-scale';
import type { SceneUnits } from './scene-units';

// ──────────────────────────────────────────────────────────────────────────────
// 1. Το λεξιλόγιο
// ──────────────────────────────────────────────────────────────────────────────

/** Οι τρεις —και μόνες— βάσεις μέτρησης μεγέθους σε ένα σχέδιο. */
export type SizeBasis = 'model' | 'paper' | 'screen';

/** Μέγεθος σε μονάδες κόσμου. Ό,τι περιγράφει το κτίριο, και κάθε εισαγόμενο DXF. */
export interface ModelSize {
  readonly basis: 'model';
  /** Μονάδες σκηνής (ό,τι λέει το `resolveSceneUnits` της σκηνής). */
  readonly value: number;
}

/**
 * Μέγεθος σε **χιλιοστά του τυπωμένου χαρτιού**. Η κλίμακα σχεδίου το μεταφράζει σε μονάδες
 * κόσμου τη στιγμή του render — άρα αλλάζει μόνη της όταν αλλάξει η κλίμακα (Revit/ArchiCAD).
 */
export interface PaperSize {
  readonly basis: 'paper';
  /** Χιλιοστά στο χαρτί (πρότυπο ISO 3098 για σημειώσεις: 2,5). */
  readonly mm: number;
}

/**
 * Μέγεθος σε **pixels οθόνης**, αμετάβλητο και από την κλίμακα **και** από το ζουμ.
 *
 * Η τρίτη σημασιολογία, δανεισμένη από τον 3D κόσμο (*constant screen size* των gizmos): μια
 * λαβή πρέπει να πιάνεται με το ίδιο δάχτυλο είτε βλέπεις όλο το οικόπεδο είτε ένα πόμολο.
 * Δεν είναι σημείωση — δεν τυπώνεται ποτέ.
 */
export interface ScreenSize {
  readonly basis: 'screen';
  /** CSS pixels. */
  readonly px: number;
}

export type EntitySize = ModelSize | PaperSize | ScreenSize;

/** Μέγεθος που λύνεται χωρίς να ξέρεις πόσο ζουμ έχει ο χρήστης. */
export type ScaleIndependentSize = ModelSize | PaperSize;

// ──────────────────────────────────────────────────────────────────────────────
// 2. Η επίλυση
// ──────────────────────────────────────────────────────────────────────────────

/** Ό,τι χρειάζεται για να απαντηθεί «πόσες μονάδες κόσμου είναι αυτό;». */
export interface SizeContext {
  /** Παρονομαστής κλίμακας σχεδίου (100 → 1:100). */
  readonly drawingScale: number;
  /** Μονάδες της ενεργής σκηνής. */
  readonly sceneUnits: SceneUnits;
}

/** Το επιπλέον που απαιτεί —και **μόνο**— η βάση `screen`. */
export interface ViewportSizeContext extends SizeContext {
  /** CSS pixels ανά μονάδα σκηνής (το `scale` του `ImmediateTransformStore`). */
  readonly pxPerSceneUnit: number;
}

/**
 * Μέγεθος → μονάδες κόσμου.
 *
 * Οι υπερφορτώσεις κάνουν το λάθος **αδύνατο σε χρόνο μεταγλώττισης** αντί για σιωπηλό σε χρόνο
 * εκτέλεσης: ένα `screen` μέγεθος **δεν μεταγλωττίζεται** χωρίς `pxPerSceneUnit`. Χωρίς αυτό, ο
 * καλών θα έπαιρνε έναν αριθμό που μοιάζει σωστός και δεν είναι — η κατηγορία σφάλματος που
 * γεννά «γιατί η λαβή είναι τεράστια όταν κάνω zoom out;».
 */
export function resolveSizeToModel(size: ScaleIndependentSize, ctx: SizeContext): number;
export function resolveSizeToModel(size: EntitySize, ctx: ViewportSizeContext): number;
export function resolveSizeToModel(
  size: EntitySize,
  ctx: SizeContext | ViewportSizeContext,
): number {
  switch (size.basis) {
    case 'model':
      return Number.isFinite(size.value) ? size.value : 0;
    case 'paper':
      // Ο ΕΝΑΣ υπολογισμός — ο ίδιος που ήδη τρέφει διαστάσεις, πίνακες και scale-bar.
      return paperHeightToModel(size.mm, ctx.drawingScale, ctx.sceneUnits);
    case 'screen': {
      const px = (ctx as ViewportSizeContext).pxPerSceneUnit;
      // Αμυντικό: οι υπερφορτώσεις το εγγυώνται στους δικούς μας καλούντες, αλλά ένα μηδενικό
      // `scale` (καμβάς πριν το layout) θα έδινε άπειρο και θα δηλητηρίαζε τα όρια.
      if (!Number.isFinite(px) || px <= 0) return 0;
      return size.px / px;
    }
  }
}

/** Ακολουθεί αυτό το μέγεθος την κλίμακα σχεδίου; (η ερώτηση που κάνει το UI του Σταδίου 3) */
export function followsDrawingScale(size: EntitySize | undefined): boolean {
  return size?.basis === 'paper';
}

/**
 * Μονάδες κόσμου → πρόθεση σε mm χαρτιού, στην κλίμακα που ίσχυε όταν γράφτηκε.
 *
 * Η αντίστροφη πράξη, για τη ρητή ενέργεια «Μετατροπή σε μέγεθος χαρτιού» ενός παλιού
 * αντικειμένου. **Ποτέ αυτόματα**: ένα υπάρχον σχέδιο δεν αλλάζει επειδή αναβαθμίστηκε ο
 * κώδικας — η ίδια αρχή που ήδη τηρεί το ADR-362 για το εισαγόμενο `DIMSTYLE`.
 */
export function modelSizeToPaper(modelValue: number, ctx: SizeContext): PaperSize {
  const unit = paperHeightToModel(1, ctx.drawingScale, ctx.sceneUnits);
  return { basis: 'paper', mm: unit > 0 ? modelValue / unit : 0 };
}

/**
 * Ερμηνεία ενός legacy μεγέθους: ό,τι δεν δηλώνει βάση **είναι** `model`.
 *
 * 🔑 Αυτή η γραμμή είναι όλη η στρατηγική μετάβασης. Κάθε αποθηκευμένη οντότητα που γράφτηκε πριν
 * το λεξιλόγιο συνεχίζει να αποδίδει **ακριβώς** ό,τι απέδιδε χθες — καμία σιωπηλή αλλαγή σε
 * σχέδιο που ο χρήστης θεωρούσε τελειωμένο.
 */
export function sizeOrLegacyModel(size: EntitySize | undefined, legacyValue: number): EntitySize {
  return size ?? { basis: 'model', value: legacyValue };
}
