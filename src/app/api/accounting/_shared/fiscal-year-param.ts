/**
 * Shared query-param resolver for accounting routes (ADR-603).
 *
 * SSoT for the repeated `fiscalYear` query parsing: default to the current year,
 * 400 (`Invalid fiscalYear`) when present-but-non-numeric. Extracted from the
 * balances + fiscal-periods GET handlers (jscpd sibling clone).
 *
 * @module api/accounting/_shared/fiscal-year-param
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { NextRequest } from 'next/server';
import { badRequest } from '@/lib/api/define-route';

/**
 * Resolve the `fiscalYear` query param, defaulting to the current calendar year.
 * Throws a 400 `{ success:false, error:'Invalid fiscalYear' }` when the param is
 * present but does not parse to a number.
 */
export function resolveFiscalYearParam(req: NextRequest): number {
  const raw = new URL(req.url).searchParams.get('fiscalYear');
  const fiscalYear = raw ? parseInt(raw, 10) : new Date().getFullYear();
  if (isNaN(fiscalYear)) badRequest('Invalid fiscalYear');
  return fiscalYear;
}

/**
 * Resolve a year query param (`param`) and validate it falls in the 2000-2100
 * range, defaulting to the current calendar year when absent. Throws a 400
 * `{ success:false, error:'<label> must be a valid year (2000-2100)' }` when the
 * value is non-numeric or out of range. Shared by the documents / efka / tax
 * summary handlers (jscpd sibling clone).
 */
export function resolveYearInRange(req: NextRequest, param: string, label: string): number {
  const raw = new URL(req.url).searchParams.get(param);
  const year = raw ? parseInt(raw, 10) : new Date().getFullYear();
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    badRequest(`${label} must be a valid year (2000-2100)`);
  }
  return year;
}
