/**
 * =============================================================================
 * GET + PATCH + DELETE /api/accounting/journal/[id] — Single Journal Entry CRUD
 * =============================================================================
 *
 * GET:    Fetch a single journal entry by ID (404 if not found)
 * PATCH:  Update journal entry fields
 * DELETE: Delete journal entry
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/journal/[id]
 * @enterprise ADR-ACC-001 Chart of Accounts
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { UpdateJournalEntryInput } from '@/subapps/accounting/types';

// =============================================================================
// GET — Single Journal Entry
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const entry = await repository.getJournalEntry(id);

        if (!entry) {
          return NextResponse.json(
            { success: false, error: 'Journal entry not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: entry });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch journal entry';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// PATCH — Update Journal Entry
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as UpdateJournalEntryInput;

        if (!body || Object.keys(body).length === 0) {
          return NextResponse.json(
            { success: false, error: 'No update fields provided' },
            { status: 400 }
          );
        }

        // Verify entry exists
        const existing = await repository.getJournalEntry(id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Journal entry not found' },
            { status: 404 }
          );
        }

        await repository.updateJournalEntry(id, body);

        return NextResponse.json({
          success: true,
          data: { entryId: id, updated: true },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update journal entry';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);

// =============================================================================
// DELETE — Delete Journal Entry
// =============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();

        // Verify entry exists
        const existing = await repository.getJournalEntry(id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Journal entry not found' },
            { status: 404 }
          );
        }

        await repository.deleteJournalEntry(id);

        return NextResponse.json({
          success: true,
          data: { entryId: id, deleted: true },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete journal entry';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const DELETE = withStandardRateLimit(handleDelete);
