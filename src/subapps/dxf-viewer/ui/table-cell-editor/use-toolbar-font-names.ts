'use client';

/**
 * ADR-739 §55 — **οι διαθέσιμες γραμματοσειρές, τη στιγμή του δεξιού κλικ.**
 *
 * ## Γιατί getter και όχι το `useTextPanelFonts`
 * Η **γνώση** είναι η ίδια και ζει σε ένα σημείο ({@link collectAvailableFontNames}). Αυτό που
 * διαφέρει είναι το **πότε**: το πάνελ κειμένου θέλει συνδρομή (η λίστα αλλάζει ενόσω το πάνελ
 * είναι ανοιχτό), τα μενού του πίνακα **δεν επιτρέπεται** να έχουν καμία — ζουν μέσα στον
 * `CanvasSection`, όπου κάθε συνδρομή γίνεται re-render του orchestrator (ADR-040 κανόνας #1).
 *
 * Και είναι και **ορθότητα**, όχι μόνο απόδοση: η λίστα οφείλει να είναι αυτή που ισχύει τη
 * στιγμή που ανοίγει η γραμμή, όχι αυτή του τελευταίου render — ίδιο σκεπτικό με το
 * {@link useLiveTable} δίπλα.
 *
 * ## Γιατί χωριστό αρχείο
 * Το ζητούν **δύο** μενού (ζώνες δείκτη, περιοχή κελιών). Τρεις γραμμές αντιγραμμένες δύο
 * φορές δεν φτάνουν το κατώφλι του jscpd (N.18) — δηλαδή είναι ακριβώς το διπλότυπο που
 * **καμία πύλη δεν βλέπει** και που αποκλίνει σιωπηλά την ημέρα που θα αλλάξει η πηγή.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-toolbar-font-names
 * @see text-engine/fonts/available-font-names.ts — η γνώση (SSoT)
 */

import { useCallback } from 'react';
import { collectAvailableFontNames } from '../../text-engine/fonts';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export function useToolbarFontNames(levelManager: LevelManagerLike): () => readonly string[] {
  return useCallback((): readonly string[] => {
    const levelId = levelManager.currentLevelId;
    return collectAvailableFontNames(levelId ? levelManager.getLevelScene(levelId) : null);
  }, [levelManager]);
}
