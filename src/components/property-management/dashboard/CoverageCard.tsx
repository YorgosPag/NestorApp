'use client';

/**
 * 🏢 ENTERPRISE: CoverageCard - Unit Documentation Completeness Dashboard
 *
 * Displays 3 coverage metrics (photos/floorplans/documents) with click-to-filter
 * functionality for "missing X" workflow.
 *
 * 🔑 ADR-840 §7.8 — κάθε μετρική είναι **εναλλαγή** του `?missing=`: η πατημένη λέγεται με `aria-pressed` και
 * περίγραμμα (όχι μόνο χρώμα), και ενεργοποιείται και από πληκτρολόγιο (`actionable-card`). Ως τότε ήταν **τρία**
 * αντιγραμμένα μπλοκ, με `role="button"` χωρίς Enter/Space και χωρίς ένδειξη ότι το φίλτρο είναι ενεργό.
 *
 * @fileoverview Enterprise coverage card using canonical StatsCard patterns
 * @enterprise ADR-031 - Single authority για coverage statistics
 * @since PR1.2 - Coverage/Completeness card implementation
 * @author Enterprise Architecture Team
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { HeaderBar } from '@/components/ui/header-bar';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// 🏢 ENTERPRISE: Icons from Lucide (consistent with app standards)
import { FileImage, FileText, FolderOpen, TrendingUp, type LucideIcon } from 'lucide-react';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Types
import type { CoverageStats } from '@/hooks/usePropertiesStats';
import '@/lib/design-system';

import { ACTIONABLE_CARD_CLASS, PRESSED_CARD_CLASS, actionableCardProps } from './actionable-card';

// =============================================================================
// 🏢 TYPES
// =============================================================================

/** Οι τρεις σημαίες «λείπει» — ίδια ονόματα με το `FilterState['coverage']`. */
export type MissingCoverageFlag = 'missingPhotos' | 'missingFloorplans' | 'missingDocuments';

export interface CoverageCardProps {
  /** Coverage statistics from usePropertiesStats */
  coverage: CoverageStats;
  /** Click handler for "missing photos" filter */
  onMissingPhotosClick?: () => void;
  /** Click handler for "missing floorplans" filter */
  onMissingFloorplansClick?: () => void;
  /** Click handler for "missing documents" filter */
  onMissingDocumentsClick?: () => void;
  /** Ποια φίλτρα «λείπει» είναι ενεργά — η κατάσταση των εναλλαγών. Χωρίς αυτό οι μετρικές είναι απλές πράξεις. */
  activeMissing?: Partial<Record<MissingCoverageFlag, boolean>>;
  /** Additional className */
  className?: string;
}

interface CoverageMetricProps {
  readonly icon: LucideIcon;
  readonly iconClass: string;
  readonly label: string;
  readonly percentage: number;
  readonly withCount: number;
  readonly total: number;
  readonly onActivate?: () => void;
  readonly pressed?: boolean;
}

// =============================================================================
// 🏢 COMPONENTS
// =============================================================================

function CoverageMetric({ icon: Icon, iconClass, label, percentage, withCount, total, onActivate, pressed }: CoverageMetricProps) {
  const { t } = useTranslation(['properties', 'common']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const missing = total - withCount;

  return (
    <article
      className={`p-3 rounded-lg border transition-all duration-200 ${
        onActivate ? `${ACTIONABLE_CARD_CLASS} ${INTERACTIVE_PATTERNS.CARD_ENHANCED}` : ''
      } ${pressed ? PRESSED_CARD_CLASS : ''} ${colors.bg.surface} hover:bg-accent/10`}
      {...actionableCardProps(onActivate, pressed)}
      aria-label={onActivate ? t('page.dashboard.coverage.clickToFilterMissing', { type: label }) : undefined}
    >
      <header className="flex items-center justify-between mb-2">
        <Icon className={`${iconSizes.md} ${iconClass}`} />
        <span className={`text-2xl font-bold ${colors.text.primary}`}>{percentage}%</span>
      </header>
      <p className={`text-xs font-medium ${colors.text.primary}`}>{label}</p>
      <p className={`text-xs ${colors.text.muted}`}>
        {withCount}/{total} {t('navigation.units', { ns: 'common' })}
      </p>
      {missing > 0 && (
        <p className={`text-xs ${colors.text.warning}`}>{t('page.dashboard.coverage.missing', { count: missing })}</p>
      )}
    </article>
  );
}

/**
 * 🏢 CoverageCard Component
 *
 * @example
 * ```tsx
 * <CoverageCard
 *   coverage={stats.coverage}
 *   activeMissing={filters.coverage}
 *   onMissingPhotosClick={() => toggle('missingPhotos')}
 * />
 * ```
 */
export function CoverageCard({
  coverage,
  onMissingPhotosClick,
  onMissingFloorplansClick,
  onMissingDocumentsClick,
  activeMissing,
  className,
}: CoverageCardProps) {
  const { t } = useTranslation(['properties', 'common']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  // `undefined` όταν ο καλών δεν δηλώνει κατάσταση ⇒ καμία `aria-pressed` (πράξη, όχι εναλλαγή).
  const pressedOf = (flag: MissingCoverageFlag) => (activeMissing ? activeMissing[flag] === true : undefined);

  const metrics: ReadonlyArray<CoverageMetricProps & { readonly flag: MissingCoverageFlag }> = [
    {
      flag: 'missingPhotos', icon: FileImage, iconClass: colors.text.info, label: t('page.dashboard.coverage.photos'),
      percentage: coverage.photosPercentage, withCount: coverage.propertiesWithPhotos, total: coverage.totalProperties,
      onActivate: onMissingPhotosClick, pressed: pressedOf('missingPhotos'),
    },
    {
      flag: 'missingFloorplans', icon: FolderOpen, iconClass: colors.text.success, label: t('page.dashboard.coverage.floorplans'),
      percentage: coverage.floorplansPercentage, withCount: coverage.propertiesWithFloorplans, total: coverage.totalProperties,
      onActivate: onMissingFloorplansClick, pressed: pressedOf('missingFloorplans'),
    },
    {
      flag: 'missingDocuments', icon: FileText, iconClass: colors.text.purple, label: t('page.dashboard.coverage.documents'),
      percentage: coverage.documentsPercentage, withCount: coverage.propertiesWithDocuments, total: coverage.totalProperties,
      onActivate: onMissingDocumentsClick, pressed: pressedOf('missingDocuments'),
    },
  ];

  return (
    <Card className={`lg:col-span-2 ${className || ''}`}>
      <CardHeader className={`${spacing.padding.sm} pb-2`}>
        <HeaderBar wrap={false} actions={<TrendingUp className={`${iconSizes.sm} ${colors.text.muted}`} />}>
          <CardTitle className="text-sm font-medium">{t('page.dashboard.coverage.title')}</CardTitle>
        </HeaderBar>
      </CardHeader>

      <CardContent className={`${spacing.padding.sm} pt-0`}>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map(({ flag, ...metric }) => <CoverageMetric key={flag} {...metric} />)}
        </section>
      </CardContent>
    </Card>
  );
}

CoverageCard.displayName = 'CoverageCard';

export default CoverageCard;
