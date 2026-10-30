'use client';
import { PropertyBadge } from '@/core/badges';
import type { PropertyStatus } from '@/core/types/BadgeTypes';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Type-safe props with PropertyStatus
interface PropertyHoverHeaderProps {
  name: string;
  type: string;
  building: string;
  statusLabel: string;
  statusColor: string;
  status?: PropertyStatus;
}

export function PropertyHoverHeader({
  name,
  type,
  building,
  statusLabel: _statusLabel,
  statusColor,
  status = 'for-sale'
}: PropertyHoverHeaderProps) {
  const { t } = useTranslation('properties');
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Translate unit type (apartment → Διαμέρισμα) — SSoT: filters.types
  const translatedType = t(`filters.types.${type}`, { defaultValue: type });

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h4 className="font-semibold text-sm leading-tight">{name}</h4>
          <span className={cn("text-xs font-normal", colors.text.muted)}>{translatedType} • {building}</span>
        </div>
        <PropertyBadge
          status={status}
          variant="outline"
          size="sm"
          className={cn("text-xs flex-shrink-0", statusColor)}
        />
      </div>
    </div>
  );
}
