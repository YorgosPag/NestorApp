'use client';

/**
 * @fileoverview **ΠΟΙΟΙ ΕΙΝΑΙ, ΠΟΙΟΣ ΛΕΙΠΕΙ, ΤΙ ΘΕΛΩ ΝΑ ΑΚΟΥΩ** — ονόματα · παρουσία · σίγαση/ακολουθώ.
 * @related ADR-867 Β7 · ADR-834 (γ) ③ · (ε) 🏆 · `network-thread.client.ts`
 * @module hooks/network-messaging/useThreadRoster
 *
 * 🔑 **Τα ονόματα και η παρουσία ΞΑΝΑΖΗΤΙΟΥΝΤΑΙ ΟΤΑΝ ΑΛΛΑΞΕΙ Η ΣΥΝΘΕΣΗ** (κλειδί = τα `uid`), όχι σε κάθε
 * render: ένας νέος συνεργάτης που μπαίνει φαίνεται με όνομα αμέσως· η απουσία ξαναρωτιέται και όταν η
 * καρτέλα ξαναγίνει ορατή (κάποιος μπορεί να γύρισε). ⚠️ Απάντηση για **παλιό** κλειδί **αγνοείται** —
 * αλλιώς μια αργή απάντηση θα έγραφε ονόματα της προηγούμενης σύνθεσης πάνω στη νέα.
 *
 * 🔀 **Σίγαση / ακολουθώ = αισιόδοξα** (Gmail): ο διακόπτης αλλάζει **αμέσως**· η τιμή επιβεβαιώνεται όταν
 * η ζωντανή γραμμή ακροατηρίου φτάσει ίδια· αποτυχία ⇒ επιστροφή στην αλήθεια + κωδικός για την οθόνη.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { rosterUids } from '@/lib/network-messaging/audience-roster';
import {
  networkThreadClient,
  type NetworkFailure,
} from '@/services/network-messaging/network-thread.client';
import type { NetworkAudienceEntry } from '@/types/network-thread';
import type { NetworkPeopleResult, NetworkPresenceResult } from '@/types/network-wire';

type Keyed<T> = { readonly key: string; readonly value: T } | null;

/** Φέρνει κάτι **ανά κλειδί**, αγνοώντας απαντήσεις για κλειδί που πέρασε. `refreshOnFocus` ⇒ ξανά στην επιστροφή. */
function useKeyedFetch<T>(key: string | null, fetcher: () => Promise<T | null>, refreshOnFocus: boolean): T | null {
  const [state, setState] = useState<Keyed<T>>(null);
  // ⚠️ Ο `fetcher` γράφεται inline και αλλάζει ταυτότητα σε κάθε render ⇒ σε `ref`, εξάρτηση μόνο το κλειδί.
  const latest = useRef(fetcher);
  latest.current = fetcher;

  useEffect(() => {
    if (key === null) return undefined;
    let current = true;
    const load = () => {
      void latest.current().then((value) => {
        if (current && value !== null) setState({ key, value });
      });
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    if (refreshOnFocus) document.addEventListener('visibilitychange', onVisible);
    return () => {
      current = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, refreshOnFocus]);

  return state?.key === key ? state.value : null;
}

export interface ThreadRoster {
  readonly people: NetworkPeopleResult | null;
  readonly presence: NetworkPresenceResult | null;
}

/** Ονόματα (κλειδί: **όλοι** όσοι πέρασαν) + παρουσία (κλειδί: όσοι διαβάζουν **τώρα**). */
export function useThreadRoster(threadId: string | null, audience: readonly NetworkAudienceEntry[] | null): ThreadRoster {
  const peopleKey = threadId !== null && audience !== null ? `${threadId}|${rosterUids(audience).join(',')}` : null;
  const liveUids = audience?.filter((entry) => entry.until === null).map((entry) => entry.uid).sort().join(',');
  const presenceKey = threadId !== null && liveUids !== undefined ? `${threadId}|${liveUids}` : null;

  const people = useKeyedFetch(
    peopleKey,
    async () => {
      const result = await networkThreadClient.people(threadId ?? '');
      return result.ok ? result.value : null;
    },
    false,
  );
  const presence = useKeyedFetch(
    presenceKey,
    async () => {
      const result = await networkThreadClient.presence(threadId ?? '');
      return result.ok ? result.value : null;
    },
    true,
  );
  return { people, presence };
}

export interface SeatToggle {
  readonly value: boolean;
  readonly saving: boolean;
  readonly failure: NetworkFailure | null;
  readonly set: (value: boolean) => void;
}

/** **Σίγαση ή ακολουθώ** πάνω στη δική μου γραμμή — αισιόδοξα, με επιστροφή στην αλήθεια σε αποτυχία. */
export function useSeatToggle(threadId: string | null, field: 'muted' | 'following', live: boolean): SeatToggle {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [failure, setFailure] = useState<NetworkFailure | null>(null);

  useEffect(() => {
    if (optimistic !== null && live === optimistic) setOptimistic(null);
  }, [live, optimistic]);

  const set = useCallback(
    (value: boolean) => {
      if (threadId === null) return;
      setOptimistic(value);
      setFailure(null);
      const write = field === 'muted' ? networkThreadClient.setMuted : networkThreadClient.setFollowing;
      void write(threadId, value).then((result) => {
        if (result.ok) return;
        setOptimistic(null);
        setFailure(result.failure);
      });
    },
    [threadId, field],
  );

  return { value: optimistic ?? live, saving: optimistic !== null, failure, set };
}
