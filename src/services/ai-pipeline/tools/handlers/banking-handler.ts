/**
 * BANKING HANDLER — Bank account CRUD via AI agent
 * Delegates to BankAccountsServerService (SSoT for banking operations).
 * @module services/ai-pipeline/tools/handlers/banking-handler
 * @see ADR-171 (Autonomous AI Agent), ADR-252 (Security Audit)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { getBankByIBAN } from '@/constants/greek-banks';
import { formatIBAN } from '@/types/contacts/banking';
import type { BankAccountInput, AccountType, CurrencyCode } from '@/types/contacts/banking';
import { BankAccountsServerService } from '@/services/banking/bank-accounts-server.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditFieldChange } from '@/types/audit-trail';
import { resolveOwnedToolDoc } from '../tool-tenant-guard';
import { BANK_ACCOUNT_OPERATIONS } from '../agentic-tool-definitions';
import type { BankAccountOperation } from '../agentic-tool-definitions';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  auditWrite,
  buildAttribution,
  logger,
  nullableString,
} from '../executor-shared';

/** ADR-195: local wrapper for CONTACT entity audit (banking subcollection mutations). */
async function recordBankingAudit(
  ctx: AgenticContext,
  contactId: string,
  changes: AuditFieldChange[],
): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: contactId,
    entityName: null,
    action: 'updated',
    changes,
    performedBy: ctx.channelSenderId || 'system',
    performedByName: buildAttribution(ctx),
    companyId: ctx.companyId,
  });
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_ACCOUNT_TYPES: ReadonlySet<string> = new Set(['checking', 'savings', 'business', 'other']);
const VALID_CURRENCIES: ReadonlySet<string> = new Set(['EUR', 'USD', 'GBP', 'CHF', 'BGN', 'RON', 'RSD', 'MKD', 'ALL']);

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

/**
 * Το `accountId` όπως το έδωσε το μοντέλο — ή το έτοιμο σφάλμα.
 *
 * Το μήνυμα ονομάζει τη **λειτουργία** ώστε το μοντέλο να καταλάβει ποια κλήση
 * απέτυχε· γι' αυτό η λειτουργία είναι παράμετρος και όχι σταθερά.
 *
 * (N.0.2 Boy Scout: `handleDelete` και `handleSetPrimary` το έγραφαν
 * πανομοιότυπα — το CHECK 3.28 το μετρούσε ως κλώνο **ήδη στο HEAD**.)
 */
function requireAccountId(
  args: Record<string, unknown>,
  operation: BankAccountOperation,
):
  | { readonly ok: true; readonly accountId: string }
  | { readonly ok: false; readonly result: ToolResult } {
  const accountId = String(args.accountId ?? '').trim();
  if (!accountId) {
    return {
      ok: false,
      result: { success: false, error: `accountId is required for ${operation}.` },
    };
  }
  return { ok: true, accountId };
}

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

    await auditWrite(ctx, 'bank_accounts', result.data.accountId, 'create', {
      contactId, iban, bankName,
    });
    await recordBankingAudit(ctx, contactId, [
      { field: 'bankAccounts', oldValue: null, newValue: `${bankName} ${formatIBAN(iban)}`, label: 'Τραπεζικός λογαριασμός' },
    ]);

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
    const contactSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();

    // Tenant ownership (ADR-742 Φάση Δ). Δύο διακριτά μηνύματα («Contact not
    // found» vs «Access denied») επέτρεπαν στον καλούντα να συμπεράνει ύπαρξη
    // από το *ποιο* γύρισε· πλέον γυρίζει το ίδιο.
    //
    // ⚠️ ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ: το παλιό `contactData?.companyId &&` άφηνε να
    // περάσει επαφή **χωρίς** `companyId`. Ο SSoT ρωτά `isPayloadOwnedByCompany`
    // — έγγραφο χωρίς tenant δεν ανήκει σε κανέναν (ADR-742 §4).
    const owned = resolveOwnedToolDoc({
      snap: contactSnap,
      ctx,
      subject: { resource: 'Contact', resourceId: contactId, path: 'banking:list' },
      notFound: () => ({ success: false, error: 'Contact not found' }),
    });
    if (!owned.ok) return owned.result;

    const snapshot = await db
      .collection(COLLECTIONS.CONTACTS).doc(contactId)
      .collection(SUBCOLLECTIONS.BANK_ACCOUNTS)
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
    const parsed = requireAccountId(args, 'delete');
    if (!parsed.ok) return parsed.result;
    const { accountId } = parsed;

    const result = await BankAccountsServerService.deleteAccount(
      contactId, accountId, ctx.companyId
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await auditWrite(ctx, 'bank_accounts', accountId, 'delete', { contactId });
    await recordBankingAudit(ctx, contactId, [
      { field: 'bankAccounts', oldValue: accountId, newValue: null, label: 'Τραπεζικός λογαριασμός' },
    ]);

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
    const parsed = requireAccountId(args, 'set_primary');
    if (!parsed.ok) return parsed.result;
    const { accountId } = parsed;

    const db = getAdminFirestore();
    const accountRef = db
      .collection(COLLECTIONS.CONTACTS).doc(contactId)
      .collection(SUBCOLLECTIONS.BANK_ACCOUNTS).doc(accountId);

    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      return { success: false, error: 'Bank account not found' };
    }

    // Unset all other primary accounts
    const primarySnap = await db
      .collection(COLLECTIONS.CONTACTS).doc(contactId)
      .collection(SUBCOLLECTIONS.BANK_ACCOUNTS)
      .where('isPrimary', '==', true).get();

    const batch = db.batch();
    for (const doc of primarySnap.docs) {
      if (doc.id !== accountId) {
        batch.update(doc.ref, { isPrimary: false, updatedAt: FieldValue.serverTimestamp() });
      }
    }
    batch.update(accountRef, { isPrimary: true, updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();

    await auditWrite(ctx, 'bank_accounts', accountId, 'set_primary', { contactId });
    await recordBankingAudit(ctx, contactId, [
      { field: 'primaryBankAccount', oldValue: null, newValue: accountId, label: 'Κύριος λογαριασμός' },
    ]);

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
