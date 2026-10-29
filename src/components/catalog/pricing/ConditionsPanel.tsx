'use client';

/**
 * @fileoverview **Συνθήκες: πίνακας + επιθεωρητής** — ο πίνακας σε όλο το πλάτος, ο επεξεργαστής σε side peek που σέρνεται
 *   (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related ConditionMatrix.tsx · ConditionPeriods.tsx · DiscountConditionEditor.tsx · core/layouts/ListDetailsSplit (`peek`, ADR-912)
 * @module components/catalog/pricing/ConditionsPanel
 *
 * 🔑 **Κλικ σε κελί = άνοιγμα της υποδοχής του**: η ισχύουσα περίοδος (ή η πρώτη που υπάρχει), αλλιώς **νέα** συνθήκη
 *    προσυμπληρωμένη με την ομάδα και το κοινό του κελιού — ο άνθρωπος δεν ξαναδιαλέγει ό,τι μόλις έδειξε.
 * 🔑 **Το πρόχειρο ζει στον πίνακα**: ο επεξεργαστής αναφέρει το πρόχειρό του, ο πίνακας ξαναχτίζεται από πάνω του — η θέση
 *    όπου θα «προσγειωθεί» και κάθε ασάφεια φαίνονται **πριν** από την αποθήκευση. Το πρόχειρο δένεται στη **συνεδρία**
 *    επιλογής: ένα καρέ μετά την αλλαγή επιλογής δεν δείχνει το πρόχειρο της προηγούμενης.
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?condition=<id>`)· η συνθήκη έχει id από τη γέννησή της (Γ5), άρα ο σύνδεσμος δεν σπάει.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ListDetailsSplit } from '@/core/layouts';
import type { PriceAudience } from '@/subapps/catalog/types/price-list';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { NEW_SELECTION, type CatalogSelection } from '../shared/use-catalog-selection';
import type { UnsavedGuard } from '../shared/use-unsaved-guard';
import { buildConditionMatrix, cellKeyOf, columnKeyOf, rowKeyOf, type MatrixColumn, type MatrixDraft, type MatrixRow } from './condition-matrix';
import { ConditionMatrix } from './ConditionMatrix';
import { ConditionPeriods } from './ConditionPeriods';
import { DEFAULT_CONDITION_SEED, type ConditionSeed } from './discount-condition-draft';
import { DiscountConditionEditor } from './DiscountConditionEditor';
import type { DiscountsWorkspace } from './use-discounts-workspace';
import { useDiscountWords } from './use-discount-words';

interface ConditionsPanelProps {
  readonly workspace: DiscountsWorkspace;
  readonly selection: CatalogSelection;
  readonly unsaved: UnsavedGuard;
}

/** Το κοινό που «δείχνει» μια στήλη — ο συνεργάτης χωρίς συμβαλλόμενο (τον διαλέγει ο άνθρωπος). */
function audienceOfColumn(column: MatrixColumn): PriceAudience {
  if (column.kind === 'customerGroup') return { kind: 'customerGroup', customerGroupId: column.group.id };
  if (column.kind === 'partner') return { kind: 'partner', party: { kind: 'contact', contactId: '' } };
  return { kind: column.kind };
}

/** Το πρόχειρο του ανοιχτού επεξεργαστή (με την ταυτότητά του), δεμένο στη συνεδρία επιλογής που το γέννησε. */
function useSessionDraft(sessionKey: string) {
  const [draft, setDraft] = useState<{ readonly key: string; readonly value: MatrixDraft } | null>(null);
  const report = useCallback((value: MatrixDraft) => setDraft({ key: sessionKey, value }), [sessionKey]);
  return { value: draft?.key === sessionKey ? draft.value : null, report };
}

