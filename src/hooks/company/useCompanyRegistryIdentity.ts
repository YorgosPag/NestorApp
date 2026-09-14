'use client';

/**
 * @fileoverview **Η ΝΟΜΙΚΗ ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΟΡΓΑΝΙΣΜΟΥ, ΑΠΕΝΑΝΤΙ ΣΤΟ ΓΕΜΗ** — ανάγνωση + πράξη.
 * @related ADR-841 §7 Α23 · app/api/companies/registry-verification/route.ts
 * @module hooks/company/useCompanyRegistryIdentity
 *
 * 🔑 **Ένας καταναλωτής της διαδρομής, πολλές οθόνες**: η δήλωση μεσιτείας διαβάζει από εδώ τον
 * αριθμό ΓΕΜΗ του προφίλ (δεν τον ξαναρωτά), η βιτρίνα την κρίση «επαληθευμένη;».
 *
 * ⚠️ **Τέσσερις καταστάσεις, ποτέ `null`**: `forbidden` (δεν είσαι διαχειριστής) ≠ `unavailable`
 * (δεν απάντησε) ≠ `loading`. Ένα «δεν έχει αριθμό ΓΕΜΗ» σε διακοπή δικτύου θα έστελνε τον
 * άνθρωπο να ξαναγράψει κάτι που το σύστημα **ήδη** κρατά.
 *
 * ⚠️ **Η παλιά κρίση ΜΕΝΕΙ ορατή όσο και αν η φρέσκια ερώτηση αποτύχει**: ο άνθρωπος δεν χάνει
 * την ημερομηνία του προηγούμενου ελέγχου επειδή το ΓΕΜΗ δεν απάντησε τώρα.
 */

import { useCallback, useEffect, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { RegistryIdentityReport } from '@/types/company-registry';

const logger = createModuleLogger('useCompanyRegistryIdentity');

const ENDPOINT = API_ROUTES.COMPANIES.REGISTRY_VERIFICATION;

export type CompanyRegistryIdentityState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly report: RegistryIdentityReport }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'unavailable' };

export interface CompanyRegistryIdentity {
  readonly state: CompanyRegistryIdentityState;
  readonly verifying: boolean;
  /** «Επαλήθευση από ΓΕΜΗ» — η **μόνη** πράξη που ρωτά το μητρώο. */
  readonly verify: () => Promise<void>;
}

async function stateOf(response: Response): Promise<CompanyRegistryIdentityState> {
  if (response.status === 401 || response.status === 403) return { kind: 'forbidden' };
  if (!response.ok) return { kind: 'unavailable' };
  const body = (await response.json().catch(() => null)) as { data?: RegistryIdentityReport } | null;
  return body?.data ? { kind: 'ready', report: body.data } : { kind: 'unavailable' };
}

async function requestReport(method: 'GET' | 'POST'): Promise<CompanyRegistryIdentityState> {
  try {
    return await stateOf(await fetch(ENDPOINT, { method }));
  } catch (error) {
    logger.error('Η νομική ταυτότητα δεν διαβάστηκε', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'unavailable' };
  }
}

export function useCompanyRegistryIdentity(): CompanyRegistryIdentity {
  const [state, setState] = useState<CompanyRegistryIdentityState>({ kind: 'loading' });
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    void requestReport('GET').then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const verify = useCallback(async () => {
    setVerifying(true);
    const next = await requestReport('POST');
    setState((previous) => (next.kind === 'ready' || previous.kind !== 'ready' ? next : previous));
    setVerifying(false);
  }, []);

  return { state, verifying, verify };
}
