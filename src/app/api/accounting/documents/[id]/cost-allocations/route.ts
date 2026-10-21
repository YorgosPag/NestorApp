/**
 * GET /api/accounting/documents/[id]/cost-allocations[?purchaseOrderId=…]
 *     → { lines, revision, netAmount, coverage, proposal, purchaseOrderNumbers }
 * PUT /api/accounting/documents/[id]/cost-allocations  { lines, expectedRevision } → { outcome, lines, revision }
 *
 * Which project + cost code an expense document pays for (ADR-917 Φ4 · §4 Γ1).
 *
 * - **Proposal** (GET): from the PO named in the query, else from the document's `suggestedPOId` — the PO's cost
 *   codes in proportion to its lines, summing exactly to the net amount. A proposal is NEVER stored: the human
 *   confirms it with a PUT (origin `po_proposal`), or changes it (origin `manual`).
 * - **One writer** (PUT): `writeExpenseCostAllocations` — tenant, references, Σ ≤ net and CAS judged in ONE
 *   transaction. 409 `{ currentRevision }` on a stale revision; 400 with the issues on invalid lines; 404 for a
 *   foreign or missing document (same answer). Retries also pass the `Idempotency-Key` boundary (ADR-872).
 *
 * Auth: withAuth (accounting) · tenant fence in the reader and the writer · Rate: standard
 *
 * @see ADR-917 Φ4
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { badRequest, conflict, defineRoute, notFound, ok } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { nowISO } from '@/lib/date-local';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { getPO } from '@/services/procurement/procurement-service';
import {
  allocatedPurchaseOrderIdsOf,
  allocationCoverageOf,
  expenseNetAmountOf,
  proposeAllocationsFromPurchaseOrder,
} from '@/services/project-cost/expense-allocation';
import { expenseAllocationPutBody } from '@/services/project-cost/expense-allocation-schema';
import { writeExpenseCostAllocations } from '@/services/project-cost/expense-cost-allocations.server';
import { requireExpenseDocument } from '../../../_shared/expense-document-access';
import type { ReceivedExpenseDocument } from '@/subapps/accounting/types/documents';

export const dynamic = 'force-dynamic';

type Params = { id: string };

/** The PO a proposal is drawn from — ours, alive — or `null` (no proposal, nothing guessed) */
async function proposalFor(document: ReceivedExpenseDocument, purchaseOrderId: string | null, companyId: string) {
  const poId = purchaseOrderId ?? document.suggestedPOId;
  if (!poId) return null;
  const po = await getPO(poId);
  if (po === null || po.isDeleted || !isPayloadOwnedByCompany(po, companyId)) return null;
  return {
    purchaseOrder: { id: po.id, poNumber: po.poNumber, projectId: po.projectId, status: po.status },
    lines: proposeAllocationsFromPurchaseOrder(po, expenseNetAmountOf(document)),
  };
}

/** `poId → poNumber` for the POs the stored lines name — the screen never shows a raw id */
async function purchaseOrderNumbersOf(lines: ReceivedExpenseDocument['costAllocations'], companyId: string) {
  const entries = await Promise.all(allocatedPurchaseOrderIdsOf(lines ?? []).map(async (poId) => {
    const po = await getPO(poId);
    return po !== null && isPayloadOwnedByCompany(po, companyId) ? [poId, po.poNumber] as const : null;
  }));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null));
}

export const GET = defineRoute<never, Params>({
  rateLimit: 'standard',
  fallbackError: 'Failed to load cost allocation',
  handler: async ({ auth, req, params }) => {
    const { document } = await requireExpenseDocument(auth, params.id);
    const netAmount = expenseNetAmountOf(document);
    const lines = document.costAllocations ?? [];
    const requestedPo = req.nextUrl.searchParams.get('purchaseOrderId')?.trim() || null;
    return ok({
      lines,
      revision: document.allocationRevision ?? 0,
      netAmount,
      coverage: allocationCoverageOf(netAmount, lines),
      proposal: await proposalFor(document, requestedPo, auth.companyId),
      purchaseOrderNumbers: await purchaseOrderNumbersOf(lines, auth.companyId),
    });
  },
});

export const PUT = defineRoute<typeof expenseAllocationPutBody, Params>({
  rateLimit: 'standard',
  schema: expenseAllocationPutBody,
  fallbackError: 'Failed to set cost allocation',
  handler: async ({ auth, body, params }) => {
    const outcome = await writeExpenseCostAllocations(getAdminFirestore(), {
      actor: { companyId: auth.companyId, uid: auth.uid, name: auth.email || null },
      documentId: params.id,
      lines: body.lines,
      expectedRevision: body.expectedRevision,
      nowIso: nowISO(),
    });
    if (outcome.kind === 'not_found') notFound('Document not found');
    if (outcome.kind === 'conflict') conflict('Cost allocation changed meanwhile', { currentRevision: outcome.currentRevision });
    if (outcome.kind === 'not_allocatable') conflict('Document cannot carry a cost allocation', { status: outcome.status });
    if (outcome.kind === 'invalid') badRequest('Invalid cost allocation', { issues: outcome.issues });
    if (outcome.kind === 'invalid_reference') {
      badRequest('Unknown allocation reference', { problem: outcome.problem, id: outcome.id });
    }
    return ok({ outcome: outcome.kind, lines: outcome.lines, revision: outcome.revision });
  },
});
