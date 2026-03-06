'use client';

/**
 * Searchable picker for the ΥΠΕΣ Public Services Registry.
 * When a user selects an entity, it auto-fills: name, supervisionMinistry, legalForm.
 * Supports free text for entities not in the registry.
 */

import React, { useCallback } from 'react';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { usePublicServiceRegistry } from '@/hooks/usePublicServiceRegistry';
import { useTranslation } from 'react-i18next';

interface PublicServicePickerProps {
  /** Current service name value */
  value: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Called when service name changes (always) */
  onNameChange: (name: string) => void;
  /** Called when a registry entry is selected (auto-fill ministry etc.) */
  onEntitySelected: (entity: {
    name: string;
    supervisingMinistry: string;
    legalForm: string;
  }) => void;
}

export function PublicServicePicker({
  value,
  disabled = false,
  onNameChange,
  onEntitySelected
}: PublicServicePickerProps) {
  const { options, findByName, isLoading } = usePublicServiceRegistry();
  const { t } = useTranslation('contacts');

  const handleValueChange = useCallback((newValue: string, option: ComboboxOption | null) => {
    onNameChange(newValue);

    // If user selected from the registry, auto-fill other fields
    if (option) {
      const entry = findByName(option.value);
      if (entry) {
        onEntitySelected({
          name: entry.name,
          supervisingMinistry: entry.supervisingMinistry,
          legalForm: entry.legalForm
        });
      }
    }
  }, [onNameChange, onEntitySelected, findByName]);

  return (
    <SearchableCombobox
      value={value}
      onValueChange={handleValueChange}
      options={options}
      placeholder={t('service.fields.name.placeholder', 'Αναζήτηση υπηρεσίας...')}
      emptyMessage={t('service.registryEmpty', 'Δεν βρέθηκε — πληκτρολογήστε ελεύθερα')}
      isLoading={isLoading}
      allowFreeText
      disabled={disabled}
      maxDisplayed={30}
    />
  );
}
