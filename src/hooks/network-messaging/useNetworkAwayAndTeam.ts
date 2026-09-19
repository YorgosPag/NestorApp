'use client';

/**
 * @fileoverview **Η ΑΠΟΥΣΙΑ ΜΟΥ · Η ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ** — οι δύο ρυθμίσεις που ζουν δίπλα στο νήμα.
 * @related ADR-867 §4.4 (απουσία) · §4.3 + Β5 (ομάδα, `If-Match`) · ADR-834 (ε) ②
 * @module hooks/network-messaging/useNetworkAwayAndTeam
 *
 * 🌴 **Η απουσία είναι ΜΟΝΟ ημερομηνίες** — κανένα ελεύθερο κείμενο (ΓΚΠΔ, §4.4).
 *
 * 👥 **Η ομάδα με αισιόδοξο έλεγχο έκδοσης** (Β5): κάθε αλλαγή στέλνει την έκδοση που **είδε** ο άνθρωπος.
 * Σύγκρουση (`stale-version`) ⇒ η οθόνη **ξαναφορτώνει** και λέει «άλλαξε στο μεταξύ» — **ποτέ** σιωπηλή
 * αντικατάσταση της αλλαγής του άλλου (Google Docs: η σύγκρουση φαίνεται, δεν καταπίνεται). ⛔ Καμία
 * αυτόματη επανάληψη πάνω στη νέα έκδοση: ο άνθρωπος αποφάσισε πάνω σε κάτι που **δεν ισχύει** πια.
 */

import { useCallback, useEffect, useState } from 'react';

import type { ActTeamChangeKind } from '@/services/network-messaging/act-team-change';
import {
  networkActTeamClient,
  networkAwayClient,
  type NetworkFailure,
} from '@/services/network-messaging/network-thread.client';
import type { NetworkActTeamResult, NetworkAwayView } from '@/types/network-wire';

export type LoadState<T> =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly value: T }
  | { readonly state: 'failed'; readonly failure: NetworkFailure };

// =============================================================================
// Η ΑΠΟΥΣΙΑ ΜΟΥ
// =============================================================================

export interface MyAway {
  readonly away: LoadState<NetworkAwayView | null>;
  readonly saving: boolean;
  readonly failure: NetworkFailure | null;
  /** `startsAt` απούσα ⇒ «από τώρα». Επιστρέφει αν πέτυχε. */
  readonly set: (endsAt: string, startsAt?: string) => Promise<boolean>;
  /** «Γύρισα». */
  readonly end: () => Promise<boolean>;
}

export function useMyNetworkAway(enabled: boolean): MyAway {
  const [away, setAway] = useState<LoadState<NetworkAwayView | null>>({ state: 'loading' });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<NetworkFailure | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    void networkAwayClient.read().then((result) => {
      if (!current) return;
      setAway(result.ok ? { state: 'ready', value: result.value.away } : { state: 'failed', failure: result.failure });
    });
    return () => {
      current = false;
    };
  }, [enabled]);

  const apply = useCallback(async (run: () => ReturnType<typeof networkAwayClient.end>) => {
    setSaving(true);
    setFailure(null);
    const result = await run();
    setSaving(false);
    if (result.ok) setAway({ state: 'ready', value: result.value.away });
    else setFailure(result.failure);
    return result.ok;
  }, []);

  const set = useCallback((endsAt: string, startsAt?: string) => apply(() => networkAwayClient.set(endsAt, startsAt)), [apply]);
  const end = useCallback(() => apply(() => networkAwayClient.end()), [apply]);

  return { away, saving, failure, set, end };
}

// =============================================================================
// Η ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ
// =============================================================================

/** Τι έγινε με την τελευταία αλλαγή — ώστε η οθόνη να το **πει**, όχι να το υπονοήσει. */
export type TeamChangeOutcome =
  | { readonly kind: 'applied' }
  | { readonly kind: 'unchanged' }
  /** Κάποιος άλλος άλλαξε την ομάδα στο μεταξύ — ξαναφορτώθηκε, τίποτα δεν γράφτηκε. */
  | { readonly kind: 'conflict' }
  | { readonly kind: 'failed'; readonly failure: NetworkFailure };

export interface ActTeamControl {
  readonly team: LoadState<NetworkActTeamResult>;
  readonly busy: boolean;
  readonly outcome: TeamChangeOutcome | null;
  readonly change: (kind: ActTeamChangeKind, uid: string) => void;
}

export function useActTeam(teamId: string | null): ActTeamControl {
  const [team, setTeam] = useState<LoadState<NetworkActTeamResult>>({ state: 'loading' });
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<TeamChangeOutcome | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (teamId === null) return undefined;
    let current = true;
    void networkActTeamClient.read(teamId).then((result) => {
      if (!current) return;
      setTeam(result.ok ? { state: 'ready', value: result.value } : { state: 'failed', failure: result.failure });
    });
    return () => {
      current = false;
    };
  }, [teamId, generation]);

  const change = useCallback(
    (kind: ActTeamChangeKind, uid: string) => {
      if (teamId === null || team.state !== 'ready' || busy) return;
      setBusy(true);
      setOutcome(null);
      void networkActTeamClient.change(teamId, { kind, uid }, team.value.team.version).then((result) => {
        setBusy(false);
        setGeneration((value) => value + 1);
        if (result.ok) setOutcome({ kind: result.value.applied ? 'applied' : 'unchanged' });
        else setOutcome(result.failure === 'stale-version' ? { kind: 'conflict' } : { kind: 'failed', failure: result.failure });
      });
    },
    [teamId, team, busy],
  );

  return { team, busy, outcome, change };
}
