'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useRouter } from 'next/navigation';
import { useProjectStructure } from '../../structure-tab/hooks/useProjectStructure';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectBuilding } from '@/services/projects/contracts';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ZERO any)
// ============================================================================

interface ProjectBuildingsCardProps {
  /** Project ID για fetch buildings */
  projectId: string;
  /** Whether to start expanded (load immediately) @default false for lazy loading */
  defaultExpanded?: boolean;
}

interface BuildingSummary {
  id: string | number;
  name: string;
  unitsCount: number;
  soldUnits: number;
  totalArea: number;
}

// ============================================================================
// 🏢 ENTERPRISE: Component
// ============================================================================

/**
 * 🏢 ENTERPRISE: ProjectBuildingsCard Component
 *
 * Εμφανίζει τα κτίρια που ανήκουν σε ένα έργο.
 *
 * LAZY LOADING PATTERN:
 * - Starts collapsed by default (no API call)
 * - User clicks to expand → triggers data fetch
 * - Data is cached after first fetch
 */
export function ProjectBuildingsCard({ projectId, defaultExpanded = false }: ProjectBuildingsCardProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const router = useRouter();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  // 🏢 ENTERPRISE: Lazy loading state
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 🏢 ENTERPRISE: Only fetch when expanded (enabled flag)
  const { structure, loading, error, refetch, isFetched } = useProjectStructure(projectId, {
    enabled: isExpanded
  });

  // 🏢 ENTERPRISE: Transform buildings data for display
  const buildings: BuildingSummary[] = (structure?.buildings ?? []).map((building: ProjectBuilding) => {
    const rawId = building.id;
    const normalizedId = (typeof rawId === 'string' || typeof rawId === 'number')
      ? rawId
      : String(rawId ?? '');
    const normalizedName = typeof building.name === 'string'
      ? building.name
      : String(building.name ?? '');

    return {
      id: normalizedId,
      name: normalizedName,
      unitsCount: building.units.length,
      soldUnits: building.units.filter(u => u.status === 'sold').length,
      totalArea: building.units.reduce((sum, u) => sum + (u.area || 0), 0),
    };
  });

  // 🏢 ENTERPRISE: Navigation handlers
  const handleViewBuilding = (buildingId: string | number) => {
    router.push(`/buildings?selected=${buildingId}`);
  };

  const handleAddBuilding = () => {
    router.push('/buildings');
  };

  // 🏢 ENTERPRISE: Toggle expand/collapse
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 🏢 ENTERPRISE: Collapsed state (no data fetch yet)
  if (!isExpanded) {
    return (
      <Card className={spacing.margin.top.lg}>
        <CardHeader
          className={cn(spacing.padding.sm, "cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg")}
          onClick={handleToggleExpand}
        >
          <CardTitle className={cn('flex items-center justify-between', typography.card.titleCompact)}>
            <span className={cn("flex items-center", spacing.gap.sm)}>
              <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
              {t('buildings.cardTitle')}
            </span>
            <ChevronRight className={cn(iconSizes.md, colors.text.muted)} />
          </CardTitle>
          <CardDescription>
            {t('buildings.clickToLoad')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Loading state
  if (loading) {
    return (
      <Card className={spacing.margin.top.lg}>
        <CardHeader
          className={cn(spacing.padding.sm, "cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg")}
          onClick={handleToggleExpand}
        >
          <CardTitle className={cn('flex items-center justify-between', typography.card.titleCompact)}>
            <span className={cn("flex items-center", spacing.gap.sm)}>
              <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
              {t('buildings.cardTitle')}
            </span>
            <ChevronDown className={cn(iconSizes.md, colors.text.muted)} />
          </CardTitle>
        </CardHeader>
        <CardContent className={spacing.padding.sm}>
          <section className={cn("flex items-center justify-center", spacing.gap.sm, spacing.padding.y.xl)} aria-busy="true">
            <Loader2 className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} />
            <span className={colors.text.muted}>{t('buildings.loading')}</span>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Error state with retry
  if (error) {
    return (
      <Card className={spacing.margin.top.lg}>
        <CardHeader
          className={cn(spacing.padding.sm, "cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg")}
          onClick={handleToggleExpand}
        >
          <CardTitle className={cn('flex items-center justify-between', typography.card.titleCompact)}>
            <span className={cn("flex items-center", spacing.gap.sm)}>
              <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
              {t('buildings.cardTitle')}
            </span>
            <ChevronDown className={cn(iconSizes.md, colors.text.muted)} />
          </CardTitle>
        </CardHeader>
        <CardContent className={spacing.padding.sm}>
          <section className={cn("flex flex-col items-center justify-center gap-3", spacing.padding.y.xl)} aria-live="polite">
            <AlertCircle className={cn(iconSizes.lg, 'text-destructive')} />
            <span className="text-destructive text-sm">{t('buildings.errorPrefix')} {error}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('buildings.retry')}
            </Button>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Empty state
  if (buildings.length === 0) {
    return (
      <Card className={spacing.margin.top.lg}>
        <CardHeader
          className={cn(spacing.padding.sm, "cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg")}
          onClick={handleToggleExpand}
        >
          <CardTitle className={cn('flex items-center justify-between', typography.card.titleCompact)}>
            <span className={cn("flex items-center", spacing.gap.sm)}>
              <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
              {t('buildings.cardTitle')}
            </span>
            <ChevronDown className={cn(iconSizes.md, colors.text.muted)} />
          </CardTitle>
        </CardHeader>
        <CardContent className={spacing.padding.sm}>
          <section className={cn("text-center", spacing.padding.y.xl)} aria-label={t('buildings.emptyListAriaLabel')}>
            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xl3, 'mx-auto', spacing.margin.bottom.md, NAVIGATION_ENTITIES.building.color)} />
            <p className={cn('text-sm font-medium', colors.text.foreground)}>
              {t('buildings.emptyTitle')}
            </p>
            <p className={cn('text-sm mt-1', spacing.margin.bottom.md, colors.text.muted)}>
              {t('buildings.emptyDescription')}
            </p>
            <Button variant="outline" size="sm" onClick={handleAddBuilding}>
              <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color, spacing.margin.right.sm)} />
              {t('buildings.emptyAction')}
            </Button>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Buildings list (expanded)
  return (
    <Card className={spacing.margin.top.lg}>
      <CardHeader
        className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg"
        onClick={handleToggleExpand}
      >
        <CardTitle className={cn('flex items-center justify-between', typography.card.titleCompact)}>
          <span className={cn("flex items-center", spacing.gap.sm)}>
            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
            {t('buildings.cardTitle')}
          </span>
          <ChevronDown className={cn(iconSizes.md, colors.text.muted)} />
        </CardTitle>
        <CardDescription>
          {t('buildings.linkedCount', { count: buildings.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Table Headers */}
        <header className={cn("grid grid-cols-[2fr_1fr_1fr_auto] gap-3 border-b border-border", typography.label.sm, colors.text.muted, spacing.padding.bottom.sm)}>
          <span>{t('buildings.buildingName')}</span>
          <span className="text-right">{t('buildings.unitsHeader')}</span>
          <span className="text-right">{t('buildings.areaHeader')}</span>
          <span className="text-right">{t('buildings.actionsHeader')}</span>
        </header>

        {/* Buildings List */}
        <section className={spacing.spaceBetween.sm} aria-label={t('buildings.listAriaLabel')}>
          {buildings.map((building) => (
            <article
              key={building.id}
              className={cn(
                'grid grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center p-3 rounded-md',
                'hover:bg-accent/30 transition-colors cursor-pointer border border-transparent hover:border-border'
              )}
              onClick={() => handleViewBuilding(building.id)}
            >
              <div className={cn("flex items-center", spacing.gap.sm)}>
                <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color)} />
                <span className="font-medium">{building.name}</span>
              </div>
              <div className={cn("text-right", typography.body.sm)}>
                <span className="font-medium">{building.unitsCount}</span>
                <span className={cn('ml-1', colors.text.muted)}>{t('buildings.unitsLabel')}</span>
                <div className={cn(typography.body.xs, colors.text.muted)}>
                  {building.soldUnits} {t('buildings.soldLabel')}
                </div>
              </div>
              <div className={cn("text-right", typography.body.sm, colors.text.muted)}>
                {building.totalArea.toLocaleString('el-GR', { maximumFractionDigits: 1 })} {t('buildings.areaLabel')}
              </div>
              <div className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewBuilding(building.id);
                  }}
                >
                  <ExternalLink className={iconSizes.sm} />
                  <span className="sr-only">{t('buildings.viewBuilding')}</span>
                </Button>
              </div>
            </article>
          ))}
        </section>
      </CardContent>
    </Card>
  );
}

export default ProjectBuildingsCard;
