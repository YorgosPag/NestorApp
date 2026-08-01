/**
 * ADR-344 Φ-3D — ο **2D** resolver αγκύρωσης του in-place text editor.
 *
 * Ένα από τα δύο μέλη του συμβολαίου {@link TextEditorAnchor}· ο άλλος είναι ο 3D
 * (`bim-3d/text/text-edit-anchor-3d.ts`). Ό,τι ΔΕΝ αφορά την αγκύρωση (ποια οντότητα,
 * ποιο AST, πώς γίνεται commit) ζει στο κοινό `text-edit-session.ts` και δεν διπλασιάζεται.
 *
 * ### Τι άλλαξε σε σχέση με πριν (και γιατί)
 * Παλαιότερα το άγκυρο υπολογιζόταν **μία φορά**, τη στιγμή του διπλού κλικ, από ένα
 * στιγμιότυπο του transform (`transformRef.current`), και έμενε καρφωμένο. Αποτέλεσμα: pan
 * ή zoom με ανοιχτό τον editor τον άφηνε πίσω — το κουτί σε ένα σημείο της οθόνης, τα
 * γράμματα που επεξεργάζεσαι σε άλλο. Εδώ η θέση διαβάζεται **στον χρόνο του tick** από το
 * `ImmediateTransformStore` (ADR-040: event-time read μέσω getter, ποτέ snapshot), οπότε ο
 * editor ακολουθεί τον καμβά όπως στο Figma/Miro.
 *
 * ## 🔴 Η προβολή ΔΕΝ ξαναγράφεται εδώ (διορθώθηκε 2026-08-01, ADR-739 Φ.Δ βήμα 3)
 * Μέχρι τότε αυτό το αρχείο έγραφε **δική του** εκδοχή του τύπου:
 *
 *     screenX = rect.left + world.x · scale + offsetX
 *     screenY = rect.top + (container.clientHeight − world.y · scale − offsetY)
 *
 * Είναι το `worldToScreen` **χωρίς τους χάρακες**. Η αρχή του κόσμου δεν κάθεται στην κάτω
 * αριστερή γωνία του **container** αλλά της **περιοχής σχεδίασης** (`drawing-area.ts`), που
 * είναι μικρότερη κατά `leftRulerWidth` οριζόντια και `bottomRulerHeight` κατακόρυφα. Το
 * σφάλμα ήταν **σταθερή** μετατόπιση — αόρατη σε ένα ελεύθερα αιωρούμενο κουτί TipTap,
 * **μετρήσιμη** μόλις το κουτί έπρεπε να καθίσει ακριβώς πάνω σε κελί πίνακα (μετρημένο
 * ζωντανά: ≈ 30 px αριστερά, ≈ 23 px κάτω).
 *
 * Ήταν κλασικό διπλότυπο του N.18: η **αντίστροφη** διαδρομή (`eventWorldPoint` του διπλού
 * κλικ) καλούσε ήδη το `CoordinateTransforms.screenToWorld`, δηλαδή τη σωστή, margin-aware
 * μηχανή. Οι δύο κατευθύνσεις της ΙΔΙΑΣ προβολής είχαν διαφορετική άποψη για το πού είναι η
 * αρχή. Τώρα και οι δύο περνούν από το ένα SSoT.
 *
 * Import-time καθαρό: μηδέν React, μηδέν THREE. Αγγίζει DOM μόνο μέσα στο `project()`
 * (getBoundingClientRect του container), δηλαδή τη στιγμή του tick.
 */

import type { Point2D } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getImmediateTransform, subscribeTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { TextEditorAnchor } from './TextEditorAnchorLayer';

/** Ελάχιστο ύψος κουτιού (px) όταν το κείμενο είναι πολύ μικρό στην τρέχουσα εστίαση. */
const MIN_BOX_HEIGHT_PX = 24;

/**
 * Ύψος κουτιού (px) από το ύψος κειμένου σε μονάδες κόσμου. Ο συντελεστής 4 είναι η
 * ιστορική προσέγγιση του ADR-344 Φ6.E για «μία σειρά + περιθώρια TipTap»· το TipTap
 * μεγαλώνει από μόνο του μόλις προσαρτηθεί, οπότε αυτό είναι απλώς το αρχικό πλαίσιο.
 */
export function textEditorBoxHeightPx(worldHeight: number, scale: number): number {
  return Math.max(MIN_BOX_HEIGHT_PX, worldHeight * scale * 4);
}

/**
 * Ζωντανή αγκύρωση σε ένα σημείο του κόσμου (μονάδες σκηνής) πάνω στον 2D καμβά.
 *
 * `getContainer` είναι getter και όχι τιμή επίτηδες: ο container μπορεί να προσαρτηθεί ή
 * να αποπροσαρτηθεί όσο ο editor ζει, και ένα καρφωμένο element θα κρατούσε νεκρή αναφορά.
 */
export function createTextEditorAnchor2D(params: {
  readonly worldPoint: Point2D;
  readonly getContainer: () => HTMLElement | null;
  readonly size: { readonly width: number; readonly height: number };
}): TextEditorAnchor {
  const { worldPoint, getContainer, size } = params;
  return {
    size,
    project: () => {
      const container = getContainer();
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      // Το viewport είναι **ολόκληρος** ο container — ποτέ σμικρυμένο κατά τους χάρακες
      // (ρητή προειδοποίηση του `drawing-area.ts`: το inset ζει μέσα στο `worldToScreen`,
      // και αφαιρώντας το δεύτερη φορά εδώ όλο το σχέδιο θα ανέβαινε κατά έναν χάρακα).
      const local = CoordinateTransforms.worldToScreen(worldPoint, getImmediateTransform(), {
        width: rect.width,
        height: rect.height,
      });
      // Ο μετασχηματισμός δίνει συντεταγμένες **του container**· το κουτί ζει σε `position:
      // fixed`, άρα προστίθεται η θέση του container στο παράθυρο. Ακριβώς η αντίστροφη
      // πράξη από το `event.clientX - rect.left` του διπλού κλικ.
      return { x: rect.left + local.x, y: rect.top + local.y };
    },
    subscribe: (reproject) => subscribeTransform(reproject),
  };
}
