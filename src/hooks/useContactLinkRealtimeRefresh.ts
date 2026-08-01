/**
 * =============================================================================
 * Contact Link Realtime Refresh — shared subscription (ADR-032 / ADR-228 Tier 4)
 * =============================================================================
 *
 * Both association hooks (`useEntityContactLinks`, `useContactEntityLinks`) need
 * the same thing: re-fetch when a contact link is created or removed elsewhere.
 * The only difference is *which* create events concern them — one matches on the
 * link's target entity, the other on its source contact.
 *
 * Extracted 2026-08-01 (ADR-745): the two subscriptions were byte-identical apart
 * from that predicate, and jscpd flagged them as a clone inside a single file.
 * Removal events always refresh — the payload carries only `linkId`, so neither
 * caller can tell whether it was theirs.
 *
 * @module hooks/useContactLinkRealtimeRefresh
 * @enterprise ADR-032 - Linking Model (Associations)
 */

'use client';

import { useEffect, useRef } from 'react';
import { RealtimeService } from '@/services/realtime';
import type { ContactLinkCreatedPayload } from '@/services/realtime';

/**
 * Subscribe to contact-link create/remove events and call `refresh` when relevant.
 *
 * @param enabled - false while the owning hook has nothing to watch (no id yet)
 * @param matchesCreated - does this creation concern the caller? Held in a ref, so
 *   an inline arrow does not re-subscribe on every render
 * @param refresh - re-fetch callback (expected to be referentially stable)
 */
export function useContactLinkRealtimeRefresh(
  enabled: boolean,
  matchesCreated: (payload: ContactLinkCreatedPayload) => boolean,
  refresh: () => void,
): void {
  const matchesRef = useRef(matchesCreated);
  matchesRef.current = matchesCreated;

  useEffect(() => {
    if (!enabled) return;

    const handleLinkCreated = (payload: ContactLinkCreatedPayload) => {
      if (matchesRef.current(payload)) refresh();
    };
    const handleLinkRemoved = () => refresh();

    const unsubCreated = RealtimeService.subscribe('CONTACT_LINK_CREATED', handleLinkCreated);
    const unsubRemoved = RealtimeService.subscribe('CONTACT_LINK_REMOVED', handleLinkRemoved);

    return () => { unsubCreated(); unsubRemoved(); };
  }, [enabled, refresh]);
}
