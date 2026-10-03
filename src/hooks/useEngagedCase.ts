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
 * @module hooks/useEngagedCase
 */

import { useCallback, useEffect, useState } from 'react';
import { deniedVerdictOf, fetchEngagedCase } from '@/services/conveyance/conveyance-engagement-gateway';
import type { EngagedCaseView } from '@/types/conveyance-case';
import type { EngagementVerdict } from '@/types/engagement';

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

export function useEngagedCase(engagementId: string): EngagedCaseHandle {
  const [state, setState] = useState<EngagedCaseState>({ kind: 'loading' });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let alive = true;
    if (generation === 0) setState({ kind: 'loading' });
    fetchEngagedCase(engagementId)
      .then((result) => { if (alive) setState({ kind: 'ready', view: result.view }); })
      .catch((error: unknown) => {
        if (!alive) return;
        const verdict = deniedVerdictOf(error);
        // Ανανέωση που απέτυχε για λόγο δικτύου ⇒ μένει η όψη που υπάρχει· ονομασμένη άρνηση ⇒ φαίνεται πάντα.
        setState((current) => (verdict ? { kind: 'denied', verdict } : current.kind === 'ready' ? current : { kind: 'failed' }));
      });
    return () => { alive = false; };
  }, [engagementId, generation]);

  const reload = useCallback(() => setGeneration((g) => g + 1), []);
  return { state, reload };
}
