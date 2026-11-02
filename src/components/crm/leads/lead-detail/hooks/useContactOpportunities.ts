'use client';

import { useEffect, useState } from 'react';
import { getOpportunitiesByContact } from '@/services/opportunities.service';
import type { Opportunity } from '@/types/crm';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useContactOpportunities');

interface ContactOpportunities {
  readonly opportunities: readonly Opportunity[];
  readonly loading: boolean;
}

/** Οι ευκαιρίες μιας επαφής· φορτώνονται μόνο όταν ανοίξει η προεπισκόπηση (`enabled`). */
export function useContactOpportunities(contactId: string, enabled: boolean): ContactOpportunities {
  const [state, setState] = useState<ContactOpportunities>({ opportunities: [], loading: false });

  useEffect(() => {
    if (!enabled || !contactId) return;

    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true }));
    getOpportunitiesByContact(contactId)
      .then((opportunities) => {
        if (!cancelled) setState({ opportunities, loading: false });
      })
      .catch((error: unknown) => {
        logger.error('Failed to load contact opportunities', { error, contactId });
        if (!cancelled) setState({ opportunities: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [contactId, enabled]);

  return state;
}
