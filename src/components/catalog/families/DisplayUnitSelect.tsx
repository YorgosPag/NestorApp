'use client';

/**
 * @fileoverview **Μονάδα προβολής** μιας μέτρησης — η προεπιλεγμένη της ιδιότητας ή μια μονάδα της οικογένειας μέτρησής της
 *   (ADR-923 §21 · §21.6). Κοινό για γραμμή πίνακα και μέρος σύνθετης ένδειξης: ο ίδιος κανόνας (`measurementInUnit`).
 * @module components/catalog/families/DisplayUnitSelect
 *
 * Δεν αποδίδεται τίποτα όταν η ιδιότητα δεν είναι μέτρηση — η μονάδα δεν έχει νόημα εκεί.
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import { useCatalogText } from '../shared/catalog-ui-hooks';

const DEFAULT_UNIT = 'default';

export function DisplayUnitSelect({ attributeId, value, library, disabled, onChange }: {
  readonly attributeId: string;
  readonly value: string | null;
  readonly library: CatalogLibrary;
  readonly disabled: boolean;
  readonly onChange: (unitCode: string | null) => void;
}) {
  const { t } = useCatalogText();
  const attribute = library.attributeById.get(attributeId);
  const unitFamily = attribute?.type === 'measurement' ? library.registry.get(attribute.config.measurementFamilyCode) : undefined;
  if (!unitFamily) return null;
  return (
    <Select value={value ?? DEFAULT_UNIT} disabled={disabled} onValueChange={(unit) => onChange(unit === DEFAULT_UNIT ? null : unit)}>
      <SelectTrigger className="w-32" aria-label={t('families.table.displayUnit')}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_UNIT}>{t('families.table.defaultUnit')}</SelectItem>
        {unitFamily.units.map((unit) => <SelectItem key={unit.code} value={unit.code}>{unit.symbol}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
