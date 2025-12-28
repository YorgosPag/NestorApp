'use client';

/**
 * Adaptive Multi-Column Navigation Component (Refactored)
 * Clean orchestrator using modular components and hooks
 * Desktop: Multi-column layout (Finder-style)
 * Mobile: Drill-down navigation with back stack
 */
import React from 'react';
import { useNavigation } from '../core/NavigationContext';
import { useNavigationHandlers } from '../hooks/useNavigationHandlers';
import { NavigationCompanyManager } from './NavigationCompanyManager';
import { MobileNavigation } from './MobileNavigation';
import { DesktopMultiColumn } from './DesktopMultiColumn';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

interface AdaptiveMultiColumnNavigationProps {
  className?: string;
}

export function AdaptiveMultiColumnNavigation({ className }: AdaptiveMultiColumnNavigationProps) {
  const { loading, error, companies } = useNavigation();

  // Navigation handlers hook
  const {
    mobileLevel,
    handleCompanySelect,
    handleProjectSelect,
    handleBuildingSelect,
    handleFloorSelect,
    handleUnitSelect,
    handleNavigateToPage,
    handleMobileBack,
    getMobileTitle
  } = useNavigationHandlers();

  // Loading and error states
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 dark:text-red-400 mb-4">Σφάλμα: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className={`px-4 py-2 text-white rounded-lg ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
        >
          Ξαναδοκιμή
        </button>
      </div>
    );
  }

  return (
    <div className={`${className || ''}`}>
      <NavigationCompanyManager companies={companies}>
        {({ isContactsModalOpen, setIsContactsModalOpen, handleCompanySelected, navigationCompanyIds }) => (
          <>
            {/* Mobile Navigation */}
            <MobileNavigation
              mobileLevel={mobileLevel}
              onBack={handleMobileBack}
              getTitle={getMobileTitle}
              onCompanySelect={handleCompanySelect}
              onProjectSelect={handleProjectSelect}
              onBuildingSelect={handleBuildingSelect}
              onFloorSelect={handleFloorSelect}
              onUnitSelect={handleUnitSelect}
              onNavigateToPage={handleNavigateToPage}
              navigationCompanyIds={navigationCompanyIds}
            />

            {/* Desktop Multi-Column Navigation */}
            <DesktopMultiColumn
              onCompanySelect={handleCompanySelect}
              onProjectSelect={handleProjectSelect}
              onBuildingSelect={handleBuildingSelect}
              onFloorSelect={handleFloorSelect}
              onNavigateToPage={handleNavigateToPage}
              onAddCompanyClick={() => setIsContactsModalOpen(true)}
              navigationCompanyIds={navigationCompanyIds}
            />
          </>
        )}
      </NavigationCompanyManager>
    </div>
  );
}

export default AdaptiveMultiColumnNavigation;