'use client';

import '@/lib/design-system';

/**
 * 🏢 ENTERPRISE ContactsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { Users, Filter, Trash2 } from 'lucide-react';
import { CommonBadge } from '@/core/badges';
import { PageHeader } from '@/core/headers';
import type { ViewMode as CoreViewMode } from '@/core/headers';
import type { ViewMode } from '@/hooks/useContactsState';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';


interface ContactsHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  // Trash toggle
  showTrash?: boolean;
  trashCount?: number;
  onToggleTrash?: () => void;
  /** Breadcrumb element to display inside PageHeader */
  breadcrumb?: React.ReactNode;
}

// 🏢 ENTERPRISE: Search removed from header - using unified search in AdvancedFiltersPanel
export function ContactsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  showFilters,
  setShowFilters,
  showTrash = false,
  trashCount = 0,
  onToggleTrash,
  breadcrumb,
}: ContactsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      breadcrumb={breadcrumb}
      title={{
        icon: Users,
        title: t('header.title'),
        subtitle: t('header.subtitle')
      }}
      // 🏢 ENTERPRISE: Search removed from header - using unified search in AdvancedFiltersPanel
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as CoreViewMode,
        onViewModeChange: (mode) => setViewMode(mode as ViewMode),
        viewModes: ['list', 'grid'] as CoreViewMode[],
        customActions: [
          // 🗑️ Trash toggle button
          ...(onToggleTrash ? [
            React.createElement('button', {
              key: 'trash-toggle',
              onClick: onToggleTrash,
              className: `relative p-2 ${quick.input} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                showTrash
                  ? `bg-destructive text-destructive-foreground ${getStatusBorder('default')}`
                  : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
              }`,
              'aria-label': t('trash.viewTrash'),
              title: showTrash ? t('trash.backToContacts') : t('trash.viewTrash'),
            },
              React.createElement(Trash2, { className: iconSizes.sm }),
              trashCount > 0 && !showTrash
                ? React.createElement(CommonBadge, {
                    key: 'trash-badge',
                    status: 'deleted',
                    customLabel: String(trashCount),
                    className: 'absolute -top-1 -right-1 h-4 min-w-[16px] text-[10px] px-1',
                  })
                : null,
            )
          ] : []),
          // Mobile filter toggle
          ...(setShowFilters ? [
            React.createElement('button', {
              key: 'mobile-filter',
              onClick: () => setShowFilters(!showFilters),
              className: `md:hidden p-2 ${quick.input} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                showFilters
                  ? `bg-primary text-primary-foreground ${getStatusBorder('default')}`
                  : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
              }`,
              'aria-label': 'Toggle filters',
            }, React.createElement(Filter, { className: iconSizes.sm }))
          ] : []),
        ]
      }}
    />
  );
}
