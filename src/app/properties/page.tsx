'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PropertyGridView } from '@/features/property-grid/PropertyGridView';
import { PropertyManagementPageContent } from '@/components/property-management/PropertyManagementPageContent';
import { StaticPageLoading } from '@/core/states';

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

export default function PropertiesPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <PropertiesPageContent />
    </Suspense>
  );
}
