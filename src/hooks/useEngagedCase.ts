'use client';

/**
 * ADR-901 Φ2 — η υπόθεση μέσω της συμμετοχής του θεατή. **Μόνο ανάγνωση**: ο κατάλογος έρχεται ήδη
 * φιλτραρισμένος ανά ρόλο και εμβέλεια από τον server — ο client **δεν** τον ξαναπαράγει (δεν έχει, και δεν
 * πρέπει να έχει, το ωμό έγγραφο).
 *
 * Τρεις εκβάσεις, ποτέ δύο: η όψη · η **δική μου** συμμετοχή χωρίς πρόσβαση τώρα (ονομασμένη ετυμηγορία) ·
 * «δεν βρέθηκε/δεν φορτώθηκε».
 *
 * @module hooks/useEngagedCase
 */

import { useEffect, useState } from 'react';
import { deniedVerdictOf, fetchEngagedCase } from '@/services/conveyance/conveyance-engagement-gateway';
import type { EngagedCaseView } from '@/types/conveyance-case';
import type { EngagementVerdict } from '@/types/engagement';

export type EngagedCaseState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly view: EngagedCaseView }
  | { readonly kind: 'denied'; readonly verdict: EngagementVerdict }
  | { readonly kind: 'failed' };

export function useEngagedCase(engagementId: string): EngagedCaseState {
  const [state, setState] = useState<EngagedCaseState>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    fetchEngagedCase(engagementId)
      .then((result) => { if (alive) setState({ kind: 'ready', view: result.view }); })
      .catch((error: unknown) => {
        if (!alive) return;
        const verdict = deniedVerdictOf(error);
        setState(verdict ? { kind: 'denied', verdict } : { kind: 'failed' });
      });
    return () => { alive = false; };
  }, [engagementId]);

  return state;
}
