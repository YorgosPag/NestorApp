'use client';

/**
 * @fileoverview **Ο πίνακας της ροής πωλήσεων** — στήλες σταδίων πάνω στον ΕΝΑ `KanbanBoard` (ADR-930).
 * @module components/crm/dashboard/OpportunityColumns
 *
 * 🔑 Σύρσιμο κάρτας σε στήλη = αλλαγή σταδίου (Pipedrive/HubSpot/Salesforce Kanban). Ο πίνακας **δεν** αλλάζει
 *    δεδομένα: καλεί `onMove`, και η εντολή (`useStageTransitionCommand`) αποφασίζει (διάλογος, πόρτα, σύγκρουση).
 * 🔑 Κεφαλίδα στήλης: πλήθος · σύνολο · **σταθμισμένο** σύνολο (αξία × πιθανότητα).
 * 🔑 Σειρά μέσα στη στήλη = κανόνας του χρήστη (ταξινόμηση), ποτέ χειροκίνητη.
 * 🔑 ADR-930 §3.11 — ο πίνακας **γεμίζει το ύψος** (Jira): η οριζόντια μπάρα είναι πάντα στην οθόνη, οι άκρες σβήνουν
 *    όπου υπάρχουν κρυμμένες στήλες. Κάθε στήλη **συμπτύσσεται** (HubSpot, ανά συσκευή)· τα **κλειστά** στάδια
 *    ξεκινούν συμπτυγμένα — φαίνονται με πλήθος, όχι εξαφανισμένα (Pipedrive τα κρύβει τελείως). Όσο σέρνεις,
 *    «Κέρδος»/«Απώλεια» εμφανίζονται ως **ζώνη ρίψης** κάτω, όσο κι αν έχει κυλήσει ο πίνακας.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Trophy, XCircle } from 'lucide-react';

import { KanbanBoard, type KanbanColumnDef, type KanbanDockTarget } from '@/components/ui/sortable/KanbanBoard';
import { useKanbanCollapse } from '@/components/ui/sortable/use-kanban-collapse';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  closingStageOf,
  isClosedStage,
  isOpportunityStage,
  OPPORTUNITY_STAGE_IDS,
  type OpportunityStage,
} from '@/config/crm/opportunity-stages';
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
import { useOpportunityLocks, type OpportunityAccessGate } from '../stage-move/useOpportunityAccess';
import { OpportunityCard } from './OpportunityCard';

interface OpportunityColumnsProps {
  readonly opportunities: readonly Opportunity[];
  readonly onEdit: (opportunity: Opportunity) => void;
  readonly onDelete: (opportunityId: string, opportunityName: string) => void;
  readonly onMove: (opportunity: Opportunity, to: OpportunityStage) => void;
  /** Ο κριτής κατόχου (ADR-930): ανά κάρτα, ο ίδιος με τον server — διαχειριστής όλες, ο κάτοχος τις δικές του. */
  readonly access: OpportunityAccessGate;
  readonly isMoving: (opportunityId: string) => boolean;
}

const money = (value: number) => formatCurrency(value, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Τα κλειστά στάδια ξεκινούν συμπτυγμένα — ο άνθρωπος δουλεύει τα ανοιχτά. Η ρητή του επιλογή κερδίζει. */
const collapsedByDefault = (columnId: string) => isOpportunityStage(columnId) && isClosedStage(columnId);

/**
 * 🔑 **Αδιαφανές** φόντο στήλης (το ίδιο χρώμα που έδινε το `bg-muted/30` πάνω στο `bg-background` της σελίδας): η
 *    κεφαλίδα είναι `sticky` και κληρονομεί το φόντο (`bg-inherit`) — με ημιδιαφανές, οι κάρτες θα φαίνονταν από κάτω.
 */
const COLUMN_CLASS = 'min-w-[280px] flex-1 bg-[color-mix(in_srgb,hsl(var(--muted))_30%,hsl(var(--background)))]';

function useClosingDock(): readonly KanbanDockTarget[] {
  const { t } = useTranslation('crm');
  return useMemo(() => {
    const won = closingStageOf('won');
    const lost = closingStageOf('lost');
    return [
      { columnId: won, label: t(`opportunities.stages.${won}`), icon: <Trophy className="h-4 w-4 text-[hsl(var(--status-success))]" aria-hidden /> },
      { columnId: lost, label: t(`opportunities.stages.${lost}`), icon: <XCircle className="h-4 w-4 text-[hsl(var(--status-error))]" aria-hidden /> },
    ];
  }, [t]);
}

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

export function OpportunityColumns({ opportunities, onEdit, onDelete, onMove, access, isMoving }: OpportunityColumnsProps) {
  const { t } = useTranslation('crm');
  const [sort, setSort] = usePipelineSort();
  const { collapsed, setCollapsed } = useKanbanCollapse(STORAGE_KEYS.PIPELINE_COLUMNS, OPPORTUNITY_STAGE_IDS, collapsedByDefault);
  const dock = useClosingDock();
  const locksOf = useOpportunityLocks(opportunities, access);
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
    <section aria-label={t('pipeline.title')} className="flex h-full min-h-96 flex-col gap-2">
      <header className="flex shrink-0 justify-end"><SortPicker sort={sort} onSort={setSort} /></header>
      <KanbanBoard
        columns={columns}
        items={sorted}
        getId={(o) => o.id ?? ''}
        getLabel={(o) => o.fullName || o.title}
        getColumnId={(o) => o.stage}
        canDrag={(o) => !!o.id && !isMoving(o.id) && access.allows(o, 'edit')}
        onMove={(o, _from, to) => moveTo(o.id ?? '', to)}
        activation="card"
        ariaLabel={t('pipeline.title')}
        emptyLabel={t('pipeline.board.emptyColumn')}
        layout="fill"
        columnClassName={COLUMN_CLASS}
        columnHeaderClassName="bg-inherit"
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        dock={dock}
        dockLabel={t('pipeline.board.dockLabel')}
        renderCard={(o, handle) => (
          <OpportunityCard opportunity={o} onEdit={onEdit} onDelete={onDelete} handle={handle} moving={!!o.id && isMoving(o.id)}
            locks={locksOf(o)} onMoveTo={access.allows(o, 'edit') ? (stage) => moveTo(o.id ?? '', stage) : undefined} />
        )}
      />
    </section>
  );
}
