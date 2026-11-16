'use client';

/**
 * ADR-929 §6.25 — **ποιο βήμα κοιτάζει ο άνθρωπος.**
 *
 * Η κατάσταση προτείνει βήμα (`mfdSuggestedStep`)· ο άνθρωπος μπορεί να πάει όπου θέλει (μη-γραμμικό, NN/g). Η επιλογή
 * του ισχύει **όσο ισχύει η πρόταση πάνω στην οποία πάρθηκε**: μόλις προχωρήσει η δουλειά (βαθμονόμηση ⇒ «Τοίχοι»,
 * εγγραφή τοίχων ⇒ «Κουφώματα»), η πρόταση αλλάζει και το πάνελ ακολουθεί — αυτόματη προώθηση ΜΟΝΟ μετά από επιτυχή
 * πράξη, ποτέ στη μέση μιας απόφασης.
 *
 * 🔑 Χωρίς `useEffect`: η επιλογή κρατά τη **βάση** της, και το τρέχον βήμα παράγεται στην απόδοση. Καμία ενδιάμεση
 *   απόδοση με μπαγιάτικο βήμα, καμία κούρσα ανάμεσα σε «επιλογή» και «προώθηση».
 */

import * as React from 'react';
import type { MfdStepId } from './model-from-drawing-steps';

interface StepChoice {
  readonly id: MfdStepId;
  /** Η πρόταση της κατάστασης τη στιγμή της επιλογής. */
  readonly basis: MfdStepId;
}

interface ModelFromDrawingStepNavigation {
  readonly current: MfdStepId;
  readonly select: (id: MfdStepId) => void;
}

export function useModelFromDrawingStep(suggested: MfdStepId): ModelFromDrawingStepNavigation {
  const [choice, setChoice] = React.useState<StepChoice | null>(null);
  const select = React.useCallback((id: MfdStepId) => setChoice({ id, basis: suggested }), [suggested]);
  const current = choice !== null && choice.basis === suggested ? choice.id : suggested;
  return { current, select };
}
