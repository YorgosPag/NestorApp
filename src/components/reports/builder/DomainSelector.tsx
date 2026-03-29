/**
 * @module components/reports/builder/DomainSelector
 * @enterprise ADR-268 — Domain Selection (Radix Select — ADR-001)
 *
 * Dropdown to choose report domain (projects, buildings, floors, units).
 */

'use client';

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  VALID_DOMAIN_IDS,
  type BuilderDomainId,
} from '@/config/report-builder/report-builder-types';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';

interface DomainSelectorProps {
  value: BuilderDomainId | null;
  onChange: (domain: BuilderDomainId) => void;
}

export function DomainSelector({ value, onChange }: DomainSelectorProps) {
  const { t } = useTranslation('report-builder-domains');
  const { t: tBuilder } = useTranslation('report-builder');

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {tBuilder('domain.select')}
      </legend>
      <Select
        value={value ?? undefined}
        onValueChange={(val) => onChange(val as BuilderDomainId)}
      >
        <SelectTrigger className="w-full max-w-sm">
          <SelectValue placeholder={tBuilder('domain.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {VALID_DOMAIN_IDS.map((id) => {
            const def = getDomainDefinition(id);
            return (
              <SelectItem key={id} value={id}>
                <span className="flex flex-col">
                  <span>{t(def.labelKey)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(def.descriptionKey)}
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </fieldset>
  );
}
