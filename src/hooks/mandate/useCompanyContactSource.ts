'use client';

/**
 * @fileoverview **ΤΙ ΞΕΡΕΙ ΗΔΗ ΤΟ ΣΥΣΤΗΜΑ** — η πηγή της «Εισαγωγής από τα στοιχεία της εταιρείας» (ADR-841 §7 Α21.19).
 * @related app/api/agency-profile/card/import-source/route.ts · lib/agency/showcase-card-import.ts
 * @module hooks/mandate/useCompanyContactSource
 *
 * ⚠️ **Τρεις καταλήξεις, όχι δύο** (N.12): `absent` = «δεν δηλώσατε ακόμη» (πρόταση: ρυθμίσεις εταιρείας)·
 * `failed` = «δεν μάθαμε» (πρόταση: ξαναδοκιμάστε). Και οι δύο αφήνουν την κάρτα **άθικτη** — είναι βοήθεια, όχι προϋπόθεση.
 */

import { useWorkspaceGet } from '@/hooks/mandate/useWorkspaceGet';
import { ApiClientError, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import type { CompanyContactSource, CompanyContactSourceResponse } from '@/types/showcase-card-import';

export type CompanyContactSourceLoad =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | { readonly phase: 'present'; readonly source: CompanyContactSource }
  | { readonly phase: 'absent' }
  | { readonly phase: 'failed' };

const ENDPOINT = '/api/agency-profile/card/import-source' as const;

function loadOf(body: CompanyContactSourceResponse | null): CompanyContactSourceLoad {
  return body !== null && 'source' in body ? { phase: 'present', source: body.source } : { phase: 'failed' };
}

/** Η άρνηση → κατάσταση. Μόνο το ονομασμένο 404 `NO_COMPANY_DATA` είναι «δεν υπάρχουν στοιχεία»· όλα τα άλλα = δεν μάθαμε. */
function refusedLoadOf(error: unknown): CompanyContactSourceLoad {
  const absent = ApiClientError.isApiClientError(error)
    && error.statusCode === 404
    && apiErrorBodyOf(error)?.error === 'NO_COMPANY_DATA';
  return absent ? { phase: 'absent' } : { phase: 'failed' };
}

/** Ο ερμηνευτής ζει σε επίπεδο αρχείου ⇒ σταθερή ταυτότητα. */
const INTERPRETER = { answered: loadOf, refused: refusedLoadOf } as const;

export function useCompanyContactSource(enabled: boolean): CompanyContactSourceLoad {
  // 🔴 **Μέσω `useWorkspaceGet` ⇒ `apiClient`** (ADR-787 §5.3 ζ): τα στοιχεία της εταιρείας **του χώρου**.
  const [load] = useWorkspaceGet<CompanyContactSourceResponse, CompanyContactSourceLoad>(enabled, ENDPOINT, INTERPRETER);
  return load;
}
