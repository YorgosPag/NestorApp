'use client';
/**
 * **Παραλλαγές ενός μοντέλου** — το γενικό πλέγμα σε λειτουργία επεξεργασίας (ADR-923 §5.10.4 Β4).
 *
 * Επικόλληση από Excel (7 γραμμές × 12 στήλες με **μία** αναίρεση), πληκτρολόγιο του Excel, ευρήματα **στο κελί** από
 * την ίδια κρίση με τον διακομιστή, πληρότητα ανά γραμμή, γεννήτορας με τις νέες γραμμές **στο ίδιο πλέγμα**,
 * αποθήκευση με **μία** δέσμη. Συγκρούσεις του rebase αναφέρονται ονομαστικά.
 *
 * @module components/catalog/products/variants/VariantsPanel
 */

import { AlertTriangle, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/ui/data-grid/DataGrid';
import type { DataGridColumn } from '@/components/ui/data-grid/data-grid-types';
import type { ProductModelRecord } from '@/services/catalog/catalog-api.client';
import type { AggregateReferences } from '@/subapps/catalog/aggregate/judge-aggregate';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { StoredMemberShape } from '@/subapps/catalog/aggregate/aggregate-members';
import { axesAtDepth } from '@/subapps/catalog/values/attribute-levels';

import { IssueSummary, useIssueMessage } from '../../shared/CatalogIssues';
import { useCatalogText } from '../../shared/catalog-ui-hooks';
import { useCatalogGridWords } from '../../shared/use-catalog-grid-words';
import type { ValueEditorEnv } from '../../values/value-editor-types';
import type { ListScope } from '../ProductListToolbar';
import type { ProductCatalogContext } from '../use-product-catalog-context';
import { ModelTablePreview } from './ModelTablePreview';
import { VariantGeneratorDialog } from './VariantGeneratorDialog';
import { variantColumns } from './variant-columns';
import { cellIssues, unplacedIssues, type VariantRow } from './variant-rows';
import { useVariantGrid } from './use-variant-grid';

export interface VariantsPanelProps {
  /** Το μοντέλο του οποίου τις παραλλαγές επεξεργάζεσαι (ρίζα ή υπο-μοντέλο) — κλειδί σειριοποίησης της δέσμης. */
  readonly root: ProductModelRecord;
  /** Η **ρίζα** του συνόλου (η μονάδα κρίσης) — ίδια με το `root` σε σχήμα ενός επιπέδου. */
  readonly rootId: string;
  readonly parentId: string;
  readonly depth: number;
  readonly columnIds: readonly string[];
  readonly members: readonly StoredMemberShape[];
  readonly schema: CatalogSchemaSnapshot;
  readonly refs: AggregateReferences;
  readonly scope: ListScope;
  readonly env: ValueEditorEnv;
  readonly ctx: ProductCatalogContext;
  readonly canManage: boolean;
  /** Το πρόχειρο του πλέγματος στον φύλακα μη αποθηκευμένων (μια επικόλληση 7 γραμμών δεν χάνεται σιωπηλά). */
  readonly reportDirty: (dirty: boolean) => void;
}

function useColumns(props: VariantsPanelProps, grid: ReturnType<typeof useVariantGrid>): DataGridColumn<VariantRow>[] {
  const { t, text } = useCatalogText();
  const message = useIssueMessage();
  const axisIds = axesAtDepth(props.schema.scheme, props.depth + 1);
  const columns = variantColumns({ columnIds: props.columnIds, axisIds, attributeById: props.ctx.library.attributeById, scope: props.scope, env: props.env, message, percentOf: grid.percentOf, words: { t, text } });
  if (!props.canManage) return columns;
  return [...columns, {
    id: '__remove', header: '', label: t('variants.removeRow'), width: 'xs', text: () => '',
    render: (row) => (
      <Button type="button" variant="ghost" size="icon" tabIndex={-1} aria-label={t('variants.removeRow')}
        onClick={() => grid.change({ rows: grid.draft.rows.filter((other) => other.id !== row.id), removed: row.stored ? [...grid.draft.removed, row.stored] : grid.draft.removed })}>
        <X className="h-3 w-3" aria-hidden />
      </Button>
    ),
  }];
}

export function VariantsPanel(props: VariantsPanelProps) {
  const { t } = useCatalogText();
  const words = useCatalogGridWords();
  const message = useIssueMessage();
  const grid = useVariantGrid({ root: props.root, parentId: props.parentId, rootId: props.rootId, members: props.members, schema: props.schema, refs: props.refs, scope: props.scope });
  const columns = useColumns(props, grid);
  const { reportDirty } = props;
  useEffect(() => reportDirty(grid.dirty), [grid.dirty, reportDirty]);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const axisAttributes = useMemo(() => axesAtDepth(props.schema.scheme, props.depth + 1).flatMap((id) => props.ctx.library.attributeById.get(id) ?? []), [props.schema.scheme, props.depth, props.ctx.library.attributeById]);
  return (
    <section className="grid gap-3" aria-labelledby="variants-title">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="variants-title" className="m-0 text-base font-semibold">{t('variants.title', { count: grid.draft.rows.length })}</h3>
        {props.canManage ? <Button type="button" variant="outline" onClick={() => setGeneratorOpen(true)}><Sparkles className="mr-1 h-4 w-4" aria-hidden />{t('variants.generator.open')}</Button> : null}
      </header>
      {grid.conflicts.length > 0 ? (
        <p className="m-0 flex items-center gap-1 text-sm text-muted-foreground" role="status">
          <AlertTriangle className="h-4 w-4" aria-hidden />{t('variants.conflicts', { count: grid.conflicts.length })}
        </p>
      ) : null}
      <IssueSummary issues={unplacedIssues(grid.issues, props.columnIds)} title={t('editor.issuesTitle')} />
      <DataGrid<VariantRow> label={t('variants.gridLabel')} rows={grid.draft.rows} rowKey={(row) => row.id} columns={columns} words={words}
        onChange={props.canManage ? (change) => grid.change({ ...grid.draft, rows: change.rows }) : undefined}
        issuesOf={(row, _index, columnId) => cellIssues(grid.issues, row.id, columnId).map(message)}
        rowTone={(row) => (row.stored === null ? 'new' : null)} onUndo={grid.undo} onRedo={grid.redo} />
      {props.canManage ? (
        <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
          <p className="m-0 mr-auto text-sm text-muted-foreground" aria-live="polite">
            {grid.issues.length > 0 ? t('editor.status.issues', { count: grid.issues.length }) : grid.dirty ? t('variants.unsaved') : t('variants.clean')}
          </p>
          {grid.dirty ? <Button type="button" variant="ghost" onClick={grid.discard}>{t('common.discard')}</Button> : null}
          <Button type="button" disabled={!grid.dirty || grid.saving || grid.issues.length > 0} onClick={grid.save}>{t('variants.save')}</Button>
        </footer>
      ) : null}
      <ModelTablePreview aggregate={grid.aggregate} order={grid.draft.rows.map((row) => row.id)} schema={props.schema}
        attributeById={props.ctx.library.attributeById} registry={props.ctx.library.registry} scope={props.scope} env={props.env} modelId={props.root.id} />
      <VariantGeneratorDialog open={generatorOpen} onOpenChange={setGeneratorOpen} axes={axisAttributes} existing={grid.draft.rows.map((row) => row.definition.values)}
        descendantCount={grid.draft.rows.length} attributeById={props.ctx.library.attributeById} registry={props.ctx.library.registry} env={props.env} onGenerate={grid.generate} />
    </section>
  );
}
