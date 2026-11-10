/**
 * @fileoverview Μητρώο τραπεζικών λογαριασμών της εταιρείας — ο ΕΝΑΣ γραφέας του `accounting_bank_accounts`
 * @description Δημιουργία · αλλαγή · απενεργοποίηση, κάθε μία σε **μία** συναλλαγή που διαβάζει όλους τους
 *   λογαριασμούς του μισθωτή και επιβάλλει τις αναλλοίωτες:
 *
 *   1. Ένα IBAN εμφανίζεται **μία** φορά ανάμεσα στους ενεργούς λογαριασμούς της εταιρείας.
 *   2. Ανάμεσα στους λογαριασμούς που τυπώνονται στα τιμολόγια υπάρχει **ακριβώς ένας** προεπιλεγμένος
 *      (όταν υπάρχει έστω ένας) — αυτός μπαίνει πρώτος και στο EPC QR.
 *   3. Τίποτα δεν διαγράφεται: οι τραπεζικές κινήσεις κρατούν `accountId` (ADR-ACC-008).
 *
 * Κάθε ανάγνωση φιλτράρει `companyId` — το Admin SDK παρακάμπτει τους κανόνες (ADR-917 Φ4.0).
 *
 * @see ADR-ACC-008 §2 · ADR-ACC-018 §15
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, enterprise IDs (N.6)
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { DomainRefusal } from '@/lib/errors/domain-refusal';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBankAccountId } from '@/services/enterprise-id.service';
import { cleanBIC, cleanIBAN } from '@/types/contacts/banking';

import type { BankAccountConfig, CreateBankAccountInput, UpdateBankAccountInput } from '../../types/bank';
import type { TenantContext } from '../../types/common';

import { compareBankAccounts, resolveInvoiceDefault } from '../payments/invoice-payment-accounts';
import { sanitizeForFirestore, isoNow } from './firestore-helpers';
import { OwnedDocumentNotFoundError, ownedPayload, type OwnedDocAddress } from './tenant-owned-doc';

const bankAccountAt = (id: string): OwnedDocAddress =>
  ({ collection: COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS, id, resource: 'bank account' });

/** Το IBAN υπάρχει ήδη σε ενεργό λογαριασμό της εταιρείας. */
export class DuplicateBankAccountError extends DomainRefusal {
  readonly httpStatus = 409;

  constructor(readonly iban: string) {
    super(`An active bank account with this IBAN already exists`);
    this.name = 'DuplicateBankAccountError';
  }
}

// ============================================================================
// READ
// ============================================================================

function tenantAccountsQuery(db: Firestore, tenant: TenantContext) {
  return db.collection(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS).where('companyId', '==', tenant.companyId);
}

/** Οι λογαριασμοί της εταιρείας (ενεργοί, ή όλοι). Σφάλμα βάσης ⇒ **σφάλμα**, ποτέ σιωπηλή κενή λίστα. */
export async function listBankAccounts(tenant: TenantContext, includeInactive = false): Promise<BankAccountConfig[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await tenantAccountsQuery(db, tenant).get();
    const accounts = snap.docs.map((d) => d.data() as BankAccountConfig);
    return accounts.filter((a) => includeInactive || a.isActive).sort(compareBankAccounts);
  });
}

/** Οι ενεργοί λογαριασμοί (ADR-ACC-008 — συμφωνία τράπεζας). */
export function getBankAccounts(tenant: TenantContext): Promise<BankAccountConfig[]> {
  return listBankAccounts(tenant, false);
}

// ============================================================================
// INVARIANTS (καθαρές — ελέγχονται χωρίς βάση)
// ============================================================================

function assertUniqueIban(accounts: readonly BankAccountConfig[], iban: string, selfId: string | null): void {
  if (accounts.some((a) => a.isActive && a.accountId !== selfId && cleanIBAN(a.iban) === iban)) {
    throw new DuplicateBankAccountError(iban);
  }
}

/** Γράφει μόνο όσους αλλάζει η σημαία προεπιλογής — ο στόχος γράφεται από τον καλούντα. */
function writeDefaultFlags(
  db: Firestore, tx: Transaction, accounts: readonly BankAccountConfig[], defaultId: string | null, skipId: string, now: string,
): void {
  for (const account of accounts) {
    if (account.accountId === skipId) continue;
    const shouldBeDefault = account.accountId === defaultId;
    if ((account.isDefaultForInvoices === true) !== shouldBeDefault) {
      tx.update(db.collection(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS).doc(account.accountId),
        { isDefaultForInvoices: shouldBeDefault, updatedAt: now });
    }
  }
}

async function readTenantAccounts(db: Firestore, tx: Transaction, tenant: TenantContext): Promise<BankAccountConfig[]> {
  const snap = await tx.get(tenantAccountsQuery(db, tenant));
  return snap.docs.map((d) => d.data() as BankAccountConfig);
}

// ============================================================================
// WRITE — ένας γραφέας, μία συναλλαγή ανά πράξη
// ============================================================================

