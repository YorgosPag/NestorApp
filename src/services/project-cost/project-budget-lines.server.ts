/**
 * Project budget lines — the ONE reader and the ONE writer of `project_budget_lines` (ADR-917 Φ3β)
 *
 * - **One line per (project, cost code)**, deterministic id ⇒ set / archive always hit the SAME document.
 * - **Compare-and-set** on `revision`, read and write in ONE transaction: two people editing the same line
 *   never silently overwrite each other — the second one gets `conflict` with the current revision.
 * - **Same values ⇒ `unchanged`**: no write, no revision bump, no history row (idempotent replays).
 * - **History on the PROJECT** (ADR-195), as a collection keyed by cost code — through the canonical
 *   `diffTrackedFields` + the project registry, never a hand-written diff.
 * - **Foreign ≡ absent**: a document of another company never reads as a line.
 *
 * Tenant fencing of the PROJECT is the caller's job (`requireProjectInTenant`); every read here is also
 * scoped by `companyId`. Equality-only query (`companyId` + `projectId`) ⇒ single-field index merge.
 *
 * @module services/project-cost/project-budget-lines.server
 * @see ADR-917 Ζ3 · Ζ5 · Ζ8
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { PROJECT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { diffTrackedFields } from '@/lib/audit/audit-diff';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  parseProjectBudgetLine,
  projectBudgetLineIdOf,
  type StoredProjectBudgetLine,
} from './project-budget-line-schema';
import { normalizeBudgetAmount } from './budget-line-limits';

const logger = createModuleLogger('project-budget-lines');

function linesCollection(db: Firestore) {
  return db.collection(COLLECTIONS.PROJECT_BUDGET_LINES);
}

/** One document → a line of THIS company, or nothing. Corrupt ⇒ skipped AND reported. */
function ownLine(id: string, raw: unknown, companyId: string): StoredProjectBudgetLine | null {
  const parsed = parseProjectBudgetLine(raw);
  if (parsed !== null && parsed.companyId === companyId) return parsed;
  if (raw !== undefined) logger.warn('Unreadable project budget line — skipped', { lineId: id });
  return null;
}

/** The project's ACTIVE lines (archived ones excluded) — what the ledger and the editor read */
export async function readProjectBudgetLines(
  db: Firestore,
  companyId: string,
  projectId: string,
): Promise<StoredProjectBudgetLine[]> {
  // Literal collection (not `linesCollection`): CHECK 3.91 must SEE the query to judge its index.
  const snapshot = await db
    .collection(COLLECTIONS.PROJECT_BUDGET_LINES)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where(FIELDS.PROJECT_ID, '==', projectId)
    .get();
  return snapshot.docs
    .map(doc => ownLine(doc.id, doc.data(), companyId))
    .filter((line): line is StoredProjectBudgetLine => line !== null && line.archivedAt === null);
}

// ============================================================================
// WRITE
// ============================================================================

export interface BudgetLineActor {
  readonly companyId: string;
  readonly uid: string;
  readonly name: string | null;
}

export interface BudgetLineTarget {
  readonly projectId: string;
  readonly projectName: string | null;
  readonly costCode: string;
}

/** `null` ⇒ archive */
export interface BudgetLineValues {
  readonly amount: number;
  readonly note: string | null;
}

export interface BudgetLineWrite {
  readonly actor: BudgetLineActor;
  readonly target: BudgetLineTarget;
  readonly next: BudgetLineValues | null;
  readonly expectedRevision: number;
  readonly nowIso: string;
}

export type BudgetLineWriteOutcome =
  | { readonly kind: 'changed'; readonly line: StoredProjectBudgetLine }
  | { readonly kind: 'unchanged'; readonly line: StoredProjectBudgetLine | null }
  | { readonly kind: 'conflict'; readonly currentRevision: number };

const isActive = (line: StoredProjectBudgetLine | null): line is StoredProjectBudgetLine =>
  line !== null && line.archivedAt === null;

