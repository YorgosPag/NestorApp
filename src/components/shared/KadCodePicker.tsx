'use client';

/**
 * ============================================================================
 * KAD Code Picker — ο ΕΝΑΣ επιλογέας ΚΑΔ (επαφές + λογιστήριο)
 * ============================================================================
 *
 * Κατάλογος: **ΚΑΔ 2025** (ΑΑΔΕ Α.1003/2026, Παράρτημα Ι — ΦΕΚ Β΄ 235/22.01.2026), μέσω `useKadOptions`.
 *
 * 🔑 **Δέσμευση μόνο με πρόθεση** (commit-on-select): η πληκτρολόγηση ΦΙΛΤΡΑΡΕΙ· το `onChange` καλείται
 * όταν επιλεγεί γραμμή, ή όταν επικολλημένο/πληκτρολογημένο κείμενο επιλύεται ΑΚΡΙΒΩΣ σε ΚΑΔ
 * (`useKadTextCommit`) — ποτέ ανά πάτημα. Καμία ελεύθερη τιμή.
 *
 * 🔑 **Τιμή χωρίς σημαία καταλόγου = ΚΑΔ 2008**: δείχνεται αυτούσια με σήμα «απαιτεί αντιστοίχιση»
 * και δεν ξαναγράφεται ποτέ σιωπηλά — μόνο όταν ο άνθρωπος διαλέξει νέο ΚΑΔ.
 *
 * @module components/shared/KadCodePicker
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { SearchableCombobox, type ComboboxOption, type FieldAccessibleName } from '@/components/ui/searchable-combobox';
import { useKadOptions } from '@/hooks/useKadOptions';
import { isLegacyKadValue, toKadSelection } from '@/lib/kad/kad-resolve';
import { KAD_CATALOG_VERSION, type KadCatalogEntry, type KadSelection } from '@/lib/kad/kad-types';
import { useKadTextCommit } from './useKadTextCommit';

interface KadCodePickerOwnProps {
  /** Ο αποθηκευμένος κωδικός (με τελείες). */
  value: string;
  /** Η σημαία καταλόγου της αποθηκευμένης τιμής — απουσία ⇒ ΚΑΔ 2008. */
  catalog?: string;
  disabled?: boolean;
  error?: string;
  /** Νέα επιλογή από τον κατάλογο· `null` = ο άνθρωπος καθάρισε το πεδίο. */
  onChange: (selection: KadSelection | null) => void;
}

/** Own props + the combobox NAME, forwarded untouched (ADR-598 G11 · `FieldAccessibleName`). */
export type KadCodePickerProps = KadCodePickerOwnProps & FieldAccessibleName;

export function KadCodePicker({ value, catalog: valueCatalog, disabled = false, error, onChange, ...accessibleName }: KadCodePickerProps) {
  const { t } = useTranslation('forms');
  const { options, isLoading, catalog } = useKadOptions();

  const isCurrent = useCallback(
    (entry: KadCatalogEntry) => entry.code === value && valueCatalog === KAD_CATALOG_VERSION,
    [value, valueCatalog],
  );
  const commit = useCallback((entry: KadCatalogEntry) => onChange(toKadSelection(entry)), [onChange]);
  const textCommit = useKadTextCommit(catalog, isCurrent, commit);

  const handleValueChange = useCallback(
    (selectedValue: string, option: ComboboxOption | null) => {
      if (option === null) {
        if (selectedValue === '') onChange(null);
        return;
      }
      const entry = catalog.byCode.get(selectedValue);
      if (entry && !isCurrent(entry)) commit(entry);
    },
    [catalog, isCurrent, commit, onChange],
  );

  const legacy = !isLoading && isLegacyKadValue({ code: value, catalog: valueCatalog });

  return (
    <div className="space-y-1" {...textCommit}>
      <SearchableCombobox
        {...accessibleName}
        value={value}
        onValueChange={handleValueChange}
        options={options}
        placeholder={t('kad.searchPlaceholder')}
        emptyMessage={t('kad.noResults')}
        isLoading={isLoading}
        maxDisplayed={30}
        disabled={disabled}
        error={error}
      />
      {legacy && (
        <p>
          <Badge variant="warning">{t('kad.legacyBadge')}</Badge>
        </p>
      )}
    </div>
  );
}

export default KadCodePicker;
