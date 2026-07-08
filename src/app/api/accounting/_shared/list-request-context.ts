/**
 * Shared list-endpoint request context for accounting routes (ADR-603).
 *
 * SSoT for the repeated GET-list handler opener — resolve the accounting
 * repository from the auth context and the URL search params in one call. The
 * journal / invoices / bank-transactions list handlers each opened with the
 * identical `createAccountingServices(...) + new URL(req.url)` block (jscpd
 * sibling clone, N.18); they now share this resolver.
 *
 * @module api/accounting/_shared/list-request-context
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { NextRequest } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';

/**
 * Resolve `{ repository, searchParams }` for a list (GET) handler from the raw
 * request + auth context. Callers build their own typed `filters` object from
 * `searchParams` — only the shared opener is centralised here.
 */
export function readListContext(req: NextRequest, auth: AuthContext) {
  const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
  return { repository, searchParams: new URL(req.url).searchParams };
}
