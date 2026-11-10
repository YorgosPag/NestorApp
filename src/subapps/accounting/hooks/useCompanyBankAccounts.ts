/**
 * @fileoverview useCompanyBankAccounts — οι λογαριασμοί ΤΗΣ εταιρείας (ADR-ACC-008 §2 · ADR-ACC-018 §15)
 * @description Λίστα + δημιουργία + αλλαγή + απενεργοποίηση μέσω του ΕΝΟΣ μεταφορέα (`apiClient`, ξετυλίγει το
 *   `data`). Κάθε εγγραφή επιστρέφει τον αποθηκευμένο λογαριασμό· επειδή μια αλλαγή προεπιλογής αγγίζει και
 *   **άλλους** λογαριασμούς (ένας προεπιλεγμένος, μέσα σε συναλλαγή), η λίστα ξαναδιαβάζεται μετά από κάθε εγγραφή —
 *   η οθόνη δείχνει πάντα ό,τι αποφάσισε ο διακομιστής, ποτέ δική της εικασία.
 *
 *   Σφάλμα ⇒ `BankAccountMutationError` με τον κωδικό HTTP (409 = διπλό IBAN), ώστε η φόρμα να μεταφράσει.
 *   Η οθόνη ρυθμίσεων ζητά και τους **ανενεργούς** (`?includeInactive=true`) — χωρίς αυτούς δεν υπάρχει επανενεργοποίηση.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { API_ROUTES } from '@/config/domain-constants';
import type { BankAccountConfig, CreateBankAccountInput, UpdateBankAccountInput } from '@/subapps/accounting/types';

/** Αποτυχία εγγραφής — ο κωδικός HTTP (ή `null` για σφάλμα δικτύου) για μετάφραση στη φόρμα. */
export class BankAccountMutationError extends Error {
  constructor(readonly statusCode: number | null) {
    super(`Bank account mutation failed (${statusCode ?? 'network'})`);
    this.name = 'BankAccountMutationError';
  }
}

async function mutation<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (cause) {
    throw new BankAccountMutationError(ApiClientError.isApiClientError(cause) ? cause.statusCode : null);
  }
}

export interface UseCompanyBankAccountsReturn {
  accounts: BankAccountConfig[];
  loading: boolean;
  /** Η ανάγνωση απέτυχε (η λίστα ΔΕΝ είναι «κενή» — είναι άγνωστη) */
  loadFailed: boolean;
  refetch: () => Promise<void>;
  createAccount: (input: CreateBankAccountInput) => Promise<BankAccountConfig>;
  updateAccount: (accountId: string, updates: UpdateBankAccountInput) => Promise<BankAccountConfig>;
  deactivateAccount: (accountId: string) => Promise<BankAccountConfig>;
  reactivateAccount: (accountId: string) => Promise<BankAccountConfig>;
}

const LIST_WITH_INACTIVE = `${API_ROUTES.ACCOUNTING.BANK_ACCOUNTS.LIST}?includeInactive=true`;

export function useCompanyBankAccounts(): UseCompanyBankAccountsReturn {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccountConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setAccounts(await apiClient.get<BankAccountConfig[]>(LIST_WITH_INACTIVE));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createAccount = useCallback(async (input: CreateBankAccountInput) => {
    const saved = await mutation(() =>
      apiClient.post<BankAccountConfig>(API_ROUTES.ACCOUNTING.BANK_ACCOUNTS.LIST, input));
    await refetch();
    return saved;
  }, [refetch]);

  const updateAccount = useCallback(async (accountId: string, updates: UpdateBankAccountInput) => {
    const saved = await mutation(() =>
      apiClient.patch<BankAccountConfig>(API_ROUTES.ACCOUNTING.BANK_ACCOUNTS.BY_ID(accountId), updates));
    await refetch();
    return saved;
  }, [refetch]);

  const deactivateAccount = useCallback(async (accountId: string) => {
    const saved = await mutation(() =>
      apiClient.delete<BankAccountConfig>(API_ROUTES.ACCOUNTING.BANK_ACCOUNTS.BY_ID(accountId)));
    await refetch();
    return saved;
  }, [refetch]);

  const reactivateAccount = useCallback(async (accountId: string) => {
    const saved = await mutation(() =>
      apiClient.post<BankAccountConfig>(API_ROUTES.ACCOUNTING.BANK_ACCOUNTS.REACTIVATE(accountId), {}));
    await refetch();
    return saved;
  }, [refetch]);

  return { accounts, loading, loadFailed, refetch, createAccount, updateAccount, deactivateAccount, reactivateAccount };
}
