'use client';

/**
 * PODeliveryAddressField — Delivery address picker by type
 *
 * Address type selector + free text override.
 * User picks a type (Εργοτάξιο, Είσοδος, Παράδοση, ...) → autofill
 * il valore con l'indirizzo del progetto selezionato di quel tipo.
 *
 * @see ADR-267 §Phase D — Entity Selectors (delivery address by type)
 */

import { useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import {
  formatAddressLine,
  formatAddressType,
} from '@/types/project/address-helpers';
import type {
  ProjectAddress,
  ProjectAddressType,
} from '@/types/project/addresses';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PODeliveryAddressFieldProps {
  projectId: string;
  value: string;
  onChange: (next: string) => void;
}

const NO_TYPE_VALUE = '__none__';

export function PODeliveryAddressField({
  projectId,
  value,
  onChange,
}: PODeliveryAddressFieldProps) {
  const { t } = useTranslation('procurement');
  const { projects } = useFirestoreProjects();

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const addresses: ProjectAddress[] = useMemo(
    () => (project?.addresses ?? []) as ProjectAddress[],
    [project],
  );

  // Solo i tipi presenti negli addresses del progetto (no opzioni vuote)
  const availableTypes = useMemo<ProjectAddressType[]>(() => {
    const set = new Set<ProjectAddressType>();
    for (const a of addresses) set.add(a.type);
    return Array.from(set);
  }, [addresses]);

  const handleTypeSelect = useCallback(
    (type: string) => {
      if (type === NO_TYPE_VALUE) {
        onChange('');
        return;
      }
      const candidates = addresses.filter((a) => a.type === type);
      const chosen =
        candidates.find((a) => a.isPrimary) ?? candidates[0] ?? null;
      if (chosen) onChange(formatAddressLine(chosen));
    },
    [addresses, onChange],
  );

  const hasProject = !!project;
  const hasOptions = availableTypes.length > 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr] md:gap-4">
      <div className="space-y-1.5">
        <Label>{t('form.deliveryAddressType')}</Label>
        <Select
          value=""
          onValueChange={handleTypeSelect}
          disabled={!hasProject || !hasOptions}
        >
          <SelectTrigger
            aria-label={t('form.deliveryAddressType')}
            disabled={!hasProject || !hasOptions}
          >
            <SelectValue
              placeholder={
                !hasProject
                  ? t('form.deliveryAddressTypeNoProject')
                  : !hasOptions
                  ? t('form.deliveryAddressTypeNoOptions')
                  : t('form.deliveryAddressTypePlaceholder')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {formatAddressType(type)}
              </SelectItem>
            ))}
            <SelectItem value={NO_TYPE_VALUE}>
              {t('form.deliveryAddressTypeClear')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t('form.deliveryAddress')}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('form.deliveryPlaceholder')}
        />
      </div>
    </div>
  );
}
