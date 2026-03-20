import 'server-only';

/**
 * @fileoverview Bank Accounts API — PATCH (Update) & DELETE (Soft-Delete)
 * @description Server-side endpoints for modifying/removing bank accounts.
 * Part of ADR-252 security audit: routes client writes through server-side validation.
 *
 * @route PATCH /api/contacts/[id]/bank-accounts/[accountId]
 * @route DELETE /api/contacts/[id]/bank-accounts/[accountId]
 * @security withAuth + withSensitiveRateLimit + tenant isolation
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-03-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { BankAccountsServerService } from '@/services/banking/bank-accounts-server.service';
import { getErrorMessage } from '@/lib/error-utils';
import { isCurrencyCode, isAccountType } from '@/types/contacts/banking';
import type { BankAccountUpdate, AccountType, CurrencyCode } from '@/types/contacts/banking';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BankAccountsPatchDeleteRoute');

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// ROUTE CONTEXT
// ============================================================================

type RouteContext = { params: Promise<{ id: string; accountId: string }> };

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map server service error messages to HTTP status codes.
 */
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
  segmentData?: RouteContext
): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const { id: contactId, accountId } = await segmentData!.params;

        // Validate path params
        if (!contactId || !accountId) {
          return NextResponse.json(
            { success: false, error: 'Contact ID and Account ID are required' },
            { status: 400 }
          );
        }

        // Parse request body
        const body: unknown = await req.json();

        if (!body || typeof body !== 'object') {
          return NextResponse.json(
            { success: false, error: 'Request body is required' },
            { status: 400 }
          );
        }

        const rawBody = body as Record<string, unknown>;

        // Build validated update — only include fields that are present
        const updates: BankAccountUpdate = {};

        if (rawBody.bankName !== undefined) {
          if (typeof rawBody.bankName !== 'string' || rawBody.bankName.trim().length === 0) {
            return NextResponse.json(
              { success: false, error: 'bankName must be a non-empty string' },
              { status: 400 }
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
              { status: 400 }
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
              { status: 400 }
            );
          }
          updates.accountType = rawBody.accountType as AccountType;
        }

        if (rawBody.currency !== undefined) {
          if (typeof rawBody.currency !== 'string' || !isCurrencyCode(rawBody.currency)) {
            return NextResponse.json(
              { success: false, error: 'Invalid currency' },
              { status: 400 }
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

        // Check that at least one field is being updated
        if (Object.keys(updates).length === 0) {
          return NextResponse.json(
            { success: false, error: 'No fields to update' },
            { status: 400 }
          );
        }

        // Call server service
        const result = await BankAccountsServerService.updateAccount(
          contactId,
          accountId,
          updates,
          ctx.companyId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: errorToStatus(result.error) }
          );
        }

        logger.info('Bank account updated via API', { contactId, accountId, uid: ctx.uid });

        return NextResponse.json({ success: true });
      } catch (error) {
        const msg = getErrorMessage(error, 'Failed to update bank account');
        logger.error('PATCH /api/contacts/[id]/bank-accounts/[accountId] error', { error: msg });
        return NextResponse.json(
          { success: false, error: msg },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

// ============================================================================
// DELETE HANDLER — Soft-Delete Bank Account
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: RouteContext
): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const { id: contactId, accountId } = await segmentData!.params;

        // Validate path params
        if (!contactId || !accountId) {
          return NextResponse.json(
            { success: false, error: 'Contact ID and Account ID are required' },
            { status: 400 }
          );
        }

        // Call server service (soft delete)
        const result = await BankAccountsServerService.deleteAccount(
          contactId,
          accountId,
          ctx.companyId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: errorToStatus(result.error) }
          );
        }

        logger.info('Bank account soft-deleted via API', { contactId, accountId, uid: ctx.uid });

        return NextResponse.json({ success: true });
      } catch (error) {
        const msg = getErrorMessage(error, 'Failed to delete bank account');
        logger.error('DELETE /api/contacts/[id]/bank-accounts/[accountId] error', { error: msg });
        return NextResponse.json(
          { success: false, error: msg },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
