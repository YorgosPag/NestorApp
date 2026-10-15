/**
 * Shared list-endpoint request context for accounting routes (ADR-603).
 *
 * SSoT for the repeated GET-list handler opener — resolve the accounting
 * repository from the auth context and the URL search params in one call. The
 * journal / invoices / bank-transactions / assets list handlers each opened with the
 * identical `createAccountingServices(...) + new URL(req.url)` block (jscpd
 * sibling clone, N.18); they now share this resolver.
 *
 * ADR-ACC-010 §2.1.1 Φάση 3β — η ΣΕΛΙΔΑ (Google AIP-158):
 *   - `readPageRequest`: `pageSize` ακέραιος 1..`PAGE_SIZE_MAX` και αδιαφανές `cursor` — αλλιώς 400, ποτέ
 *     σιωπηλή διόρθωση·
 *   - `respondWithPage`: χαλασμένος / ξένος δρομέας ⇒ 400 `INVALID_PAGE_TOKEN`· συνδυασμός φίλτρων χωρίς δείκτη
 *     ⇒ 400 `UNSUPPORTED_LIST_FILTER`. Κάθε άλλο σφάλμα ανεβαίνει ως 500 — ποτέ «κενή λίστα».
 *
 * @module api/accounting/_shared/list-request-context
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { ApiError } from '@/lib/api/api-error-types';
import { badRequest, ok } from '@/lib/api/define-route';
import { InvalidPageTokenError } from '@/lib/admin-keyset-page';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, type PageRequest, type PaginatedResult } from '@/lib/pagination';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { UnsupportedListFilterError } from '@/subapps/accounting/services/repository/accounting-repo-list';
import type { FiscalQuarter } from '@/subapps/accounting/types';

import { MAX_FISCAL_YEAR, MIN_FISCAL_YEAR } from './fiscal-year-param';

/** Κωδικοί άρνησης της σελίδας — ο πελάτης τους μεταφράζει, δεν διαβάζει το μήνυμα. */
export const LIST_ERROR_CODES = {
  INVALID_PAGE_TOKEN: 'INVALID_PAGE_TOKEN',
  UNSUPPORTED_LIST_FILTER: 'UNSUPPORTED_LIST_FILTER',
} as const;

const INTEGER = /^\d+$/;

/**
 * Resolve `{ repository, searchParams }` for a list (GET) handler from the raw
 * request + auth context. Callers build their own typed `filters` object from
 * `searchParams` — only the shared opener is centralised here.
 */
export function readListContext(req: NextRequest, auth: AuthContext) {
  const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
  return { repository, searchParams: new URL(req.url).searchParams };
}

/**
 * Προαιρετικό ακέραιο φίλτρο μέσα σε `[min, max]`. Απόν ⇒ `undefined`· άκυρο ⇒ 400. Πριν, ένα `quarter=Q1`
 * γινόταν `NaN` και το φίλτρο **αγνοούνταν σιωπηλά** — η οθόνη έδειχνε όλο το έτος ως «Q1».
 */
export function optionalIntParam(
  searchParams: URLSearchParams,
  name: string,
  min: number,
  max: number,
): number | undefined {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return undefined;
  const value = INTEGER.test(raw) ? Number(raw) : Number.NaN;
  if (!(value >= min && value <= max)) badRequest(`${name} must be an integer in ${min}..${max}`);
  return value;
}

/** Προαιρετικό έτος χρήσης (`MIN_FISCAL_YEAR`..`MAX_FISCAL_YEAR`). */
export function optionalFiscalYearParam(searchParams: URLSearchParams): number | undefined {
  return optionalIntParam(searchParams, 'fiscalYear', MIN_FISCAL_YEAR, MAX_FISCAL_YEAR);
}

function isFiscalQuarter(value: number): value is FiscalQuarter {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Προαιρετικό τρίμηνο 1..4 (αριθμός — όχι `Q1`). */
export function optionalQuarterParam(searchParams: URLSearchParams): FiscalQuarter | undefined {
  const value = optionalIntParam(searchParams, 'quarter', 1, 4);
  return value !== undefined && isFiscalQuarter(value) ? value : undefined;
}

/** Προαιρετικό φίλτρο κλειστού λεξιλογίου. Απόν ⇒ `undefined`· άγνωστη τιμή ⇒ 400 (όχι τυφλό `as`). */
export function optionalEnumParam<V extends string>(
  searchParams: URLSearchParams,
  name: string,
  values: readonly V[],
): V | undefined {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return undefined;
  if (!(values as readonly string[]).includes(raw)) badRequest(`${name} must be one of: ${values.join(', ')}`);
  return raw as V;
}

/** Προαιρετικό φίλτρο ταυτότητας (μη κενό κείμενο). */
export function optionalIdParam(searchParams: URLSearchParams, name: string): string | undefined {
  const raw = searchParams.get(name);
  return raw === null || raw === '' ? undefined : raw;
}

/** `pageSize` + `cursor` από το query — άκυρο μέγεθος ⇒ 400 (όχι σιωπηλό «50»). */
export function readPageRequest(searchParams: URLSearchParams): PageRequest {
  const rawSize = searchParams.get('pageSize');
  let pageSize = PAGE_SIZE_DEFAULT;
  if (rawSize !== null) {
    const parsed = INTEGER.test(rawSize) ? Number(rawSize) : Number.NaN;
    if (!(parsed >= 1 && parsed <= PAGE_SIZE_MAX)) badRequest(`pageSize must be an integer in 1..${PAGE_SIZE_MAX}`);
    pageSize = parsed;
  }
  const cursor = searchParams.get('cursor');
  return { pageSize, cursor: cursor === null || cursor === '' ? null : cursor };
}

/** Εκτελεί την ανάγνωση της σελίδας και απαντά — με τις δύο αρνήσεις του πελάτη ως 400. */
export async function respondWithPage<T>(read: () => Promise<PaginatedResult<T>>): Promise<NextResponse> {
  try {
    return ok(await read());
  } catch (error) {
    if (error instanceof InvalidPageTokenError) {
      throw new ApiError(400, error.message, LIST_ERROR_CODES.INVALID_PAGE_TOKEN);
    }
    if (error instanceof UnsupportedListFilterError) {
      throw new ApiError(400, error.message, LIST_ERROR_CODES.UNSUPPORTED_LIST_FILTER);
    }
    throw error;
  }
}