/**
 * The revision a caller can have SEEN. The reader shows active lines only, so an archived line is «no line»
 * (`0`) to every editor — comparing against its stored revision would answer 409 forever to a revival nobody
 * could ever address (Λ9). The stored revision still grows monotonically (`nextLine`).
 */
const activeRevisionOf = (line: StoredProjectBudgetLine | null): number => (isActive(line) ? line.revision : 0);

function sameValues(current: StoredProjectBudgetLine | null, next: BudgetLineValues | null): boolean {
  if (!isActive(current) || next === null) return !isActive(current) && next === null;
  return current.amount === next.amount && current.note === next.note;
}

function nextLine(write: BudgetLineWrite, id: string, previous: StoredProjectBudgetLine | null): StoredProjectBudgetLine {
  const { actor, target, next, nowIso } = write;
  return {
    id,
    companyId: actor.companyId,
    projectId: target.projectId,
    costCode: target.costCode,
    amount: next?.amount ?? previous?.amount ?? 0,
    note: next === null ? (previous?.note ?? null) : next.note,
    revision: (previous?.revision ?? 0) + 1,
    createdAt: previous?.createdAt ?? nowIso,
    createdBy: previous?.createdBy ?? actor.uid,
    updatedAt: nowIso,
    updatedBy: actor.uid,
    archivedAt: next === null ? nowIso : null,
  };
}

/** Collection item for the history diff: present only while active */
const asItems = (line: StoredProjectBudgetLine | null) =>
  isActive(line) ? [{ costCode: line.costCode, amount: line.amount, note: line.note }] : [];

async function recordBudgetLineAudit(
  write: BudgetLineWrite,
  previous: StoredProjectBudgetLine | null,
  line: StoredProjectBudgetLine,
): Promise<void> {
  const changes = diffTrackedFields(
    { budgetLines: asItems(previous) },
    { budgetLines: asItems(line) },
    { budgetLines: PROJECT_TRACKED_FIELDS.budgetLines },
  );
  if (changes.length === 0) return;
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROJECT,
    entityId: write.target.projectId,
    entityName: write.target.projectName,
    action: 'updated',
    changes,
    performedBy: write.actor.uid,
    performedByName: write.actor.name,
    companyId: write.actor.companyId,
  });
}

/**
 * Sets (or archives, `next: null`) the line of (project, cost code). Read + CAS + write in ONE transaction;
 * the history row is written after the commit, from the same `previous` the transaction saw.
 */
export async function writeProjectBudgetLine(db: Firestore, write: BudgetLineWrite): Promise<BudgetLineWriteOutcome> {
  const { actor, target } = write;
  const ref = linesCollection(db).doc(projectBudgetLineIdOf(actor.companyId, target.projectId, target.costCode));
  const normalized = write.next && { amount: normalizeBudgetAmount(write.next.amount), note: write.next.note };
  const result = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const previous = snapshot.exists ? ownLine(ref.id, snapshot.data(), actor.companyId) : null;
    // Fail-closed: a document we cannot read is never overwritten by a guess of what it held.
    if (snapshot.exists && previous === null) throw new Error(`Unreadable project budget line ${ref.id}`);
    if (sameValues(previous, normalized)) return { kind: 'unchanged' as const, line: previous, previous };
    const currentRevision = activeRevisionOf(previous);
    if (currentRevision !== write.expectedRevision) return { kind: 'conflict' as const, currentRevision, previous };
    const line = nextLine({ ...write, next: normalized }, ref.id, previous);
    tx.set(ref, line);
    return { kind: 'changed' as const, line, previous };
  });
  if (result.kind === 'conflict') return { kind: 'conflict', currentRevision: result.currentRevision };
  if (result.kind === 'unchanged') return { kind: 'unchanged', line: isActive(result.line) ? result.line : null };
  await recordBudgetLineAudit(write, result.previous, result.line);
  return { kind: 'changed', line: result.line };
}
