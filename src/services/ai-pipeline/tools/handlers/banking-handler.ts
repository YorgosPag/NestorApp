/**
 * BANKING HANDLER — Bank account CRUD via AI agent
 * Delegates to BankAccountsServerService (SSoT for banking operations).
 * @module services/ai-pipeline/tools/handlers/banking-handler
 * @see ADR-171 (Autonomous AI Agent), ADR-252 (Security Audit)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getBankByIBAN } from '@/constants/greek-banks';
import { formatIBAN } from '@/types/contacts/banking';
import type { BankAccountInput, AccountType, CurrencyCode } from '@/types/contacts/banking';
import { BankAccountsServerService } from '@/services/banking/bank-accounts-server.service';
import { BANK_ACCOUNT_OPERATIONS } from '../agentic-tool-definitions';
import type { BankAccountOperation } from '../agentic-tool-definitions';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  auditWrite,
  buildAttribution,
  logger,
} from '../executor-shared';

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_ACCOUNT_TYPES: ReadonlySet<string> = new Set(['checking', 'savings', 'business', 'other']);
const VALID_CURRENCIES: ReadonlySet<string> = new Set(['EUR', 'USD', 'GBP', 'CHF']);

// ============================================================================
// HANDLER
// ============================================================================

export class BankingHandler implements ToolHandler {
  readonly toolNames = ['manage_bank_account'] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (toolName !== 'manage_bank_account') {
      return { success: false, error: `Unknown banking tool: ${toolName}` };
    }

    if (!ctx.isAdmin) {
      return { success: false, error: 'manage_bank_account is admin-only.' };
    }

    const operation = String(args.operation ?? '') as BankAccountOperation;
    if (!BANK_ACCOUNT_OPERATIONS.includes(operation)) {
      return {
        success: false,
        error: `operation must be one of: ${BANK_ACCOUNT_OPERATIONS.join(', ')}`,
      };
    }

    const contactId = String(args.contactId ?? '').trim();
    if (!contactId) {
      return { success: false, error: 'contactId is required.' };
    }

    switch (operation) {
      case 'add': return this.handleAdd(args, contactId, ctx);
      case 'list': return this.handleList(contactId, ctx);
      case 'delete': return this.handleDelete(args, contactId, ctx);
      case 'set_primary': return this.handleSetPrimary(args, contactId, ctx);
    }
  }

  // ── ADD ──

  private async handleAdd(
    args: Record<string, unknown>,
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const iban = String(args.iban ?? '').trim();
    if (!iban) {
      return { success: false, error: 'iban is required for add operation.' };
    }

    // Auto-detect Greek bank from IBAN
    const detectedBank = getBankByIBAN(iban);
    const bankName = String(args.bankName ?? '').trim() || detectedBank?.name;
    if (!bankName) {
      return {
        success: false,
        error: 'bankName is required for non-Greek IBANs (could not auto-detect).',
      };
    }

    const accountType = parseAccountType(args.accountType);
    const currency = parseCurrency(args.currency);

    const input: BankAccountInput = {
      bankName,
      bankCode: detectedBank?.code ?? undefined,
      iban,
      accountNumber: undefined,
      branch: undefined,
      accountType,
      currency,
      isPrimary: Boolean(args.isPrimary ?? false),
      holderName: nullableString(args.holderName) ?? undefined,
      notes: nullableString(args.notes) ?? undefined,
      isActive: true,
    };

    const result = await BankAccountsServerService.addAccount(
      contactId, input, ctx.companyId, buildAttribution(ctx)
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await auditWrite(ctx, 'bankAccounts', result.data.accountId, 'create', {
      contactId, iban, bankName,
    });

    logger.info('Bank account added via AI agent', {
      contactId, accountId: result.data.accountId, requestId: ctx.requestId,
    });

    return {
      success: true,
      data: {
        accountId: result.data.accountId,
        bankName,
        iban: formatIBAN(iban),
        isPrimary: input.isPrimary,
      },
    };
  }

  // ── LIST ──

  private async handleList(
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const db = getAdminFirestore();
    const contactSnap = await db.collection('contacts').doc(contactId).get();
    if (!contactSnap.exists) {
      return { success: false, error: 'Contact not found' };
    }
    const contactData = contactSnap.data();
    if (contactData?.companyId && contactData.companyId !== ctx.companyId) {
      return { success: false, error: 'Access denied' };
    }

    const snapshot = await db
      .collection('contacts').doc(contactId)
      .collection('bankAccounts')
      .where('isActive', '==', true)
      .get();

    const accounts = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        bankName: String(d.bankName ?? ''),
        iban: formatIBAN(String(d.iban ?? '')),
        isPrimary: Boolean(d.isPrimary),
        accountType: String(d.accountType ?? 'checking'),
        currency: String(d.currency ?? 'EUR'),
      };
    });

    return { success: true, data: accounts, count: accounts.length };
  }

  // ── DELETE ──

  private async handleDelete(
    args: Record<string, unknown>,
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const accountId = String(args.accountId ?? '').trim();
    if (!accountId) {
      return { success: false, error: 'accountId is required for delete.' };
    }

    const result = await BankAccountsServerService.deleteAccount(
      contactId, accountId, ctx.companyId
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await auditWrite(ctx, 'bankAccounts', accountId, 'delete', { contactId });

    logger.info('Bank account deleted via AI agent', {
      contactId, accountId, requestId: ctx.requestId,
    });

    return { success: true, data: { accountId, deleted: true } };
  }

  // ── SET PRIMARY ──

  private async handleSetPrimary(
    args: Record<string, unknown>,
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const accountId = String(args.accountId ?? '').trim();
    if (!accountId) {
      return { success: false, error: 'accountId is required for set_primary.' };
    }

    const db = getAdminFirestore();
    const accountRef = db
      .collection('contacts').doc(contactId)
      .collection('bankAccounts').doc(accountId);

    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      return { success: false, error: 'Bank account not found' };
    }

    // Unset all other primary accounts
    const primarySnap = await db
      .collection('contacts').doc(contactId)
      .collection('bankAccounts')
      .where('isPrimary', '==', true).get();

    const batch = db.batch();
    for (const doc of primarySnap.docs) {
      if (doc.id !== accountId) {
        batch.update(doc.ref, { isPrimary: false, updatedAt: FieldValue.serverTimestamp() });
      }
    }
    batch.update(accountRef, { isPrimary: true, updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();

    await auditWrite(ctx, 'bankAccounts', accountId, 'set_primary', { contactId });

    return { success: true, data: { accountId, isPrimary: true } };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function parseAccountType(value: unknown): AccountType {
  const str = String(value ?? '').trim();
  return VALID_ACCOUNT_TYPES.has(str) ? (str as AccountType) : 'checking';
}

function parseCurrency(value: unknown): CurrencyCode {
  const str = String(value ?? '').trim().toUpperCase();
  return VALID_CURRENCIES.has(str) ? (str as CurrencyCode) : 'EUR';
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}
