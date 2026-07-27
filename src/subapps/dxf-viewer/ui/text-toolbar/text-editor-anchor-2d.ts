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
 * Η προβολή είναι η ίδια που κάνει το `CoordinateTransforms.worldToScreen`:
 *   screenX = world.x · scale + offsetX
 *   screenY = (ύψος καμβά) − world.y · scale − offsetY     ← ο άξονας Y του DXF κοιτά ΠΑΝΩ
 *
 * Import-time καθαρό: μηδέν React, μηδέν THREE. Αγγίζει DOM μόνο μέσα στο `project()`
 * (getBoundingClientRect του container), δηλαδή τη στιγμή του tick.
 */

import type { Point2D } from '../../rendering/types/Types';
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
      const t = getImmediateTransform();
      const rect = container.getBoundingClientRect();
      return {
        x: rect.left + worldPoint.x * t.scale + t.offsetX,
        y: rect.top + (container.clientHeight - worldPoint.y * t.scale - t.offsetY),
      };
    },
    subscribe: (reproject) => subscribeTransform(reproject),
  };
}
