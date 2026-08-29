'use client';

/**
 * ADR-739 §46 — **η React καλωδίωση του διπλού κλικ** πάνω στον 2D καμβά.
 *
 * ## Γιατί δικό του αρχείο (ADR-828 Φ4α, 2026-08-29)
 * Η **απόφαση** ζούσε ήδη χωριστά (`table-double-click-gesture.ts`, καθαρή)· εδώ έμενε μόνο ο
 * `useCallback` που της δίνει container και μετασχηματισμό. Έμεινε μέσα στον
 * `useTableCellDoubleClickEditor` όσο υπήρχε χώρος — και το ίδιο του το σχόλιο κατέγραφε ότι
 * ακόμη και τότε «*αυτό εδώ ξαναχτύπησε τις 500 γραμμές*».
 *
 * Ο ένατος καταναλωτής εκείνου του ορίου ήταν η πληκτρολογιακή πόρτα του κουμπιού
 * συμπλήρωσης, και η επιλογή ήταν η γνωστή: **εξαγωγή, ποτέ κόψιμο τεκμηρίωσης**. Επιλέχθηκε
 * αυτός ο χειριστής και όχι κάτι άλλο επειδή ταιριάζει ακριβώς στο ρητό κριτήριο της
 * κεφαλίδας εκείνου του αρχείου: *ό,τι δεν χρειάζεται μοντέλο **και** DOM μαζί, ζει αλλού* —
 * εδώ η γνώση του μοντέλου έχει ήδη φύγει ολόκληρη στη χειρονομία, και μένει σκέτο DOM.
 *
 * ⚠️ **Καμία εξάρτηση από τον δρομέα**, επίτηδες: το πρόχειρο ζει μέσα του, άρα μια εξάρτηση
 * θα ξανάφτιαχνε αυτόν τον χειριστή σε κάθε πάτημα πλήκτρου — και ταξιδεύει ως prop μέχρι τον
 * `CanvasSection`, τον orchestrator που ο ADR-040 απαγορεύει να επαναποδίδεται. Τον δρομέα τον
 * διαβάζει η ίδια η χειρονομία, με getter, τη στιγμή του συμβάντος.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-double-click
 * @see ui/table-cell-editor/table-double-click-gesture.ts — Η ΑΠΟΦΑΣΗ (καθαρή)
 * @see ui/table-cell-editor/use-table-mode-entry.ts — ο αδελφός: είσοδος **χωρίς** σημείο
 */

import { useCallback } from 'react';
import type React from 'react';
import { applyTableDoubleClick } from './table-double-click-gesture';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { ViewTransform } from '../../rendering/types/Types';

export interface UseTableDoubleClickParams {
  readonly transformRef: React.RefObject<ViewTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly getSelectedEntityIds: () => readonly string[];
  readonly levelManager: LevelManagerLike;
}

/**
 * **Δύο** χειρονομίες σε ένα συμβάν: έξω από λειτουργία πίνακα ⇒ είσοδος σε πλοήγηση, μέσα ⇒
 * άνοιγμα του κελιού. Η διάκριση δεν γίνεται εδώ — δες `applyTableDoubleClick`.
 */
export function useTableDoubleClick(
  params: UseTableDoubleClickParams,
): (event: React.MouseEvent<HTMLDivElement>) => void {
  const { transformRef, containerRef, getSelectedEntityIds, levelManager } = params;
  return useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!container || !transform) return;
      applyTableDoubleClick({ event, container, transform, levelManager, getSelectedEntityIds });
    },
    [levelManager, getSelectedEntityIds, containerRef, transformRef],
  );
}
