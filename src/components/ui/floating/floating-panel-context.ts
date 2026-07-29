'use client';

/**
 * ADR-723 / ADR-724 Φ3 — Το **context** μιας αιωρούμενης παλέτας: η γραμμή επικοινωνίας
 * ανάμεσα στη ρίζα και τα compound παιδιά της.
 *
 * ── ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ──
 *
 * Ίδιο ακριβώς σκεπτικό με το `useFloatingPanelGeometry.ts`, γραμμένο ήδη εκεί: *«το component
 * είναι **απόδοση**, αυτό εδώ είναι **κατάσταση**»*. Το `FloatingPanel.tsx` έφτασε στις 510
 * γραμμές όταν η Φ3 πρόσθεσε τη μη-πετώσα παραλλαγή — πάνω από το όριο των 500 (N.7.1).
 *
 * ⛔ Η εύκολη «διόρθωση» θα ήταν να κοπεί τεκμηρίωση. Το όριο του N.7.1 υπάρχει για **μία
 * ευθύνη ανά αρχείο**, όχι για λιγότερα σχόλια: κόβοντας το «γιατί» θα ικανοποιούσαμε τον
 * μετρητή και θα χάναμε τον λόγο του κανόνα. Εξάγεται η ευθύνη, όχι το κείμενο.
 *
 * Μηδέν JSX εδώ επίτηδες — ένα αρχείο context που αποδίδει κάτι είναι δύο πράγματα ξανά.
 */

import { createContext, useContext } from 'react';
import type React from 'react';
import type { ResizeEdge } from '@/hooks/useResizable';
// `PanelPosition` και όχι `FloatingPanelPosition`: το δεύτερο είναι απλώς alias του πρώτου
// μέσα στο `FloatingPanel.tsx`. Δανειζόμενοι το **πρωτότυπο** από τη γεωμετρία, αυτό το αρχείο
// δεν εξαρτάται καθόλου από το component — ούτε καν με `import type`.
import type { PanelPosition } from './floating-panel-geometry';

/** Ό,τι μοιράζεται η ρίζα με τα compound παιδιά της. */
export interface FloatingPanelContextValue {
  readonly position: PanelPosition;
  readonly isDragging: boolean;
  readonly isResizing: boolean;
  readonly isMounted: boolean;
  readonly handleMouseDown: (e: React.MouseEvent) => void;
  readonly startResize: (edge: ResizeEdge, e: React.PointerEvent) => void;
  readonly onClose?: () => void;
  readonly elementRef: React.RefObject<HTMLDivElement>;
  /** ADR-723 — id του `<h3>` τίτλου· η ρίζα το δείχνει με `aria-labelledby`. */
  readonly titleId: string;
  /** `true` όταν η ρίζα επιβάλλει ρητό width/height ⇒ το σώμα πρέπει να κυλά. */
  readonly isSizeControlled: boolean;
}

export const FloatingPanelContext = createContext<FloatingPanelContextValue | null>(null);

/**
 * ADR-724 Φ3 — «Είμαι μέσα σε αιωρούμενη παλέτα;» **χωρίς** εξαίρεση.
 *
 * Ένα component που πρέπει να λειτουργεί **και** μέσα **και** έξω από `FloatingPanel` (η
 * επικεφαλίδα της κύριας παλέτας του viewer: αγκυρωμένη ή αιωρούμενη, **ίδιο** component) δεν
 * μπορεί να καλέσει το {@link useFloatingPanelContext} — θα έσκαγε στην αγκυρωμένη κατάσταση.
 *
 * ⛔ Η προφανής εναλλακτική είναι **λάθος** και γι' αυτό γράφεται εδώ: «κάλεσε το hook μόνο
 * όταν αιωρείται» παραβιάζει τους κανόνες των hooks (υπό συνθήκη κλήση). Ένα hook που
 * επιστρέφει `null` καλείται **πάντα** και απαντά ειλικρινά.
 *
 * @returns το context, ή `null` όταν ο καλών δεν είναι απόγονος `FloatingPanel`
 */
export const useFloatingPanelContextOptional = (): FloatingPanelContextValue | null =>
  useContext(FloatingPanelContext);

/**
 * Το context, ή **εξαίρεση**. Για τα compound παιδιά, που δεν έχουν νόημα εκτός panel:
 * ένα σιωπηλό `null` εκεί θα γινόταν `undefined is not a function` δέκα καρέ αργότερα.
 */
export const useFloatingPanelContext = (): FloatingPanelContextValue => {
  const context = useFloatingPanelContextOptional();
  if (!context) {
    throw new Error('FloatingPanel compound components must be used within FloatingPanel');
  }
  return context;
};
