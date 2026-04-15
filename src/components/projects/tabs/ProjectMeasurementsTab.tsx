/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * =============================================================================
 * PROJECT MEASUREMENTS TAB — Read-Only Aggregation
 * =============================================================================
 *
 * Συγκεντρωτική προβολή επιμετρήσεων από ΟΛΑ τα κτίρια του Έργου.
 *
 * Pattern: Procore "Budget" tab, SAP RE-FX "Cost Summary"
 * - Data entry: ΜΟΝΟ στο κτίριο (MeasurementsTabContent)
 * - Project level: READ-ONLY aggregation (αυτό το component)
 *
 * @see ADR-175 (BOQ / Quantity Surveying)
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { Project } from '@/types/project';
import type { BOQItem, BOQSummary, BOQProjectSummary } from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { boqService, computeBuildingSummary } from '@/services/measurements';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Ruler, Building2, TrendingUp, Package, AlertTriangle,
  ChevronDown, ChevronRight, Layers,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { formatBuildingLabel } from '@/lib/entity-formatters';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatCurrency as formatCurrencyIntl } from '@/lib/intl-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('ProjectMeasurementsTab');

interface ProjectMeasurementsCached {
  buildings: BuildingInfo[];
  allItems: BOQItem[];
}
const projectMeasurementsCache = createStaleCache<ProjectMeasurementsCached>('project-measurements');

// =============================================================================
// TYPES
// =============================================================================

interface ProjectMeasurementsTabProps {
  data: Project;
  projectId?: string;
}

interface BuildingInfo {
  id: string;
  name: string;
  code?: string;
}

interface BuildingAggregation {
  building: BuildingInfo;
  summary: BOQSummary | null;
  items: BOQItem[];
  loading: boolean;
}

// =============================================================================
// MONEY FORMATTER — delegates to centralized intl-utils (ADR-215)
// =============================================================================

