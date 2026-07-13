/**
 * ADR-651 Φάση Γ — Title-block tool options store (ribbon ⇄ τοποθέτηση).
 *
 * Ο **ένας** ιδιοκτήτης της απάντησης «τι ακριβώς θα μπει στο επόμενο κλικ»: ποιο preset,
 * ποιο χαρτί, ποιος προσανατολισμός, με ή χωρίς κορνίζα. Το contextual ribbon tab γράφει,
 * το `active-title-block.ts` διαβάζει **event-time** (`getState()` — καμία React συνδρομή,
 * ADR-040), όπως ακριβώς κάνει το `scale-bar-options-store` (ίδιο μοτίβο, όχι νέο).
 *
 * **Έξυπνη πρόταση χωρίς κλείδωμα** (Απόφαση Giorgio #2): όσο ο χρήστης ΔΕΝ έχει διαλέξει
 * ο ίδιος χαρτί, το `paperAutoSuggest` μένει `true` και κάθε φορά που οπλίζεται το εργαλείο
 * η πρόταση (bbox σχεδίου ÷ κλίμακα) εφαρμόζεται ξανά. Μόλις ο χρήστης πειράξει μέγεθος ή
 * προσανατολισμό, το flag πέφτει και **ποτέ ξανά** δεν του αλλάζει το πρόγραμμα την επιλογή.
 * Idempotent: `applySuggestedPaper` με ίδια πρόταση δεν γράφει τίποτα (μηδέν περιττά renders).
 *
 * @see ../text-engine/title-block/suggest-paper.ts — η πρόταση (καθαρή συνάρτηση)
 * @see ../text-engine/title-block/active-title-block.ts — ο καταναλωτής (event-time)
 */

import { create } from 'zustand';
import type { PaperOrientation, PaperSize, PaperSpec } from '../print/config/paper-types';
import {
  DEFAULT_TITLE_BLOCK_PRESET_ID,
  type TitleBlockPresetId,
} from '../text-engine/title-block/title-block-presets';

/** Αρχικό φύλλο πριν τρέξει οποιαδήποτε πρόταση (τυπικό τεχνικό φύλλο, όπως το detail sheet). */
export const DEFAULT_TITLE_BLOCK_PAPER: PaperSpec = { size: 'A3', orientation: 'landscape' };

interface TitleBlockOptionsState {
  readonly presetId: TitleBlockPresetId;
  readonly paperSize: PaperSize;
  readonly orientation: PaperOrientation;
  /** Πλήρης κορνίζα φύλλου ISO 5457 (πρακτική μεγάλων: border + πινακίδα = ΕΝΑ αντικείμενο). */
  readonly withFrame: boolean;
  /** Όσο είναι `true`, το χαρτί ακολουθεί την αυτόματη πρόταση· ο χρήστης το «κλειδώνει». */
  readonly paperAutoSuggest: boolean;
  setPreset(presetId: TitleBlockPresetId): void;
  setPaperSize(paperSize: PaperSize): void;
  setOrientation(orientation: PaperOrientation): void;
  setWithFrame(withFrame: boolean): void;
  /** Επαναφέρει τον αυτόματο τρόπο (το επόμενο όπλισμα ξαναπροτείνει χαρτί). */
  setPaperAutoSuggest(paperAutoSuggest: boolean): void;
  /** Εφαρμόζει την πρόταση — no-op αν ο χρήστης έχει διαλέξει χαρτί ή αν δεν άλλαξε τίποτα. */
  applySuggestedPaper(spec: PaperSpec): void;
}

export const useTitleBlockOptionsStore = create<TitleBlockOptionsState>((set, get) => ({
  presetId: DEFAULT_TITLE_BLOCK_PRESET_ID,
  paperSize: DEFAULT_TITLE_BLOCK_PAPER.size,
  orientation: DEFAULT_TITLE_BLOCK_PAPER.orientation,
  withFrame: true,
  paperAutoSuggest: true,
  setPreset: (presetId) => set({ presetId }),
  // Ρητή επιλογή χρήστη ⇒ σταματά η αυτόματη πρόταση (default έξυπνο, όχι κλειδωμένο).
  setPaperSize: (paperSize) => set({ paperSize, paperAutoSuggest: false }),
  setOrientation: (orientation) => set({ orientation, paperAutoSuggest: false }),
  setWithFrame: (withFrame) => set({ withFrame }),
  setPaperAutoSuggest: (paperAutoSuggest) => set({ paperAutoSuggest }),
  applySuggestedPaper: (spec) => {
    const s = get();
    if (!s.paperAutoSuggest) return;
    if (s.paperSize === spec.size && s.orientation === spec.orientation) return;
    set({ paperSize: spec.size, orientation: spec.orientation });
  },
}));

/** Το ενεργό φύλλο ως `PaperSpec` (event-time read — μηδέν συνδρομή, ADR-040). */
export function getActiveTitleBlockPaper(): PaperSpec {
  const { paperSize, orientation } = useTitleBlockOptionsStore.getState();
  return { size: paperSize, orientation };
}
