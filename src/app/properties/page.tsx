'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PropertyGridView } from '@/features/property-grid/PropertyGridView';
import { PropertyManagementPageContent } from '@/components/property-management/PropertyManagementPageContent';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';

function PropertiesPageContent() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const selectedId = searchParams.get('selected');
  
  // Default to grid view, unless floorplan is explicitly requested
  const [currentView, setCurrentView] = useState(viewParam === 'floorplan' ? 'floorplan' : 'grid');
  
  useEffect(() => {
    // Update view when URL params change
    if (viewParam === 'floorplan') {
      setCurrentView('floorplan');
    } else {
      setCurrentView('grid');
    }
  }, [viewParam]);
  
  // Show PropertyGridView by default, PropertyManagementPageContent for floorplan
  if (currentView === 'floorplan') {
    return <PropertyManagementPageContent />;
  }
  
  return <PropertyGridView />;
}

function PropertiesPageFallback() {
  const colors = useSemanticColors();

  return (
    <div className={`min-h-screen ${colors.bg.secondary} ${colors.bg.primary} flex items-center justify-center`}>
      <div className="text-center">
        <AnimatedSpinner size="large" className="mx-auto mb-4" />
        <p className="text-gray-600 dark:text-muted-foreground">Φόρτωση ακινήτων...</p>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={<PropertiesPageFallback />}>
      <PropertiesPageContent />
    </Suspense>
  );
}
