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
import { isPartyFact, type ConveyancePartyFactId } from '@/config/conveyance-checklist/types';
import { contradictsDocumentText } from '@/lib/document-validity/document-facts';
import type { ChecklistItemOverride, ConveyanceCase, EvidenceFile } from '@/types/conveyance-case';
import type { CommandRejection, ConveyanceCommand } from './conveyance-commands';
import { resolveCaseRow, rowFiles, type CaseRow } from './case-rows';
import { change, reject, type CommandResult } from './command-result';
import { addSellers, removeSeller, type SellerCandidates } from './case-party-commands';

export interface CommandContext {
  readonly actorUid: string;
  /** ISO στιγμή της πράξης. */
  readonly now: string;
  /** Σήμερα, `YYYY-MM-DD` — όριο για ημερομηνία έκδοσης. */
  readonly today: string;
  readonly evidence: readonly EvidenceFile[];
  /**
   * ADR-915 §23 — οι επαφές του `add_sellers`, **ήδη κριμένες** (`sellerCandidateOf`): ο server από τις επαφές που
   * διάβασε ο ίδιος, ο client από τον επιλογέα. Όποια λείπει ⇒ `seller_not_eligible`. Οι άλλες εντολές δεν το διαβάζουν.
   */
  readonly sellerCandidates: SellerCandidates;
}

function withOverride(current: ConveyanceCase, itemId: string, override: ChecklistItemOverride | null): ConveyanceCase {
  const overrides = { ...current.overrides };
  if (override === null) delete overrides[itemId];
  else overrides[itemId] = override;
  return { ...current, overrides };
}

type AnswerFact = Extract<ConveyanceCommand, { type: 'answer_fact' }>;

function answerFact(current: ConveyanceCase, command: AnswerFact, ctx: CommandContext): CommandResult {
  const { factId } = command;
  if (isPartyFact(factId)) return answerPartyFact(current, { ...command, factId }, ctx);
  if (command.partyKey !== undefined) return reject('party_not_applicable');
  const facts = { ...current.facts };
  const before = facts[command.factId]?.value ?? null;
  if (command.value === null) delete facts[command.factId];
  else facts[command.factId] = { value: command.value, answeredBy: ctx.actorUid, answeredAt: ctx.now };
  return { ok: true, next: { ...current, facts }, changes: [change(`facts.${command.factId}`, before, command.value)] };
}

/**
 * ADR-915 §22 — απάντηση σε γεγονός **ενός προσώπου**: γράφεται στο `partyFacts[key]`, ποτέ στο κοινό `facts` (το
 * «πληρεξούσιο;» του Α δεν απαντά για τον Β). Πρόσωπο εκτός υπόθεσης ⇒ άρνηση, όχι «ορφανή» απάντηση.
 */
function answerPartyFact(current: ConveyanceCase, command: AnswerFact & { readonly factId: ConveyancePartyFactId }, ctx: CommandContext): CommandResult {
  const { partyKey, factId } = command;
  if (partyKey === undefined || !current.parties.sellers.some((party) => party.key === partyKey)) return reject('party_required');
  const own = { ...current.partyFacts[partyKey] };
  const before = own[factId]?.value ?? null;
  if (command.value === null) delete own[factId];
  else own[factId] = { value: command.value, answeredBy: ctx.actorUid, answeredAt: ctx.now };
  const partyFacts = { ...current.partyFacts, [partyKey]: own };
  if (Object.keys(own).length === 0) delete partyFacts[partyKey];
  return { ok: true, next: { ...current, partyFacts }, changes: [change(`partyFacts.${partyKey}.${factId}`, before, command.value)] };
}

