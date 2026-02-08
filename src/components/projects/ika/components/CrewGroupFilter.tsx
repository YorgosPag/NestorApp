'use client';

/**
 * =============================================================================
 * CrewGroupFilter — Filter workers by crew (company)
 * =============================================================================
 *
 * Dropdown that filters the attendance view by crew/company.
 * Enterprise pattern: Procore-style crew grouping for construction sites.
 *
 * @module components/projects/ika/components/CrewGroupFilter
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 * @compliance ADR-001 — Uses Radix Select (canonical dropdown)
 */

import React from 'react';
import { Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { CrewGroup } from '../contracts';

/** Sentinel value for "all crews" filter */
const ALL_CREWS_VALUE = '__all__';

interface CrewGroupFilterProps {
  /** Available crew groups */
  crews: CrewGroup[];
  /** Currently selected crew company ID (null = all) */
  selectedCrewId: string | null;
  /** Callback when selection changes */
  onChange: (crewId: string | null) => void;
}

export function CrewGroupFilter({ crews, selectedCrewId, onChange }: CrewGroupFilterProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  // Don't render if only one or no crews
  if (crews.length <= 1) return null;

  const handleChange = (value: string) => {
    onChange(value === ALL_CREWS_VALUE ? null : value);
  };

  return (
    <div className={cn('flex items-center', spacing.gap.sm)}>
      <Users className={cn(iconSizes.sm, 'text-muted-foreground')} />
      <Select
        value={selectedCrewId ?? ALL_CREWS_VALUE}
        onValueChange={handleChange}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder={t('ika.timesheetTab.crews.allCrews')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CREWS_VALUE}>
            {t('ika.timesheetTab.crews.allCrews')}
          </SelectItem>
          {crews.map((crew) => {
            const crewKey = crew.companyContactId ?? '__independent__';
            return (
              <SelectItem key={crewKey} value={crewKey}>
                {crew.companyName} ({crew.presentCount}/{crew.totalCount})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
