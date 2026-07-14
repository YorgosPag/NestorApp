/**
 * ADR-651 Φάση Ζ — «Sheet Set»: το σύνολο φύλλων ενός έργου, **παραγόμενο** από τα
 * levels (κατόψεις ορόφων = τα φύλλα του σετ).
 *
 * Πρακτική μεγάλων (AutoCAD Sheet Set Manager / ArchiCAD Layout Book / Revit Sheet
 * List): το σετ είναι **live view** πάνω σε ΕΝΑ project data model, όχι αντίγραφο —
 * μία αλλαγή στα στοιχεία έργου ενημερώνει ΟΛΑ τα φύλλα. Εδώ: **μηδέν νέο
 * persistence**· κάθε level = ένα scene = ένα φύλλο, με αυτόματη αρίθμηση + τίτλο.
 *
 * Καθαρή, backend-agnostic συνάρτηση — SSoT για «ποια φύλλα, με ποια σειρά, με ποια
 * αρίθμηση». Η **σειρά** ορίζεται από τον καλούντα (React layer, όπου ζει το
 * `level-display-order` SSoT + το ProjectHierarchy) ⇒ το μοντέλο μένει καθαρό,
 * decoupled από React/context, και unit-testable (ghost === commit === PDF).
 *
 * @see ./sheet-numbering.ts — η καθαρή αρίθμηση (Α-1…)
 * @see ../../print/print-service.ts — `runPrintSet` (πολυσέλιδο PDF)
 * @see ../../systems/levels/level-display-order.ts — το ordering SSoT του panel
 */

import type { Level } from '../../systems/levels/config';
import type { SceneModel } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import { autoSheetNumber, sheetNumberPrefixForLocale } from './sheet-numbering';
import type { TitleBlockLocale } from './title-block-presets';

/** Ένα level + το φορτωμένο scene του — η πηγή ενός φύλλου (ήδη ταξινομημένη). */
export interface SheetSetSource {
  readonly level: Level;
  readonly scene: SceneModel;
  /** ADR-368 — προαιρετικές μονάδες σχεδίασης του ορόφου (αλλιώς από το scene). */
  readonly userDrawingUnits?: SceneUnits;
}

/**
 * ADR-651 Φάση Ι — οι **ανεπίδοτες** (pending) αλλαγές ταυτότητας ενός φύλλου, όπως τις
 * πληκτρολογεί ο χρήστης στον πίνακα φύλλων **πριν** πατήσει «Εκτύπωση». Κείμενο ως έχει:
 * **κενό = αυτόματο** (ίδια σημασιολογία με τα persisted πεδία του ορόφου — ArchiCAD
 * «Layout ID: automatic / custom»).
 */
export interface SheetIdentityEdit {
  readonly sheetNumber?: string;
  readonly title?: string;
}

/** Pending αλλαγές ανά `levelId` (μόνο για τις γραμμές που άγγιξε ο χρήστης). */
export type SheetIdentityEdits = Readonly<Record<string, SheetIdentityEdit>>;

/**
 * Ένα φύλλο του σετ: το scene του + η αυτόματη αρίθμηση/τίτλος που θα τυπωθούν στην
 * (ίδια για όλα) πινακίδα. Δομικά συμβατό με ό,τι χρειάζεται το `runPrintSet` — μία
 * δομή, μηδέν διπλότυπο (N.18).
 */
export interface SheetSetItem {
  /** Ο όροφος-φύλλο· η ταυτότητα με την οποία γράφονται πίσω οι αλλαγές (Φάση Ι). */
  readonly levelId: string;
  readonly scene: SceneModel;
  readonly userDrawingUnits?: SceneUnits;
  /** Ο τελικός αριθμός (χειρόγραφος ή αυτόματος) → `{{drawing.sheetNumber}}` override. */
  readonly sheetNumber: string;
  /** Τίτλος φύλλου (ανθρώπινη ετικέτα ορόφου) → `{{drawing.title}}` override. */
  readonly title: string;
}

export interface SheetSet {
  readonly sheets: readonly SheetSetItem[];
}

export interface BuildSheetSetOptions {
  /** Γλώσσα προτύπου → πρόθεμα αρίθμησης (Α για ελληνικά, A για αγγλικά). */
  readonly locale: TitleBlockLocale;
  /**
   * ADR-651 Φάση Ι — pending αλλαγές του διαλόγου. Το PDF τυπώνεται με **αυτό που είδε ο
   * χρήστης**, χωρίς να περιμένει το Firestore round-trip (μηδέν race· N.7.2 #2).
   */
  readonly edits?: SheetIdentityEdits;
}

/**
 * Ο τίτλος ενός φύλλου = η ανθρώπινη ετικέτα του ορόφου (fallback: το όνομά του).
 * SSoT — τον μοιράζονται το σετ εκτύπωσης (Φάση Ζ) και το αποτύπωμα αναθεώρησης (Φάση Η):
 * το φύλλο λέγεται το ΙΔΙΟ και στο PDF και στον πίνακα αναθεωρήσεων.
 */
