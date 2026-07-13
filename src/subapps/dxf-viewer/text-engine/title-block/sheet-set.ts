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
 * Ένα φύλλο του σετ: το scene του + η αυτόματη αρίθμηση/τίτλος που θα τυπωθούν στην
 * (ίδια για όλα) πινακίδα. Δομικά συμβατό με ό,τι χρειάζεται το `runPrintSet` — μία
 * δομή, μηδέν διπλότυπο (N.18).
 */
export interface SheetSetItem {
  readonly scene: SceneModel;
  readonly userDrawingUnits?: SceneUnits;
  /** Auto-numbered (Α-1, Α-2…) → `{{drawing.sheetNumber}}` override. */
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
}

/** Ο τίτλος ενός φύλλου = η ανθρώπινη ετικέτα του ορόφου (fallback: το όνομά του). */
function sheetTitleForLevel(level: Level): string {
  return level.entityLabel?.trim() || level.name;
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
    scene: source.scene,
    userDrawingUnits: source.userDrawingUnits,
    sheetNumber: autoSheetNumber(index, prefix),
    title: sheetTitleForLevel(source.level),
  }));
  return { sheets };
}
