'use client';

/**
 * @fileoverview **Το ημερολόγιο καταλύματος ως κατάσταση οθόνης** — φόρτωση παραθύρου,
 *   αισιόδοξη πράξη, επαναφορά σε άρνηση.
 * @related ADR-835 §20 (Στάδιο Α) · services/stay-calendar/stay-calendar.client.ts ·
 *   lib/stay/stay-calendar-optimistic.ts
 * @module hooks/owner-property/useStayCalendar
 *
 * 🔑 **Τρεις κανόνες, κανένας προαιρετικός:**
 * 1. **Μία πράξη τη φορά.** Δύο αισιόδοξες προβλέψεις η μία πάνω στην άλλη δεν
 *    επαναφέρονται σωστά αν αρνηθεί η πρώτη. Η οθόνη κλειδώνει τις πράξεις όσο `busy`.
 * 2. **Η παλιότερη απάντηση χάνει.** Κάθε φόρτωση παίρνει αύξοντα αριθμό· απάντηση
 *    παλιότερου αιτήματος (π.χ. γρήγορη αλλαγή μήνα) αγνοείται.
 * 3. **Μετά από επιτυχία, ξαναδιάβασμα.** Η πρόβλεψη είχε προσωρινή ταυτότητα· ο
 *    διακομιστής είναι η αλήθεια (ταυτότητες, `version`, ό,τι έγραψε άλλη καρτέλα).
 */

import React from 'react';
import { nowISO } from '@/lib/date-local';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { monthWindow } from '@/lib/stay/stay-calendar-month';
import { optimisticView, PENDING_ENTRY_PREFIX } from '@/lib/stay/stay-calendar-optimistic';
import type { StayCalendarView } from '@/lib/stay/stay-calendar-view';
import {
  fetchStayCalendar,
  sendStayCalendarCommand,
  type StayCalendarSendOutcome,
} from '@/services/stay-calendar/stay-calendar.client';

/** Μήνες που φορτώνονται μαζί — ο τρέχων και ο επόμενος, ώστε το «επόμενο» να είναι άμεσο. */
const MONTHS_PER_LOAD = 2;

export type StayCalendarScreenState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly view: StayCalendarView };

export interface StayCalendarController {
  readonly state: StayCalendarScreenState;
  readonly busy: boolean;
  /** Η έκβαση της **τελευταίας** πράξης — `null` μέχρι να γίνει κάποια. */
  readonly lastOutcome: StayCalendarSendOutcome | null;
  readonly send: (command: StayCalendarCommand) => Promise<StayCalendarSendOutcome>;
  readonly reload: () => void;
}

export function useStayCalendar(ownerPropertyId: string, monthKey: string): StayCalendarController {
  const [state, setState] = React.useState<StayCalendarScreenState>({ kind: 'loading' });
  const [busy, setBusy] = React.useState(false);
  const [lastOutcome, setLastOutcome] = React.useState<StayCalendarSendOutcome | null>(null);
  const loadSeq = React.useRef(0);
  const pendingSeq = React.useRef(0);

  const load = React.useCallback(async (): Promise<void> => {
    const seq = ++loadSeq.current;
    const result = await fetchStayCalendar(ownerPropertyId, monthWindow(monthKey, MONTHS_PER_LOAD));
    if (seq !== loadSeq.current) return;
    setState(result.kind === 'loaded' ? { kind: 'ready', view: result.view } : { kind: result.kind });
  }, [ownerPropertyId, monthKey]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const send = React.useCallback(async (command: StayCalendarCommand): Promise<StayCalendarSendOutcome> => {
    const before = state;
    if (before.kind === 'ready' && before.view.kind === 'readable') {
      const pendingId = `${PENDING_ENTRY_PREFIX}${++pendingSeq.current}`;
      setState({ kind: 'ready', view: optimisticView(before.view, command, pendingId, nowISO()) });
    }
    setBusy(true);
    const outcome = await sendStayCalendarCommand(ownerPropertyId, command);
    setLastOutcome(outcome);
    if (outcome.kind === 'ok') {
      await load();
    } else {
      // Επαναφορά στο ΠΡΟΗΓΟΥΜΕΝΟ στιγμιότυπο — και ακύρωση κάθε φόρτωσης σε εξέλιξη,
      // που θα έφερνε πίσω την πρόβλεψη.
      loadSeq.current += 1;
      setState(before);
    }
    setBusy(false);
    return outcome;
  }, [ownerPropertyId, state, load]);

  const reload = React.useCallback(() => {
    void load();
  }, [load]);

  return { state, busy, lastOutcome, send, reload };
}
