import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { BankAccountUpdate, BankAccount } from '@/types/contacts/banking';
import type { AuditFieldChange } from '@/types/audit-trail';

const BANK_ACCOUNTS_SUBCOLLECTION = SUBCOLLECTIONS.BANK_ACCOUNTS;

export function mapBoolean(value: boolean): string {
  return value ? 'Ναι' : 'Όχι';
}

function toAuditComparable(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value);
}

export function buildUpdateAuditChanges(existing: BankAccount, updates: BankAccountUpdate): AuditFieldChange[] {
  const labels: Record<keyof BankAccountUpdate, string> = {
    bankName: 'Τράπεζα',
    bankCode: 'BIC / SWIFT',
    iban: 'IBAN',
    accountNumber: 'Αριθμός λογαριασμού',
    branch: 'Κατάστημα',
    accountType: 'Τύπος λογαριασμού',
    currency: 'Νόμισμα',
    isPrimary: 'Κύριος λογαριασμός',
    holderName: 'Δικαιούχος',
    notes: 'Σημειώσεις',
    isActive: 'Ενεργός λογαριασμός',
  };

  const changes: AuditFieldChange[] = [];
  for (const [field, nextValue] of Object.entries(updates) as Array<[keyof BankAccountUpdate, BankAccountUpdate[keyof BankAccountUpdate]]>) {
    if (nextValue === undefined) {
      continue;
    }

    const prevValue = existing[field as keyof BankAccount];
    const normalizedPrev = typeof prevValue === 'boolean' ? mapBoolean(prevValue) : toAuditComparable(prevValue);
    const normalizedNext = typeof nextValue === 'boolean' ? mapBoolean(nextValue) : toAuditComparable(nextValue);

    if (normalizedPrev !== normalizedNext) {
      changes.push({
        field: `bankAccounts.${field}`,
        oldValue: normalizedPrev,
        newValue: normalizedNext,
        label: labels[field],
      });
    }
  }

  return changes;
}

export async function getExistingAccount(contactId: string, accountId: string): Promise<BankAccount | null> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.CONTACTS)
    .doc(contactId)
    .collection(BANK_ACCOUNTS_SUBCOLLECTION)
    .doc(accountId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;
  return {
    id: snapshot.id,
    bankName: String(data.bankName ?? ''),
    bankCode: typeof data.bankCode === 'string' ? data.bankCode : undefined,
    iban: String(data.iban ?? ''),
    accountNumber: typeof data.accountNumber === 'string' ? data.accountNumber : undefined,
    branch: typeof data.branch === 'string' ? data.branch : undefined,
    accountType: (data.accountType as BankAccount['accountType']) ?? 'checking',
    currency: (data.currency as BankAccount['currency']) ?? 'EUR',
    isPrimary: Boolean(data.isPrimary),
    holderName: typeof data.holderName === 'string' ? data.holderName : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    isActive: data.isActive !== false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
