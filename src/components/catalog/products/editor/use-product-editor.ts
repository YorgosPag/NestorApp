'use client';
/**
 * **Ο επεξεργαστής ενός φορέα τιμών** — ρίζα · υπο-μοντέλο · SKU · απλό προϊόν (ADR-923 §5.10.4 Β3).
 *
 * Πρόχειρο (`useDefinitionDraft`: CAS, `revisionMismatch` ⇒ επαναφορά στη ζωντανή βάση) → το **σύνολο** όπως θα είναι
 * (`editAggregate`) → η **ίδια** `judgeAggregate` με τον διακομιστή ⇒ γνωστό 422 δεν στέλνεται. Από το ίδιο σύνολο:
 * τιμές **με ιδιοκτήτη** (`resolveInheritedValues`, Δ1 — γκρι «ορίζεται στο …») και πληρότητα **ζωντανά** όσο γράφεις.
 *
 * @module components/catalog/products/editor/use-product-editor
 */

import { useEffect, useMemo } from 'react';

import { useCatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { useCatalogReferenceLookup } from '@/hooks/catalog/useCatalogReferenceLookup';
import { replaceCatalogDefinition, type ProductModelRecord, type ProductRecord } from '@/services/catalog/catalog-api.client';
import { chainOf } from '@/subapps/catalog/aggregate/aggregate-model';
import { editAggregate, modelDefinitionOf, productDefinitionOf, referenceTargetsOf, schemaSnapshotOf } from '@/subapps/catalog/aggregate/edit-aggregate';
import { judgeAggregate, memberPath } from '@/subapps/catalog/aggregate/judge-aggregate';
import type { StoredMemberShape } from '@/subapps/catalog/aggregate/aggregate-members';
import { computeCompleteness } from '@/subapps/catalog/completeness/compute-completeness';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogProductDefinition, CatalogProductModelDefinition } from '@/subapps/catalog/types/product';
import { resolveInheritedValues } from '@/subapps/catalog/values/resolve-inherited';

import { optimisticWire } from '../../shared/catalog-actions';
import { useCatalogFailureNotice } from '../../shared/catalog-ui-hooks';
import { useDefinitionDraft } from '../../shared/use-definition-draft';
import type { ProductCatalogContext } from '../use-product-catalog-context';
import { levelSchema } from './editor-layout';

export type HolderDefinition = CatalogProductModelDefinition | CatalogProductDefinition;
export type HolderRecord = ProductModelRecord | ProductRecord;

export interface ProductEditorInput {
  readonly record: HolderRecord;
  readonly rootId: string | null;
  readonly members: readonly StoredMemberShape[];
  readonly ctx: ProductCatalogContext;
  readonly reportDirty: (dirty: boolean) => void;
}

const definitionOfRecord = (record: HolderRecord): HolderDefinition =>
  ('code' in record ? modelDefinitionOf(record) : productDefinitionOf(record));

/**
 * Αντικατάσταση με CAS — το είδος της εγγραφής **και** του ορισμού στενεύουν μαζί (το `CatalogOptimistic<T>` είναι
 * αμετάβλητο ως προς τον τύπο: η ένωση μοντέλο|SKU δεν χωρά στο γενικό `saveDefinition<K>` χωρίς μετατροπή).
 */
function replaceHolder(record: HolderRecord, revision: number, draft: HolderDefinition): Promise<HolderRecord> {
  if ('code' in record && 'code' in draft) return replaceCatalogDefinition('productModel', record.id, revision, draft);
  if ('modelId' in record && 'modelId' in draft) return replaceCatalogDefinition('product', record.id, revision, draft);
  return Promise.reject(new Error(`holder kind mismatch for ${record.id}`));
}

