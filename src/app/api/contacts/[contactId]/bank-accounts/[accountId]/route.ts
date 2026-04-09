import 'server-only';

/**
 * @fileoverview Bank Accounts API — PATCH (Update) & DELETE (Soft-Delete)
 * @route PATCH /api/contacts/[id]/bank-accounts/[accountId]
 * @route DELETE /api/contacts/[id]/bank-accounts/[accountId]
 * @security withAuth + withSensitiveRateLimit + tenant isolation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { BankAccountsServerService } from '@/services/banking/bank-accounts-server.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getErrorMessage } from '@/lib/error-utils';
import { isCurrencyCode, isAccountType } from '@/types/contacts/banking';
import type { BankAccountUpdate, AccountType, CurrencyCode } from '@/types/contacts/banking';
import { createModuleLogger } from '@/lib/telemetry';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { mapBoolean, buildUpdateAuditChanges, getExistingAccount } from './bank-account-audit';

const logger = createModuleLogger('BankAccountsPatchDeleteRoute');

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ contactId: string; accountId: string }> };

function errorToStatus(errorMsg: string): number {
  if (errorMsg === 'Access denied') return 403;
  if (errorMsg === 'Contact not found' || errorMsg === 'Bank account not found') return 404;
  return 400;
}

// ============================================================================
// PATCH HANDLER — Update Bank Account
// ============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: RouteContext,
): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse> => {
      try {
        const { contactId, accountId } = await segmentData!.params;

        if (!contactId || !accountId) {
          return NextResponse.json(
            { success: false, error: 'Contact ID and Account ID are required' },
            { status: 400 },
          );
        }

        const existingAccount = await getExistingAccount(contactId, accountId);
        if (!existingAccount) {
          return NextResponse.json(
            { success: false, error: 'Bank account not found' },
            { status: 404 },
          );
        }

        const body: unknown = await req.json();

        if (!body || typeof body !== 'object') {
          return NextResponse.json(
            { success: false, error: 'Request body is required' },
            { status: 400 },
          );
        }

        const rawBody = body as Record<string, unknown>;
        const updates: BankAccountUpdate = {};

        if (rawBody.bankName !== undefined) {
          if (typeof rawBody.bankName !== 'string' || rawBody.bankName.trim().length === 0) {
            return NextResponse.json(
              { success: false, error: 'bankName must be a non-empty string' },
              { status: 400 },
            );
          }
          updates.bankName = rawBody.bankName;
        }

        if (rawBody.bankCode !== undefined) {
          updates.bankCode = typeof rawBody.bankCode === 'string' ? rawBody.bankCode : undefined;
        }

        if (rawBody.iban !== undefined) {
          if (typeof rawBody.iban !== 'string') {
            return NextResponse.json(
              { success: false, error: 'iban must be a string' },
              { status: 400 },
            );
          }
          updates.iban = rawBody.iban;
        }

        if (rawBody.accountNumber !== undefined) {
          updates.accountNumber = typeof rawBody.accountNumber === 'string'
            ? rawBody.accountNumber
            : undefined;
        }

        if (rawBody.branch !== undefined) {
          updates.branch = typeof rawBody.branch === 'string' ? rawBody.branch : undefined;
        }

        if (rawBody.accountType !== undefined) {
          if (typeof rawBody.accountType !== 'string' || !isAccountType(rawBody.accountType)) {
            return NextResponse.json(
              { success: false, error: 'Invalid accountType' },
              { status: 400 },
            );
          }
          updates.accountType = rawBody.accountType as AccountType;
        }

        if (rawBody.currency !== undefined) {
          if (typeof rawBody.currency !== 'string' || !isCurrencyCode(rawBody.currency)) {
            return NextResponse.json(
              { success: false, error: 'Invalid currency' },
              { status: 400 },
            );
          }
          updates.currency = rawBody.currency as CurrencyCode;
        }

        if (rawBody.isPrimary !== undefined) {
          updates.isPrimary = rawBody.isPrimary === true;
        }

        if (rawBody.holderName !== undefined) {
          updates.holderName = typeof rawBody.holderName === 'string'
            ? rawBody.holderName
            : undefined;
        }

        if (rawBody.notes !== undefined) {
          updates.notes = typeof rawBody.notes === 'string' ? rawBody.notes : undefined;
        }

        if (rawBody.isActive !== undefined) {
          updates.isActive = rawBody.isActive === true;
        }

        if (Object.keys(updates).length === 0) {
          return NextResponse.json(
            { success: false, error: 'No fields to update' },
            { status: 400 },
          );
        }

        const result = await BankAccountsServerService.updateAccount(
          contactId,
          accountId,
          updates,
          ctx.companyId,
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: errorToStatus(result.error) },
          );
        }

        const changes = buildUpdateAuditChanges(existingAccount, updates);
        if (changes.length > 0) {
          await EntityAuditService.recordChange({
            entityType: ENTITY_TYPES.CONTACT,
            entityId: contactId,
            entityName: null,
            action: 'updated',
            changes,
            performedBy: ctx.uid,
            performedByName: ctx.email,
            companyId: ctx.companyId,
          });
        }

        logger.info('Bank account updated via API', { contactId, accountId, uid: ctx.uid });

        return NextResponse.json({ success: true });
      } catch (error) {
        const msg = getErrorMessage(error, 'Failed to update bank account');
        logger.error('PATCH /api/contacts/[id]/bank-accounts/[accountId] error', { error: msg });
        return NextResponse.json(
          { success: false, error: msg },
          { status: 500 },
        );
      }
    },
  );

  return handler(request);
}

// ============================================================================
// DELETE HANDLER — Soft-Delete Bank Account
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: RouteContext,
): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse> => {
      try {
        const { contactId, accountId } = await segmentData!.params;

        if (!contactId || !accountId) {
          return NextResponse.json(
            { success: false, error: 'Contact ID and Account ID are required' },
            { status: 400 },
          );
        }

        const existingAccount = await getExistingAccount(contactId, accountId);
        if (!existingAccount) {
          return NextResponse.json(
            { success: false, error: 'Bank account not found' },
            { status: 404 },
          );
        }

        const result = await BankAccountsServerService.deleteAccount(
          contactId,
          accountId,
          ctx.companyId,
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: errorToStatus(result.error) },
          );
        }

        await EntityAuditService.recordChange({
          entityType: ENTITY_TYPES.CONTACT,
          entityId: contactId,
          entityName: null,
          action: 'updated',
          changes: [
            {
              field: 'bank_accounts',
              oldValue: `${existingAccount.bankName} (${existingAccount.iban})`,
              newValue: null,
              label: 'Τραπεζικός λογαριασμός',
            },
            {
              field: 'bankAccounts.isActive',
              oldValue: mapBoolean(existingAccount.isActive),
              newValue: 'Όχι',
              label: 'Ενεργός λογαριασμός',
            },
          ],
          performedBy: ctx.uid,
          performedByName: ctx.email,
          companyId: ctx.companyId,
        });

        logger.info('Bank account soft-deleted via API', { contactId, accountId, uid: ctx.uid });

        return NextResponse.json({ success: true });
      } catch (error) {
        const msg = getErrorMessage(error, 'Failed to delete bank account');
        logger.error('DELETE /api/contacts/[id]/bank-accounts/[accountId] error', { error: msg });
        return NextResponse.json(
          { success: false, error: msg },
          { status: 500 },
        );
      }
    },
  );

  return handler(request);
}

export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
