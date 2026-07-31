'use client';

/**
 * ADR-736 §6 — Το placement tool της εντολής **ΕΙΣΑΓΩΓΗΣ εικόνας** (`attach-image`).
 *
 * Πέμπτο instance της ΚΟΙΝΗΣ entourage μηχανής (ADR-654 M6) — μηδέν νέο FSM, μηδέν νέος ghost
 * renderer. Ό,τι διαφέρει ζει στο `bim/image/attached-image-placement.ts` (ο store ξέρει το
 * μέγεθος, γιατί δεν υπάρχει catalog να το πει).
 *
 * ## Το «ΚΑΙ ΤΑ ΔΥΟ» του χρήστη (Giorgio 2026-07-31): κλικ **και** αυτόματα στο κέντρο
 *
 * Ένας μηχανισμός, δύο δρόμοι — το μοτίβο του Revit *Insert ▸ Image*: μόλις επιλεγεί το αρχείο
 * το ghost ακολουθεί τον κέρσορα· **κλικ** το καρφώνει όπου θέλει ο χρήστης, **Enter** το
 * αφήνει στο κέντρο της προβολής, **Esc** ακυρώνει (ο κοινός `EscapeCommandBus` / tool reset).
 *
 * Το Enter **δεν** είναι δεύτερη διαδρομή τοποθέτησης: υπολογίζει το σημείο και καλεί το ΙΔΙΟ
 * `onCanvasClick` — ίδιο commit, ίδιο undo, ίδιο broadcast. Γι' αυτό δεν μπορεί να αποκλίνει
 * από το κλικ, όσο κι αν αλλάξει αργότερα η τοποθέτηση.
 *
 * @see ./create-entourage-tool.ts — το factory (FSM + ghost)
 * @see ../../bim/image/attached-image-placement.ts — store + placer αυτής της οικογένειας
 * @see ../../rendering/utils/viewport-world-metrics.ts — «ποιο σημείο είναι το κέντρο»
 */

import { useEffect, useRef } from 'react';
import { isTextEntryFocused } from '@/lib/a11y/keyboard-scope';
import {
  attachedImageSelection,
  attachedImagePlacer,
} from '../../bim/image/attached-image-placement';
import { readViewportWorldMetrics } from '../../rendering/utils/viewport-world-metrics';
import {
  createEntourageTool,
  type UseEntourageToolOptions,
  type UseEntourageToolResult,
} from './create-entourage-tool';

const usePlacement = createEntourageTool({
  selection: attachedImageSelection,
  placer: attachedImagePlacer,
  statusPositionKey: 'tools.attachImage.statusPosition',
  errorNoSelectionKey: 'tools.attachImage.errorNoSelection',
  errorUnknownItemKey: 'tools.attachImage.errorUnknownItem',
});

/**
 * Enter ⇒ τοποθέτηση στο κέντρο της προβολής, όσο το εργαλείο περιμένει θέση.
 *
 * Ο listener μπαίνει **μόνο** όσο το εργαλείο είναι οπλισμένο· ένα μόνιμο global keydown θα
 * ήταν ένας ακόμη διεκδικητής του Enter σε μια εφαρμογή που το χρησιμοποιεί ήδη για commit
 * πολυγώνων και διαστάσεων (ADR-364/711 — ιδιοκτησία πληκτρολογίου).
 */
function useCommitAtViewportCenter(tool: UseEntourageToolResult): void {
  // Event-time ανάγνωση μέσω ref: ο handler γράφεται μία φορά και βλέπει πάντα το τρέχον
  // tool, χωρίς να ξαναδένεται ο listener σε κάθε αλλαγή κατάστασης (ADR-040).
  const toolRef = useRef(tool);
  toolRef.current = tool;

  useEffect(() => {
    if (!tool.isAwaitingPosition) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.defaultPrevented) return;
      if (isTextEntryFocused()) return;
      const metrics = readViewportWorldMetrics();
      if (!metrics) return;
      event.preventDefault();
      toolRef.current.onCanvasClick(metrics.center);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tool.isAwaitingPosition]);
}

/** Single-click (ή Enter) τοποθέτηση μιας εικόνας που ανέβασε ο χρήστης (ImageEntity). */
export function useAttachImageTool(
  options: UseEntourageToolOptions = {},
): UseEntourageToolResult {
  const tool = usePlacement(options);
  useCommitAtViewportCenter(tool);
  return tool;
}
