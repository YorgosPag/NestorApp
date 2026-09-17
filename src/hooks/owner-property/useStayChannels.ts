'use client';

/**
 * @fileoverview **Τα κανάλια ως κατάσταση οθόνης** — φόρτωση, πράξη, ξαναδιάβασμα.
 * @related ADR-835 §22 (Στάδιο Γ) · services/stay-calendar/stay-channels.client.ts ·
 *   hooks/owner-property/useStayCalendar.ts
 * @module hooks/owner-property/useStayChannels
 *
 * 🔑 **ΚΑΜΙΑ αισιόδοξη ενημέρωση εδώ, και είναι απόφαση** — αντίθετα από το
 * `useStayCalendar`, όπου η πρόβλεψη είναι σωστή γιατί ο κριτής είναι **ντετερμινιστικός
 * πάνω σε δεδομένα που η οθόνη έχει**. Εδώ κάθε πράξη κάνει **εξωτερικό αίτημα σε ξένο
 * διακομιστή**: η οθόνη **δεν μπορεί** να προβλέψει ούτε αν ο σύνδεσμος διαβάζεται, ούτε
 * πόσες νύχτες θα έρθουν. Μια αισιόδοξη «✅ προστέθηκε» που γίνεται «δεν διαβάζεται»
 * είναι χειρότερη από μια αναμονή δύο δευτερολέπτων.
 *
 * ⚠️ **Μία πράξη τη φορά** (`busy`) και **η παλιότερη απάντηση χάνει** (`loadSeq`) —
 * ίδιοι δύο κανόνες με το ημερολόγιο.
 */

import React from 'react';
import type { StayChannelCommand, StayChannelsView } from '@/lib/stay/stay-channel-command';
import {
  fetchStayChannels,
  sendStayChannelCommand,
  type StayChannelsSendOutcome,
} from '@/services/stay-calendar/stay-channels.client';

export type StayChannelsScreenState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly view: StayChannelsView };

export interface StayChannelsController {
  readonly state: StayChannelsScreenState;
  readonly busy: boolean;
  readonly send: (command: StayChannelCommand) => Promise<StayChannelsSendOutcome>;
  readonly reload: () => void;
}

export function useStayChannels(ownerPropertyId: string): StayChannelsController {
  const [state, setState] = React.useState<StayChannelsScreenState>({ kind: 'loading' });
  const [busy, setBusy] = React.useState(false);
  const loadSeq = React.useRef(0);

  const load = React.useCallback(async (): Promise<void> => {
    const seq = ++loadSeq.current;
    const result = await fetchStayChannels(ownerPropertyId);
    if (seq !== loadSeq.current) return;
    setState(result.kind === 'loaded' ? { kind: 'ready', view: result.view } : { kind: result.kind });
  }, [ownerPropertyId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const send = React.useCallback(async (command: StayChannelCommand): Promise<StayChannelsSendOutcome> => {
    setBusy(true);
    const outcome = await sendStayChannelCommand(ownerPropertyId, command);
    // 🔑 Ξαναδιάβασμα **και σε άρνηση**: μια αποτυχημένη ανάγνωση feed άλλαξε κατάσταση
    //    πηγής (τελευταία προσπάθεια, μετρητής) ακόμη κι όταν η πράξη απορρίφθηκε.
    await load();
    setBusy(false);
    return outcome;
  }, [ownerPropertyId, load]);

  const reload = React.useCallback(() => {
    void load();
  }, [load]);

  return { state, busy, send, reload };
}
