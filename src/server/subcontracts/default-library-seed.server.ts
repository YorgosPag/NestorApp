import 'server-only';

/**
 * Η **σπορά της προεπιλεγμένης βιβλιοθήκης** σε έναν χώρο (ADR-928 Φ1 απόφαση 5) — ιδεμποτική, χωρίς πόρτα γύρω από
 * την επικύρωση.
 *
 * 1. **Ρήτρες**: κάθε ρήτρα του `DEFAULT_CLAUSE_LIBRARY` που λείπει γράφεται ως έκδοση 1 `proposed` με προτείνοντα
 *    `DEFAULT_LIBRARY_PROPOSER` — **όχι** άνθρωπο, άρα τη ρήτρα την εγκρίνει άνθρωπος του χώρου, που έτσι τη **διαβάζει**
 *    (Ironclad: ο διαχειριστής εγκρίνει). Το κείμενο υπάρχουσας ρήτρας **δεν αντικαθίσταται ποτέ**: αν ο Νέστορας άλλαξε
 *    το δικό του από την τελευταία φορά που το πρόσφερε, φτάνει ως **νέα πρόταση** του συστήματος (κανόνας upstream,
 *    `default-library-update.ts`, ADR-928 §5.20).
 * 2. **Πρότυπα**: περνούν από τον **ίδιο** έλεγχο απέναντι στην εγκεκριμένη βιβλιοθήκη με τον γραφέα. Όσα αναφέρουν
 *    ρήτρες χωρίς εγκεκριμένη έκδοση **αναφέρονται ως εκκρεμή** με τα ευρήματά τους· η επόμενη σπορά, μετά τις εγκρίσεις,
 *    τα γράφει. Η σειρά «πρώτα κρίνω, μετά γράφω» μένει ακέραιη.
 *
 * Όλες οι αναγνώσεις κάθε συναλλαγής γίνονται **πριν** από κάθε εγγραφή (`getAll`).
 * @module server/subcontracts/default-library-seed.server
 */

