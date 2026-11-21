'use client';

/**
 * @fileoverview **ΜΙΑ ανάγνωση της βιτρίνας, ΜΕ δήλωση χώρου** — ADR-841 §7 Α23.14.1 · ADR-787 §5.3 ζ.
 * @module hooks/mandate/useWorkspaceGet
 *
 * Ο κοινός κύκλος ζωής των GET του `/api/agency-profile/*` που ανοίγουν «κατ' απαίτηση» (κάρτα, πηγή
 * στοιχείων εταιρείας): `idle` όσο είναι κλειστά → `loading` → ό,τι πει ο **ερμηνευτής** του καλούντος.
 *
 * 🔴 **Μέσω `apiClient`, ποτέ ωμό `fetch`**: μόνο ο client στέλνει την κεφαλίδα χώρου — αλλιώς ο server
 *    απαντά για την εταιρεία **του λογαριασμού**. `retry: false`: μία ερώτηση· το «δεν μάθαμε» είναι
 *    κατάσταση του καλούντος, όχι αφορμή για αυτόματη επανάληψη (το 503 είναι **απάντηση**).
 *
 * ⚠️ Οι ερμηνευτές διαβάζονται από ref ⇒ μια νέα ταυτότητα συνάρτησης **δεν** ξαναρωτά τον server.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';

export type WorkspaceGetLoad<TLoad> =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | TLoad;

export interface WorkspaceGetInterpreter<TBody, TLoad> {
  /** Απάντηση 2xx → κατάσταση (σώμα απόν ⇒ `null`). */
  readonly answered: (body: TBody | null) => TLoad;
  /** Άρνηση (`ApiClientError`) ή δίκτυο που δεν απάντησε → κατάσταση. */
  readonly refused: (error: unknown) => TLoad;
}

export function useWorkspaceGet<TBody, TLoad>(
  enabled: boolean,
  endpoint: string,
  interpreter: WorkspaceGetInterpreter<TBody, TLoad>,
): readonly [WorkspaceGetLoad<TLoad>, Dispatch<SetStateAction<WorkspaceGetLoad<TLoad>>>] {
  const [load, setLoad] = useState<WorkspaceGetLoad<TLoad>>({ phase: 'idle' });
  const interpreterRef = useRef(interpreter);
  interpreterRef.current = interpreter;

  useEffect(() => {
    if (!enabled) {
      setLoad({ phase: 'idle' });
      return;
    }
    let cancelled = false;
    setLoad({ phase: 'loading' });
    void (async () => {
      try {
        const body = await apiClient.get<TBody>(endpoint, { retry: false });
        if (!cancelled) setLoad(interpreterRef.current.answered(body ?? null));
      } catch (error) {
        if (!cancelled) setLoad(interpreterRef.current.refused(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, endpoint]);

  return [load, setLoad] as const;
}
