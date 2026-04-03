'use client';

import { BankAccountsService } from '@/services/banking';
import type { BankAccountInput, BankAccountUpdate } from '@/types/contacts/banking';

interface AddBankAccountWithPolicyInput {
  readonly contactId: string;
  readonly account: BankAccountInput;
}

interface UpdateBankAccountWithPolicyInput {
  readonly contactId: string;
  readonly accountId: string;
  readonly updates: BankAccountUpdate;
}

interface DeleteBankAccountWithPolicyInput {
  readonly contactId: string;
  readonly accountId: string;
}

interface SetPrimaryBankAccountWithPolicyInput {
  readonly contactId: string;
  readonly accountId: string;
}

export async function addBankAccountWithPolicy({
  contactId,
  account,
}: AddBankAccountWithPolicyInput): Promise<string> {
  return BankAccountsService.addAccount(contactId, account);
}

export async function updateBankAccountWithPolicy({
  contactId,
  accountId,
  updates,
}: UpdateBankAccountWithPolicyInput): Promise<void> {
  return BankAccountsService.updateAccount(contactId, accountId, updates);
}

export async function deleteBankAccountWithPolicy({
  contactId,
  accountId,
}: DeleteBankAccountWithPolicyInput): Promise<void> {
  return BankAccountsService.deleteAccount(contactId, accountId);
}

export async function setPrimaryBankAccountWithPolicy({
  contactId,
  accountId,
}: SetPrimaryBankAccountWithPolicyInput): Promise<void> {
  return BankAccountsService.setPrimaryAccount(contactId, accountId);
}
