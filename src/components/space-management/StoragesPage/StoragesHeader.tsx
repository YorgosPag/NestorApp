'use client';

import React from 'react';
import { Warehouse, Filter, Trash2 } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import type { ViewMode } from '@/core/headers';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Breadcrumb navigation
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';
// 🏢 ENTERPRISE: Type for Storages view modes (avoids `as any`)
type StoragesViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

interface StoragesHeaderProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  // Trash view toggle (ADR-281)
  showTrash?: boolean;
  onToggleTrash?: () => void;
  trashCount?: number;
}

export function StoragesHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  showTrash,
  onToggleTrash,
  trashCount = 0,
}: StoragesHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['storage', 'trash']);
  const iconSizes = useIconSizes();
  const { quick, radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: Warehouse,
        title: t('storages.header.title'),
        subtitle: t('storages.header.subtitle')
      }}
      breadcrumb={<NavigationBreadcrumb />}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: t('storages.header.searchPlaceholder')
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as StoragesViewMode),
        viewModes: ['list', 'grid', 'byType', 'byStatus'] as ViewMode[],
        customActions: [
          ...(setShowFilters ? [
            <button
              key="mobile-filter"
              onClick={() => setShowFilters(!showFilters)}
              className={`md:hidden p-2 ${radius.md} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                showFilters
                  ? `bg-primary text-primary-foreground ${quick.focus}`
                  : `${colors.bg.primary} ${quick.input} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
              }`}
              aria-label={t('storages.accessibility.toggleFilters')}
            >
              <Filter className={iconSizes.sm} />
            </button>
          ] : []),
          ...(onToggleTrash ? [
            <button
              key="trash-toggle"
              onClick={onToggleTrash}
              className={`relative p-2 ${quick.button} transition-colors ${
                showTrash
                  ? `bg-destructive/10 text-destructive ${getStatusBorder('default')}`
                  : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
              }`}
              aria-label={t('trashView', { ns: 'trash' })}
              aria-pressed={showTrash}
            >
              <Trash2 className={iconSizes.sm} />
              {trashCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
                  {trashCount > 99 ? '99+' : trashCount}
                </span>
              )}
            </button>
          ] : []),
        ].filter(Boolean)
      }}
    />
  );
}