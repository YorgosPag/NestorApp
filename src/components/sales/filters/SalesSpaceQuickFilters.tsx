'use client';

/**
 * @fileoverview Οι γρήγορες επιλογές των σελίδων πωλήσεων ΧΩΡΩΝ (θέσεις · αποθήκες)
 * @description Δύο σειρές: διάθεση (ίδιες επιλογές παντού — `SPACE_AVAILABILITY_QUICK_OPTIONS`) +
 *   τύπος (δικός του ανά χώρο). Ήταν δύο σχεδόν ίδια components (`ParkingQuickFilters` /
 *   `StorageQuickFilters`)· το `jscpd:diff` (CHECK 3.28) τα έπιασε όταν η ADR-777 §8.60.20 άγγιξε
 *   και τα δύο.
 */

import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { TypeQuickFilters, type TypeFilterOption } from '@/components/shared/TypeQuickFilters';
import { SPACE_AVAILABILITY_QUICK_OPTIONS } from '@/components/shared/SpaceStatusQuickFilters';
import '@/lib/design-system';

/** Ό,τι δίνει ο καλών — η επιλογή διάθεσης και τύπου, ως μία τιμή ή `'all'`. */
export interface SalesSpaceQuickFilterSelection {
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  className?: string;
}

/** Το «όλοι» της σειράς τύπων — ίδιο για κάθε χώρο. */
const ALL_TYPES_OPTION: TypeFilterOption = {
  value: 'all', label: 'common:filters.all', icon: LayoutGrid, tooltip: 'common:filters.all',
};

export interface SalesSpaceQuickFiltersProps extends SalesSpaceQuickFilterSelection {
  /** Οι τύποι του χώρου — **χωρίς** το «όλοι» (το προσθέτει το component). */
  readonly typeOptions: TypeFilterOption[];
  /** Ήδη μεταφρασμένες. */
  readonly ariaLabels: { readonly status: string; readonly type: string };
}

/** Μονή επιλογή πάνω σε `TypeQuickFilters` (πολλαπλής): κενό ⇒ `'all'`. */
function single(onChange: (value: string) => void) {
  return (values: string[]) => onChange(values.length === 0 ? 'all' : values[0]);
}

export function SalesSpaceQuickFilters({
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
  className,
  typeOptions,
  ariaLabels,
}: SalesSpaceQuickFiltersProps) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <TypeQuickFilters
        options={SPACE_AVAILABILITY_QUICK_OPTIONS}
        selectedTypes={selectedStatus === 'all' ? [] : [selectedStatus]}
        onTypeChange={single(onStatusChange)}
        compact
        ariaLabel={ariaLabels.status}
      />
      <TypeQuickFilters
        options={[ALL_TYPES_OPTION, ...typeOptions]}
        selectedTypes={selectedType === 'all' ? [] : [selectedType]}
        onTypeChange={single(onTypeChange)}
        compact
        ariaLabel={ariaLabels.type}
      />
    </div>
  );
}
