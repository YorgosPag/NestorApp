/**
 * @related ADR-186 §8 Q3 — Optional ΝΟΚ zone dropdown
 *
 * Shows the 15 canonical zones from `ZONE_PARAMETERS` plus a "no zone" entry.
 * Selecting a zone triggers parent auto-fill of ΣΔ / coverage / height in
 * `useProjectBuildingCode.setZoneId`.
 */
'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ZONE_PARAMETERS } from '@/services/building-code/constants/zones.constants';

interface ZoneSelectorProps {
  value: string | null;
  onChange(value: string | null): void;
  disabled?: boolean;
}

export function ZoneSelector({ value, onChange, disabled = false }: ZoneSelectorProps) {
  const { t } = useTranslation('buildingCode');
  const zoneIds = Object.keys(ZONE_PARAMETERS);

  const handleChange = (next: string) => {
    if (next === SELECT_CLEAR_VALUE) {
      onChange(null);
      return;
    }
    onChange(next);
  };

  return (
    <Select
      value={value ?? SELECT_CLEAR_VALUE}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger aria-label={t('zone.label')}>
        <SelectValue placeholder={t('zone.placeholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SELECT_CLEAR_VALUE}>{t('zone.none')}</SelectItem>
        {zoneIds.map((id) => {
          const zone = ZONE_PARAMETERS[id]!;
          return (
            <SelectItem key={id} value={id}>
              {t('zone.displayName', { id, name: zone.displayName })}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
