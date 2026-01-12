"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { PropertyGridViewCompatible as PropertyGridView } from '@/components/property-viewer/PropertyGrid';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// Loading component for dynamic import
const LoadingComponent = () => {
  const { t } = useTranslation('units');
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

// Dynamically import the Units page content
const UnitsPageContent = dynamic(
  () => import('@/app/units/page').then(mod => ({ default: mod.default })),
  {
    loading: () => <LoadingComponent />,
    ssr: false
  }
);

export const PropertiesPageContent = () => {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');

  // If floorplan view is requested, show the Units page (which has the floorplan viewer)
  if (viewParam === 'floorplan') {
    return <UnitsPageContent />;
  }

  // Otherwise, show the property grid view
  return <PropertyGridView />;
};

export default PropertiesPageContent;