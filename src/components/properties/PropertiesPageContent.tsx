"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
import { PropertyGridView } from '@/features/property-grid/PropertyGridView';

// Dynamically import the Units page content
const UnitsPageContent = dynamic(
  () => import('@/app/units/page').then(mod => ({ default: mod.default })),
  {
    loading: () => (
      <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <AnimatedSpinner size="large" className="mx-auto mb-4" />
          <p className="text-gray-600 dark:text-muted-foreground">Φόρτωση μονάδων...</p>
        </div>
      </div>
    ),
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