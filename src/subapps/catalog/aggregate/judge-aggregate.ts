/**
 * =============================================================================
 * Η ΚΡΙΣΗ ΕΝΟΣ ΣΥΝΟΛΟΥ — ό,τι μπλοκάρει μια εγγραφή, με τη σειρά που μετρά (ADR-923 §5.10)
 * =============================================================================
 *
 * Η σειρά του σχεδίου (handoff 2β §2), καθαρή και κοινή σε οθόνη και γραφέα:
 *   1. **τοποθέτηση** (σχήμα, βάθος, γονέας) — άκυρη ⇒ οι τιμές **δεν** κρίνονται (θα έδιναν ψευδή ευρήματα)·
 *   2. **τιμές** απέναντι στο σχήμα όπως είναι τώρα (`validateHolderValues`)·
 *   3. **όριο απογόνων** (≤ 200 — μία συναλλαγή)·
 *   4. **συνδυασμός αξόνων** μοναδικός ανάμεσα στα αδέλφια (Akeneo «already set on another variant»)·
 *   5. **κανόνες συνέπειας** πριν/μετά — απορρίπτεται **μόνο** ό,τι η εγγραφή εισάγει ή αγγίζει (Δ8).
 * Οι κρατήσεις μοναδικότητας (6) θέλουν ανάγνωση ⇒ ζουν στον διακομιστή, **μετά** από αυτή την κρίση.
 *
 * @module subapps/catalog/aggregate/judge-aggregate
 */

import type { CatalogSchemaSnapshot } from '../derived/chain-derived';
import { changedCells, judgeConsistency, toVariantValueRow } from '../rules/consistency-gate';
import { evaluateConsistency, type ConsistencyViolation, type VariantValueRow } from '../rules/evaluate-consistency';
import type { CatalogIssue } from '../schema/catalog-issues';
import type { AssetLookup, ReferenceLookup } from '../schema/product-validation-context';
import { checkDescendantBudget, placeProduct, placeProductModel, type PlacementResult } from '../schema/validate-product-placement';
import { validateHolderValues } from '../schema/validate-product-values';
import { axesAtDepth } from '../values/attribute-levels';
import { axisClashIssues, findAxisCombinationClashes } from '../values/axis-combination';
import { resolveInheritedValues } from '../values/resolve-inherited';
import {
  chainOf,
  definitionOf,
  liveMembers,
  parentIdOf,
  productMembers,
  type AggregateMember,
  type AggregateSide,
  type CatalogAggregate,
} from './aggregate-model';

export interface AggregateReferences {
  readonly assets: AssetLookup;
  readonly categories: ReadonlySet<string>;
  readonly references: ReferenceLookup;
}

export interface AggregateJudgeInput {
  readonly aggregate: CatalogAggregate;
  readonly schema: CatalogSchemaSnapshot;
  readonly refs: AggregateReferences;
}

export interface AggregateVerdict {
  /** Μπλοκάρουν (422). Διαδρομή `variants.<id>.…` — η οθόνη τα δείχνει στο κελί τους. */
  readonly issues: readonly CatalogIssue[];
  /** Δεν μπλοκάρουν — `derived.findings` της ρίζας (Δ8). */
  readonly findings: readonly ConsistencyViolation[];
}

/** Η διαδρομή ενός μέλους μέσα στα ευρήματα — μία, για κρίση, κρατήσεις και οθόνη. */
export const memberPath = (memberId: string): string => `variants.${memberId}`;

const prefixed = (memberId: string, issues: readonly CatalogIssue[]): CatalogIssue[] =>
  issues.map((issue) => ({ ...issue, path: `${memberPath(memberId)}.${issue.path}` }));

/** Η τοποθέτηση ενός μέλους στην όψη «μετά» — `null` για μέλος που διαγράφεται. */
function placementOf(input: AggregateJudgeInput, member: AggregateMember): PlacementResult | null {
  const { aggregate, schema } = input;
  const parentId = parentIdOf(member, 'after');
  const parent = parentId === null ? undefined : aggregate.members.get(parentId);
  const parentModel = parent?.kind === 'productModel' ? parent.after : null;
  if (member.kind === 'productModel') return member.after ? placeProductModel(member.after, parentModel, schema.family) : null;
  return member.after ? placeProduct(member.after, parentModel, schema.family) : null;
}

/** 1 + 2: τοποθέτηση και τιμές κάθε μέλους που **άλλαξε** ο άνθρωπος. */
function judgeMembers(input: AggregateJudgeInput): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  for (const member of input.aggregate.members.values()) {
    const placement = member.changed ? placementOf(input, member) : null;
    if (placement === null || member.after === null) continue;
    issues.push(...prefixed(member.id, placement.issues));
    if (!placement.placement) continue;
    const context = { ...input.schema, ...input.refs, ...placement.placement };
    issues.push(...prefixed(member.id, validateHolderValues(member.after, context)));
  }
  return issues;
}

