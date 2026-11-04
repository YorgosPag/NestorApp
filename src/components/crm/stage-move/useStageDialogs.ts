'use client';

/**
 * @fileoverview **Οι διάλογοι μιας μετακίνησης, ως υποσχέσεις** (ADR-930).
 * @module components/crm/stage-move/useStageDialogs
 *
 * Η μετακίνηση ρωτά «τι λέει ο άνθρωπος;» και **περιμένει** — `askClose` επιστρέφει το αίτημα κλεισίματος ή `null`
 * (Άκυρο ⇒ η κάρτα γυρίζει), `askReopen` επιστρέφει ναι/όχι. Κανένα αίτημα δεν φεύγει πριν απαντήσει ο άνθρωπος.
 * Ένας διάλογος τη φορά: νέα ερώτηση ενώ μια είναι ανοιχτή ⇒ η παλιά απαντιέται «Άκυρο».
 */

import { useCallback, useRef, useState } from 'react';

import type { OpportunityStage } from '@/config/crm/opportunity-stages';
import type { StageTransitionRequest } from '@/services/crm/opportunity-stage-transition';
import type { Opportunity } from '@/types/crm';

export type ClosingKind = 'won' | 'lost';
export type ClosingRequest = Extract<StageTransitionRequest, { kind: ClosingKind }>;

export type StageDialogState =
  | { readonly kind: 'none' }
  | { readonly kind: 'close'; readonly opportunity: Opportunity; readonly closing: ClosingKind }
  | { readonly kind: 'reopen'; readonly opportunity: Opportunity; readonly target: OpportunityStage };

type Pending = { readonly settle: (answer: ClosingRequest | boolean | null) => void };

export interface StageDialogs {
  readonly state: StageDialogState;
  readonly askClose: (opportunity: Opportunity, closing: ClosingKind) => Promise<ClosingRequest | null>;
  readonly askReopen: (opportunity: Opportunity, target: OpportunityStage) => Promise<boolean>;
  readonly answer: (answer: ClosingRequest | boolean | null) => void;
}

export function useStageDialogs(): StageDialogs {
  const [state, setState] = useState<StageDialogState>({ kind: 'none' });
  const pending = useRef<Pending | null>(null);

  const open = useCallback(<A>(next: StageDialogState, cancelled: A) => new Promise<A>((resolve) => {
    pending.current?.settle(null);
    pending.current = { settle: (value) => resolve((value ?? cancelled) as A) };
    setState(next);
  }), []);

  const answer = useCallback((value: ClosingRequest | boolean | null) => {
    const current = pending.current;
    pending.current = null;
    setState({ kind: 'none' });
    current?.settle(value);
  }, []);

  const askClose = useCallback(
    (opportunity: Opportunity, closing: ClosingKind) => open<ClosingRequest | null>({ kind: 'close', opportunity, closing }, null),
    [open],
  );
  const askReopen = useCallback(
    (opportunity: Opportunity, target: OpportunityStage) => open<boolean>({ kind: 'reopen', opportunity, target }, false),
    [open],
  );
  return { state, askClose, askReopen, answer };
}