function markNotApplicable(current: ConveyanceCase, command: Extract<ConveyanceCommand, { type: 'mark_not_applicable' }>, ctx: CommandContext): CommandResult {
  if (!resolveCaseRow(current, command.itemId)) return reject('unknown_item');
  const notApplicable = { reason: command.reason, markedBy: ctx.actorUid, markedAt: ctx.now };
  const next = withOverride(current, command.itemId, { ...current.overrides[command.itemId], notApplicable });
  return { ok: true, next, changes: [change(`checklist.${command.itemId}.notApplicable`, null, command.reason)] };
}

/**
 * Το αρχείο που ελέγχεται πρέπει να είναι τεκμήριο ΑΥΤΗΣ της γραμμής — το αποτύπωμα το βάζει ο server. ADR-915 §22:
 * για γραμμή προσώπου, **του** προσώπου (η ΕΝΦΙΑ του Α δεν εγκρίνεται στη γραμμή του Β).
 */
function resolveReviewedFile(row: CaseRow, fileId: string | null, evidence: readonly EvidenceFile[]): EvidenceFile | null | 'invalid' {
  if (fileId === null) return null;
  if (row.item.satisfaction.kind !== 'files') return 'invalid';
  return rowFiles(row, evidence).find((file) => file.fileId === fileId) ?? 'invalid';
}

/**
 * ADR-915 Φ3β — αποδοχή με ημερομηνία που **αντιλέγει** σε ό,τι διάβασε ο αναγνώστης από το ίδιο το έγγραφο. Το έγγραφο
 * δεν διορθώνεται με δήλωση: αν ο ελεγκτής διαφωνεί, **επιστρέφει** το έγγραφο με λόγο (revise & resubmit).
 */
function contradictsDocument(row: CaseRow, file: EvidenceFile | null, declared: DeclaredDates): boolean {
  const facts = file?.documentFacts ?? null;
  return contradictsDocumentText(row.item.documentKind, facts, declared.issuedOn, declared.printedValidUntil);
}

interface DeclaredDates {
  readonly issuedOn: string | null;
  readonly printedValidUntil: string | null;
}

/** Οι ημερομηνίες της δήλωσης — ή ο λόγος άρνησης. Η τυπωμένη λήξη **πριν** από την έκδοση είναι αδύνατη. */
function declaredDatesOf(command: Extract<ConveyanceCommand, { type: 'review' }>, today: string): DeclaredDates | CommandRejection {
  const printedValidUntil = command.validUntil ?? null;
  if (command.issuedOn !== null && !isDateKey(command.issuedOn)) return 'invalid_date';
  if (printedValidUntil !== null && !isDateKey(printedValidUntil)) return 'invalid_date';
  if (command.issuedOn !== null && command.issuedOn > today) return 'future_issue_date';
  if (printedValidUntil !== null && command.issuedOn !== null && printedValidUntil < command.issuedOn) return 'validity_before_issue';
  return { issuedOn: command.issuedOn, printedValidUntil };
}

function review(current: ConveyanceCase, command: Extract<ConveyanceCommand, { type: 'review' }>, ctx: CommandContext): CommandResult {
  const row = resolveCaseRow(current, command.itemId);
  if (!row) return reject('unknown_item');
  if (command.verdict === 'rejected' && command.reason === null) return reject('reason_required');
  const declared = declaredDatesOf(command, ctx.today);
  if (typeof declared === 'string') return reject(declared);
  const file = resolveReviewedFile(row, command.fileId, ctx.evidence);
  if (file === 'invalid') return reject('file_not_evidence');
  if (command.verdict === 'accepted' && contradictsDocument(row, file, declared)) {
    return reject('issued_on_contradicts_document');
  }
  const reviewRecord = {
    verdict: command.verdict, fileId: file?.fileId ?? null, fileFingerprint: file?.fingerprint ?? null,
    issuedOn: declared.issuedOn, printedValidUntil: declared.printedValidUntil,
    reason: command.reason, reviewedBy: ctx.actorUid, reviewedAt: ctx.now,
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
    case 'add_sellers': return addSellers(current, command, ctx.sellerCandidates);
    case 'remove_seller': return removeSeller(current, command);
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