/** Ό,τι δείχνει η οθόνη ως την απάντηση: ο ορισμός πάνω στην εγγραφή, με τα **παλιά** παράγωγα (τα νέα τα γράφει ο διακομιστής). */
function optimisticHolder(record: HolderRecord, draft: HolderDefinition): HolderRecord {
  if ('code' in record && 'code' in draft) return optimisticWire({ ...draft, derived: record.derived }, record, record.id);
  if ('modelId' in record && 'modelId' in draft) return optimisticWire({ ...draft, derived: record.derived }, record, record.id);
  return record;
}

/** Ευρήματα **αυτού** του μέλους χωρίς το πρόθεμα `variants.<id>.` (οι διαδρομές των πεδίων του φορέα). */
function memberIssues(issues: readonly CatalogIssue[], id: string): CatalogIssue[] {
  const prefix = `${memberPath(id)}.`;
  return issues.filter((issue) => issue.path.startsWith(prefix)).map((issue) => ({ ...issue, path: issue.path.slice(prefix.length) }));
}

/** Το σχήμα παραλλαγών του συνόλου: της ρίζας (μοντέλα) · `null` για απλό προϊόν. */
function schemeCodeOf(rootId: string | null, members: readonly StoredMemberShape[]): string | null {
  const root = members.find((member) => member.record.id === rootId);
  return root?.kind === 'productModel' ? root.record.variantSchemeCode : null;
}

function useJudgement(input: ProductEditorInput, draft: HolderDefinition) {
  const { record, rootId, members, ctx } = input;
  const family = ctx.familyById.get(record.familyId) ?? null;
  const targets = useMemo(() => referenceTargetsOf([draft, ...members.map((member) => member.record)]), [draft, members]);
  const references = useCatalogReferenceLookup(targets, ctx.familyById);
  return useMemo(() => {
    if (!family) return null;
    const schema = schemaSnapshotOf({ family, attributes: ctx.library.attributeById, registry: ctx.library.registry, settings: ctx.settings.definition, variantSchemeCode: schemeCodeOf(rootId, members) });
    const aggregate = editAggregate(rootId, members, { updates: new Map([[record.id, draft]]), creates: [], deletes: [] });
    const refs = { assets: ctx.assetById, categories: new Set(ctx.categories.map((category) => category.id)), references: references.lookup };
    const verdict = judgeAggregate({ aggregate, schema, refs });
    const chain = chainOf(aggregate, record.id, 'after');
    const resolved = resolveInheritedValues(chain, schema.scheme);
    const completeness = computeCompleteness({ ...levelSchema(schema, 'code' in record, chain.length - 1), resolved });
    return { schema, refs, verdict, resolved, completeness, chain, depth: chain.length - 1, own: memberIssues(verdict.issues, record.id), references };
  }, [family, ctx, rootId, members, record.id, draft, references]);
}

export function useProductEditor(input: ProductEditorInput) {
  const { record, reportDirty } = input;
  const notice = useCatalogFailureNotice();
  const ops = useCatalogOptimistic<HolderRecord>([record], notice);
  const settled = ops.settled.find((candidate) => candidate.id === record.id) ?? record;
  const base = useMemo(() => definitionOfRecord(settled), [settled]);
  const editor = useDefinitionDraft<HolderDefinition>(base, record.id, settled.revision);
  useEffect(() => reportDirty(editor.unsaved), [editor.unsaved, reportDirty]);
  const judgement = useJudgement(input, editor.draft);
  const issues = useMemo(() => [...(judgement?.own ?? []), ...editor.serverIssues], [judgement, editor.serverIssues]);

  const save = () => {
    const draft = editor.draft;
    ops.submit({
      key: settled.id,
      optimistic: optimisticHolder(settled, draft),
      baseRevision: editor.baseRevision ?? settled.revision,
      send: (revision) => replaceHolder(settled, revision ?? settled.revision, draft),
      onSettled: editor.beginSave<HolderRecord>(),
    });
  };

  return { editor, judgement, issues, save, record: settled, pending: ops.pendingKeys.has(record.id) };
}
