'use client';

/**
 * @fileoverview **ΤΙ ΞΕΡΕΙ ΗΔΗ ΤΟ ΣΥΣΤΗΜΑ** — η πηγή της «Εισαγωγής από τα στοιχεία της εταιρείας» (ADR-841 §7 Α21.19).
 * @related app/api/agency-profile/card/import-source/route.ts · lib/agency/showcase-card-import.ts
 * @module hooks/mandate/useCompanyContactSource
 *
 * ⚠️ **Τρεις καταλήξεις, όχι δύο** (N.12): `absent` = «δεν δηλώσατε ακόμη» (πρόταση: ρυθμίσεις εταιρείας)·
 * `failed` = «δεν μάθαμε» (πρόταση: ξαναδοκιμάστε). Και οι δύο αφήνουν την κάρτα **άθικτη** — είναι βοήθεια, όχι προϋπόθεση.
 */

import { useEffect, useState } from 'react';

import type { CompanyContactSource, CompanyContactSourceResponse } from '@/types/showcase-card-import';

export type CompanyContactSourceLoad =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | { readonly phase: 'present'; readonly source: CompanyContactSource }
  | { readonly phase: 'absent' }
  | { readonly phase: 'failed' };

const ENDPOINT = '/api/agency-profile/card/import-source' as const;

function loadOf(status: number, body: CompanyContactSourceResponse | null): CompanyContactSourceLoad {
  if (body !== null && 'source' in body) return { phase: 'present', source: body.source };
  if (status === 404 && body !== null && body.error === 'NO_COMPANY_DATA') return { phase: 'absent' };
  return { phase: 'failed' };
}

export function useCompanyContactSource(enabled: boolean): CompanyContactSourceLoad {
  const [load, setLoad] = useState<CompanyContactSourceLoad>({ phase: 'idle' });

  useEffect(() => {
    if (!enabled) {
      setLoad({ phase: 'idle' });
      return;
    }
    let cancelled = false;
    setLoad({ phase: 'loading' });
    void (async () => {
      try {
        const response = await fetch(ENDPOINT);
        const body = (await response.json().catch(() => null)) as CompanyContactSourceResponse | null;
        if (!cancelled) setLoad(loadOf(response.status, body));
      } catch {
        if (!cancelled) setLoad({ phase: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return load;
}
