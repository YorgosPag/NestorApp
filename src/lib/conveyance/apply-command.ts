/**
 * =============================================================================
 * Conveyance — εφαρμογή εντολής (ADR-901 §5.1) — ο ΕΝΑΣ μετασχηματισμός
 * =============================================================================
 *
 * `υπόθεση + εντολή + αρχεία → νέα υπόθεση + αλλαγές ίχνους` ή απόρριψη.
 *
 * Τον τρέχει ο server μέσα σε transaction **και** ο client για optimistic update —
 * ίδιος κώδικας, ίδιο αποτέλεσμα. Δεν αγγίζει `version`/`updatedAt`: αυτά τα γράφει
 * ο server (μόνο αυτός ξέρει ότι η γραφή έγινε).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 *
 * @module lib/conveyance/apply-command
 */

import { isDateKey } from '@/lib/calendar/date-key';
import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import type { AuditFieldChange } from '@/types/audit-trail';
import type { ChecklistItemOverride, ConveyanceCase, EvidenceFile } from '@/types/conveyance-case';
import type { CommandRejection, ConveyanceCommand } from './conveyance-commands';
import { filesForMatchers } from './evidence-match';

export interface CommandContext {
  readonly actorUid: string;
  /** ISO στιγμή της πράξης. */
  readonly now: string;
  /** Σήμερα, `YYYY-MM-DD` — όριο για ημερομηνία έκδοσης. */
  readonly today: string;
  readonly evidence: readonly EvidenceFile[];
}

type CommandResult =
  | { readonly ok: true; readonly next: ConveyanceCase; readonly changes: readonly AuditFieldChange[] }
  | { readonly ok: false; readonly rejection: CommandRejection };

const reject = (rejection: CommandRejection): CommandResult => ({ ok: false, rejection });

function change(field: string, oldValue: AuditFieldChange['oldValue'], newValue: AuditFieldChange['newValue']): AuditFieldChange {
  return { field, oldValue, newValue };
}

function withOverride(current: ConveyanceCase, itemId: string, override: ChecklistItemOverride | null): ConveyanceCase {
  const overrides = { ...current.overrides };
  if (override === null) delete overrides[itemId];
  else overrides[itemId] = override;
  return { ...current, overrides };
}

function answerFact(current: ConveyanceCase, command: Extract<ConveyanceCommand, { type: 'answer_fact' }>, ctx: CommandContext): CommandResult {
  const facts = { ...current.facts };
  const before = facts[command.factId]?.value ?? null;
  if (command.value === null) delete facts[command.factId];
  else facts[command.factId] = { value: command.value, answeredBy: ctx.actorUid, answeredAt: ctx.now };
  return { ok: true, next: { ...current, facts }, changes: [change(`facts.${command.factId}`, before, command.value)] };
}

function markNotApplicable(current: ConveyanceCase, command: Extract<ConveyanceCommand, { type: 'mark_not_applicable' }>, ctx: CommandContext): CommandResult {
  if (!getChecklistItem(command.itemId)) return reject('unknown_item');
  const notApplicable = { reason: command.reason, markedBy: ctx.actorUid, markedAt: ctx.now };
  const next = withOverride(current, command.itemId, { ...current.overrides[command.itemId], notApplicable });
  return { ok: true, next, changes: [change(`checklist.${command.itemId}.notApplicable`, null, command.reason)] };
}

/** Το αρχείο που ελέγχεται πρέπει να είναι τεκμήριο ΑΥΤΗΣ της γραμμής — το αποτύπωμα το βάζει ο server. */
function resolveReviewedFile(itemId: string, fileId: string | null, evidence: readonly EvidenceFile[]): EvidenceFile | null | 'invalid' {
  if (fileId === null) return null;
  const item = getChecklistItem(itemId);
  if (!item || item.satisfaction.kind !== 'files') return 'invalid';
  return filesForMatchers(item.satisfaction.matchers, evidence).find((file) => file.fileId === fileId) ?? 'invalid';
}

function review(current: ConveyanceCase, command: Extract<ConveyanceCommand, { type: 'review' }>, ctx: CommandContext): CommandResult {
  if (!getChecklistItem(command.itemId)) return reject('unknown_item');
  if (command.verdict === 'rejected' && command.reason === null) return reject('reason_required');
  if (command.issuedOn !== null && !isDateKey(command.issuedOn)) return reject('invalid_date');
  if (command.issuedOn !== null && command.issuedOn > ctx.today) return reject('future_issue_date');
  const file = resolveReviewedFile(command.itemId, command.fileId, ctx.evidence);
  if (file === 'invalid') return reject('file_not_evidence');
  const reviewRecord = {
    verdict: command.verdict, fileId: file?.fileId ?? null, fileFingerprint: file?.fingerprint ?? null,
    issuedOn: command.issuedOn, reason: command.reason, reviewedBy: ctx.actorUid, reviewedAt: ctx.now,
  };
  const before = current.overrides[command.itemId]?.review?.verdict ?? null;
  const next = withOverride(current, command.itemId, { ...current.overrides[command.itemId], review: reviewRecord });
  return { ok: true, next, changes: [change(`checklist.${command.itemId}.review`, before, command.verdict)] };
}

function clearOverride(current: ConveyanceCase, itemId: string): CommandResult {
  if (!current.overrides[itemId]) return { ok: true, next: current, changes: [] };
  return { ok: true, next: withOverride(current, itemId, null), changes: [change(`checklist.${itemId}`, 'override', null)] };
}

export function applyConveyanceCommand(current: ConveyanceCase, command: ConveyanceCommand, ctx: CommandContext): CommandResult {
  if (current.storedState !== 'open') return reject('not_editable');
  switch (command.type) {
    case 'answer_fact': return answerFact(current, command, ctx);
    case 'mark_not_applicable': return markNotApplicable(current, command, ctx);
    case 'review': return review(current, command, ctx);
    case 'clear_override': return clearOverride(current, command.itemId);
    case 'set_target_signing_date':
      if (command.date !== null && !isDateKey(command.date)) return reject('invalid_date');
      return {
        ok: true,
        next: { ...current, targetSigningDate: command.date },
        changes: [change('targetSigningDate', current.targetSigningDate, command.date)],
      };
    case 'cancel':
      return {
        ok: true,
        next: { ...current, storedState: 'cancelled', cancellation: { reason: command.reason, by: ctx.actorUid, at: ctx.now } },
        changes: [change('state', current.storedState, 'cancelled')],
      };
  }
}
