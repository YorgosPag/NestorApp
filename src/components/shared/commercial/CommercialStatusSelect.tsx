'use client';

/**
 * =============================================================================
 * CommercialStatusSelect — η ΔΙΑΘΕΣΗ ενός ακινήτου ή χώρου
 * =============================================================================
 *
 * **Ένας** επιλογέας για ακίνητα, θέσεις στάθμευσης και αποθήκες (ADR-777 §8.60.18). Ήταν
 * γραμμένος μόνο μέσα στη φόρμα ακινήτου, με τοπική λίστα επιλογών.
 *
 * Προσφέρει **μόνο** τις καταστάσεις του επεξεργαστή (`EDITOR_COMMERCIAL_STATUSES`): εκτός
 * αγοράς · πώληση · ενοικίαση · πώληση και ενοικίαση. Κράτηση, πώληση και μίσθωση είναι
 * **συναλλαγές** (διάλογοι πωλήσεων) — και ο server αρνείται ό,τι λείπει από εδώ.
 *
 * ⚠️ Όταν η τρέχουσα κατάσταση την **κατέχει συναλλαγή**, ο επιλογέας τη δείχνει αλλά
 * **κλειδώνει** (`locked`): ο άνθρωπος βλέπει «Πωλήθηκε», δεν μπορεί να το αλλάξει από εδώ.
 *
 * @module components/shared/commercial/CommercialStatusSelect
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  EDITOR_COMMERCIAL_STATUSES,
  isEditorCommercialStatus,
  normalizeCommercialStatus,
  type CommercialStatus,
} from '@/constants/commercial-statuses';

export interface CommercialStatusSelectProps {
  readonly id: string;
  readonly value: CommercialStatus;
  readonly onValueChange: (status: CommercialStatus) => void;
  readonly disabled: boolean;
  /** `true` σε πυκνό πίνακα: η ετικέτα μένει μόνο για τους αναγνώστες οθόνης. */
  readonly compact?: boolean;
}

export function CommercialStatusSelect({
  id,
  value,
  onValueChange,
  disabled,
  compact = false,
}: CommercialStatusSelectProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(['properties-detail', 'properties-enums']);
  // Κατάσταση συναλλαγής ⇒ ορατή, κλειδωμένη. Μπαίνει ως επιλογή ώστε να έχει ετικέτα.
  const locked = !isEditorCommercialStatus(value);
  const options: readonly CommercialStatus[] = locked
    ? [value, ...EDITOR_COMMERCIAL_STATUSES]
    : EDITOR_COMMERCIAL_STATUSES;

  return (
    <>
      <Label htmlFor={id} className={cn('text-xs', colors.text.muted, compact && 'sr-only')}>
        {t('properties-detail:fields.identity.commercialStatus')}
      </Label>
      <Select
        value={value}
        disabled={disabled || locked}
        onValueChange={(next) => {
          const status = normalizeCommercialStatus(next);
          if (status) onValueChange(status);
        }}
      >
        <SelectTrigger id={id} size="sm">
          <SelectValue placeholder={t('properties-detail:fields.identity.commercialStatusPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((status) => (
            <SelectItem key={status} value={status} className="text-xs">
              {t(`properties-enums:commercialStatus.${status}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
