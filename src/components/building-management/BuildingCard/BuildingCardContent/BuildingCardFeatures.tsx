'use client';

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized building features translation utility
import { translateBuildingFeature } from '@/utils/building-features-i18n';

interface BuildingCardFeaturesProps {
  features?: string[];
}

export function BuildingCardFeatures({ features }: BuildingCardFeaturesProps) {
  // 🏢 ENTERPRISE: i18n hook for translations with namespace readiness check
  const { t, isNamespaceReady } = useTranslation('building');

  // 🏢 ENTERPRISE: Memoized translation function using centralized utility
  const translateFeature = useMemo(() => {
    return (feature: string): string => {
      return translateBuildingFeature(feature, t, isNamespaceReady);
    };
  }, [t, isNamespaceReady]);

  if (!features || features.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pt-2">
      {features.slice(0, 3).map((feature, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="text-xs px-2 py-0.5 rounded-full"
        >
          {translateFeature(feature)}
        </Badge>
      ))}
      {features.length > 3 && (
        <Badge
          variant="secondary"
          className="text-xs px-2 py-0.5 rounded-full"
        >
          +{features.length - 3}
        </Badge>
      )}
    </div>
  );
}
