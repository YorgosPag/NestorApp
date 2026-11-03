import 'server-only';

/**
 * Ο γραφέας της **βιβλιοθήκης ρητρών** — δημιουργία ρήτρας και **πρόταση** νέας έκδοσης (ADR-928 §5.2 · §5.2.1).
 *
 * 🔑 **Κάθε αλλαγή κειμένου είναι πρόταση**: η ρήτρα γεννιέται με την έκδοση 1 `proposed`, και κάθε αλλαγή είναι
 * `latestVersion + 1` `proposed`. Ισχύει μόνο μετά από **έγκριση** άλλου ανθρώπου (`clause-governance-writer`).
 * 🔑 **Μία ανοιχτή πρόταση ανά ρήτρα, δομικά** (Φ1 απόφαση 3): το id της έκδοσης είναι ντετερμινιστικό και γράφεται με
 * `create()` ⇒ δύο ταυτόχρονες προτάσεις συγκρούονται· η δεύτερη, αν φτάσει μετά, βλέπει `openProposal` ⇒ 409.
 * 🔑 Τα αποτυπώματα υπολογίζονται **πριν** από τη συναλλαγή (καθαρά, ασύγχρονα) — η συναλλαγή μένει σύντομη.
 * @module server/subcontracts/clause-library-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { generateDeterministicSubcontractClauseId, generateDeterministicSubcontractClauseVersionId } from '@/services/enterprise-id.service';
import { clauseContentHash, clauseSourceHash } from '@/subapps/procurement/subcontracts/clauses/clause-content-hash';
import { carriedTranslations } from '@/subapps/procurement/subcontracts/clauses/clause-governance';
import { validateClauseContent, validateClauseIdentity } from '@/subapps/procurement/subcontracts/clauses/validate-clause-version';
import type {
  ClauseBody,
  ClauseTranslation,
  SubcontractClause,
  SubcontractClauseDraft,
  SubcontractClauseVersion,
} from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseLanguage, ClauseParameterDefinition } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import {
  assertRevision,
  clauseDocRef,
  clauseVersionDocRef,
  readOwned,
  readOwnedOrNull,
  runSubcontractTransaction,
  stageCreate,
  stageUpdate,
  type SubcontractTx,
} from './subcontract-store.server';
import { assertNoSubcontractIssues, SubcontractWriteError } from './subcontract-write-error';

/** Περιεχόμενο έκδοσης + τα αποτυπώματά του, υπολογισμένα πριν από τη συναλλαγή. */
export interface HashedContent {
  readonly body: ClauseBody;
  readonly parameters: readonly ClauseParameterDefinition[];
  readonly contentHash: string;
  readonly sourceHash: string;
}

async function hashedContent(body: ClauseBody, parameters: readonly ClauseParameterDefinition[]): Promise<HashedContent> {
  const [contentHash, sourceHash] = await Promise.all([clauseContentHash(body, parameters), clauseSourceHash(body)]);
  return { body, parameters, contentHash, sourceHash };
}

interface ProposedVersionInput {
  readonly clauseId: string;
  readonly version: number;
  readonly content: HashedContent;
  readonly translations: Readonly<Record<ClauseLanguage, ClauseTranslation>>;
  readonly proposedBy: string;
  readonly proposalReason: string | null;
}

/** Η νέα έκδοση `proposed` — `needs_professional_review` πάντα: η εφαρμογή δεν κρίνει νόμο (§4). */
function proposedVersion(scope: SubcontractTx, input: ProposedVersionInput): SubcontractClauseVersion {
  return {
    id: generateDeterministicSubcontractClauseVersionId(input.clauseId, input.version),
    companyId: scope.ctx.companyId,
    clauseId: input.clauseId,
    version: input.version,
    state: 'proposed',
    professionalReview: 'needs_professional_review',
    effectiveFrom: null,
    supersededBy: null,
    body: input.content.body,
    parameters: input.content.parameters,
    translations: input.translations,
    contentHash: input.content.contentHash,
    sourceHash: input.content.sourceHash,
    proposedBy: input.proposedBy,
    proposalReason: input.proposalReason,
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: scope.now,
    revision: 1,
    updatedAt: scope.now,
    updatedBy: scope.ctx.uid,
  };
}

export interface CreateClauseInput {
  readonly draft: SubcontractClauseDraft;
  readonly proposalReason: string | null;
  /** Ποιος υπογράφει την πρόταση· προεπιλογή ο δρων. Η σπορά δίνει `DEFAULT_LIBRARY_PROPOSER`. */
  readonly proposedBy?: string;
}

