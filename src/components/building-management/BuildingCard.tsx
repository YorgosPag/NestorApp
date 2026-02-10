
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Building } from './BuildingsPageContent';
import { COMPLEX_HOVER_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { EntityDetailsHeader } from '@/core/entity-headers';
import { BuildingCardContent } from './BuildingCard/BuildingCardContent';
import { BuildingCardTimeline } from './BuildingCard/BuildingCardTimeline';
// 🏢 ENTERPRISE: Only import non-i18n utilities - labels come from centralized i18n
import { getCategoryIcon } from './BuildingCard/BuildingCardUtils';


interface BuildingCardProps {
  building: Building;
  isSelected: boolean;
  onClick: () => void;
}

export function BuildingCard({
  building,
  isSelected,
  onClick,
}: BuildingCardProps) {
  // 🏢 ENTERPRISE: i18n hook for translations with namespace readiness check
  const { t, isNamespaceReady } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const CategoryIcon = getCategoryIcon(building.category || 'mixed');

  return (
    <Card
      className={cn(
        `relative overflow-hidden cursor-pointer group ${quick.card}`,
        // Use centralized border token
        "",
        COMPLEX_HOVER_EFFECTS.FEATURE_CARD,
        isSelected
          ? `${getStatusBorder('info')} shadow-lg ring-2 ring-blue-200 dark:ring-blue-800`
          : "border-border"
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* EntityDetailsHeader instead of complex visual header */}
      <EntityDetailsHeader
        icon={CategoryIcon}
        title={building.name}
        badges={[
          {
            type: 'status',
            // 🏢 ENTERPRISE: Using centralized i18n translations with namespace readiness
            value: isNamespaceReady
              ? t(`status.${building.status}`, { defaultValue: building.status })
              : building.status,
            size: 'sm'
          },
          {
            type: 'progress',
            // 🏢 ENTERPRISE: Fallback to raw percent when namespace not ready
            value: isNamespaceReady
              ? t('details.percentComplete', { percent: building.progress ?? 0 })
              : `${building.progress ?? 0}%`,
            variant: 'secondary',
            size: 'sm'
          }
        ]}
        actions={[
          {
            label: isFavorite ? t('actions.removeFromFavorites') : t('actions.addToFavorites'),
            icon: Star,
            onClick: () => {
              setIsFavorite(!isFavorite);
            },
            variant: 'ghost',
            className: cn(
              `${iconSizes.lg} p-0`,
              isFavorite ? 'text-yellow-500 fill-current' : 'text-muted-foreground'
            )
          }
        ]}
        variant="compact"
        className={quick.borderB}
      />
      
      <BuildingCardContent
        building={building}
      />

      <BuildingCardTimeline
        building={building}
      />

      {/* Hover overlay effect */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none transition-opacity duration-300",
        isHovered ? "opacity-100" : "opacity-0"
      )} />

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600" />
      )}
    </Card>
  );
}
