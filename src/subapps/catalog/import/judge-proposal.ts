/**
 * Η πρόταση περνά από τον **ίδιο κριτή** με την εγγραφή (ADR-923 §5.5 · §21.3): χτίζεται το υποθετικό σύνολο «αν εγκριθούν
 * όλα», το κρίνει ο `judgeAggregate`, και οι κανόνες συνέπειας της οικογένειας τρέχουν **πριν** τη δει άνθρωπος. Έτσι ό,τι
 * θα απέρριπτε ο γραφέας φαίνεται στο κελί του στον έλεγχο, όχι ως 422 στο κουμπί της έγκρισης.
 * @module subapps/catalog/import/judge-proposal
 */

import { createdModelMember, createdProductMember, unchangedMember, updatedModelMember, updatedProductMember, type StoredModelShape, type StoredProductShape } from '../aggregate/aggregate-members';
import type { AggregateMember, CatalogAggregate } from '../aggregate/aggregate-model';
import { consistencyRows, judgeAggregate, memberPath, type AggregateReferences } from '../aggregate/judge-aggregate';
import type { CatalogSchemaSnapshot } from '../derived/chain-derived';
import { evaluateConsistency, type ConsistencyViolation } from '../rules/evaluate-consistency';
import type { CatalogIssue } from '../schema/catalog-issues';
import type { ImportIssue, ImportProposalField, ImportProposalRow } from '../types/catalog-import';
import { defaultDecisionOf } from './field-diff';
import { EMPTY_IMPORT_HOLDER, mergeFieldsIntoHolder } from './proposal-values';

export interface ProposalHoldings {
  readonly rootModel: StoredModelShape | null;
  /** Όλα τα ζωντανά SKU του συνόλου. */
  readonly products: ReadonlyMap<string, StoredProductShape>;
}

export interface ProposalAggregateInput {
  readonly rows: readonly ImportProposalRow[];
  readonly modelCode: string | null;
  readonly familyId: string;
  readonly categoryIds: readonly string[];
  readonly holdings: ProposalHoldings;
  readonly schema: CatalogSchemaSnapshot;
}

export interface ProposalJudgeInput extends ProposalAggregateInput {
  readonly refs: AggregateReferences;
}

export interface ProposalVerdict {
  readonly rows: readonly ImportProposalRow[];
  readonly violations: readonly ConsistencyViolation[];
}

const NEW_ROOT_ID = 'import-new-model';
const memberIdOf = (row: ImportProposalRow): string => row.holderId ?? row.rowKey;
const proposed = (field: ImportProposalField): boolean => field.status !== 'unchanged';

function rootMember(input: ProposalAggregateInput, row: ImportProposalRow | undefined): AggregateMember | null {
  const { holdings, schema, modelCode, categoryIds, familyId } = input;
  const { rootModel } = holdings;
  const fields = row?.fields ?? [];
  if (rootModel) {
    return row ? updatedModelMember(rootModel, mergeFieldsIntoHolder(rootModel, fields, proposed)) : unchangedMember({ kind: 'productModel', record: rootModel });
  }
  if (!schema.scheme) return null;
  const definition = { code: modelCode ?? '', familyId, variantSchemeCode: schema.scheme.code, parentId: null, categoryIds, ...mergeFieldsIntoHolder(EMPTY_IMPORT_HOLDER, fields, proposed) };
  return createdModelMember(NEW_ROOT_ID, definition);
}

function productMember(row: ImportProposalRow, rootId: string | null, input: ProposalAggregateInput): AggregateMember {
  const stored = row.holderId === null ? undefined : input.holdings.products.get(row.holderId);
  if (stored) return updatedProductMember(stored, mergeFieldsIntoHolder(stored, row.fields, proposed));
  const content = mergeFieldsIntoHolder(EMPTY_IMPORT_HOLDER, row.fields, proposed);
  return createdProductMember(row.rowKey, { modelId: rootId, familyId: input.familyId, categoryIds: input.categoryIds, ...content });
}

/** Το υποθετικό σύνολο «αν εγκριθούν όλα». Το ίδιο κρίνεται και από το ίδιο διαβάζονται οι αναφορές του (`readAggregateReferences`). */
export function proposalAggregateOf(input: ProposalAggregateInput): CatalogAggregate {
  const modelRow = input.rows.find((row) => row.holderKind === 'productModel');
  const root = rootMember(input, modelRow);
  const members = new Map<string, AggregateMember>();
  if (root) members.set(root.id, root);
  for (const record of input.holdings.products.values()) members.set(record.id, unchangedMember({ kind: 'product', record }));
  for (const row of input.rows) {
    if (row.holderKind === 'product') members.set(memberIdOf(row), productMember(row, root?.id ?? null, input));
  }
  return { rootId: root?.id ?? null, members };
}

function violationsOf(aggregate: CatalogAggregate, schema: CatalogSchemaSnapshot): readonly ConsistencyViolation[] {
  const rows = consistencyRows(aggregate, schema, 'after');
  const schemeAxisIds = schema.scheme?.levels.flatMap((level) => level.axisAttributeIds) ?? [];
  return evaluateConsistency({ rules: schema.family.consistencyRules, rows, schemeAxisIds, attributes: schema.attributes, registry: schema.registry });
}