/** Το id της ρήτρας του χώρου για ένα κλειδί — ντετερμινιστικό, άρα η μοναδικότητα του κλειδιού είναι δομική. */
export function clauseIdOf(scope: SubcontractTx, clauseKey: string): string {
  return generateDeterministicSubcontractClauseId(scope.ctx.companyId, clauseKey);
}

/**
 * Γράφει τη ρήτρα και την έκδοση 1 — **χωρίς ανάγνωση**: ο καλών έχει ήδη κρίνει ότι δεν υπάρχει (ο γραφέας με μία
 * ανάγνωση, η σπορά με ένα `getAll` για όλες). Το `create()` αρνείται ούτως ή άλλως υπάρχον έγγραφο.
 */
export function stageNewClause(scope: SubcontractTx, input: CreateClauseInput, content: HashedContent): SubcontractClause {
  const clauseId = clauseIdOf(scope, input.draft.clauseKey);
  const ref = clauseDocRef(scope.db, clauseId);
  const clause: SubcontractClause = {
    id: clauseId,
    companyId: scope.ctx.companyId,
    clauseKey: input.draft.clauseKey,
    title: input.draft.title,
    currentVersion: null,
    latestVersion: 1,
    openProposal: 1,
    isArchived: false,
    revision: 1,
    createdAt: scope.now,
    updatedAt: scope.now,
    createdBy: scope.ctx.uid,
    updatedBy: scope.ctx.uid,
  };
  const version = proposedVersion(scope, {
    clauseId, version: 1, content, translations: {}, proposedBy: input.proposedBy ?? scope.ctx.uid, proposalReason: input.proposalReason,
  });
  stageCreate(scope, 'clause', ref, clause);
  stageCreate(scope, 'clauseVersion', clauseVersionDocRef(scope.db, clauseId, version.id), version);
  return clause;
}

/** Επικύρωση + αποτυπώματα ενός σχεδίου ρήτρας — ίδια για γραφέα και σπορά. */
export async function preparedClauseContent(draft: SubcontractClauseDraft): Promise<HashedContent> {
  assertNoSubcontractIssues([...validateClauseIdentity(draft.clauseKey, draft.title), ...validateClauseContent(draft.body, draft.parameters)]);
  return hashedContent(draft.body, draft.parameters);
}

export async function createSubcontractClause(ctx: AuthContext, input: CreateClauseInput): Promise<SubcontractClause> {
  const content = await preparedClauseContent(input.draft);
  return runSubcontractTransaction(ctx, async (scope) => {
    const ref = clauseDocRef(scope.db, clauseIdOf(scope, input.draft.clauseKey));
    if ((await scope.tx.get(ref)).exists) throw new SubcontractWriteError('duplicate', [], { clauseKey: input.draft.clauseKey });
    return stageNewClause(scope, { draft: input.draft, proposalReason: input.proposalReason }, content);
  });
}

export interface ProposeVersionInput {
  readonly expectedRevision: number;
  readonly body: ClauseBody;
  readonly parameters: readonly ClauseParameterDefinition[];
  readonly proposalReason: string | null;
}

/** Νέα έκδοση `proposed`. Κληρονομεί τις μεταφράσεις της εγκεκριμένης — μπαγιάτικες υποβιβάζονται σε πρόχειρο. */
export async function proposeSubcontractClauseVersion(ctx: AuthContext, clauseId: string, input: ProposeVersionInput): Promise<SubcontractClauseVersion> {
  assertNoSubcontractIssues(validateClauseContent(input.body, input.parameters));
  const content = await hashedContent(input.body, input.parameters);
  return runSubcontractTransaction(ctx, async (scope) => {
    const clauseRef = clauseDocRef(scope.db, clauseId);
    const clause = await readOwned(scope, 'clause', clauseRef);
    assertRevision(clause, input.expectedRevision);
    if (clause.isArchived) throw new SubcontractWriteError('invalidTransition');
    if (clause.openProposal !== null) throw new SubcontractWriteError('proposalPending', [], { openProposal: clause.openProposal });
    const current = clause.currentVersion === null
      ? null
      : await readOwnedOrNull(scope, 'clauseVersion', clauseVersionDocRef(scope.db, clauseId, generateDeterministicSubcontractClauseVersionId(clauseId, clause.currentVersion)));
    const next = clause.latestVersion + 1;
    const version = proposedVersion(scope, {
      clauseId, version: next, content, proposedBy: ctx.uid, proposalReason: input.proposalReason,
      translations: current ? carriedTranslations(current.translations, content.sourceHash) : {},
    });
    stageCreate(scope, 'clauseVersion', clauseVersionDocRef(scope.db, clauseId, version.id), version);
    stageUpdate(scope, 'clause', clauseRef, clause, { latestVersion: next, openProposal: next });
    return version;
  });
}
