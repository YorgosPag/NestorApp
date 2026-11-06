'use client';

/**
 * @fileoverview **Από ποιους διαλέγει ο επιλογέας κατόχου** (ADR-930 §3.8).
 * @module components/crm/owner/useOpportunityOwnerCandidates
 *
 * Οι υποψήφιοι έρχονται από την **ίδια** πόρτα που επικυρώνει τη μεταβίβαση (`GET …/owner`): τα ΕΝΕΡΓΑ μέλη του χώρου.
 * Καμία δεύτερη λίστα στον browser, άρα ο επιλογέας δεν δείχνει ποτέ κάποιον που το POST θα απέρριπτε.
 * 🔑 `enabled = false` ⇒ καμία κλήση: όποιος δεν μπορεί να μεταβιβάσει δεν χρειάζεται τη λίστα μελών (ελαχιστοποίηση).
 */

import { useEffect, useState } from 'react';

import { createModuleLogger } from '@/lib/telemetry';
import type { OwnerCandidate } from '@/services/crm/opportunity-owner-schema';
import { fetchOwnerCandidates } from './owner-transfer-api';

const logger = createModuleLogger('useOpportunityOwnerCandidates');

export type OwnerCandidatesState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly candidates: readonly OwnerCandidate[] }
  | { readonly status: 'failed' };

export function useOpportunityOwnerCandidates(opportunityId: string | undefined, enabled: boolean): OwnerCandidatesState {
  const [state, setState] = useState<OwnerCandidatesState>({ status: 'idle' });

  useEffect(() => {
    if (!opportunityId || !enabled) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    fetchOwnerCandidates(opportunityId)
      .then((response) => { if (!cancelled) setState({ status: 'ready', candidates: response.candidates }); })
      .catch((error: unknown) => {
        logger.error('Owner candidates failed to load', { error });
        if (!cancelled) setState({ status: 'failed' });
      });
    return () => { cancelled = true; };
  }, [opportunityId, enabled]);

  return state;
}
