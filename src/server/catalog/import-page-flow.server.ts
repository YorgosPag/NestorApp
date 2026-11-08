import 'server-only';

/**
 * Η **ροή μιας σελίδας PDF** (ADR-923 §5.5.1): ο διακομιστής ανασυνθέτει τους πίνακες χωρίς μοντέλο, και το μοντέλο αντιστοιχίζει γραμμές σε
 * ιδιότητες. Χωρίς πίνακα, ή όταν η εικόνα διαψεύσει τη στρώση κειμένου, η σελίδα διαβάζεται με όραση, όπως οι σαρωμένες.
 *
 * 🔑 Ευρήματα ⇒ **μία** επανάληψη με ανατροφοδότηση (ίδια στρατηγική με το ADR-327). Μετρά και η κατάρρευση επιβεβαίωσης (Ε5), όχι μόνο οι
 * κανόνες συνέπειας. Το όριο είναι κοινό και για τις δύο διαδρομές, άρα το κόστος σελίδας μένει φραγμένο. Αν επιμένουν, περνούν στον
 * άνθρωπο ως σημαίες, ποτέ δεν κρύβονται.
 * @module server/catalog/import-page-flow.server
 */

import type { AuthContext } from '@/lib/auth';
import { reconstructPageTables } from '@/lib/pdf-tables/reconstruct-page-tables';
import type { PageRule, PageTable, PageTagTable } from '@/lib/pdf-tables/page-table-types';
import type { CatalogAnalyzerAnswer, ICatalogPageAnalyzer } from '@/subapps/catalog/import/page-analyzer';
import { addUsage, NO_USAGE } from '@/subapps/catalog/import/page-analyzer';
import { evidenceFindings, extractGroupsFromPage, type PageAttributeSpec, type RawPageExtraction } from '@/subapps/catalog/import/page-extraction';
import type { RawPageMapping } from '@/subapps/catalog/import/page-table-mapping';
import { readPageTables, type PageTableContext } from '@/subapps/catalog/import/page-table-reading';
import type { PageToken } from '@/subapps/catalog/import/page-tokens';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { ExtractedGroup, ImportPageRoute, ImportPageSetAside, ImportPageUnmappedLine, ImportPagesUsage } from '@/subapps/catalog/types/catalog-import';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import { CatalogWriteError } from './catalog-write-error';
import { createCatalogPageAnalyzer } from './import-page-analyzer.server';
import { recordPageReading } from './import-page-reading.server';
import { proposeGroup, retireStalePageProposals, type StoredImportProposal } from './import-proposal-writer.server';

/** Πόσες αναγνώσεις δικαιούται μια σελίδα, σε όλες τις διαδρομές μαζί. */
const FEEDBACK_ATTEMPTS = 2;

export interface PageSpecs {
  readonly specs: readonly PageAttributeSpec[];
  readonly byCode: ReadonlyMap<string, CatalogAttributeDefinition & { readonly id: string }>;
  readonly codeById: ReadonlyMap<string, string>;
}

export interface PageFlowInput {
  readonly ctx: AuthContext;
  readonly batchId: string;
  readonly page: number;
  readonly png: Buffer;
  readonly tokens: readonly PageToken[];
  readonly rules: readonly PageRule[];
  readonly tagTables: readonly PageTagTable[];
  readonly specs: PageSpecs;
  readonly registry: MeasurementRegistry;
  readonly axisAttributeIds: readonly string[];
}

/** Ό,τι η σελίδα **δεν** έκανε πρόταση, δηλωμένο: πίνακες στην άκρη (Ε3) και γραμμές χωρίς ιδιότητα (Ε7). */
interface PageLeftOut {
  readonly setAside: readonly ImportPageSetAside[];
  readonly unmappedLines: readonly ImportPageUnmappedLine[];
}

const NOTHING_LEFT_OUT: PageLeftOut = { setAside: [], unmappedLines: [] };

export interface PageFlowResult extends PageLeftOut {
  readonly ok: boolean;
  readonly usage: ImportPagesUsage;
}

/** Το μοντέλο ξέρει τους κωδικούς της λίστας του, όχι τα εσωτερικά `cattr_…`: αλλιώς η δεύτερη πληρωμένη ανάγνωση δεν καταλαβαίνει. */
function ruleFindings(proposals: readonly StoredImportProposal[], codeById: ReadonlyMap<string, string>): string[] {
  return proposals.flatMap((proposal) => proposal.violations.map((violation) => {
    const attributes = violation.attributeIds.map((id) => codeById.get(id) ?? id).join(', ');
    return `Rule ${violation.ruleId} (${violation.kind}) fails for attributes ${attributes}.`;
  }));
}

function proposeGroups(input: PageFlowInput, groups: readonly ExtractedGroup[]): Promise<StoredImportProposal[]> {
  return Promise.all(groups.map((group) => proposeGroup(input.ctx, input.batchId, group)));
}

interface Interpretation extends PageLeftOut {
  readonly groups: readonly ExtractedGroup[];
  readonly findings: readonly string[];
  /** Η απάντηση διαψεύδει τη διαδρομή: τίποτα δεν προτείνεται από αυτήν. */
  readonly abandoned: boolean;
}

interface Route<TValue> {
  readonly name: ImportPageRoute;
  readonly tables: readonly PageTable[];
  readonly ask: (feedback: readonly string[]) => Promise<CatalogAnalyzerAnswer<TValue>>;
  readonly interpret: (value: TValue) => Interpretation;
  readonly attempts: number;
}

