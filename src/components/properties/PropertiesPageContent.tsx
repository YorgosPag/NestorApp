"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { PropertyGridView } from '@/features/property-grid/PropertyGridView';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// Loading component for dynamic import
const LoadingComponent = () => {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const colors = useSemanticColors();
  return (
    <div className={`min-h-screen ${colors.bg.secondary} dark:${colors.bg.primary} flex items-center justify-center`}>
      <div className="text-center">
        <AnimatedSpinner size="large" className="mx-auto mb-4" />
        <p className={colors.text.muted}>{t('page.loading')}</p>
      </div>
    </div>
  );
};

// Dynamically import the floorplan viewer with layers (ADR-237: interactive overlays)
const PropertyFloorplanViewer = dynamic(
  () => import('@/components/property-management/PropertyManagementPageContent').then(mod => ({ default: mod.PropertyManagementPageContent })),
  {
    loading: () => <LoadingComponent />,
    ssr: false
  }
);

export const PropertiesPageContent = () => {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');

  // If floorplan view is requested, show the property viewer with layers + interactive overlays
  if (viewParam === 'floorplan') {
    return <PropertyFloorplanViewer />;
  }

  // Otherwise, show the property grid view
  return <PropertyGridView />;
};

export default PropertiesPageContent;