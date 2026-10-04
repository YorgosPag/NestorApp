'use client';

/**
 * ADR-901 Φ2 — η υπόθεση μέσω της συμμετοχής του θεατή. **Μόνο ανάγνωση**: ο κατάλογος έρχεται ήδη
 * φιλτραρισμένος ανά ρόλο και εμβέλεια από τον server — ο client **δεν** τον ξαναπαράγει (δεν έχει, και δεν
 * πρέπει να έχει, το ωμό έγγραφο).
 *
 * Τρεις εκβάσεις, ποτέ δύο: η όψη · η **δική μου** συμμετοχή χωρίς πρόσβαση τώρα (ονομασμένη ετυμηγορία) ·
 * «δεν βρέθηκε/δεν φορτώθηκε».
 *
 * ADR-901 Φ4.4 — `reload()` μετά από αποστολή/απόσυρση: ανανέωση **στο παρασκήνιο** — η τρέχουσα όψη μένει ορατή
 * ώσπου να έρθει η νέα (κανένα spinner που αδειάζει τη σελίδα). Αποτυχία ανανέωσης ⇒ κρατά την προηγούμενη όψη.
 *
 * ADR-901 §14.8 — **ζωντανή**: το σήμα της **δικής μου** όψης (`useServerViewSignal`) φέρνει την ίδια ανανέωση στο
 * παρασκήνιο, χωρίς F5 — και **μονοτονική**: όψη με αναθεώρηση παλιότερη από αυτή που δείχνει η οθόνη απορρίπτεται.
 *
 * @module hooks/useEngagedCase
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { clientViewSignalDoc, viewSignalId, viewSignalRevisionOf } from '@/lib/conveyance/view-signal-client-ref';
import type { EngagementCaseView } from '@/lib/conveyance/view-signal-key';
import { isOlderEngagedView } from '@/lib/conveyance/case-view-freshness';
import { useServerViewSignal, type ServerViewSignalSource } from '@/services/realtime/hooks/use-server-view-signal';
import { deniedVerdictOf, fetchEngagedCase } from '@/services/conveyance/conveyance-engagement-gateway';
import type { EngagedCaseView } from '@/types/conveyance-case';
import type { EngagementVerdict } from '@/types/engagement';
import type { ViewFreshness } from '@/types/server-view';

export type EngagedCaseState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly view: EngagedCaseView }
  | { readonly kind: 'denied'; readonly verdict: EngagementVerdict }
  | { readonly kind: 'failed' };

export interface EngagedCaseHandle {
  readonly state: EngagedCaseState;
  /** Ξαναδιαβάζει την όψη στο παρασκήνιο (μετά από αποστολή/απόσυρση). */
  readonly reload: () => void;
}

/** Η νέα όψη, εκτός αν είναι **παλιότερη** από αυτή που ήδη δείχνει η οθόνη (αργή ανάγνωση που έφτασε δεύτερη). */
function nextState(current: EngagedCaseState, view: EngagedCaseView): EngagedCaseState {
  return isOlderEngagedView(view, current.kind === 'ready' ? current.view : null) ? current : { kind: 'ready', view };
}

/** Ανάγνωση στο παρασκήνιο· επιστρέφει την αναθεώρηση της όψης που ήρθε, ή `null`. Αποτέλεσμα άλλης συμμετοχής ⇒ αγνοείται. */
function useEngagedFetch(engagementId: string, setState: (update: (current: EngagedCaseState) => EngagedCaseState) => void) {
  const latest = useRef(engagementId);
  latest.current = engagementId;
  return useCallback(async (): Promise<number | null> => {
    try {
      const { view } = await fetchEngagedCase(engagementId);
      if (latest.current !== engagementId) return null;
      setState((current) => nextState(current, view));
      return view.freshness.revision;
    } catch (error: unknown) {
      if (latest.current !== engagementId) return null;
      const verdict = deniedVerdictOf(error);
      // Ανανέωση που απέτυχε για λόγο δικτύου ⇒ μένει η όψη που υπάρχει· ονομασμένη άρνηση ⇒ φαίνεται πάντα.
      setState((current) => (verdict ? { kind: 'denied', verdict } : current.kind === 'ready' ? current : { kind: 'failed' }));
      return null;
    }
  }, [engagementId, setState]);
}

/** Το σήμα της **δικής μου** όψης — `uid` από τη σύνδεση, ποτέ από το αίτημα. */
function useEngagementViewSource(engagementId: string): ServerViewSignalSource | null {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  return useMemo(() => {
    if (!uid) return null;
    const view: EngagementCaseView = { kind: 'engagement', engagementId, uid };
    return { key: viewSignalId(view), ref: () => clientViewSignalDoc(view) };
  }, [engagementId, uid]);
}

function freshnessOf(state: EngagedCaseState): ViewFreshness | null | 'pending' {
  if (state.kind === 'loading') return 'pending';
  return state.kind === 'ready' ? state.view.freshness : null;
}

export function useEngagedCase(engagementId: string): EngagedCaseHandle {
  const [state, setState] = useState<EngagedCaseState>({ kind: 'loading' });
  const fetchView = useEngagedFetch(engagementId, setState);

  useEffect(() => {
    setState({ kind: 'loading' });
    void fetchView();
  }, [fetchView]);

  useServerViewSignal({
    source: useEngagementViewSource(engagementId),
    revisionOf: viewSignalRevisionOf,
    freshness: freshnessOf(state),
    fetch: fetchView,
    label: 'conveyance-engaged-view-signal',
  });

  const reload = useCallback(() => { void fetchView(); }, [fetchView]);
  return { state, reload };
}
