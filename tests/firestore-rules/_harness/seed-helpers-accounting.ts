/**
 * Firestore Rules Test Harness — Accounting Document Seeders
 *
 * Arrange-phase seeders for the `accounting_*` collections covered in
 * ADR-298 Phase C.1 (2026-04-13). Extracted from seed-helpers.ts to keep
 * each module at or below the 500-line Google SRP limit.
 *
 * All standard role_dual seeders follow the same contract:
 *   - `companyId` defaults to `SAME_TENANT_COMPANY_ID` ('company-a')
 *   - `createdBy` defaults to `PERSONA_CLAIMS.same_tenant_user.uid` so that
 *     `same_tenant_user × update/delete` cells exercise the `uid==createdBy` path
 *
 * @module tests/firestore-rules/_harness/seed-helpers-accounting
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { SeedOptions } from './seed-helpers';

// ---------------------------------------------------------------------------
// Shared defaults
// ---------------------------------------------------------------------------

function accountingBase(opts?: SeedOptions & { readonly createdByUid?: string }): Record<string, unknown> {
  return {
    companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
    createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
    createdAt: new Date(),
    ...opts?.overrides,
  };
}

// ---------------------------------------------------------------------------
// Pattern A — standard role_dual (canCreateAccounting with createdBy==uid)
// ---------------------------------------------------------------------------

export async function seedAccountingBankTransaction(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_bank_transactions').doc(docId).set({
      amount: 100,
      type: 'credit',
      date: new Date(),
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingBankAccount(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_bank_accounts').doc(docId).set({
      name: `Account ${docId}`,
      iban: 'GR0000000000000000000000000',
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingFixedAsset(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_fixed_assets').doc(docId).set({
      name: `Asset ${docId}`,
      purchaseDate: new Date(),
      cost: 1000,
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingDepreciationRecord(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_depreciation_records').doc(docId).set({
      assetId: `asset-${docId}`,
      amount: 50,
      period: '2026-01',
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingExpenseDocument(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_expense_documents').doc(docId).set({
      description: `Expense ${docId}`,
      amount: 200,
      date: new Date(),
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingImportBatch(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_import_batches').doc(docId).set({
      filename: `import-${docId}.csv`,
      status: 'pending',
      rowCount: 0,
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingTaxInstallment(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_tax_installments').doc(docId).set({
      taxYear: 2026,
      installmentNumber: 1,
      amount: 500,
      dueDate: new Date(),
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingApyCertificate(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_apy_certificates').doc(docId).set({
      year: 2026,
      status: 'draft',
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingCustomCategory(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_custom_categories').doc(docId).set({
      name: `Category ${docId}`,
      type: 'expense',
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingMatchingRule(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_matching_rules').doc(docId).set({
      description: `Rule ${docId}`,
      pattern: 'contains',
      keyword: 'test',
      ...accountingBase(opts),
    });
  });
}

export async function seedAccountingEfkaPayment(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly createdByUid?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_efka_payments').doc(docId).set({
      period: '2026-01',
      amount: 300,
      dueDate: new Date(),
      ...accountingBase(opts),
    });
  });
}

// ---------------------------------------------------------------------------
// Pattern C — fiscal periods (admin-create, state-machine update, no delete)
// ---------------------------------------------------------------------------

export async function seedAccountingFiscalPeriod(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_fiscal_periods').doc(docId).set({
      name: `Period ${docId}`,
      status: 'OPEN',
      startDate: new Date(),
      endDate: new Date(),
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Pattern D — settings singletons (admin-write, internal-user read)
// ---------------------------------------------------------------------------

export async function seedAccountingSettings(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_settings').doc(docId).set({
      vatRate: 0.24,
      currency: 'EUR',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

export async function seedAccountingEfkaConfig(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_efka_config').doc(docId).set({
      employeeCount: 1,
      contributionRate: 0.2068,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Pattern F — customer balances (system-calculated, admin-delete)
// ---------------------------------------------------------------------------

export async function seedAccountingCustomerBalance(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_customer_balances').doc(docId).set({
      contactId: `contact-${docId}`,
      balance: 0,
      currency: 'EUR',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}
