/**
 * =============================================================================
 * POST /api/accounting/bank/import — CSV Bank Import (Thin Wrapper)
 * =============================================================================
 *
 * Delegates to CSVImportService (SSoT) for CSV parsing and import.
 *
 * FormData fields:
 *   - file:      CSV file (required)
 *   - accountId: Bank account ID (required)
 *   - bankCode:  Bank code (optional, default: 'auto' for auto-detection)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/bank/import
 * @enterprise DECISIONS-PHASE-2.md Q4 — CSVImportService SSoT
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { getErrorMessage } from '@/lib/error-utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const SUPPORTED_EXTENSIONS = ['.csv', '.txt'];

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { csvImportService } = createAccountingServices();

        const formData = await req.formData();
        const file = formData.get('file');
        const accountId = formData.get('accountId');
        const bankCode = (formData.get('bankCode') as string | null) ?? 'auto';

        if (!file || !(file instanceof File)) {
          return NextResponse.json({ error: 'file is required (CSV)' }, { status: 400 });
        }
        if (!accountId || typeof accountId !== 'string') {
          return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
            { status: 400 }
          );
        }

        const fileName = file.name.toLowerCase();
        if (!SUPPORTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
          return NextResponse.json(
            { error: 'Unsupported file type. Please upload a .csv file' },
            { status: 400 }
          );
        }

        const csvText = await file.text();
        const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          return NextResponse.json(
            { error: 'CSV must have at least a header row and one data row' },
            { status: 400 }
          );
        }

        const parsed = await csvImportService.parseCSV(csvText, bankCode);
        const capped = parsed.slice(0, MAX_ROWS);

        const toImport = capped.map((txn) => ({
          ...txn,
          accountId,
          importBatchId: '',
          matchStatus: 'unmatched' as const,
          matchedEntityId: null,
          matchedEntityType: null,
          matchConfidence: null,
          notes: null,
        }));

        const batch = await csvImportService.importTransactions(toImport, accountId);
        return NextResponse.json({ batch });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to import bank transactions');
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