/** Ποια ευρήματα πέφτουν σε ποιο πεδίο: `variants.<μέλος>.values.<ιδιότητα>…`. */
function issuesByCell(issues: readonly CatalogIssue[]): Map<string, CatalogIssue[]> {
  const cells = new Map<string, CatalogIssue[]>();
  for (const issue of issues) cells.set(issue.path, [...(cells.get(issue.path) ?? []), issue]);
  return cells;
}

function ruleIssues(violations: readonly ConsistencyViolation[]): CatalogIssue[] {
  return violations.flatMap((violation) =>
    violation.variantIds.flatMap((variantId) =>
      violation.attributeIds.map((attributeId): CatalogIssue => ({
        code: 'consistencyRuleViolated',
        path: `${memberPath(variantId)}.values.${attributeId}`,
        params: { ruleId: violation.ruleId, kind: violation.kind },
      })),
    ),
  );
}

/**
 * Η διαδρομή του κριτή που ανήκει στο κελί: `values.<ιδιότητα>` για τιμή, `noValueReasons.<ιδιότητα>` για λόγο απουσίας
 * (§23.2 K4: `noValueOnAxis` · `noValueConflict`). `null` = το πεδίο δεν είναι φορέα τιμών (τιμή τιμοκαταλόγου, κωδικός).
 */
function cellPathOf(field: ImportProposalField, memberId: string): { readonly path: string; readonly attributeId: string } | null {
  const { target } = field;
  if (target.kind === 'attribute') return { path: `${memberPath(memberId)}.values.${target.attributeId}`, attributeId: target.attributeId };
  if (target.kind === 'noValueReason') return { path: `${memberPath(memberId)}.noValueReasons.${target.attributeId}`, attributeId: target.attributeId };
  return null;
}

function withJudgement(field: ImportProposalField, memberId: string, cells: ReadonlyMap<string, readonly CatalogIssue[]>): ImportProposalField {
  const cell = cellPathOf(field, memberId);
  if (cell === null) return field;
  const found = [...cells].filter(([path]) => path === cell.path || path.startsWith(`${cell.path}.`)).flatMap(([, issues]) => issues);
  if (found.length === 0) return field;
  const issues: ImportIssue[] = [...field.issues, ...found.map((issue) => ({ ...issue, path: cell.attributeId }))];
  return { ...field, issues, decision: defaultDecisionOf({ ...field, issues }) };
}

/** Ευρήματα σε ιδιότητες που η πηγή δεν έφερε (π.χ. λείπει άξονας): δεν έχουν κελί, άρα ζουν στη γραμμή. */
function rowIssuesOf(row: ImportProposalRow, memberId: string, issues: readonly CatalogIssue[]): CatalogIssue[] {
  const path = memberPath(memberId);
  const prefix = `${path}.`;
  // Εύρημα ολόκληρου του μέλους έχει διαδρομή χωρίς τελεία (`axisComboDuplicate`): χωρίς το πρώτο σκέλος χανόταν, και ο άνθρωπος έβλεπε 422.
  const owned = issues.filter((issue) => issue.path === path || issue.path.startsWith(prefix));
  const cellPaths = row.fields.flatMap((field) => cellPathOf(field, memberId)?.path ?? []);
  return owned.filter((issue) => !cellPaths.some((path) => issue.path === path || issue.path.startsWith(`${path}.`))).map((issue) => ({ ...issue, path: issue.path.slice(prefix.length) }));
}

/** Εύρημα του συνόλου, όχι μέλους (`tooManyDescendants`): δεν έχει γραμμή δική του, άρα ζει στη γραμμή του μοντέλου. */
const isAggregateIssue = (issue: CatalogIssue): boolean => !issue.path.startsWith(memberPath(''));

/** Κρίνει την πρόταση και γράφει τα ευρήματα πάνω στα πεδία της. */
export function judgeProposal(input: ProposalJudgeInput): ProposalVerdict {
  const aggregate = proposalAggregateOf(input);
  const verdict = judgeAggregate({ aggregate, schema: input.schema, refs: input.refs });
  const violations = violationsOf(aggregate, input.schema);
  const issues = [...verdict.issues.filter((issue) => issue.code !== 'consistencyRuleViolated'), ...ruleIssues(violations)];
  const cells = issuesByCell(issues);
  const rows = input.rows.map((row): ImportProposalRow => {
    const memberId = row.holderKind === 'productModel' ? (aggregate.rootId ?? row.rowKey) : memberIdOf(row);
    const aggregateLevel = row.holderKind === 'productModel' ? issues.filter(isAggregateIssue) : [];
    return { ...row, fields: row.fields.map((field) => withJudgement(field, memberId, cells)), issues: [...row.issues, ...rowIssuesOf(row, memberId, issues), ...aggregateLevel] };
  });
  return { rows, violations };
}
