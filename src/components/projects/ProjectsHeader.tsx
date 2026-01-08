'use client';

import React from 'react';
import { Filter } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageHeader } from '@/core/headers';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { ViewMode } from '@/core/headers';

interface ProjectsHeaderProps {
  viewMode: 'list' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  onNewProject?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  // 🏢 ENTERPRISE COUNT DISPLAY
  projectCount?: number;
}

export function ProjectsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  onNewProject,
  showFilters,
  setShowFilters,
  projectCount,
}: ProjectsHeaderProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: NAVIGATION_ENTITIES.building.icon,
        title: `Διαχείριση Έργων${projectCount !== undefined ? ` (${projectCount})` : ''}`,
        subtitle: "Παρακολούθηση και διαχείριση έργων"
      }}
      search={searchTerm !== undefined && setSearchTerm ? {
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Αναζήτηση έργων..."
      } : undefined}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as any),
        viewModes: ['list', 'byType', 'byStatus'] as ViewMode[],
        addButton: {
          label: 'Νέο Έργο',
          onClick: () => onNewProject?.() || console.log('Add project')
        },
        // Mobile-only filter button
        customActions: setShowFilters ? [
          <button
            key="mobile-filter"
            onClick={() => setShowFilters(!showFilters)}
            className={`md:hidden p-2 ${quick.button} transition-colors ${
              showFilters
                ? `bg-primary text-primary-foreground ${getStatusBorder('default')}`
                : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
            }`}
            aria-label="Toggle filters"
          >
            <Filter className={iconSizes.sm} />
          </button>
        ] : undefined
      }}
    />
  );
}
