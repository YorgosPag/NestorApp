/**
 * 🔴 ADR-767 Δ4 — **ΤΙ ΠΡΟΚΕΙΤΑΙ ΝΑ ΕΞΑΧΘΕΙ, ΚΑΙ ΕΙΝΑΙ ΜΠΑΓΙΑΤΙΚΟ;**
 *
 * Η κρίση για **έναν** πίνακα υπάρχει και είναι ελεγμένη (`assessBoundTablesForExport`). Εδώ
 * απαντιέται η ερώτηση που προηγείται της: **ποιοι** πίνακες μπαίνουν σε αυτή την εξαγωγή.
 *
 * ## 🔴 Η ΕΜΒΕΛΕΙΑ ΕΙΝΑΙ Η ΠΡΑΓΜΑΤΙΚΗ ΕΜΒΕΛΕΙΑ ΤΗΣ ΕΞΑΓΩΓΗΣ
 * Καλείται το **ίδιο** `resolveExportFloors` που εκτελεί η ίδια η εξαγωγή. Ένας δεύτερος
 * κανόνας εδώ («σάρωσε όλους τους ορόφους») θα ήταν λάθος και προς τις **δύο** κατευθύνσεις:
 *
 * | δεύτερος κανόνας | τι θα έσπαγε |
 * |---|---|
 * | «όλοι οι όροφοι» πάντα | εξαγωγή **μόνο** του ισογείου θα μπλοκάριζε επειδή ο 3ος όροφος έχει μπαγιάτικο πίνακα — θόρυβος, και ο χρήστης μαθαίνει να προσπερνά τον φραγμό |
 * | «μόνο ο ενεργός» πάντα | εξαγωγή **όλων** των ορόφων θα περνούσε με μπαγιάτικα νούμερα μέσα — δηλαδή ο φραγμός θα ήταν διακοσμητικός ακριβώς στη βαρύτερη περίπτωση |
 *
 * ## ⚠️ Ο ΑΠΟΤΥΧΗΜΕΝΟΣ ΕΛΕΓΧΟΣ ΔΕΝ ΕΙΝΑΙ ΨΕΥΤΙΚΟ ΠΡΑΣΙΝΟ — **εδώ**
 * Το `resolveExportFloors` **πετά** όταν ζητηθεί ο ενεργός όροφος και δεν έχει φορτωμένη
 * σκηνή. Εδώ αυτό μεταφράζεται σε «τίποτα να εξεταστεί» (`examined: 0`, `blocked: false`) —
 * και είναι το **μόνο** σωστό, όχι χαλάρωση: η ίδια κλήση θα ξαναπετάξει μέσα στο `runExport`
 * λίγα μικροδευτερόλεπτα αργότερα, οπότε **κανένα αρχείο δεν παράγεται**. Ένας φραγμός που
 * θα κραύγαζε εδώ θα έκρυβε το πραγματικό σφάλμα πίσω από λάθος μήνυμα.
 *
 * 🔑 Η διάκριση από το «0 = κανείς δεν κοίταξε» των N.11/N.12 είναι ακριβώς αυτή: εκεί το
 * ψεύτικο πράσινο **επέτρεπε** να περάσει κάτι· εδώ δεν περνά τίποτα ούτως ή άλλως.
 *
 * @module subapps/dxf-viewer/export/core/bound-table-export-preflight
 * @see bim/table/binding/table-binding-export-guard.ts — η κρίση ανά πίνακα
 * @see export/core/export-floor-scope.ts — ο ΕΝΑΣ κανόνας «ποιοι όροφοι»
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4
 */

import { assessBoundTablesForExport } from '../../bim/table/binding/table-binding-export-guard';
import { resolveExportFloors } from './export-floor-scope';
import type { BoundTableExportVerdict } from '../../bim/table/binding/table-binding-export-guard';
import type { TableSourceContext } from '../../bim/table/binding/table-source-resolver';
import type { Entity } from '../../types/entities';
import type { ExportFloorScope, ExportLevelScene } from '../types';

/** Καμία εξέταση — δες την κεφαλίδα για το γιατί αυτό **δεν** είναι ψεύτικο πράσινο. */
const NOTHING_EXAMINED: BoundTableExportVerdict = {
  blocked: false,
  stale: [],
  unchecked: [],
  examined: 0,
};

export interface BoundTableExportPreflightInput {
  readonly levelScenes: readonly ExportLevelScene[];
  readonly activeLevelId: string | null;
  readonly floorScope: ExportFloorScope;
  /** Συναρμολογημένο από τον καλούντα με τη **ΜΙΑ** γέφυρα (`readTableSourceContext`). */
  readonly context: TableSourceContext;
}

/**
 * Η ετυμηγορία για **αυτή** την εξαγωγή, πριν παραχθεί οτιδήποτε.
 *
 * Καθαρή ως προς τη σκηνή: το `context` το δίνει ο καλών, ώστε ο φραγμός και η ανανέωση να
 * κρίνουν με τα **ίδια** δεδομένα — αν το διάβαζε μόνος του, θα υπήρχαν δύο σημεία που
 * μπορούν κάποτε να ρωτήσουν άλλη επιφάνεια.
 */
export function assessExportBoundTables(
  input: BoundTableExportPreflightInput,
): BoundTableExportVerdict {
  const entities = entitiesInExportScope(input);
  if (entities === null) return NOTHING_EXAMINED;
  return assessBoundTablesForExport(entities, input.context);
}

/**
 * Οι οντότητες **ακριβώς** των ορόφων που θα εξαχθούν, ή `null` όταν η εμβέλεια δεν λύνεται.
 *
 * Το `try` δεν καταπίνει σφάλμα προγραμματισμού: το `resolveExportFloors` πετά **μία**
 * δηλωμένη περίπτωση (`EXPORT_NO_ACTIVE_SCENE`), και το `null` τη μεταφράζει σε «δεν υπάρχει
 * τίποτα να εξεταστεί». Η ίδια κλήση ξαναγίνεται μέσα στο `runExport`, όπου το σφάλμα
 * φτάνει στον χρήστη με το **σωστό** μήνυμα.
 */
function entitiesInExportScope(input: BoundTableExportPreflightInput): readonly Entity[] | null {
  try {
    const floors = resolveExportFloors(input.levelScenes, input.activeLevelId, input.floorScope);
    return floors.flatMap((floor) => floor.scene.entities);
  } catch {
    return null;
  }
}
