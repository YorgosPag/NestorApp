'use client';
/**
 * **Η κατάσταση του πλέγματος παραλλαγών** (ADR-923 §5.10.4 Β4).
 *
 * - Πρόχειρο **πάνω** στο ζωντανό σύνολο με **rebase ανά γραμμή** (καμία απώλεια επικόλλησης από ξένη αλλαγή μίας γραμμής).
 * - Αναίρεση/επανάληψη: μία ενέργεια = μία μονάδα (`grid-history`) — επικόλληση 7 × 12, γεννήτορας, `Ctrl+D`.
 * - Κρίση **στον πελάτη** με την ίδια `judgeAggregate` ⇒ γνωστό 422 δεν στέλνεται· πληρότητα ανά γραμμή, ζωντανά.
 * - Αποθήκευση = **μία** δέσμη (`PUT …/variants`), σειριοποιημένη ανά μοντέλο (`useCatalogOptimistic`, κλειδί = μοντέλο).
 *
 * @module components/catalog/products/variants/use-variant-grid
 */

import { useMemo, useState } from 'react';

import { useCatalogOptimistic, type CatalogOutcome } from '@/hooks/catalog/useCatalogOptimistic';
import { emptyHistory, recordHistory, redoHistory, undoHistory, type History } from '@/lib/spreadsheet/grid-history';
import { generateCatalogProductId } from '@/services/enterprise-id-convenience';
import { saveCatalogVariants, type ProductModelRecord } from '@/services/catalog/catalog-api.client';
import type { StoredMemberShape } from '@/subapps/catalog/aggregate/aggregate-members';
import { chainOf } from '@/subapps/catalog/aggregate/aggregate-model';
import { editAggregate } from '@/subapps/catalog/aggregate/edit-aggregate';
import { judgeAggregate } from '@/subapps/catalog/aggregate/judge-aggregate';
import type { AggregateReferences } from '@/subapps/catalog/aggregate/judge-aggregate';
import { completenessPercent, computeCompleteness } from '@/subapps/catalog/completeness/compute-completeness';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { ProductValues } from '@/subapps/catalog/types/product';
import { resolveInheritedValues } from '@/subapps/catalog/values/resolve-inherited';

import { useCatalogFailureNotice } from '../../shared/catalog-ui-hooks';
import type { ListScope } from '../ProductListToolbar';
import { isDraftDirty, newVariantRows, rebaseVariantDraft, variantBatchOf, variantDraftOf, variantEdits, type VariantDraft, type VariantRow } from './variant-rows';

export interface VariantGridInput {
  readonly root: ProductModelRecord;
  readonly parentId: string;
  readonly rootId: string;
  readonly members: readonly StoredMemberShape[];
  readonly schema: CatalogSchemaSnapshot;
  readonly refs: AggregateReferences;
  readonly scope: ListScope;
}

function useDraft(input: VariantGridInput) {
  const base = useMemo(() => variantDraftOf(input.members, input.parentId), [input.members, input.parentId]);
  const [own, setOwn] = useState<VariantDraft | null>(null);
  const rebased = useMemo(() => (own ? rebaseVariantDraft(own, base) : { draft: base, conflicts: [] }), [own, base]);
  const [history, setHistory] = useState<History<VariantDraft>>(emptyHistory());
  const change = (next: VariantDraft) => { setHistory((prev) => recordHistory(prev, { before: rebased.draft, after: next })); setOwn(next); };
  const step = (result: { history: History<VariantDraft>; apply: VariantDraft | null }) => { setHistory(result.history); if (result.apply) setOwn(result.apply); };
  return {
    draft: rebased.draft,
    conflicts: rebased.conflicts,
    change,
    undo: () => step(undoHistory(history)),
    redo: () => step(redoHistory(history)),
    discard: () => { setOwn(null); setHistory(emptyHistory()); },
  };
}

function useJudgement(input: VariantGridInput, draft: VariantDraft) {
  return useMemo(() => {
    const aggregate = editAggregate(input.rootId, input.members, variantEdits(draft));
    const verdict = judgeAggregate({ aggregate, schema: input.schema, refs: input.refs });
    const percentOf = (row: VariantRow): number | null => {
      if (!aggregate.members.has(row.id)) return null;
      const resolved = resolveInheritedValues(chainOf(aggregate, row.id, 'after'), input.schema.scheme);
      const cell = computeCompleteness({ ...input.schema, resolved })[input.scope.channel][input.scope.locale];
      return cell ? completenessPercent(cell) : null;
    };
    return { verdict, percentOf, aggregate };
  }, [input.rootId, input.members, input.schema, input.refs, input.scope, draft]);
}

export function useVariantGrid(input: VariantGridInput) {
  const notice = useCatalogFailureNotice();
  const ops = useCatalogOptimistic<ProductModelRecord>([input.root], notice);
  const state = useDraft(input);
  const { verdict, percentOf, aggregate } = useJudgement(input, state.draft);
  const [serverIssues, setServerIssues] = useState<readonly CatalogIssue[]>([]);
  const issues = useMemo(() => [...verdict.issues, ...serverIssues], [verdict.issues, serverIssues]);
  const save = () => {
    const batch = variantBatchOf(state.draft);
    setServerIssues([]);
    ops.submit({
      key: input.root.id,
      optimistic: input.root,
      baseRevision: input.root.revision,
      send: () => saveCatalogVariants(input.parentId, batch).then((result) => result.model),
      onSettled: (outcome: CatalogOutcome<ProductModelRecord>) => { if (!outcome.ok) setServerIssues(outcome.failure.issues); },
    });
  };
  // Τα ευρήματα του διακομιστή αφορούσαν το **προηγούμενο** πρόχειρο ⇒ σβήνουν με κάθε αλλαγή (αλλιώς το «Αποθήκευση»
  // θα έμενε κλειδωμένο ακόμη κι αφού ο άνθρωπος διόρθωσε το κελί).
  const change = (next: VariantDraft) => { setServerIssues([]); state.change(next); };
  const generate = (combos: readonly ProductValues[]) => {
    const template = { modelId: input.parentId, familyId: input.root.familyId };
    change({ ...state.draft, rows: [...state.draft.rows, ...newVariantRows(combos, template, generateCatalogProductId)] });
  };
  return {
    ...state,
    change,
    issues,
    percentOf,
    aggregate,
    dirty: isDraftDirty(state.draft),
    saving: ops.pendingKeys.has(input.root.id),
    save,
    generate,
  };
}
