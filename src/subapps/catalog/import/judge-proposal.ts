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
import { mergeFieldsIntoValues } from './proposal-values';

export interface ProposalHoldings {
  readonly rootModel: StoredModelShape | null;
  /** Όλα τα ζωντανά SKU του συνόλου. */
  readonly products: ReadonlyMap<string, StoredProductShape>;
}

export interface ProposalJudgeInput {
  readonly rows: readonly ImportProposalRow[];
  readonly modelCode: string | null;
  readonly familyId: string;
  readonly categoryIds: readonly string[];
  readonly holdings: ProposalHoldings;
  readonly schema: CatalogSchemaSnapshot;
  readonly refs: AggregateReferences;
}

export interface ProposalVerdict {
  readonly rows: readonly ImportProposalRow[];
  readonly violations: readonly ConsistencyViolation[];
}

const NEW_ROOT_ID = 'import-new-model';
const memberIdOf = (row: ImportProposalRow): string => row.holderId ?? row.rowKey;
const proposed = (field: ImportProposalField): boolean => field.status !== 'unchanged';

function rootMember(input: ProposalJudgeInput, row: ImportProposalRow | undefined): AggregateMember | null {
  const { holdings, schema, modelCode, categoryIds, familyId } = input;
  const { rootModel } = holdings;
  const fields = row?.fields ?? [];
  if (rootModel) {
    return row ? updatedModelMember(rootModel, { ...rootModel, values: mergeFieldsIntoValues(rootModel.values, fields, proposed) }) : unchangedMember({ kind: 'productModel', record: rootModel });
  }
  if (!schema.scheme) return null;
  const definition = { code: modelCode ?? '', familyId, variantSchemeCode: schema.scheme.code, parentId: null, categoryIds, noValueReasons: {}, values: mergeFieldsIntoValues({}, fields, proposed) };
  return createdModelMember(NEW_ROOT_ID, definition);
}

function productMember(row: ImportProposalRow, rootId: string | null, input: ProposalJudgeInput): AggregateMember {
  const stored = row.holderId === null ? undefined : input.holdings.products.get(row.holderId);
  if (stored) return updatedProductMember(stored, { ...stored, values: mergeFieldsIntoValues(stored.values, row.fields, proposed) });
  const values = mergeFieldsIntoValues({}, row.fields, proposed);
  return createdProductMember(row.rowKey, { modelId: rootId, familyId: input.familyId, categoryIds: input.categoryIds, noValueReasons: {}, values });
}

function aggregateOf(input: ProposalJudgeInput): CatalogAggregate {
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

function withJudgement(field: ImportProposalField, memberId: string, cells: ReadonlyMap<string, readonly CatalogIssue[]>): ImportProposalField {
  if (field.target.kind !== 'attribute') return field;
  const prefix = `${memberPath(memberId)}.values.${field.target.attributeId}`;
  const found = [...cells].filter(([path]) => path === prefix || path.startsWith(`${prefix}.`)).flatMap(([, issues]) => issues);
  if (found.length === 0) return field;
  const issues: ImportIssue[] = [...field.issues, ...found.map((issue) => ({ ...issue, path: field.target.kind === 'attribute' ? field.target.attributeId : issue.path }))];
  return { ...field, issues, decision: defaultDecisionOf({ ...field, issues }) };
}

/** Ευρήματα σε ιδιότητες που η πηγή δεν έφερε (π.χ. λείπει άξονας): δεν έχουν κελί, άρα ζουν στη γραμμή. */
function rowIssuesOf(row: ImportProposalRow, memberId: string, issues: readonly CatalogIssue[]): CatalogIssue[] {
  const prefix = `${memberPath(memberId)}.`;
  const owned = issues.filter((issue) => issue.path.startsWith(prefix));
  const cellPaths = row.fields.flatMap((field) => (field.target.kind === 'attribute' ? [`${prefix}values.${field.target.attributeId}`] : []));
  return owned.filter((issue) => !cellPaths.some((path) => issue.path === path || issue.path.startsWith(`${path}.`))).map((issue) => ({ ...issue, path: issue.path.slice(prefix.length) }));
}

/** Κρίνει την πρόταση και γράφει τα ευρήματα πάνω στα πεδία της. */
export function judgeProposal(input: ProposalJudgeInput): ProposalVerdict {
  const aggregate = aggregateOf(input);
  const verdict = judgeAggregate({ aggregate, schema: input.schema, refs: input.refs });
  const violations = violationsOf(aggregate, input.schema);
  const issues = [...verdict.issues.filter((issue) => issue.code !== 'consistencyRuleViolated'), ...ruleIssues(violations)];
  const cells = issuesByCell(issues);
  const rows = input.rows.map((row): ImportProposalRow => {
    const memberId = row.holderKind === 'productModel' ? (aggregate.rootId ?? row.rowKey) : memberIdOf(row);
    return { ...row, fields: row.fields.map((field) => withJudgement(field, memberId, cells)), issues: [...row.issues, ...rowIssuesOf(row, memberId, issues)] };
  });
  return { rows, violations };
}
