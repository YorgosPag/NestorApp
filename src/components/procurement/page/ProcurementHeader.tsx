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
import { Package, Filter, ScanLine } from 'lucide-react';
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
  onScanQuote: () => void;
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
  onScanQuote,
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
          // Scan quote PDF
          React.createElement('button', {
            key: 'scan-quote',
            onClick: onScanQuote,
            className: `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 ${TRANSITION_PRESETS.STANDARD_COLORS}`,
            'aria-label': t('page.scanQuote'),
          },
            React.createElement(ScanLine, { className: iconSizes.sm }),
            t('page.scanQuote'),
          ),
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
