'use client';

/**
 * 🏢 ENTERPRISE ContactsHeader with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import { Users, Filter } from 'lucide-react';
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
  onNewContact?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  // 🏢 ENTERPRISE COUNT DISPLAY
  contactCount?: number;
}

// 🏢 ENTERPRISE: Search removed from header - using unified search in AdvancedFiltersPanel
export function ContactsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  onNewContact,
  showFilters,
  setShowFilters,
  contactCount,
}: ContactsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Dynamic title with optional count
  const headerTitle = contactCount !== undefined
    ? t('header.titleWithCount', { count: contactCount })
    : t('header.title');

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: Users,
        title: headerTitle,
        subtitle: t('header.subtitle')
      }}
      // 🏢 ENTERPRISE: Search removed from header - using unified search in AdvancedFiltersPanel
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as CoreViewMode,
        onViewModeChange: (mode) => setViewMode(mode as ViewMode),
        viewModes: ['list', 'grid'] as CoreViewMode[],
        addButton: {
          label: t('header.newContact'),
          onClick: () => onNewContact?.()
        },
        customActions: setShowFilters ? [
          React.createElement('button', {
            key: 'mobile-filter',
            onClick: () => setShowFilters(!showFilters),
            className: `md:hidden p-2 ${quick.input} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
              showFilters
                ? `bg-primary text-primary-foreground ${getStatusBorder('default')}`
                : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }`,
            'aria-label': 'Toggle filters',
            children: React.createElement(Filter, { className: iconSizes.sm })
          })
        ] : undefined
      }}
    />
  );
}
