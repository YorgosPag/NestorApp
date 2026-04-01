'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { Property } from '@/types/property-viewer';
import { PropertyDetailsContent } from './details/PropertyDetailsContent';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Centralized Property Icon & Color
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

interface PropertyDetailsPanelProps {
  propertyIds: string[];
  onSelectFloor: (floorId: string | null) => void;
  properties: Property[];
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  isReadOnly?: boolean; // NEW: Read-only mode prop
}

export function PropertyDetailsPanel({
  propertyIds,
  onSelectFloor,
  properties,
  onUpdateProperty,
  isReadOnly = false // NEW: Default to false
}: PropertyDetailsPanelProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');
  // Safe check για το propertyIds - εξασφαλίζουμε ότι είναι array
  const safePropertyIds = Array.isArray(propertyIds) ? propertyIds : [];
  const safeProperties = Array.isArray(properties) ? properties : [];

  // Safe functions με fallbacks - disable updates in read-only mode
  const safeOnSelectFloor = onSelectFloor || (() => {});
  const safeOnUpdateProperty = isReadOnly ? (() => {}) : (onUpdateProperty || (() => {}));

  if (safePropertyIds.length === 0) {
    return (
      // 🏢 ENTERPRISE: No internal padding - parent CardContent handles padding
      <div className={cn("flex flex-col items-center justify-center h-full", colors.text.muted)}>
        <PropertyIcon className={`${iconSizes.xl} mb-2 ${propertyColor}`} />
        <p className="text-sm text-center">{t('detailsPanel.selectProperty')}</p>
        <p className="text-xs text-center">{t('detailsPanel.toViewDetails')}</p>
      </div>
    );
  }

  if (safePropertyIds.length > 1) {
    return (
      // 🏢 ENTERPRISE: No internal padding - parent CardContent handles padding
      <div className={cn("flex flex-col items-center justify-center h-full", colors.text.muted)}>
        <Layers className={`${iconSizes.xl} mb-2`} />
        <p className="text-sm font-medium text-center">{t('detailsPanel.propertiesSelected', { count: safePropertyIds.length })}</p>
        <p className="text-xs text-center mt-2">{t('detailsPanel.selectSingleProperty')}</p>
      </div>
    );
  }

  const propertyId = safePropertyIds[0];
  const property = safeProperties.find(p => p && p.id === propertyId);

  if (!property) {
    return (
      // 🏢 ENTERPRISE: No internal padding - parent CardContent handles padding
      <div className={cn("flex flex-col items-center justify-center h-full", colors.text.muted)}>
        <PropertyIcon className={`${iconSizes.xl} mb-2 ${propertyColor}`} />
        <p className="text-sm text-center">{t('detailsPanel.noDataFound')}</p>
        <p className="text-xs text-center">{t('detailsPanel.forSelectedProperty')}</p>
      </div>
    );
  }

  // 🏢 ADR-258D: Read-only mode uses flex layout (footer pinned to bottom) — no ScrollArea
  // Edit mode keeps ScrollArea for long form content
  if (isReadOnly) {
    return (
      <div className="h-full">
        <PropertyDetailsContent
          property={property as ExtendedPropertyDetails}
          onSelectFloor={safeOnSelectFloor}
          onUpdateProperty={safeOnUpdateProperty}
          isReadOnly
        />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <PropertyDetailsContent
        property={property as ExtendedPropertyDetails}
        onSelectFloor={safeOnSelectFloor}
        onUpdateProperty={safeOnUpdateProperty}
      />
    </ScrollArea>
  );
}