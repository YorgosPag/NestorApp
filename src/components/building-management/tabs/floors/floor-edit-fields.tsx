'use client';

/**
 * @fileoverview **Τα πεδία επεξεργασίας ενός ορόφου** — κοινά στον πίνακα και στη λίστα (ADR-912 §5).
 * @related floor-row-model.ts · useFloorsTabState.ts (η κατάσταση επεξεργασίας ζει εκεί, όχι εδώ)
 * @module components/building-management/tabs/floors/floor-edit-fields
 *
 * 🔑 Το **πλάτος** είναι του καταναλωτή (`className`): στον πίνακα το ορίζει η στήλη, στη λίστα το πεδίο πιάνει
 * όλο το κελί του πλέγματος. Ό,τι ισχύει για την τιμή — βήμα, ελάχιστο, ποιο ύψος γράφεται — ζει εδώ, μία φορά.
 */

import { AlertTriangle } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import type { FloorRowModel, FloorsTabState } from './floor-row-model';

interface FieldProps {
  readonly state: FloorsTabState;
  readonly className?: string;
}

export function FloorNumberField({ state, className }: FieldProps) {
  return (
    <Input
      type="number"
      value={state.editNumber}
      onChange={(e) => state.handleEditNumberChange(e.target.value)}
      className={cn('h-8', className)}
      disabled={state.saving}
    />
  );
}

/** Το όνομα — με προειδοποίηση όταν δεν συμφωνεί με τον αριθμό στάθμης. */
export function FloorNameField({ state, className }: FieldProps) {
  const { t } = useTranslation(['building-tabs']);
  return (
    <>
      <Input
        value={state.editName}
        onChange={(e) => state.handleEditNameChange(e.target.value)}
        className={cn('h-8', state.editNameMismatch && getStatusColor('warning', 'border'), className)}
        disabled={state.saving}
      />
      {state.editNameMismatch && (
        // `<span>`, όχι `<p>`: στη λίστα το πεδίο ζει μέσα σε `<label>`, που δέχεται μόνο phrasing content.
        <span className={cn('mt-0.5 flex items-center gap-1 text-[10px]', getStatusColor('warning', 'text'))}>
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t('tabs.floors.mismatchWarning')}
        </span>
      )}
    </>
  );
}

export function FloorElevationField({ state, className }: FieldProps) {
  return (
    <Input
      type="number"
      step="0.01"
      value={state.editElevation}
      onChange={(e) => state.handleEditElevationChange(e.target.value)}
      placeholder="—"
      className={cn('h-8', className)}
      disabled={state.saving}
    />
  );
}

interface FloorHeightFieldProps extends FieldProps {
  readonly row: FloorRowModel;
}

/** Το ύψος: γράφεται **μόνο** όπου είναι ρητό· αλλού δείχνεται το παράγωγο, μόνο για ανάγνωση, με το γιατί. */
export function FloorHeightField({ state, row, className }: FloorHeightFieldProps) {
  const { t } = useTranslation(['building-tabs']);
  const colors = useSemanticColors();

  if (!row.isHeightDerived) {
    return (
      <Input
        type="number"
        step="0.01"
        min="0.1"
        value={state.editHeight}
        onChange={(e) => state.handleEditHeightChange(e.target.value)}
        placeholder="3.00"
        className={cn('h-8', className)}
        disabled={state.saving}
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Input
          type="number"
          step="0.01"
          value={row.derivedHeight != null ? row.derivedHeight.toFixed(2) : ''}
          readOnly
          tabIndex={-1}
          aria-label={t('tabs.floors.derivedHeightHint')}
          className={cn('h-8 cursor-help bg-muted/30', colors.text.muted, className)}
        />
      </TooltipTrigger>
      <TooltipContent>{t('tabs.floors.derivedHeightHint')}</TooltipContent>
    </Tooltip>
  );
}