import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import type { AuthContext } from '@/lib/auth';
import { generateDeterministicSubcontractClauseVersionId, generateDeterministicSubcontractTradeTemplateId } from '@/services/enterprise-id.service';
import { refuseWithdrawal } from '@/subapps/procurement/subcontracts/clauses/clause-governance';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { defaultLibraryUpdateOf } from '@/subapps/procurement/subcontracts/library/default-library-update';
import { validateTemplateAgainstLibrary, validateTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/templates/validate-trade-template';
import {
  DEFAULT_LIBRARY_PROPOSER,
  type SubcontractClause,
  type SubcontractClauseDraft,
  type SubcontractClauseVersion,
} from '@/subapps/procurement/subcontracts/types/clause';
import type { DefaultLibrarySeedReport } from '@/subapps/procurement/subcontracts/types/library-seed';
import { stageClosedProposal } from './clause-governance-writer.server';
import { readApprovedLibrary } from './clause-library-reads.server';
import { clauseIdOf, preparedClauseContent, stageNewClause, stageProposedVersion, type HashedContent } from './clause-library-writer.server';
import {
  clauseDocRef,
  clauseVersionDocRef,
  readOwnedMany,
  runSubcontractTransaction,
  stageCreate,
  tradeTemplateDocRef,
  type SubcontractTx,
} from './subcontract-store.server';
import { newTradeTemplateRecord } from './trade-template-writer.server';
import { assertGovernance, assertNoSubcontractIssues } from './subcontract-write-error';


type ClauseSeedReport = Pick<DefaultLibrarySeedReport, 'clausesCreated' | 'clausesExisting' | 'clausesUpdateProposed' | 'clausesUpdateDeferred'>;

interface PreparedDraft {
  readonly draft: SubcontractClauseDraft;
  readonly content: HashedContent;
}

interface ExistingClause extends PreparedDraft {
  readonly clause: SubcontractClause;
}

const SYSTEM_PROPOSAL = { proposedBy: DEFAULT_LIBRARY_PROPOSER, proposalReason: null } as const;

/** Όλες οι εκδόσεις όλων των υπαρχουσών ρητρών σε **ένα** `getAll` (ντετερμινιστικά ids 1..latestVersion). */
async function readVersionsByClause(scope: SubcontractTx, clauses: readonly SubcontractClause[]): Promise<Map<string, SubcontractClauseVersion[]>> {
  const refs = clauses.flatMap((clause) => Array.from({ length: clause.latestVersion }, (_, index) =>
    clauseVersionDocRef(scope.db, clause.id, generateDeterministicSubcontractClauseVersionId(clause.id, index + 1))));
  const versions = await readOwnedMany(scope, 'clauseVersion', refs);
  const byClause = new Map<string, SubcontractClauseVersion[]>(clauses.map((clause) => [clause.id, []]));
  for (const version of versions) if (version) byClause.get(version.clauseId)?.push(version);
  return byClause;
}

/** Εκτελεί την απόφαση του κανόνα upstream για μία ρήτρα· επιστρέφει τι έγινε (ADR-928 §5.20). */
function stageDefaultLibraryUpdate(scope: SubcontractTx, existing: ExistingClause, versions: readonly SubcontractClauseVersion[]): 'proposed' | 'deferred' | null {
  const update = defaultLibraryUpdateOf(existing.clause, versions, existing.content.contentHash);
  if (update.kind === 'none') return null;
  if (update.kind === 'deferred') return 'deferred';
  if (update.kind === 'replace') {
    assertGovernance(refuseWithdrawal(update.stale, DEFAULT_LIBRARY_PROPOSER));
    stageClosedProposal(scope, update.stale, { decidedBy: DEFAULT_LIBRARY_PROPOSER, reason: null });
  }
  const current = versions.find((version) => version.version === existing.clause.currentVersion) ?? null;
  stageProposedVersion(scope, existing.clause, current, existing.content, SYSTEM_PROPOSAL);
  return 'proposed';
}

/**
 * Ρήτρες: όσες λείπουν γράφονται ως έκδοση 1 του συστήματος· στις υπάρχουσες τρέχει ο κανόνας upstream. Όλες οι
 * αναγνώσεις (ρήτρες + εκδόσεις) πριν από κάθε εγγραφή.
 */
async function seedClauses(ctx: AuthContext): Promise<ClauseSeedReport> {
  const prepared: PreparedDraft[] = await Promise.all(DEFAULT_CLAUSE_LIBRARY.map(async (draft) => ({ draft, content: await preparedClauseContent(draft) })));
  return runSubcontractTransaction(ctx, async (scope) => {
    const clauses = await readOwnedMany(scope, 'clause', prepared.map(({ draft }) => clauseDocRef(scope.db, clauseIdOf(scope, draft.clauseKey))));
    const existing = prepared.flatMap((entry, index): ExistingClause[] => {
      const clause = clauses[index];
      return clause ? [{ ...entry, clause }] : [];
    });
    const versionsByClause = await readVersionsByClause(scope, existing.map(({ clause }) => clause));
    const report = { clausesCreated: [] as string[], clausesExisting: [] as string[], clausesUpdateProposed: [] as string[], clausesUpdateDeferred: [] as string[] };
    prepared.forEach(({ draft, content }, index) => {
      if (clauses[index] === null) {
        stageNewClause(scope, { draft, proposalReason: null, proposedBy: DEFAULT_LIBRARY_PROPOSER }, content);
        return void report.clausesCreated.push(draft.clauseKey);
      }
      report.clausesExisting.push(draft.clauseKey);
    });
    for (const entry of existing) {
      const outcome = stageDefaultLibraryUpdate(scope, entry, versionsByClause.get(entry.clause.id) ?? []);
      if (outcome === 'proposed') report.clausesUpdateProposed.push(entry.draft.clauseKey);
      if (outcome === 'deferred') report.clausesUpdateDeferred.push(entry.draft.clauseKey);
    }
    return report;
  });
}

async function seedTemplates(ctx: AuthContext): Promise<Pick<DefaultLibrarySeedReport, 'templatesCreated' | 'templatesExisting' | 'templatesPending'>> {
  for (const template of DEFAULT_TRADE_TEMPLATES) assertNoSubcontractIssues(validateTradeTemplateDefinition(template));
  return runSubcontractTransaction(ctx, async (scope) => {
    const ids = DEFAULT_TRADE_TEMPLATES.map((template) => generateDeterministicSubcontractTradeTemplateId(scope.ctx.companyId, template.code));
    const snaps = await scope.tx.getAll(...ids.map((id) => tradeTemplateDocRef(scope.db, id)));
    const library = await readApprovedLibrary(scope, DEFAULT_TRADE_TEMPLATES.flatMap((template) => template.clauses.map((ref) => ref.clauseKey)));
    const report = { templatesCreated: [] as string[], templatesExisting: [] as string[], templatesPending: [] as { code: string; issues: SubcontractIssue[] }[] };
    DEFAULT_TRADE_TEMPLATES.forEach((template, index) => {
      if (snaps[index].exists) return void report.templatesExisting.push(template.code);
      const issues = validateTemplateAgainstLibrary(template, library);
      if (issues.length > 0) return void report.templatesPending.push({ code: template.code, issues });
      stageCreate(scope, 'tradeTemplate', tradeTemplateDocRef(scope.db, ids[index]), newTradeTemplateRecord(scope, ids[index], template));
      report.templatesCreated.push(template.code);
    });
    return report;
  });
}

/** Ρήτρες πρώτα (δική τους συναλλαγή), πρότυπα μετά — η δεύτερη βλέπει ό,τι έγραψε η πρώτη. */
export async function seedDefaultSubcontractLibrary(ctx: AuthContext): Promise<DefaultLibrarySeedReport> {
  const clauses = await seedClauses(ctx);
  const templates = await seedTemplates(ctx);
  return { ...clauses, ...templates };
}
