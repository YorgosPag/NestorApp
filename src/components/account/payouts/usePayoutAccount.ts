'use client';

/**
 * @fileoverview ADR-943 §5.9 · §5.14 — **«Λήψη πληρωμών»**: ανάγνωση, εγγραφή και αλλαγή στοιχείων από τον ίδιο τον
 *   χρήστη. Ένα `Idempotency-Key` ανά πάτημα (επανάληψη δικτύου ⇒ η ίδια πράξη).
 * @related ReceivePaymentsCard.tsx · app/api/account/payouts/route.ts · lib/payments/payout-account.ts
 * @module components/account/payouts/usePayoutAccount
 *
 * 🔑 Η αλλαγή στοιχείων πηγαίνει με **Bearer token** (όχι μόνο cookie): ο server κρίνει την πρόσφατη σύνδεση από το
 *    `auth_time` του token, που ανανεώνεται με την επιβεβαίωση ταυτότητας — το cookie συνεδρίας κρατά την αρχική σύνδεση.
 */

import { useCallback, useEffect, useState } from 'react';

import { keyedHeaders } from '@/lib/api/api-client-transport';
import { auth } from '@/lib/firebase';
import { PAYEE_KYC_REQUIREMENTS } from '@/lib/payments/payee-kyc';
import {
  PAYOUT_ACCOUNT_API,
  PAYOUT_ACCOUNT_STATES,
  PAYOUT_REAUTHENTICATION_REQUIRED,
  type PayoutAccountDetails,
  type PayoutAccountView,
  type PayoutRegistration,
  type PayoutUpdate,
} from '@/lib/payments/payout-account';
import { isOneOf, plainRecordOrNull } from '@/lib/type-guards';

export type PayoutLoad =
  | { readonly phase: 'loading' }
  | { readonly phase: 'failed' }
  | { readonly phase: 'ready'; readonly account: PayoutAccountView };

/** Πώς τελείωσε μια αλλαγή στοιχείων — ο καλών ανοίγει επιβεβαίωση ταυτότητας στο `reauthentication-required`. */
export type PayoutUpdateResult = 'updated' | 'reauthentication-required' | 'failed';

const DETAIL_KEYS = ['legalName', 'tradeName', 'address', 'taxNumber', 'ibanLast4', 'ibanBeneficiary', 'bankName'] as const;

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function detailsOf(raw: unknown): PayoutAccountDetails | null {
  const record = plainRecordOrNull(raw);
  if (record === null) return null;
  const [legalName, tradeName, address, taxNumber, ibanLast4, ibanBeneficiary, bankName] = DETAIL_KEYS.map((key) => textOrNull(record[key]));
  return { legalName, tradeName, address, taxNumber, ibanLast4, ibanBeneficiary, bankName };
}

function accountOf(payload: unknown): PayoutAccountView | null {
  const record = plainRecordOrNull(payload);
  if (record === null || !isOneOf(PAYOUT_ACCOUNT_STATES, record.state)) return null;
  const due = Array.isArray(record.dueRequirements) ? record.dueRequirements : [];
  return {
    state: record.state,
    charges: record.charges === true,
    payouts: record.payouts === true,
    dueRequirements: due.filter((item): item is (typeof PAYEE_KYC_REQUIREMENTS)[number] => isOneOf(PAYEE_KYC_REQUIREMENTS, item)),
    kycProcessUrl: textOrNull(record.kycProcessUrl),
    details: detailsOf(record.details),
  };
}

async function request(init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(PAYOUT_ACCOUNT_API, { credentials: 'include', cache: 'no-store', ...init });
  } catch {
    return null;
  }
}

async function viewOf(response: Response | null): Promise<PayoutAccountView | null> {
  return response?.ok ? accountOf(await response.json()) : null;
}

/** Το token της **τρέχουσας** σύνδεσης — μετά την επιβεβαίωση ταυτότητας φέρει το νέο `auth_time`. */
async function bearerOrNull(): Promise<string | null> {
  try {
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

async function isReauthenticationRefusal(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  const body = plainRecordOrNull(await response.json().catch(() => null));
  return body?.error === PAYOUT_REAUTHENTICATION_REQUIRED;
}

export function usePayoutAccount(): {
  readonly load: PayoutLoad;
  readonly register: (form: PayoutRegistration) => Promise<boolean>;
  readonly update: (change: PayoutUpdate) => Promise<PayoutUpdateResult>;
} {
  const [load, setLoad] = useState<PayoutLoad>({ phase: 'loading' });
  useEffect(() => {
    let cancelled = false;
    void request({ method: 'GET' }).then(viewOf).then((account) => {
      if (!cancelled) setLoad(account === null ? { phase: 'failed' } : { phase: 'ready', account });
    });
    return () => { cancelled = true; };
  }, []);
  const register = useCallback(async (form: PayoutRegistration): Promise<boolean> => {
    const account = await viewOf(await request({
      method: 'POST', body: JSON.stringify(form), headers: keyedHeaders('POST', form, { 'Content-Type': 'application/json' }),
    }));
    if (account !== null) setLoad({ phase: 'ready', account });
    return account !== null;
  }, []);
  const update = useCallback(async (change: PayoutUpdate): Promise<PayoutUpdateResult> => {
    const token = await bearerOrNull();
    if (token === null) return 'failed';
    const response = await request({
      method: 'PATCH', body: JSON.stringify(change),
      headers: keyedHeaders('PATCH', change, { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    });
    if (response !== null && await isReauthenticationRefusal(response)) return 'reauthentication-required';
    const account = await viewOf(response);
    if (account !== null) setLoad({ phase: 'ready', account });
    return account === null ? 'failed' : 'updated';
  }, []);
  return { load, register, update };
}