function useConditionsPanel({ workspace, selection, unsaved }: ConditionsPanelProps) {
  const { conditions, discountGroups, customerGroups } = workspace;
  const [seed, setSeed] = useState<ConditionSeed>(DEFAULT_CONDITION_SEED);
  const canManage = useCatalogAccess('pricing') === 'granted';
  const isNew = selection.selected === NEW_SELECTION && canManage;
  const record = !isNew && selection.selected ? conditions.settled.find((condition) => condition.id === selection.selected) ?? null : null;
  const open = isNew || record !== null;
  const draft = useSessionDraft(selection.key);
  const shownDraft = open ? draft.value : null;
  const matrix = useMemo(() => buildConditionMatrix({
    discountGroups: discountGroups.view, customerGroups: customerGroups.view, conditions: conditions.view,
    draft: shownDraft, nowMs: workspace.nowMs,
  }), [discountGroups.view, customerGroups.view, conditions.view, shownDraft, workspace.nowMs]);
  const located = shownDraft?.definition ?? record ?? (isNew ? seed : null);
  const selectedCell = located ? cellKeyOf(rowKeyOf(located.discountGroupId), columnKeyOf(located.audience)) : null;
  const startNew = (next: ConditionSeed) => { setSeed(next); selection.select(NEW_SELECTION); };
  const onCell = (row: MatrixRow, column: MatrixColumn) => unsaved.guard(() => {
    const cell = matrix.cells.get(cellKeyOf(row.key, column.key));
    const target = cell?.current.find((entry) => !entry.isDraft) ?? cell?.entries.find((entry) => !entry.isDraft);
    if (target) selection.select(target.id);
    else if (canManage) startNew({ discountGroupId: row.group?.id ?? null, audience: audienceOfColumn(column) });
  });
  return { matrix, record, isNew, open, seed, selectedCell, onCell, startNew, reportDraft: draft.report, canManage, located };
}

export function ConditionsPanel(props: ConditionsPanelProps) {
  const { workspace, selection, unsaved } = props;
  const { t } = useCatalogText();
  const state = useConditionsPanel(props);
  const words = useDiscountWords(workspace.customerGroups.view, workspace.partyNames);
  const open = (id: string) => unsaved.guard(() => selection.select(id));
  const close = () => unsaved.guard(() => selection.select(null));
  const located = state.located;
  const title = located ? words.audience(located.audience) : t('pricing.discounts.editor.newTitle');
  const cell = state.selectedCell ? state.matrix.cells.get(state.selectedCell) : undefined;
  const newPeriod = state.canManage && located ? () => unsaved.guard(() => state.startNew({ discountGroupId: located.discountGroupId, audience: located.audience })) : null;
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-muted-foreground">{t('pricing.discounts.matrix.lead')}</p>
        {state.canManage ? (
          <Button type="button" onClick={() => unsaved.guard(() => state.startNew(DEFAULT_CONDITION_SEED))}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('pricing.discounts.newCondition')}</Button>
        ) : null}
      </header>
      {state.matrix.unplaced > 0 ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('pricing.discounts.matrix.unplaced', { count: state.matrix.unplaced })}</p> : null}
      <ListDetailsSplit
        peek
        list={<ConditionMatrix matrix={state.matrix} selectedCell={state.selectedCell} onCell={state.onCell} />}
        details={state.open ? (
          <section className="flex flex-col">
            <ConditionPeriods cell={cell} selectedId={state.record?.id ?? null} words={words} onOpen={open} onNew={newPeriod} />
            <DiscountConditionEditor key={selection.key} record={state.record} seed={state.seed} ops={workspace.conditions}
              discountGroups={workspace.discountGroups.view} customerGroups={workspace.customerGroups.view} words={words}
              onDraft={state.reportDraft} onCreated={(id) => selection.selectIfCurrent(selection.key, id)} onDeleted={() => selection.select(null)}
              onOpen={open} reportDirty={unsaved.reportDirty} />
          </section>
        ) : null}
        sheetOpen={state.open}
        sheetTitle={title}
        onCloseSheet={close}
      />
    </section>
  );
}