/** 3: το όριο απογόνων — μετρά μόνο ό,τι **προστίθεται** (ένα σύνολο πάνω από το όριο δεν κλειδώνει διορθώσεις). */
function judgeBudget(aggregate: CatalogAggregate): readonly CatalogIssue[] {
  const count = (side: AggregateSide) => liveMembers(aggregate, side).filter((member) => member.id !== aggregate.rootId).length;
  if (aggregate.rootId === null) return [];
  const before = count('before');
  return checkDescendantBudget(before, Math.max(0, count('after') - before));
}

/** 4: συνδυασμός αξόνων μοναδικός ανάμεσα στα αδέλφια (ίδιος γονέας), σε **τυποποιημένη** τιμή. */
function judgeAxes(input: AggregateJudgeInput): readonly CatalogIssue[] {
  const { aggregate, schema } = input;
  const byParent = new Map<string, AggregateMember[]>();
  for (const member of liveMembers(aggregate, 'after')) {
    const parentId = parentIdOf(member, 'after');
    if (parentId !== null) byParent.set(parentId, [...(byParent.get(parentId) ?? []), member]);
  }
  const issues: CatalogIssue[] = [];
  for (const siblings of byParent.values()) {
    const depth = chainOf(aggregate, siblings[0].id, 'after').length - 1;
    const rows = siblings.map((member) => ({ id: member.id, values: definitionOf(member, 'after')?.values ?? {} }));
    const clashes = findAxisCombinationClashes(rows, axesAtDepth(schema.scheme, depth), schema.attributes, schema.registry);
    issues.push(...axisClashIssues(clashes));
  }
  return issues;
}

/** Οι γραμμές του αξιολογητή κανόνων σε μία όψη: ένα SKU = μία γραμμή, πάνω στις συγχωνευμένες τιμές. */
export function consistencyRows(aggregate: CatalogAggregate, schema: CatalogSchemaSnapshot, side: AggregateSide): VariantValueRow[] {
  return productMembers(aggregate, side).map((member) => {
    const resolved = resolveInheritedValues(chainOf(aggregate, member.id, side), schema.scheme);
    return toVariantValueRow(member.id, resolved, schema.attributes, schema.registry);
  });
}

function evaluate(schema: CatalogSchemaSnapshot, rows: readonly VariantValueRow[]): readonly ConsistencyViolation[] {
  const schemeAxisIds = schema.scheme?.levels.flatMap((level) => level.axisAttributeIds) ?? [];
  return evaluateConsistency({ rules: schema.family.consistencyRules, rows, schemeAxisIds, ...schema });
}

/** 5: κανόνες πριν/μετά ⇒ «καμία νέα παράβαση». Κάθε μπλοκάρουσα παράβαση γίνεται εύρημα **ανά κελί**. */
function judgeRules(input: AggregateJudgeInput): AggregateVerdict {
  const { aggregate, schema } = input;
  const beforeRows = consistencyRows(aggregate, schema, 'before');
  const afterRows = consistencyRows(aggregate, schema, 'after');
  const verdict = judgeConsistency(evaluate(schema, beforeRows), evaluate(schema, afterRows), changedCells(beforeRows, afterRows));
  const issues = verdict.blocking.flatMap((violation) =>
    violation.variantIds.flatMap((variantId) =>
      violation.attributeIds.map((attributeId): CatalogIssue => ({
        code: 'consistencyRuleViolated',
        path: `${memberPath(variantId)}.values.${attributeId}`,
        // Το ΕΙΔΟΣ του κανόνα ταξιδεύει μαζί: το μήνυμα λέει «επαναλαμβάνεται», όχι το εσωτερικό «rule_1».
        params: { ruleId: violation.ruleId, kind: violation.kind },
      })),
    ),
  );
  return { issues, findings: verdict.findings };
}

/** Η κρίση του συνόλου. Τα ευρήματα 3–5 κρίνονται μόνο αν 1–2 είναι καθαρά (αλλιώς θα έδιναν ψευδή ευρήματα). */
export function judgeAggregate(input: AggregateJudgeInput): AggregateVerdict {
  const memberIssues = judgeMembers(input);
  if (memberIssues.length > 0) return { issues: memberIssues, findings: [] };
  const structural = [...judgeBudget(input.aggregate), ...judgeAxes(input)];
  if (structural.length > 0) return { issues: structural, findings: [] };
  return judgeRules(input);
}
