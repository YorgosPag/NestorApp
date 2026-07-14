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
import type { TextTemplate } from '../text-engine/templates/template.types';
import {
  DEFAULT_TITLE_BLOCK_PRESET_ID,
  type TitleBlockPresetId,
} from '../text-engine/title-block/title-block-presets';

/** Αρχικό φύλλο πριν τρέξει οποιαδήποτε πρόταση (τυπικό τεχνικό φύλλο, όπως το detail sheet). */
export const DEFAULT_TITLE_BLOCK_PAPER: PaperSpec = { size: 'A3', orientation: 'landscape' };

/**
 * ADR-651 Φάση Δ — AI-generated πινακίδα που **αντικαθιστά** το preset για την επόμενη
 * τοποθέτηση. Κρατά και το `withStampBox`/`stampLabel` του (η AI πινακίδα δεν είναι preset,
 * φέρνει τα δικά της). `null` ⇒ ισχύει το επιλεγμένο preset.
 */
export interface TitleBlockAiOverride {
  readonly template: TextTemplate;
  readonly withStampBox: boolean;
  /** Κείμενο κελιού σφραγίδας (περιεχόμενο σχεδίου, γλώσσα προτύπου) όταν `withStampBox`. */
  readonly stampLabel: string;
}

/**
 * ADR-651 Φάση Θ — η ταυτότητα του ενεργού προτύπου: είτε **built-in preset**
 * (`TitleBlockPresetId`) είτε **αποθηκευμένο πρότυπο βιβλιοθήκης** (enterprise id
 * `tpl_text_*` — γραφείου/έργου/μου). Ένα πεδίο, δύο βαθμίδες — γιατί ο χρήστης βλέπει ΕΝΑ
 * ενωμένο dropdown (Revit content library: system content + office content δίπλα-δίπλα).
 *
 * Ο `active-title-block.ts` ρωτά **πρώτα** τη βιβλιοθήκη και μετά τα presets· άγνωστο id
 * (διαγραμμένο πρότυπο) πέφτει στο default preset — ποτέ crash.
 */
export type TitleBlockTemplateId = TitleBlockPresetId | string;

interface TitleBlockOptionsState {
  readonly presetId: TitleBlockTemplateId;
  readonly paperSize: PaperSize;
  readonly orientation: PaperOrientation;
  /** Πλήρης κορνίζα φύλλου ISO 5457 (πρακτική μεγάλων: border + πινακίδα = ΕΝΑ αντικείμενο). */
  readonly withFrame: boolean;
  /**
   * ADR-651 Φάση Λ — κελί QR (σύνδεσμος έργου + αποτύπωμα έκδοσης) δεξιά στην πινακίδα. Off by
   * default: μόνο όποιος το ζητά ρητά αλλάζει την πινακίδα του (§8 #8, Δρόμος Γ = Autodesk ACC).
   */
  readonly withQr: boolean;
  /** Όσο είναι `true`, το χαρτί ακολουθεί την αυτόματη πρόταση· ο χρήστης το «κλειδώνει». */
  readonly paperAutoSuggest: boolean;
  /** ADR-651 Φάση Δ — AI πινακίδα που υπερισχύει του preset (ή `null`). */
  readonly aiOverride: TitleBlockAiOverride | null;
  setPreset(presetId: TitleBlockTemplateId): void;
  /** Ορίζει/καθαρίζει την AI πινακίδα (η επιλογή preset από τον χρήστη την καθαρίζει). */
  setAiOverride(aiOverride: TitleBlockAiOverride | null): void;
  setPaperSize(paperSize: PaperSize): void;
  setOrientation(orientation: PaperOrientation): void;
  setWithFrame(withFrame: boolean): void;
  /** ADR-651 Φάση Λ — ενεργοποιεί/απενεργοποιεί το κελί QR στην επόμενη τοποθέτηση/εκτύπωση. */
  setWithQr(withQr: boolean): void;
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
  withQr: false,
  paperAutoSuggest: true,
  aiOverride: null,
  // Ρητή επιλογή preset ⇒ καθαρίζει τυχόν AI πινακίδα (ο χρήστης γύρισε σε έτοιμο πρότυπο).
  setPreset: (presetId) => set({ presetId, aiOverride: null }),
  setAiOverride: (aiOverride) => set({ aiOverride }),
  // Ρητή επιλογή χρήστη ⇒ σταματά η αυτόματη πρόταση (default έξυπνο, όχι κλειδωμένο).
  setPaperSize: (paperSize) => set({ paperSize, paperAutoSuggest: false }),
  setOrientation: (orientation) => set({ orientation, paperAutoSuggest: false }),
  setWithFrame: (withFrame) => set({ withFrame }),
  setWithQr: (withQr) => set({ withQr }),
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
