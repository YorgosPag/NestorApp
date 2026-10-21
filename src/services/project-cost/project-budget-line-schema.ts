/**
 * Project budget line — the stored shape, the request bodies and the ONE identity (ADR-917 Φ3β · Ζ3 · Ζ5 · Ζ8)
 *
 * Pure (no `server-only`): read by the writer, the ledger reader, the route and the tests.
 *
 * - **One line per (project, cost code)**, deterministic id ⇒ the writer finds it without a query.
 * - **No `kind` field** (Ζ8): soft cost vs allowance follows from the code's family.
 * - **Net of VAT** (Ζ5), in euros, two decimals, never negative.
 * - **Archive, never delete** (Ζ3): `archivedAt` set ⇒ the ledger ignores it, the history stays.
 * - `revision` increments on every change ⇒ compare-and-set on the writer (lost-update guard).
 *
 * Fail-closed: a document that does not parse ⇒ `null` ⇒ the reader skips it AND reports it.
 * ⛔ Never `as StoredProjectBudgetLine`: a guessed line would put a figure in the budget nobody set.
 *
 * @module services/project-cost/project-budget-line-schema
 * @see ADR-917
 */

import { z } from 'zod';

import { isBudgetLineCostCode } from '@/config/cost-taxonomy';
import { generateDeterministicProjectBudgetLineId } from '@/services/enterprise-id.service';
import type { LedgerBudgetLine } from './cost-ledger-budget';
import { BUDGET_LINE_MAX_AMOUNT, BUDGET_LINE_NOTE_MAX } from './budget-line-limits';

const nonEmpty = z.string().min(1);
const isoOrNull = nonEmpty.nullable();

const amountSchema = z.number().finite().min(0).max(BUDGET_LINE_MAX_AMOUNT);

const storedSchema = z.object({
  id: nonEmpty,
  companyId: nonEmpty,
  projectId: nonEmpty,
  costCode: nonEmpty.refine(isBudgetLineCostCode),
  amount: amountSchema,
  note: z.string().max(BUDGET_LINE_NOTE_MAX).nullable(),
  revision: z.number().int().min(1),
  createdAt: nonEmpty,
  createdBy: nonEmpty,
  updatedAt: nonEmpty,
  updatedBy: nonEmpty,
  archivedAt: isoOrNull,
});

/** The stored document (`project_budget_lines`, deny-all — server only) */
export type StoredProjectBudgetLine = z.infer<typeof storedSchema>;

/** Raw document → line, or `null` when it is not a line we understand */
export function parseProjectBudgetLine(raw: unknown): StoredProjectBudgetLine | null {
  const parsed = storedSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * The ONE identity per (company, project, cost code). The company is in the seed so that no line of one
 * tenant can ever share an address with another's — even if a project id were ever reused.
 */
export function projectBudgetLineIdOf(companyId: string, projectId: string, costCode: string): string {
  return generateDeterministicProjectBudgetLineId(`${companyId}:${projectId}:${costCode}`);
}

/** Stored → the ledger's input (`computeCostLedger({ budgetLines })`) */
export function toLedgerBudgetLine(line: StoredProjectBudgetLine): LedgerBudgetLine {
  return { id: line.id, costCode: line.costCode, amount: line.amount, note: line.note };
}

// ============================================================================
// REQUEST BODIES (the route's contract; the Φ3γ editor reuses them)
// ============================================================================

/** `PUT …/budget-lines/{costCode}` — set the line. `expectedRevision: 0` ⇒ «I believe there is no line yet». */
export const budgetLinePutBody = z.object({
  amount: amountSchema,
  note: z
    .string()
    .trim()
    .max(BUDGET_LINE_NOTE_MAX)
    .nullable()
    .transform(value => (value === '' ? null : value)),
  expectedRevision: z.number().int().min(0),
});

export type BudgetLinePutBody = z.infer<typeof budgetLinePutBody>;

/** `DELETE …/budget-lines/{costCode}?expectedRevision=N` — archive the line */
export const budgetLineArchiveQuery = z.object({
  expectedRevision: z.coerce.number().int().min(1),
});