interface RouteResult extends PageLeftOut {
  readonly proposals: readonly StoredImportProposal[] | null;
  readonly usage: ImportPagesUsage;
  readonly used: number;
  readonly abandoned: boolean;
}

interface ReadingFacts<TValue> {
  readonly attempt: number;
  readonly answer: Exclude<CatalogAnalyzerAnswer<TValue>, { readonly kind: 'unavailable' }>;
  readonly feedback: readonly string[];
  readonly abandoned: boolean;
}

/** Ε6: η απάντηση φυλάσσεται **πριν** κριθεί από τους γραφείς, ώστε να μένει και όταν η πρόταση αποτύχει. */
function keepReading<TValue>(input: PageFlowInput, route: Route<TValue>, { attempt, answer, feedback, abandoned }: ReadingFacts<TValue>): Promise<void> {
  const tables = route.tables.map(({ key, source, witness, rowCount, colCount }) => ({ key, source, witness, rows: rowCount, columns: colCount }));
  const { model, rawText, usage } = answer;
  const outcome = answer.kind === 'read' ? 'read' : 'failed';
  return recordPageReading(input.ctx, { batchId: input.batchId, page: input.page, route: route.name, attempt, model, rawText, outcome, abandoned, usage, feedback, tables });
}

async function runRoute<TValue>(input: PageFlowInput, route: Route<TValue>): Promise<RouteResult> {
  let feedback: readonly string[] = [];
  let result: RouteResult = { proposals: null, ...NOTHING_LEFT_OUT, usage: NO_USAGE, used: 0, abandoned: false };
  for (let attempt = 0; attempt < route.attempts; attempt += 1) {
    const answer = await route.ask(feedback);
    if (answer.kind === 'unavailable') throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'analyzer' }]);
    const usage = addUsage(result.usage, answer.usage);
    if (answer.kind === 'failed') {
      await keepReading(input, route, { attempt, answer, feedback, abandoned: false });
      return { ...result, usage, used: attempt + 1 };
    }
    const reading = route.interpret(answer.value);
    await keepReading(input, route, { attempt, answer, feedback, abandoned: reading.abandoned });
    if (reading.abandoned) return { ...result, usage, used: attempt + 1, abandoned: true };
    const proposals = await proposeGroups(input, reading.groups);
    result = { proposals, setAside: reading.setAside, unmappedLines: reading.unmappedLines, usage, used: attempt + 1, abandoned: false };
    feedback = [...reading.findings, ...ruleFindings(proposals, input.specs.codeById)];
    if (feedback.length === 0) break;
  }
  return result;
}

function tableRoute(input: PageFlowInput, analyzer: ICatalogPageAnalyzer, tables: readonly PageTable[]): Route<RawPageMapping> {
  const context: PageTableContext = { page: input.page, tables, attributesByCode: input.specs.byCode, registry: input.registry, axisAttributeIds: input.axisAttributeIds };
  return {
    name: 'table',
    tables,
    attempts: FEEDBACK_ATTEMPTS,
    ask: (feedback) => analyzer.mapTables({ png: input.png, tables, attributes: input.specs.specs, feedback }),
    interpret: (mapping) => {
      const { groups, findings, setAside, unmappedLines, doubted } = readPageTables(mapping, context);
      return { groups, findings, setAside, unmappedLines, abandoned: doubted };
    },
  };
}

function visionRoute(input: PageFlowInput, analyzer: ICatalogPageAnalyzer, attempts: number): Route<RawPageExtraction> {
  const context = { page: input.page, tokens: new Map(input.tokens.map((token) => [token.id, token])), attributesByCode: input.specs.byCode };
  return {
    name: 'vision',
    tables: [],
    attempts,
    ask: (feedback) => analyzer.readPage({ png: input.png, tokens: input.tokens, attributes: input.specs.specs, feedback }),
    interpret: (extraction) => {
      const groups = extractGroupsFromPage(extraction, context);
      return { groups, findings: evidenceFindings(groups), ...NOTHING_LEFT_OUT, abandoned: false };
    },
  };
}

/** Διάβασμα → πρόταση → αν χρειαστεί, μία ακόμη ανάγνωση. Ό,τι απέσυρε η τελευταία ανάγνωση φεύγει. */
export async function readAndProposePage(input: PageFlowInput): Promise<PageFlowResult> {
  const analyzer = createCatalogPageAnalyzer();
  const tables = input.tokens.length === 0 ? [] : reconstructPageTables({ words: input.tokens, rules: input.rules, tagTables: input.tagTables });
  const mapped = tables.length > 0 ? await runRoute(input, tableRoute(input, analyzer, tables)) : null;
  const needsVision = mapped === null || mapped.abandoned;
  const seen = needsVision ? await runRoute(input, visionRoute(input, analyzer, Math.max(1, FEEDBACK_ATTEMPTS - (mapped?.used ?? 0)))) : null;
  const usage = addUsage(mapped?.usage ?? NO_USAGE, seen?.usage ?? NO_USAGE);
  const final = seen ?? mapped;
  const proposals = final?.proposals ?? null;
  if (proposals !== null) await retireStalePageProposals(input.ctx, input.batchId, input.page, new Set(proposals.map((proposal) => proposal.id)));
  return { ok: proposals !== null, usage, setAside: final?.setAside ?? [], unmappedLines: final?.unmappedLines ?? [] };
}
