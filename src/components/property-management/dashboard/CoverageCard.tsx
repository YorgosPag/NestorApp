'use client';

/**
 * 🏢 ENTERPRISE: CoverageCard - Unit Documentation Completeness Dashboard
 *
 * Displays 3 coverage metrics (photos/floorplans/documents) with click-to-filter
 * functionality for "missing X" workflow.
 *
 * @fileoverview Enterprise coverage card using canonical StatsCard patterns
 * @enterprise ADR-031 - Single authority για coverage statistics
 * @since PR1.2 - Coverage/Completeness card implementation
 * @author Enterprise Architecture Team
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// 🏢 ENTERPRISE: Icons from Lucide (consistent with app standards)
import { FileImage, FileText, FolderOpen, TrendingUp } from 'lucide-react';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

// 🏢 ENTERPRISE: Types
import type { CoverageStats } from '@/hooks/useUnitsStats';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface CoverageCardProps {
  /** Coverage statistics from useUnitsStats */
  coverage: CoverageStats;
  /** Click handler for "missing photos" filter */
  onMissingPhotosClick?: () => void;
  /** Click handler for "missing floorplans" filter */
  onMissingFloorplansClick?: () => void;
  /** Click handler for "missing documents" filter */
  onMissingDocumentsClick?: () => void;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🏢 CoverageCard Component
 *
 * Enterprise coverage card showing unit documentation completeness.
 * Composed from same primitives as StatsCard with click-to-filter functionality.
 *
 * @example
 * ```tsx
 * <CoverageCard
 *   coverage={stats.coverage}
 *   onMissingPhotosClick={() => setFilter({ coverage: { missingPhotos: true }})}
 *   onMissingFloorplansClick={() => setFilter({ coverage: { missingFloorplans: true }})}
 *   onMissingDocumentsClick={() => setFilter({ coverage: { missingDocuments: true }})}
 * />
 * ```
 */
export function CoverageCard({
  coverage,
  onMissingPhotosClick,
  onMissingFloorplansClick,
  onMissingDocumentsClick,
  className,
}: CoverageCardProps) {
  const { t } = useTranslation(['units', 'common']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  // ==========================================================================
  // 🏢 COMPUTED VALUES
  // ==========================================================================

  /** Calculate missing counts for actionable metrics */
  const missingPhotos = coverage.totalUnits - coverage.unitsWithPhotos;
  const missingFloorplans = coverage.totalUnits - coverage.unitsWithFloorplans;
  const missingDocuments = coverage.totalUnits - coverage.unitsWithDocuments;

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  return (
    <Card className={`lg:col-span-2 ${className || ''}`}>
      <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${spacing.padding.sm} pb-2`}>
        <CardTitle className="text-sm font-medium">
          {t('page.dashboard.coverage.title')}
        </CardTitle>
        <TrendingUp className={`${iconSizes.sm} text-muted-foreground`} />
      </CardHeader>

      <CardContent className={`${spacing.padding.sm} pt-0`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Photos Coverage */}
          <div
            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
              onMissingPhotosClick ? INTERACTIVE_PATTERNS.CARD_ENHANCED : ''
            } ${colors.bg.surface} hover:bg-accent/10`}
            onClick={onMissingPhotosClick}
            role={onMissingPhotosClick ? 'button' : undefined}
            tabIndex={onMissingPhotosClick ? 0 : undefined}
            aria-label={
              onMissingPhotosClick
                ? t('page.dashboard.coverage.clickToFilterMissing', {
                    type: t('page.dashboard.coverage.photos')
                  })
                : undefined
            }
          >
            <div className="flex items-center justify-between mb-2">
              <FileImage className={`${iconSizes.md} ${colors.text.info}`} />
              <span className={`text-2xl font-bold ${colors.text.primary}`}>
                {coverage.photosPercentage}%
              </span>
            </div>
            <div className="space-y-1">
              <p className={`text-xs font-medium ${colors.text.primary}`}>
                {t('page.dashboard.coverage.photos')}
              </p>
              <p className={`text-xs ${colors.text.muted}`}>
                {coverage.unitsWithPhotos}/{coverage.totalUnits} {t('navigation.units', { ns: 'common' })}
              </p>
              {missingPhotos > 0 && (
                <p className={`text-xs ${colors.text.warning}`}>
                  {t('page.dashboard.coverage.missing', {
                    count: missingPhotos
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Floorplans Coverage */}
          <div
            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
              onMissingFloorplansClick ? INTERACTIVE_PATTERNS.CARD_ENHANCED : ''
            } ${colors.bg.surface} hover:bg-accent/10`}
            onClick={onMissingFloorplansClick}
            role={onMissingFloorplansClick ? 'button' : undefined}
            tabIndex={onMissingFloorplansClick ? 0 : undefined}
            aria-label={
              onMissingFloorplansClick
                ? t('page.dashboard.coverage.clickToFilterMissing', {
                    type: t('page.dashboard.coverage.floorplans')
                  })
                : undefined
            }
          >
            <div className="flex items-center justify-between mb-2">
              <FolderOpen className={`${iconSizes.md} ${colors.text.success}`} />
              <span className={`text-2xl font-bold ${colors.text.primary}`}>
                {coverage.floorplansPercentage}%
              </span>
            </div>
            <div className="space-y-1">
              <p className={`text-xs font-medium ${colors.text.primary}`}>
                {t('page.dashboard.coverage.floorplans')}
              </p>
              <p className={`text-xs ${colors.text.muted}`}>
                {coverage.unitsWithFloorplans}/{coverage.totalUnits} {t('navigation.units', { ns: 'common' })}
              </p>
              {missingFloorplans > 0 && (
                <p className={`text-xs ${colors.text.warning}`}>
                  {t('page.dashboard.coverage.missing', {
                    count: missingFloorplans
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Documents Coverage */}
          <div
            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
              onMissingDocumentsClick ? INTERACTIVE_PATTERNS.CARD_ENHANCED : ''
            } ${colors.bg.surface} hover:bg-accent/10`}
            onClick={onMissingDocumentsClick}
            role={onMissingDocumentsClick ? 'button' : undefined}
            tabIndex={onMissingDocumentsClick ? 0 : undefined}
            aria-label={
              onMissingDocumentsClick
                ? t('page.dashboard.coverage.clickToFilterMissing', {
                    type: t('page.dashboard.coverage.documents')
                  })
                : undefined
            }
          >
            <div className="flex items-center justify-between mb-2">
              <FileText className={`${iconSizes.md} ${colors.text.purple}`} />
              <span className={`text-2xl font-bold ${colors.text.primary}`}>
                {coverage.documentsPercentage}%
              </span>
            </div>
            <div className="space-y-1">
              <p className={`text-xs font-medium ${colors.text.primary}`}>
                {t('page.dashboard.coverage.documents')}
              </p>
              <p className={`text-xs ${colors.text.muted}`}>
                {coverage.unitsWithDocuments}/{coverage.totalUnits} {t('navigation.units', { ns: 'common' })}
              </p>
              {missingDocuments > 0 && (
                <p className={`text-xs ${colors.text.warning}`}>
                  {t('page.dashboard.coverage.missing', {
                    count: missingDocuments
                  })}
                </p>
              )}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

CoverageCard.displayName = 'CoverageCard';

export default CoverageCard;