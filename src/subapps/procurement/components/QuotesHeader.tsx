'use client';

/**
 * QuotesHeader — Header unificato per la pagina /procurement/quotes
 *
 * Mirror di ProcurementHeader (ADR-267 Phase E) — pattern PageHeader sticky-rounded.
 * Espone: dashboard toggle, filtri mobile toggle, "Σάρωση Προσφοράς" CTA,
 * archived toggle button, breadcrumb.
 *
 * @see ADR-327 §Layout Unification
 */

import React from 'react';
import { FileText, Filter, ScanLine, ArchiveX } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface QuotesHeaderProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  archivedCount: number;
  showArchived: boolean;
  onToggleArchived: () => void;
  onScanNew: () => void;
  breadcrumb?: React.ReactNode;
}

export function QuotesHeader({
  showDashboard,
  setShowDashboard,
  showFilters,
  setShowFilters,
  archivedCount,
  showArchived,
  onToggleArchived,
  onScanNew,
  breadcrumb,
}: QuotesHeaderProps) {
  const { t } = useTranslation('quotes');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const archivedLabel = archivedCount > 0
    ? t('quotes.archivedCount', { count: archivedCount })
    : t('quotes.archivedTab');

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      breadcrumb={breadcrumb}
      title={{
        icon: FileText,
        title: t('quotes.header.title'),
        subtitle: t('quotes.header.subtitle'),
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        addButton: {
          label: t('quotes.create'),
          onClick: onScanNew,
          icon: ScanLine,
        },
        customActions: [
          React.createElement('button', {
            key: 'archived-toggle',
            onClick: onToggleArchived,
            className: `inline-flex items-center gap-1.5 px-3 py-2 ${quick.input} ${TRANSITION_PRESETS.STANDARD_COLORS} text-sm font-medium ${
              showArchived
                ? `bg-primary text-primary-foreground ${quick.card}`
                : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }`,
            'aria-label': archivedLabel,
            'aria-pressed': showArchived,
          },
            React.createElement(ArchiveX, { key: 'icon', className: iconSizes.sm }),
            React.createElement('span', { key: 'label' }, archivedLabel),
          ),
          React.createElement('button', {
            key: 'mobile-filter',
            onClick: () => setShowFilters(!showFilters),
            className: `md:hidden p-2 ${quick.input} ${TRANSITION_PRESETS.STANDARD_COLORS} ${
              showFilters
                ? `bg-primary text-primary-foreground ${quick.card}`
                : `${colors.bg.primary} ${quick.card} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }`,
            'aria-label': t('quotes.page.filters.mobile'),
          }, React.createElement(Filter, { className: iconSizes.sm })),
        ],
      }}
    />
  );
}
