'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox-types';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

interface VendorContact {
  id: string;
  displayName: string;
  email: string | null;
}

interface VendorPickerSectionProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VendorPickerSection({ value, onChange }: VendorPickerSectionProps) {
  const { t } = useTranslation('quotes');
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  const [pickerValue, setPickerValue] = useState('');

  useEffect(() => {
    fetch('/api/rfqs/new/vendor-contacts')
      .then((r) => r.json())
      .then((json) => setContacts((json.data ?? []) as VendorContact[]))
      .catch(() => {/* non-blocking */});
  }, []);

  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const options: ComboboxOption[] = contacts
    .filter((c) => !value.includes(c.id))
    .map((c) => ({
      value: c.id,
      label: c.displayName,
      secondaryLabel: c.email ?? undefined,
    }));

  const handlePick = useCallback(
    (id: string) => {
      if (!id || value.includes(id)) { setPickerValue(''); return; }
      onChange([...value, id]);
      setPickerValue('');
    },
    [value, onChange],
  );

  const handleRemove = useCallback(
    (id: string) => onChange(value.filter((v) => v !== id)),
    [value, onChange],
  );

  return (
    <section className="space-y-2">
      <Label>{t('rfqs.vendorPicker.label')}</Label>

      <SearchableCombobox
        value={pickerValue}
        onValueChange={handlePick}
        options={options}
        placeholder={t('rfqs.vendorPicker.placeholder')}
        emptyMessage={t('rfqs.vendorPicker.empty')}
      />

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const name = contactMap.get(id)?.displayName ?? id;
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-full p-0 hover:bg-transparent"
                  onClick={() => handleRemove(id)}
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('rfqs.vendorPicker.noSelected')}</p>
      )}
    </section>
  );
}
