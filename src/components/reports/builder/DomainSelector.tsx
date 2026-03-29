/**
 * @module components/reports/builder/DomainSelector
 * @enterprise ADR-268 — Domain Selection (Grouped Radix Select — Q87)
 *
 * Dropdown to choose report domain, grouped by category:
 * Ακίνητα | Πρόσωπα | Ειδικότητες
 */

'use client';

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select';
import {
  VALID_DOMAIN_IDS,
  DOMAIN_GROUP_ORDER,
  type BuilderDomainId,
  type DomainGroup,
} from '@/config/report-builder/report-builder-types';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';

interface DomainSelectorProps {
  value: BuilderDomainId | null;
  onChange: (domain: BuilderDomainId) => void;
}

/** Group domains by their `group` property, preserving DOMAIN_GROUP_ORDER */
function groupDomains(): Map<DomainGroup, BuilderDomainId[]> {
  const grouped = new Map<DomainGroup, BuilderDomainId[]>();
  for (const group of DOMAIN_GROUP_ORDER) {
    grouped.set(group, []);
  }
  for (const id of VALID_DOMAIN_IDS) {
    const def = getDomainDefinition(id);
    const list = grouped.get(def.group);
    if (list) list.push(id);
  }
  return grouped;
}

export function DomainSelector({ value, onChange }: DomainSelectorProps) {
  const { t } = useTranslation('report-builder-domains');
  const { t: tBuilder } = useTranslation('report-builder');
  const grouped = groupDomains();

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
          {Array.from(grouped.entries()).map(([group, domainIds]) => {
            if (domainIds.length === 0) return null;
            return (
              <SelectGroup key={group}>
                <SelectLabel>{t(`groups.${group}`)}</SelectLabel>
                {domainIds.map((id) => {
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
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </fieldset>
  );
}
