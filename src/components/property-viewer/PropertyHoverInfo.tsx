'use client';

import { MousePointer } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;
import { Separator } from '@/components/ui/separator';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { PropertyQuickView } from '@/features/property-hover/components/PropertyQuickView';
import { PropertyHoverInstruction } from '@/features/property-hover/components/PropertyHoverInstruction';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property } from '@/types/property-viewer';
import { useHoveredProperty } from '@/features/property-hover/hooks/useHoveredProperty';
import '@/lib/design-system';

interface PropertyHoverInfoProps {
  propertyId: string | null;
  properties: Property[];
}

export function PropertyHoverInfo({ propertyId, properties }: PropertyHoverInfoProps) {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  const property = useHoveredProperty(propertyId, properties);
  const { t } = useTranslation('properties');

  if (!propertyId) {
    return (
      <div className={cn(`flex flex-col items-center justify-center h-full ${spacing.padding.sm}`, colors.text.muted)}>
        <MousePointer className={`${iconSizes.md} mb-2`} />
        <p className="text-xs text-center">{t('hoverInfo.hoverMouse')}</p>
        <p className="text-xs text-center">{t('hoverInfo.overProperty')}</p>
        <p className="text-xs text-center mt-1 opacity-70">{t('hoverInfo.onFloorPlanToSee')}</p>
        <p className="text-xs text-center opacity-70">{t('hoverInfo.quickInfo')}</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className={cn(`flex flex-col items-center justify-center h-full ${spacing.padding.sm}`, colors.text.muted)}>
        <UnitIcon className={`${iconSizes.md} mb-2 ${unitColor}`} />
        <p className="text-xs text-center">{t('hoverInfo.noDataFound')}</p>
        <p className="text-xs text-center">{t('hoverInfo.forThisProperty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 animate-fade-in">
      {/* Content — shared PropertyQuickView (SSoT with Επιλεγμένο Ακίνητο) */}
      <div className="flex-1">
        <PropertyQuickView property={property} />
      </div>

      {/* Footer — pinned to bottom */}
      <div className="shrink-0 pt-1">
        <Separator className="mb-1" />
        <PropertyHoverInstruction />
      </div>
    </div>
  );
}
