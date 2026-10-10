'use client';

/**
 * @fileoverview **Τα κομμάτια μιας γραμμής ορόφου** — κοινά στον πίνακα και στη λίστα (ADR-912 §5).
 * @related floor-row-model.ts (τι δείχνει) · FloorsTable.tsx · FloorsCompactList.tsx (πώς το στήνουν)
 * @module components/building-management/tabs/floors/floor-row-parts
 *
 * 🔑 Κάθε κομμάτι απαντά **μία** ερώτηση («ποιο είναι το όνομα και τι σημάδια έχει;» · «τι ύψος;» · «τι μπορώ
 * να κάνω;»). Η διάταξη — κελί πίνακα ή γραμμή λίστας — ανήκει στον καταναλωτή. Απαιτούν `TooltipProvider` πρόγονο.
 */

import { AlertTriangle, ChevronDown, ChevronRight, Map, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '@/types/building/contracts';

import { FloorFloorplanInline } from '../FloorFloorplanInline';
import { FloorStairsList } from './FloorStairsList';
import type { FloorRowModel, FloorsTabState } from './floor-row-model';

interface RowProps {
  readonly row: FloorRowModel;
}

interface RowStateProps extends RowProps {
  readonly state: FloorsTabState;
}

/** Το βελάκι που ανοίγει/κλείνει την κάτοψη του ορόφου. */
export function FloorExpandButton({ row, state }: RowStateProps) {
  const { t } = useTranslation(['building-tabs']);
  return (
    <IconButton
      label={row.isExpanded ? t('tabs.floors.collapseFloor') : t('tabs.floors.expandFloor')}
      tooltipSide="right"
      aria-expanded={row.isExpanded}
      onClick={() => state.toggleFloorExpand(row.floor.id)}
    >
      {row.isExpanded
        ? <ChevronDown className="h-4 w-4 text-foreground" />
        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </IconButton>
  );
}

/** Το όνομα του ορόφου και τα σημάδια του: «ειδική στάθμη», «χωρίς κάτοψη». Αναδιπλώνεται, δεν κόβεται. */
export function FloorTitle({ row, state }: RowStateProps) {
  const { t } = useTranslation(['building-tabs']);
  const { floor } = row;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <button
        type="button"
        onClick={() => state.toggleFloorExpand(floor.id)}
        className="min-w-0 break-words text-left hover:underline"
      >
        {floor.name}
      </button>
      {row.isSpecial && (
        <Badge variant="info" className="px-1.5 py-0.5 text-[10px] font-medium">
          {t('tabs.floors.specialLevel')}
        </Badge>
      )}
      {!floor.hasFloorplan && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help" aria-label={t('tabs.floors.noFloorplan')}>
              <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--text-warning))] shrink-0" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('tabs.floors.noFloorplan')}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

/** Το ύψος όπως διαβάζεται: τιμή, «—», ή **σφάλμα** όταν ο όροφος δεν έχει ύψος (ADR-910 §3.2). */
export function FloorHeightValue({ row }: RowProps) {
  const { t } = useTranslation(['building-tabs']);
  if (row.isTooLow) {
    return (
      <span className="inline-flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('tabs.floors.storeyTooLowCell')}
      </span>
    );
  }
  return <>{row.displayHeight != null ? `${row.displayHeight.toFixed(2)} m` : '—'}</>;
}

interface FloorViewActionsProps extends RowStateProps {
  /** Το κουμπί-χάρτης του πίνακα. Στη λίστα το ίδιο κάνουν ήδη βελάκι και όνομα — τρίτο κουμπί δεν χωρά στα 390px. */
  readonly withFloorplanToggle?: boolean;
}

/** Οι πράξεις μιας γραμμής σε προβολή: (κάτοψη) · επεξεργασία · διαγραφή. */
export function FloorViewActions({ row, state, withFloorplanToggle = false }: FloorViewActionsProps) {
  const { t } = useTranslation(['building-tabs']);
  const { floor } = row;
  return (
    <nav className="flex shrink-0 justify-end gap-1">
      {withFloorplanToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleButton
              pressed={row.isExpanded}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t('tabs.floors.uploadFloorplan')}
              onClick={() => state.toggleFloorExpand(floor.id)}
            >
              <Map className="h-3.5 w-3.5" />
            </ToggleButton>
          </TooltipTrigger>
          <TooltipContent>
            {row.isExpanded ? t('tabs.floors.collapseFloor') : t('tabs.floors.uploadFloorplan')}
          </TooltipContent>
        </Tooltip>
      )}
      <IconButton label={t('tabs.floors.editFloor')} onClick={() => state.startEdit(floor)}>
        <Pencil className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label={t('tabs.floors.deleteFloor')}
        className="text-destructive hover:text-destructive"
        onClick={() => state.handleDelete(floor)}
        busy={state.deletingId === floor.id}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </IconButton>
    </nav>
  );
}

interface FloorExpandedPanelProps extends RowStateProps {
  readonly building: Building;
}

/** Ό,τι ανοίγει κάτω από τη γραμμή: η κάτοψη του ορόφου και οι σκάλες του. */
export function FloorExpandedPanel({ row, state, building }: FloorExpandedPanelProps) {
  return (
    <>
      <FloorFloorplanInline
        floorId={row.floor.id}
        floorName={row.floor.name}
        projectId={building.projectId}
        buildingCompanyId={building.companyId}
      />
      <FloorStairsList stairs={state.expandedFloorStairs} loading={state.loadingStairs} />
    </>
  );
}
