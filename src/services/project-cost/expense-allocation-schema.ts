/**
 * Expense cost allocation — the request body of `PUT …/cost-allocations` (ADR-917 Φ4)
 *
 * Pure (no `server-only`): the route parses with it, the review form builds it. Shape only — every rule that
 * needs the stored document (Σ ≤ net, PO of the same project, CAS) is judged by the ONE writer, in its
 * transaction.
 *
 * @module services/project-cost/expense-allocation-schema
 * @see ADR-917 §4 Γ1
 */

import { z } from 'zod';

import { isBudgetLineCostCode } from '@/config/cost-taxonomy';
import { BUDGET_LINE_MAX_AMOUNT } from './budget-line-limits';
import { EXPENSE_ALLOCATION_MAX_LINES } from './expense-allocation';

const id = z.string().trim().min(1).max(128);

const expenseAllocationLineSchema = z.object({
  projectId: id,
  costCode: z.string().trim().min(1).max(64).refine(isBudgetLineCostCode, { message: 'Unknown cost code' }),
  netAmount: z.number().finite().positive().max(BUDGET_LINE_MAX_AMOUNT),
  purchaseOrderId: id.nullable(),
  origin: z.enum(['po_proposal', 'manual']),
});

/** `lines: []` clears the allocation. `expectedRevision: 0` ⇒ «I believe nothing is allocated yet». */
export const expenseAllocationPutBody = z.object({
  lines: z.array(expenseAllocationLineSchema).max(EXPENSE_ALLOCATION_MAX_LINES),
  expectedRevision: z.number().int().min(0),
});