export function sheetTitleForLevel(level: Level): string {
  return titleFromText(level.entityLabel, level);
}

/** Ο κανόνας «κείμενο ετικέτας → τίτλος φύλλου» σε ΕΝΑ σημείο: κενό ⇒ όνομα ορόφου. */
function titleFromText(text: string | null | undefined, level: Level): string {
  return text?.trim() || level.name;
}

/**
 * ADR-651 Φάση Ι — **η ΜΟΝΗ σειρά προτεραιότητας** για την ταυτότητα ενός φύλλου, σε ένα
 * σημείο (N.7.2 #5):
 *
 *  1. **pending edit** — αν ο χρήστης **άγγιξε** το πεδίο, ό,τι γράφει ΕΙΝΑΙ η απάντηση,
 *  2. αλλιώς **persisted** — ο αριθμός που κράτησε ο μηχανικός (`level.sheetNumberOverride`) /
 *     η ετικέτα του ορόφου (`level.entityLabel`),
 *  3. αλλιώς **αυτόματο** — αριθμός από τη ΘΕΣΗ στο σετ (Α-1, Α-2…) / όνομα ορόφου.
 *
 * ⚠️ **Κενό πεδίο = «αυτόματο», ΟΧΙ «κράτα το παλιό»** — το «Layout ID: automatic» του ArchiCAD.
 * Ένα αγγιγμένο-και-κενό πεδίο ΔΕΝ πέφτει πίσω στο persisted override· αλλιώς ο χρήστης δεν θα
 * μπορούσε ποτέ να **σβήσει** έναν χειρόγραφο αριθμό (και το `sheetLevelUpdates` θα έγραφε `null`
 * ενώ η προεπισκόπηση θα έδειχνε ακόμη την παλιά τιμή — δύο αλήθειες).
 */
export function resolveSheetIdentity(
  level: Level,
  index: number,
  prefix: string,
  edit?: SheetIdentityEdit,
): { readonly sheetNumber: string; readonly title: string } {
  const numberText = edit?.sheetNumber ?? level.sheetNumberOverride ?? '';
  return {
    sheetNumber: numberText.trim() || autoSheetNumber(index, prefix),
    title: titleFromText(edit?.title ?? level.entityLabel, level),
  };
}

/**
 * Χτίζει το σετ φύλλων από τις **ήδη ταξινομημένες** πηγές (η σειρά τους = η σειρά
 * που βλέπει ο χρήστης στο panel «Στάθμες»). Καθαρή συνάρτηση: ίδιο input ⇒ ίδιο
 * σετ + αρίθμηση. Κενές πηγές ⇒ κενό σετ (ο καλών αποφασίζει τι κάνει τότε).
 */
export function buildSheetSet(
  sources: readonly SheetSetSource[],
  options: BuildSheetSetOptions,
): SheetSet {
  const prefix = sheetNumberPrefixForLocale(options.locale);
  const sheets: SheetSetItem[] = sources.map((source, index) => ({
    levelId: source.level.id,
    scene: source.scene,
    userDrawingUnits: source.userDrawingUnits,
    ...resolveSheetIdentity(source.level, index, prefix, options.edits?.[source.level.id]),
  }));
  return { sheets };
}

/**
 * ADR-651 Φάση Ι — οι γραμμές του πίνακα φύλλων του διαλόγου: τι είναι **γραμμένο** (persisted
 * κείμενο, «» = αυτόματο) και τι θα **φανεί αν το αφήσεις κενό** (το αυτόματο, ως placeholder).
 * Καθαρή — ο διάλογος δεν ξαναϋπολογίζει ποτέ μόνος του αρίθμηση/τίτλο.
 */
export interface SheetRow {
  readonly levelId: string;
  /** Το όνομα του ορόφου — η ταυτότητα της γραμμής για τον χρήστη. */
  readonly levelName: string;
  /** Ο αυτόματος αριθμός της θέσης (placeholder του πεδίου «Αριθμός»). */
  readonly autoNumber: string;
  /** Ο αυτόματος τίτλος = όνομα ορόφου (placeholder του πεδίου «Τίτλος»). */
  readonly autoTitle: string;
  /** Ο persisted χειρόγραφος αριθμός («» = αυτόματος). */
  readonly numberText: string;
  /** Η persisted ετικέτα ορόφου («» = όνομα ορόφου). */
  readonly titleText: string;
}

export function buildSheetRows(
  sources: readonly SheetSetSource[],
  options: BuildSheetSetOptions,
): readonly SheetRow[] {
  const prefix = sheetNumberPrefixForLocale(options.locale);
  return sources.map(({ level }, index) => ({
    levelId: level.id,
    levelName: level.name,
    autoNumber: autoSheetNumber(index, prefix),
    autoTitle: level.name,
    numberText: level.sheetNumberOverride ?? '',
    titleText: level.entityLabel ?? '',
  }));
}
