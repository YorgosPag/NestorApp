'use client';

/**
 * ProcurementHeader — Header unificato per la pagina Procurement
 *
 * Stesso pattern di ContactsHeader / BuildingsHeader.
 * Gestisce: dashboard toggle, filtri mobile toggle, breadcrumb.
 *
 * @see ADR-267 Phase E — Procurement Layout Unification
 */

import React from 'react';
import { Package, Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// INTERFACE
// =============================================================================

interface ProcurementHeaderProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  breadcrumb?: React.ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProcurementHeader({
  showDashboard,
  setShowDashboard,
  showFilters,
  setShowFilters,
  breadcrumb,
}: ProcurementHeaderProps) {
  const { t } = useTranslation('procurement');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      breadcrumb={breadcrumb}
      title={{
        icon: Package,
        title: t('header.title'),
        subtitle: t('header.subtitle'),
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        customActions: [
          // Mobile filter toggle
          React.createElement('button', {
            key: 'mobile-filter',
            onClick: () => setShowFilters(!showFilters),
            className: `md:hidden p-2 ${quick.input} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
              showFilters
                ? `bg-primary text-primary-foreground ${quick.card}`
                : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }`,
            'aria-label': t('page.filters.mobile'),
          }, React.createElement(Filter, { className: iconSizes.sm })),
        ],
      }}
    />
  );
}
