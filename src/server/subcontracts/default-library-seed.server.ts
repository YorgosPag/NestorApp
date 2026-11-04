import 'server-only';

/**
 * Η **σπορά της προεπιλεγμένης βιβλιοθήκης** σε έναν χώρο (ADR-928 Φ1 απόφαση 5) — ιδεμποτική, χωρίς πόρτα γύρω από
 * την επικύρωση.
 *
 * 1. **Ρήτρες**: κάθε ρήτρα του `DEFAULT_CLAUSE_LIBRARY` που λείπει γράφεται ως έκδοση 1 `proposed` με προτείνοντα
 *    `DEFAULT_LIBRARY_PROPOSER` — **όχι** άνθρωπο, άρα τη ρήτρα την εγκρίνει άνθρωπος του χώρου, που έτσι τη **διαβάζει**
 *    (Ironclad: ο διαχειριστής εγκρίνει). Ό,τι υπάρχει ήδη (ίδιο ντετερμινιστικό id) **δεν αγγίζεται**.
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
import { generateDeterministicSubcontractTradeTemplateId } from '@/services/enterprise-id.service';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { validateTemplateAgainstLibrary, validateTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/templates/validate-trade-template';
import { DEFAULT_LIBRARY_PROPOSER } from '@/subapps/procurement/subcontracts/types/clause';
import type { DefaultLibrarySeedReport } from '@/subapps/procurement/subcontracts/types/library-seed';
import { readApprovedLibrary } from './clause-library-reads.server';
import { clauseIdOf, preparedClauseContent, stageNewClause } from './clause-library-writer.server';
import { clauseDocRef, runSubcontractTransaction, stageCreate, tradeTemplateDocRef } from './subcontract-store.server';
import { newTradeTemplateRecord } from './trade-template-writer.server';
import { assertNoSubcontractIssues } from './subcontract-write-error';


async function seedClauses(ctx: AuthContext): Promise<Pick<DefaultLibrarySeedReport, 'clausesCreated' | 'clausesExisting'>> {
  const prepared = await Promise.all(DEFAULT_CLAUSE_LIBRARY.map(async (draft) => ({ draft, content: await preparedClauseContent(draft) })));
  return runSubcontractTransaction(ctx, async (scope) => {
    const snaps = await scope.tx.getAll(...prepared.map(({ draft }) => clauseDocRef(scope.db, clauseIdOf(scope, draft.clauseKey))));
    const missing = prepared.filter((_, index) => !snaps[index].exists);
    for (const { draft, content } of missing) {
      stageNewClause(scope, { draft, proposalReason: null, proposedBy: DEFAULT_LIBRARY_PROPOSER }, content);
    }
    const created = new Set(missing.map(({ draft }) => draft.clauseKey));
    return {
      clausesCreated: [...created],
      clausesExisting: prepared.map(({ draft }) => draft.clauseKey).filter((key) => !created.has(key)),
    };
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
