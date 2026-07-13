/**
 * ADR-651 Φάση Γ — Bridge store: εργαλείο «Πινακίδα» → contextual ribbon tab.
 *
 * Δημοσιεύει ΜΟΝΟ το handle των **placement overrides** (rotation/scale) του επόμενου κλικ —
 * ό,τι ακριβώς κάνει και το `block-library-tool-bridge-store` (ίδιο `ToolHandleLike` σχήμα,
 * μηδέν νέα έννοια).
 *
 * ⚠️ Το «ποιο preset / ποιο χαρτί / με κορνίζα;» **ΔΕΝ** ζει εδώ: το κατέχει το
 * `title-block-options-store` (SSoT), το οποίο ο bridge διαβάζει/γράφει απευθείας — έτσι η
 * επιλογή επιβιώνει και όταν το εργαλείο δεν είναι οπλισμένο, και το commit path τη διαβάζει
 * event-time χωρίς να εξαρτάται από το ribbon (ADR-040).
 *
 * @see ../../../../state/title-block-options-store.ts — preset/χαρτί/κορνίζα (SSoT)
 * @see ./block-library-tool-bridge-store.ts — το αδελφό store (ίδιο μοτίβο)
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type { TitleBlockParamOverrides } from '../../../../hooks/drawing/useTitleBlockTool';

/** Το handle που δημοσιεύει το `useTitleBlockTool.useExtension` στο ribbon. */
export interface TitleBlockToolBridgeHandle {
  readonly isActive: boolean;
  /** Τα τρέχοντα placement overrides (rotation σε ΜΟΙΡΕΣ, scale ομοιόμορφο, locale). */
  readonly overrides: TitleBlockParamOverrides;
  setParamOverrides(overrides: TitleBlockParamOverrides): void;
}

export const titleBlockToolBridgeStore = createToolBridgeStore<TitleBlockToolBridgeHandle>();
