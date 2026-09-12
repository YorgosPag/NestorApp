'use client';

import '@/lib/design-system';

/**
 * 🏢 ENTERPRISE ContactsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { Users, Filter, Trash2 } from 'lucide-react';
import { IconCountBadge } from '@/core/badges';
import { PageHeader, LIST_GRID_VIEW_MODES, isListGridViewMode } from '@/core/headers';
import type { ListGridViewMode } from '@/core/headers';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';


interface ContactsHeaderProps {
  viewMode: ListGridViewMode;
  setViewMode: (mode: ListGridViewMode) => void;
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
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
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
        viewMode,
        onViewModeChange: (mode) => { if (isListGridViewMode(mode)) setViewMode(mode); },
        viewModes: LIST_GRID_VIEW_MODES,
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
              // ADR-854: το «count > 0» ζει ΜΕΣΑ στο IconCountBadge — εδώ μένει μόνο η
              // συνθήκη που είναι όντως δική μας (όταν βλέπεις ήδη τον κάδο, ο μετρητής
              // δεν λέει τίποτα). Χρώμα/μέγεθος/θέση/cutoff δεν αποφασίζονται πια εδώ.
              showTrash
                ? null
                : React.createElement(IconCountBadge, {
                    key: 'trash-badge',
                    count: trashCount,
                    announce: true,
                  }),
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
