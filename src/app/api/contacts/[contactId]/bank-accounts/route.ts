import 'server-only';

/**
 * @fileoverview Bank Accounts API — POST (Add Account)
 * @description Server-side endpoint for creating bank accounts under a contact.
 * Part of ADR-252 security audit: routes client writes through server-side validation.
 *
 * @route POST /api/contacts/[id]/bank-accounts
 * @security withAuth + withSensitiveRateLimit + tenant isolation
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-03-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { BankAccountsServerService } from '@/services/banking/bank-accounts-server.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getErrorMessage } from '@/lib/error-utils';
import { isCurrencyCode, isAccountType } from '@/types/contacts/banking';
import type { BankAccountInput, AccountType, CurrencyCode } from '@/types/contacts/banking';
import type { AuditFieldChange } from '@/types/audit-trail';
import { createModuleLogger } from '@/lib/telemetry';
import { ENTITY_TYPES } from '@/config/domain-constants';

const logger = createModuleLogger('BankAccountsPostRoute');

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// REQUEST BODY TYPE
// ============================================================================

/**
 * Expected shape of the POST request body.
 * We parse and validate each field individually for safety.
 */
interface CreateBankAccountBody {
  bankName: string;
  bankCode?: string;
  iban: string;
  accountNumber?: string;
  branch?: string;
  accountType: AccountType;
  currency: CurrencyCode;
  isPrimary: boolean;
  holderName?: string;
  notes?: string;
  isActive: boolean;
}

function buildCreateAuditChanges(accountInput: BankAccountInput): AuditFieldChange[] {
  return [
    {
      field: 'bankAccounts',
      oldValue: null,
      newValue: `${accountInput.bankName} (${accountInput.iban})`,
      label: 'Τραπεζικός λογαριασμός',
    },
    {
      field: 'bankAccounts.isPrimary',
      oldValue: null,
      newValue: accountInput.isPrimary,
      label: 'Κύριος λογαριασμός',
    },
  ];
}

// ============================================================================
// ROUTE CONTEXT
// ============================================================================

type RouteContext = { params: Promise<{ contactId: string }> };

// ============================================================================
// POST HANDLER
// ============================================================================

async function handlePost(
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
        const { contactId } = await segmentData!.params;

        // Validate contactId
        if (!contactId || typeof contactId !== 'string' || contactId.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: 'Contact ID is required' },
            { status: 400 },
          );
        }

        // Parse request body
        const body: unknown = await req.json();

        if (!body || typeof body !== 'object') {
          return NextResponse.json(
            { success: false, error: 'Request body is required' },
            { status: 400 },
          );
        }

        const rawBody = body as Record<string, unknown>;

        // Validate required fields
        if (!rawBody.bankName || typeof rawBody.bankName !== 'string') {
          return NextResponse.json(
            { success: false, error: 'bankName is required' },
            { status: 400 },
          );
        }

        if (!rawBody.iban || typeof rawBody.iban !== 'string') {
          return NextResponse.json(
            { success: false, error: 'iban is required' },
            { status: 400 },
          );
        }

        // Validate accountType
        const accountType = typeof rawBody.accountType === 'string' ? rawBody.accountType : 'checking';
        if (!isAccountType(accountType)) {
          return NextResponse.json(
            { success: false, error: 'Invalid accountType' },
            { status: 400 },
          );
        }

        // Validate currency
        const currency = typeof rawBody.currency === 'string' ? rawBody.currency : 'EUR';
        if (!isCurrencyCode(currency)) {
          return NextResponse.json(
            { success: false, error: 'Invalid currency' },
            { status: 400 },
          );
        }

        // Build validated input
        const accountInput: BankAccountInput = {
          bankName: rawBody.bankName as string,
          bankCode: typeof rawBody.bankCode === 'string' ? rawBody.bankCode : undefined,
          iban: rawBody.iban as string,
          accountNumber: typeof rawBody.accountNumber === 'string' ? rawBody.accountNumber : undefined,
          branch: typeof rawBody.branch === 'string' ? rawBody.branch : undefined,
          accountType: accountType as AccountType,
          currency: currency as CurrencyCode,
          isPrimary: rawBody.isPrimary === true,
          holderName: typeof rawBody.holderName === 'string' ? rawBody.holderName : undefined,
          notes: typeof rawBody.notes === 'string' ? rawBody.notes : undefined,
          isActive: rawBody.isActive !== false,
        };

        // Call server service
        const result = await BankAccountsServerService.addAccount(
          contactId,
          accountInput,
          ctx.companyId,
          ctx.uid,
        );

        if (!result.success) {
          const status = result.error === 'Access denied' ? 403
            : result.error === 'Contact not found' ? 404
              : 400;
          return NextResponse.json(
            { success: false, error: result.error },
            { status },
          );
        }

        await EntityAuditService.recordChange({
          entityType: ENTITY_TYPES.CONTACT,
          entityId: contactId,
          entityName: null,
          action: 'updated',
          changes: buildCreateAuditChanges(accountInput),
          performedBy: ctx.uid,
          performedByName: ctx.email,
          companyId: ctx.companyId,
        });

        logger.info('Bank account created via API', {
          contactId,
          accountId: result.data.accountId,
          uid: ctx.uid,
        });

        return NextResponse.json(
          {
            success: true,
            accountId: result.data.accountId,
          },
          { status: 201 },
        );
      } catch (error) {
        const msg = getErrorMessage(error, 'Failed to create bank account');
        logger.error('POST /api/contacts/[id]/bank-accounts error', { error: msg });
        return NextResponse.json(
          { success: false, error: msg },
          { status: 500 },
        );
      }
    },
  );

  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