export async function createBankAccount(tenant: TenantContext, input: CreateBankAccountInput): Promise<BankAccountConfig> {
  const accountId = generateBankAccountId();
  const now = isoNow();
  const iban = cleanIBAN(input.iban);

  return safeFirestoreOperation((db) => db.runTransaction(async (tx) => {
    const existing = await readTenantAccounts(db, tx, tenant);
    assertUniqueIban(existing, iban, null);

    const draft: BankAccountConfig = {
      accountId, bankName: input.bankName.trim(), iban, label: input.label.trim(), type: input.type,
      currency: input.currency, isActive: true, bankCode: input.bankCode ? cleanBIC(input.bankCode) : null,
      holderName: input.holderName.trim(), showOnInvoices: input.showOnInvoices, isDefaultForInvoices: false,
      sortOrder: existing.length, notes: input.notes, companyId: tenant.companyId, createdBy: tenant.userId,
      createdAt: now, updatedAt: now,
    };
    const all = [...existing, draft];
    const defaultId = resolveInvoiceDefault(all, input.isDefaultForInvoices ? accountId : null);
    const created: BankAccountConfig = { ...draft, isDefaultForInvoices: defaultId === accountId };

    tx.set(db.collection(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS).doc(accountId),
      sanitizeForFirestore(created as unknown as Record<string, unknown>));
    writeDefaultFlags(db, tx, existing, defaultId, accountId, now);
    return created;
  }));
}

/** Εφαρμόζει μια αλλαγή στον στόχο μέσα στη συναλλαγή + ξαναλύνει την προεπιλογή. Ξένο/ανύπαρκτο ⇒ σφάλμα. */
async function mutateBankAccount(
  tenant: TenantContext,
  accountId: string,
  change: (
    current: BankAccountConfig, existing: readonly BankAccountConfig[],
  ) => { next: BankAccountConfig; requestDefault: boolean; avoidDefault: boolean },
): Promise<BankAccountConfig> {
  const address = bankAccountAt(accountId);
  return safeFirestoreOperation((db) => db.runTransaction(async (tx) => {
    const existing = await readTenantAccounts(db, tx, tenant);
    const raw = existing.find((a) => a.accountId === accountId);
    const current = ownedPayload<BankAccountConfig>(raw, tenant, address);
    if (current === null) throw new OwnedDocumentNotFoundError(address);

    const now = isoNow();
    const { next, requestDefault, avoidDefault } = change(current, existing);
    const all = existing.map((a) => (a.accountId === accountId ? next : a));
    const defaultId = resolveInvoiceDefault(all, requestDefault ? accountId : null, avoidDefault ? accountId : null);
    const saved: BankAccountConfig = { ...next, isDefaultForInvoices: defaultId === accountId, updatedAt: now };

    tx.set(db.collection(COLLECTIONS.ACCOUNTING_BANK_ACCOUNTS).doc(accountId),
      sanitizeForFirestore(saved as unknown as Record<string, unknown>));
    writeDefaultFlags(db, tx, existing, defaultId, accountId, now);
    return saved;
  }));
}

export function updateBankAccount(
  tenant: TenantContext, accountId: string, updates: UpdateBankAccountInput,
): Promise<BankAccountConfig> {
  return mutateBankAccount(tenant, accountId, (current) => ({
    next: {
      ...current,
      ...(updates.bankName !== undefined && { bankName: updates.bankName.trim() }),
      ...(updates.bankCode !== undefined && { bankCode: updates.bankCode ? cleanBIC(updates.bankCode) : null }),
      ...(updates.holderName !== undefined && { holderName: updates.holderName.trim() }),
      ...(updates.label !== undefined && { label: updates.label.trim() }),
      ...(updates.type !== undefined && { type: updates.type }),
      ...(updates.showOnInvoices !== undefined && { showOnInvoices: updates.showOnInvoices }),
      ...(updates.sortOrder !== undefined && { sortOrder: updates.sortOrder }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      // Ζητούμενη αποεπιλογή ⇒ ο λύτης διαλέγει άλλον· ποτέ μηδέν προεπιλεγμένοι όσο κάποιος τυπώνεται.
      isDefaultForInvoices: updates.isDefaultForInvoices === false ? false : current.isDefaultForInvoices,
    },
    requestDefault: updates.isDefaultForInvoices === true,
    avoidDefault: updates.isDefaultForInvoices === false,
  }));
}

/**
 * Επανενεργοποίηση — ο λογαριασμός επιστρέφει **χωρίς** να τυπώνεται στα τιμολόγια και χωρίς προεπιλογή: το IBAN
 * που βλέπει ο πελάτης αλλάζει μόνο με **ρητή** απόφαση (αντι-απάτη, BEC). Ο έλεγχος μοναδικού ενεργού IBAN ξανατρέχει
 * μέσα στη συναλλαγή — στο μεσοδιάστημα μπορεί να μπήκε νέος ενεργός λογαριασμός με το ίδιο IBAN. Ιδεμποτική.
 */
export function reactivateBankAccount(tenant: TenantContext, accountId: string): Promise<BankAccountConfig> {
  return mutateBankAccount(tenant, accountId, (current, existing) => {
    if (!current.isActive) assertUniqueIban(existing, cleanIBAN(current.iban), current.accountId);
    return {
      next: current.isActive ? current : { ...current, isActive: true, showOnInvoices: false, isDefaultForInvoices: false },
      requestDefault: false,
      avoidDefault: !current.isActive,
    };
  });
}

/** Απενεργοποίηση — ποτέ διαγραφή (οι κινήσεις κρατούν `accountId`). */
export function deactivateBankAccount(tenant: TenantContext, accountId: string): Promise<BankAccountConfig> {
  return mutateBankAccount(tenant, accountId, (current) => ({
    next: { ...current, isActive: false, showOnInvoices: false, isDefaultForInvoices: false },
    requestDefault: false,
    avoidDefault: true,
  }));
}
