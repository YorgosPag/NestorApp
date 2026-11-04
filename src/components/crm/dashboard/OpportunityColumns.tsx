'use client';

/**
 * @fileoverview **Ο πίνακας της ροής πωλήσεων** — στήλες σταδίων πάνω στον ΕΝΑ `KanbanBoard` (ADR-930).
 * @module components/crm/dashboard/OpportunityColumns
 *
 * 🔑 Σύρσιμο κάρτας σε στήλη = αλλαγή σταδίου (Pipedrive/HubSpot/Salesforce Kanban). Ο πίνακας **δεν** αλλάζει
 *    δεδομένα: καλεί `onMove`, και η εντολή (`useStageTransitionCommand`) αποφασίζει (διάλογος, πόρτα, σύγκρουση).
 * 🔑 Κεφαλίδα στήλης: πλήθος · σύνολο · **σταθμισμένο** σύνολο (αξία × πιθανότητα).
 * 🔑 Σειρά μέσα στη στήλη = κανόνας του χρήστη (ταξινόμηση), ποτέ χειροκίνητη.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { KanbanBoard, type KanbanColumnDef } from '@/components/ui/sortable/KanbanBoard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isOpportunityStage, OPPORTUNITY_STAGE_IDS, type OpportunityStage } from '@/config/crm/opportunity-stages';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-utils';
import { safeGetItem, safeSetItem, STORAGE_KEYS } from '@/lib/storage';
import type { Opportunity } from '@/types/crm';
import {
  columnTotals,
  DEFAULT_PIPELINE_SORT,
  isPipelineSort,
  PIPELINE_SORTS,
  sortOpportunities,
  type ColumnTotals,
  type PipelineSort,
} from '../utils/pipeline-board';
import { OpportunityCard } from './OpportunityCard';

interface OpportunityColumnsProps {
  readonly opportunities: readonly Opportunity[];
  readonly onEdit: (opportunity: Opportunity) => void;
  readonly onDelete: (opportunityId: string, opportunityName: string) => void;
  readonly onMove: (opportunity: Opportunity, to: OpportunityStage) => void;
  /** Έχει ο χρήστης το δικαίωμα αλλαγής σταδίου (`crm:opportunities:update`); */
  readonly canMove: boolean;
  readonly isMoving: (opportunityId: string) => boolean;
}

const money = (value: number) => formatCurrency(value, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function usePipelineSort(): [PipelineSort, (sort: PipelineSort) => void] {
  const [sort, setSort] = useState<PipelineSort>(() => {
    const stored = safeGetItem(STORAGE_KEYS.PIPELINE_SORT, DEFAULT_PIPELINE_SORT);
    return isPipelineSort(stored) ? stored : DEFAULT_PIPELINE_SORT;
  });
  const choose = useCallback((next: PipelineSort) => { setSort(next); safeSetItem(STORAGE_KEYS.PIPELINE_SORT, next); }, []);
  return [sort, choose];
}

function ColumnHeader({ totals }: { readonly totals: ColumnTotals }) {
  const { t } = useTranslation('crm');
  return (
    <p className="m-0 flex flex-col items-end text-xs text-muted-foreground">
      <span>{totals.count}</span>
      {totals.total > 0 && (
        <span aria-label={t('pipeline.board.totalsLabel', { total: money(totals.total), weighted: money(totals.weighted) })}>
          {money(totals.total)} · ~{money(totals.weighted)}
        </span>
      )}
    </p>
  );
}

function SortPicker({ sort, onSort }: { readonly sort: PipelineSort; readonly onSort: (sort: PipelineSort) => void }) {
  const { t } = useTranslation('crm');
  return (
    <Select value={sort} onValueChange={(value) => { if (isPipelineSort(value)) onSort(value); }}>
      <SelectTrigger className="h-8 w-56 text-xs" aria-label={t('pipeline.board.sortLabel')}><SelectValue /></SelectTrigger>
      <SelectContent>
        {PIPELINE_SORTS.map((option) => <SelectItem key={option} value={option}>{t(`pipeline.board.sort.${option}`)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function OpportunityColumns({ opportunities, onEdit, onDelete, onMove, canMove, isMoving }: OpportunityColumnsProps) {
  const { t } = useTranslation('crm');
  const [sort, setSort] = usePipelineSort();
  const sorted = useMemo(() => sortOpportunities(opportunities, sort), [opportunities, sort]);
  const columns = useMemo<KanbanColumnDef[]>(() => OPPORTUNITY_STAGE_IDS.map((stage) => ({
    id: stage,
    label: t(`opportunities.stages.${stage}`),
    header: <ColumnHeader totals={columnTotals(opportunities.filter((o) => o.stage === stage))} />,
  })), [opportunities, t]);
  const byId = useMemo(() => new Map(opportunities.map((o) => [o.id ?? '', o])), [opportunities]);
  const moveTo = useCallback((id: string, to: string) => {
    const opportunity = byId.get(id);
    if (opportunity && isOpportunityStage(to)) onMove(opportunity, to);
  }, [byId, onMove]);

  return (
    <section aria-label={t('pipeline.title')} className="flex flex-col gap-2">
      <header className="flex justify-end"><SortPicker sort={sort} onSort={setSort} /></header>
      <KanbanBoard
        columns={columns}
        items={sorted}
        getId={(o) => o.id ?? ''}
        getLabel={(o) => o.fullName || o.title}
        getColumnId={(o) => o.stage}
        canDrag={(o) => canMove && !!o.id && !isMoving(o.id)}
        onMove={(o, _from, to) => moveTo(o.id ?? '', to)}
        activation="card"
        ariaLabel={t('pipeline.title')}
        emptyLabel={t('pipeline.board.emptyColumn')}
        className="overflow-x-auto pb-4"
        columnClassName="min-w-[280px] flex-1 bg-muted/30"
        renderCard={(o, handle) => (
          <OpportunityCard opportunity={o} onEdit={onEdit} onDelete={onDelete} handle={handle} moving={!!o.id && isMoving(o.id)}
            onMoveTo={canMove ? (stage) => moveTo(o.id ?? '', stage) : undefined} />
        )}
      />
    </section>
  );
}