const formatCurrencyWithDecimals = (amount: number): string =>
  formatCurrencyIntl(amount, 'EUR', { minimumFractionDigits: 2 });

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectMeasurementsTab({ data: project }: ProjectMeasurementsTabProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const colors = useSemanticColors();
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);

  const cacheKey = project.id ?? '';
  const cachedMeasurements = projectMeasurementsCache.get(cacheKey);
  const [buildings, setBuildings] = useState<BuildingInfo[]>(cachedMeasurements?.buildings ?? []);
  const [allItems, setAllItems] = useState<BOQItem[]>(cachedMeasurements?.allItems ?? []);
  const [loading, setLoading] = useState(!projectMeasurementsCache.hasLoaded(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());

  const categories: readonly MasterBOQCategory[] = ATOE_MASTER_CATEGORIES;

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      map.set(cat.code, cat.nameEL);
    }
    return map;
  }, [categories]);

  // ==========================================================================
  // FETCH: Buildings + BOQ items for entire project
  // ==========================================================================

  const fetchData = useCallback(async () => {
    if (!project.id) return;

    if (!projectMeasurementsCache.hasLoaded(cacheKey)) setLoading(true);
    setError(null);

    try {
      // 1. Fetch buildings for this project
      interface BuildingsResponse {
        buildings: Array<{ id: string; name: string }>;
        count: number;
      }
      const buildingsData = await apiClient.get<BuildingsResponse>(
        `${API_ROUTES.BUILDINGS.LIST}?projectId=${project.id}`
      );

      const buildingList: BuildingInfo[] = (buildingsData?.buildings ?? []).map(b => ({
        id: b.id,
        name: b.name || `Κτίριο ${b.id.slice(0, 6)}`,
        code: b.code,
      }));
      setBuildings(buildingList);

      // 2. Fetch all BOQ items for this project (single query)
      const items = await boqService.getByProject(project.companyId, project.id);
      setAllItems(items);
      projectMeasurementsCache.set({ buildings: buildingList, allItems: items }, cacheKey);

      logger.info('Project measurements loaded', {
        projectId: project.id,
        buildings: buildingList.length,
        totalItems: items.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα φόρτωσης';
      logger.error('Failed to fetch project measurements', { error: err });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [project.id, cacheKey]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ==========================================================================
  // COMPUTED: Per-building summaries + project totals
  // ==========================================================================

  const buildingAggregations = useMemo<BuildingAggregation[]>(() => {
    return buildings.map(building => {
      const buildingItems = allItems.filter(item => item.buildingId === building.id);
      const summary = buildingItems.length > 0
        ? computeBuildingSummary(building.id, buildingItems, categoryNames)
        : null;

      return { building, summary, items: buildingItems, loading: false };
    });
  }, [buildings, allItems, categoryNames]);

  const projectSummary = useMemo<BOQProjectSummary>(() => {
    const summaries = buildingAggregations
      .map(ba => ba.summary)
      .filter((s): s is BOQSummary => s !== null);

    const totalEstimated = summaries.reduce((acc, s) => acc + s.totalEstimatedCost, 0);
    const hasActual = summaries.some(s => s.totalActualCost !== null);
    const totalActual = hasActual
      ? summaries.reduce((acc, s) => acc + (s.totalActualCost ?? 0), 0)
      : null;

    return {
      projectId: project.id!,
      buildings: summaries,
      totalEstimatedCost: totalEstimated,
      totalActualCost: totalActual,
    };
  }, [buildingAggregations, project.id]);

  const totalItems = allItems.length;
  const buildingsWithItems = buildingAggregations.filter(ba => ba.items.length > 0).length;

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const toggleBuilding = (buildingId: string) => {
    setExpandedBuildings(prev => {
      const next = new Set(prev);
      if (next.has(buildingId)) {
        next.delete(buildingId);
      } else {
        next.add(buildingId);
      }
      return next;
    });
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (loading) {
    return (
      <section className={cn("flex items-center justify-center gap-2 py-12", colors.text.muted)}>
        <Spinner size="large" />
        {/* eslint-disable-next-line custom/no-hardcoded-strings */}
        <span className={typography.body.base}>Φόρτωση επιμετρήσεων...</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex items-center justify-center gap-2 py-12 text-destructive">
        <AlertTriangle className={iconSizes.lg} />
        <span>{error}</span>
      </section>
    );
  }

  if (buildings.length === 0) {
    return (
      <section className="text-center py-12 border-2 border-dashed rounded-lg">
        <Building2 className={cn(iconSizes.xl, 'mx-auto mb-2', colors.text.muted)} />
        <h3 className={cn(typography.heading.md, 'mb-2')}>{t('measurements.noBuildings')}</h3>
        <p className={typography.special.secondary}>
          {t('measurements.noBuildingsHint')}
        </p>
      </section>
    );
  }

  if (totalItems === 0) {
    return (
      <section className="text-center py-12 border-2 border-dashed rounded-lg">
        <Ruler className={cn(iconSizes.xl, 'mx-auto mb-2', colors.text.muted)} />
        <h3 className={cn(typography.heading.md, 'mb-2')}>{t('measurements.noMeasurements')}</h3>
        <p className={typography.special.secondary}>
          {t('measurements.noMeasurementsHint')}
        </p>
        <p className={cn(typography.special.tertiary, 'mt-1')}>
          {buildings.length === 1
            ? t('measurements.buildingsInProject', { count: buildings.length })
            : t('measurements.buildingsInProjectPlural', { count: buildings.length })}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <header>
        <h2 className={cn(typography.heading.lg, 'flex items-center gap-2')}>
          <Ruler className={iconSizes.lg} />
          {t('measurements.title')}
        </h2>
        <p className={cn(typography.special.secondary, 'mt-1')}>
          {t('measurements.subtitle')}
        </p>
      </header>

      {/* ================================================================ */}
      {/* SUMMARY CARDS                                                    */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-2">
            <div className={cn("flex items-center gap-2 mb-1", colors.text.muted)}>
              <Package className="h-4 w-4" />
              <span className={typography.label.xs}>{t('measurements.works')}</span>
            </div>
            <p className={cn(typography.heading.lg, 'tabular-nums')}>{totalItems}</p>
            <p className={typography.special.tertiary}>
              {t('measurements.inBuildingsCount', { with: String(buildingsWithItems), total: String(buildings.length) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2">
            <div className={cn("flex items-center gap-2 mb-1", colors.text.muted)}>
              <TrendingUp className="h-4 w-4" />
              <span className={typography.label.xs}>{t('measurements.estimate')}</span>
            </div>
            <p className={cn(typography.heading.lg, 'tabular-nums')}>
              {formatCurrencyWithDecimals(projectSummary.totalEstimatedCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2">
            <div className={cn("flex items-center gap-2 mb-1", colors.text.muted)}>
              <Ruler className="h-4 w-4" />
              <span className={typography.label.xs}>{t('measurements.actual')}</span>
            </div>
            <p className={cn(typography.heading.lg, 'tabular-nums')}>
              {projectSummary.totalActualCost !== null
                ? formatCurrencyWithDecimals(projectSummary.totalActualCost)
                : '—'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2">
            <div className={cn("flex items-center gap-2 mb-1", colors.text.muted)}>
              <Building2 className="h-4 w-4" />
              <span className={typography.label.xs}>{t('measurements.buildings')}</span>
            </div>
            <p className={cn(typography.heading.lg, 'tabular-nums')}>{buildings.length}</p>
            <p className={typography.special.tertiary}>
              {buildingsWithItems} {t('measurements.withWorks')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* PER-BUILDING BREAKDOWN                                           */}
      {/* ================================================================ */}
      <div className="space-y-2">
        <h3 className={cn(typography.heading.md, 'flex items-center gap-2')}>
          <Layers className={iconSizes.md} />
          {t('measurements.perBuildingBreakdown')}
        </h3>

        {buildingAggregations.map(({ building, summary, items }) => {
          const isExpanded = expandedBuildings.has(building.id);
          const hasData = items.length > 0;

          // Compute percentage of total
          const percent = projectSummary.totalEstimatedCost > 0 && summary
            ? (summary.totalEstimatedCost / projectSummary.totalEstimatedCost) * 100
            : 0;

          return (
            <Card key={building.id} className={cn(!hasData && 'opacity-60')}>
              <CardHeader className="p-2 pb-0">
                <button
                  type="button"
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => hasData && toggleBuilding(building.id)}
                  disabled={!hasData}
                >
                  <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
                    {hasData ? (
                      isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                    ) : (
                      <Building2 className={cn("h-4 w-4", colors.text.muted)} />
                    )}
                    {formatBuildingLabel(building.code, building.name)}
                    <Badge variant="secondary" className="ml-1">
                      {items.length === 1
                        ? t('measurements.worksCount', { count: items.length })
                        : t('measurements.worksCountPlural', { count: items.length })}
                    </Badge>
                  </CardTitle>

                  {summary && (
                    <span className={cn('font-semibold tabular-nums', typography.body.sm)}>
                      {formatCurrencyWithDecimals(summary.totalEstimatedCost)}
                    </span>
                  )}
                </button>
              </CardHeader>

              <CardContent className="p-2 pt-2">
                {/* Progress bar — cost share */}
                {summary && (
                  <div className="flex items-center gap-2">
                    <Progress value={percent} className="h-2 flex-1" />
                    <span className={cn(typography.special.tertiary, 'tabular-nums w-12 text-right')}>
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                )}

                {!hasData && (
                  <p className={typography.special.tertiary}>
                    {t('measurements.noMeasurementsInBuilding')}
                  </p>
                )}

                {/* Expanded: Category breakdown */}
                {isExpanded && summary && (
                  <div className="mt-2 space-y-1">
                    <div className={cn('grid grid-cols-[1fr_auto_auto] gap-2 border-b pb-1', colors.text.muted, typography.label.xs)}>
                      <span>{t('measurements.category')}</span>
                      <span className="text-right">{t('measurements.worksHeader')}</span>
                      <span className="text-right w-24">{t('measurements.estimateHeader')}</span>
                    </div>
                    {summary.categories.map(cat => (
                      <div
                        key={cat.categoryCode}
                        className={cn('grid grid-cols-[1fr_auto_auto] gap-2 py-1 border-b border-muted/40 last:border-0', typography.body.sm)}
                      >
                        <span className="truncate">
                          <span className={cn(typography.special.codeId, colors.text.muted, 'mr-1')}>
                            {cat.categoryCode}
                          </span>
                          {cat.categoryName}
                        </span>
                        <span className={cn("text-right tabular-nums", colors.text.muted)}>
                          {cat.itemCount}
                        </span>
                        <span className={cn(typography.label.sm, 'text-right tabular-nums w-24')}>
                          {formatCurrencyWithDecimals(cat.totalEstimatedCost)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default ProjectMeasurementsTab;
