'use client';

/**
 * @fileoverview **«Έλεγχος στο μητρώο»** για μία άδεια της επαφής — ανάγνωση της κρίσης και η πράξη (ADR-915 §40.7 Φ2).
 * @module components/contacts/useLicenceRegistryCheck
 *
 * 🔑 Η ανάγνωση (GET) **δεν** ρωτά το μητρώο — κρίνει τα αποθηκευμένα· μόνο το πάτημα (POST) ρωτά.
 * 🔑 Ξαναδιαβάζει όταν αλλάξει ο **αποθηκευμένος** αριθμός (`storedNumber`): η κρίση εξαρτάται από αυτόν.
 * 🔑 Η απάντηση αντικαθιστά την αναφορά **ολόκληρη** — καμία συγχώνευση με παλιά κατάσταση.
 */

import { useCallback, useEffect, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import type { ProfessionalLicence } from '@/config/professional-licences';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { RegistryCheckReport } from '@/types/professional-registry-check';

export type LicenceRegistryCheckState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly report: RegistryCheckReport };

export function useLicenceRegistryCheck(contactId: string, licence: ProfessionalLicence, storedNumber: string) {
  const [state, setState] = useState<LicenceRegistryCheckState>({ kind: 'loading' });
  const [checking, setChecking] = useState(false);
  const url = API_ROUTES.CONTACTS.LICENCE_REGISTRY_CHECK(contactId, licence);

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    apiClient
      .get<RegistryCheckReport>(url)
      .then((report) => { if (alive) setState({ kind: 'ready', report }); })
      .catch(() => { if (alive) setState({ kind: 'failed' }); });
    return () => { alive = false; };
  }, [url, storedNumber]);

  const check = useCallback(async (): Promise<void> => {
    setChecking(true);
    try {
      setState({ kind: 'ready', report: await apiClient.post<RegistryCheckReport>(url) });
    } catch {
      setState({ kind: 'failed' });
    } finally {
      setChecking(false);
    }
  }, [url]);

  return { state, checking, check };
}
