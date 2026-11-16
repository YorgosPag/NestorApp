'use client';

/**
 * @fileoverview ADR-943 §5.9 — **«Λήψη πληρωμών»**: ανάγνωση της κατάστασης και εγγραφή στον πάροχο, από τον ίδιο τον
 *   χρήστη. Ένα `Idempotency-Key` ανά πάτημα (επανάληψη δικτύου ⇒ η ίδια εγγραφή).
 * @related ReceivePaymentsCard.tsx · app/api/account/payouts/route.ts · lib/payments/payout-account.ts
 * @module components/account/payouts/usePayoutAccount
 */

import { useCallback, useEffect, useState } from 'react';

import { keyedHeaders } from '@/lib/api/api-client-transport';
import { isOneOf } from '@/lib/type-guards';
import {
  PAYOUT_ACCOUNT_API,
  PAYOUT_ACCOUNT_STATES,
  type PayoutAccountView,
  type PayoutRegistration,
} from '@/lib/payments/payout-account';

export type PayoutLoad =
  | { readonly phase: 'loading' }
  | { readonly phase: 'failed' }
  | { readonly phase: 'ready'; readonly account: PayoutAccountView };

function accountOf(payload: unknown): PayoutAccountView | null {
  if (payload === null || typeof payload !== 'object') return null;
  const state: unknown = Reflect.get(payload, 'state');
  const url: unknown = Reflect.get(payload, 'kycProcessUrl');
  if (!isOneOf(PAYOUT_ACCOUNT_STATES, state)) return null;
  return { state, kycProcessUrl: typeof url === 'string' ? url : null };
}

async function request(init: RequestInit): Promise<PayoutAccountView | null> {
  try {
    const response = await fetch(PAYOUT_ACCOUNT_API, { credentials: 'include', cache: 'no-store', ...init });
    return response.ok ? accountOf(await response.json()) : null;
  } catch {
    return null;
  }
}

export function usePayoutAccount(): {
  readonly load: PayoutLoad;
  readonly register: (form: PayoutRegistration) => Promise<boolean>;
} {
  const [load, setLoad] = useState<PayoutLoad>({ phase: 'loading' });
  useEffect(() => {
    let cancelled = false;
    void request({ method: 'GET' }).then((account) => {
      if (!cancelled) setLoad(account === null ? { phase: 'failed' } : { phase: 'ready', account });
    });
    return () => { cancelled = true; };
  }, []);
  const register = useCallback(async (form: PayoutRegistration): Promise<boolean> => {
    const account = await request({
      method: 'POST', body: JSON.stringify(form), headers: keyedHeaders('POST', form, { 'Content-Type': 'application/json' }),
    });
    if (account !== null) setLoad({ phase: 'ready', account });
    return account !== null;
  }, []);
  return { load, register };
}
