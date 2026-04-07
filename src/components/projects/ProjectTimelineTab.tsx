/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React, { useEffect, useState } from 'react';
import type { Project } from '@/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { BuildingBadge } from '@/core/badges';
import type { BuildingStatus } from '@/core/types/BadgeTypes';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized typography tokens
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized API client
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { Building2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { formatBuildingLabel } from '@/lib/entity-formatters';

/** 🏢 ENTERPRISE: Building data from API */
interface ProjectBuilding {
  id: string;
  name: string;
  code?: string;
  progress: number;
  status: BuildingStatus;
}

/** API response shape from GET /api/buildings */
interface BuildingsApiResponse {
  buildings: Array<{
    id: string;
    name?: string;
    code?: string;
    progress?: number;
    status?: string;
  }>;
  count: number;
}

export function ProjectTimelineTab({ project }: { project: Project }) {
  const { t } = useTranslation('projects');
  const typography = useTypography();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  const [buildings, setBuildings] = useState<ProjectBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🏢 ENTERPRISE: Fetch real buildings for this project
  useEffect(() => {
    let cancelled = false;

    async function fetchBuildings() {
      try {
        setLoading(true);
        setError(null);

        const result = await apiClient.get<BuildingsApiResponse>(
          `${API_ROUTES.BUILDINGS.LIST}?projectId=${project.id}`
        );

        if (cancelled) return;

        const mapped: ProjectBuilding[] = (result?.buildings || []).map(b => ({
          id: b.id,
          name: b.name || b.id,
          code: b.code,
          progress: b.progress ?? 0,
          status: (b.status as BuildingStatus) || 'planning',
        }));

        setBuildings(mapped);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load buildings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBuildings();
    return () => { cancelled = true; };
  }, [project.id]);

  // 🏢 ENTERPRISE: Calculate aggregated progress from real buildings
  const aggregatedProgress = buildings.length > 0
    ? Math.round(buildings.reduce((sum, b) => sum + b.progress, 0) / buildings.length)
    : project.progress;

  return (
    <Card>
      <CardHeader>
        <CardTitle className={typography.card.titleCompact}>{t('timelineTab.title', { name: project.name })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <section>
            <h3 className={cn(typography.heading.md, "mb-2")}>{t('timelineTab.totalProgress')}</h3>
            <div className="flex items-center gap-2">
                <span className={cn(typography.heading.h3, "text-primary")}>{aggregatedProgress}%</span>
                <div className="w-full">
                  <ThemeProgressBar
                    progress={aggregatedProgress}
                    label=""
                    size="md"
                    showPercentage={false}
                  />
                </div>
            </div>
        </section>

        <section className="space-y-2">
            <h3 className={typography.heading.md}>{t('timelineTab.buildingProgress')}</h3>

            {loading && (
              <div className={cn("flex items-center gap-2 py-2 justify-center", colors.text.muted)}>
                <Spinner size="small" />
                <span className={typography.body.sm}>{t('timelineTab.loading')}</span>
              </div>
            )}

            {error && (
              <p className={cn(typography.body.sm, "text-destructive py-2 text-center")}>{error}</p>
            )}

            {!loading && !error && buildings.length === 0 && (
              <div className={cn("flex flex-col items-center gap-2 py-2", colors.text.muted)}>
                <Building2 className={iconSizes.lg} />
                <p className={typography.body.sm}>{t('timelineTab.noBuildings')}</p>
              </div>
            )}

            {buildings.map(building => (
                <article key={building.id} className={cn('p-2', quick.card)}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color)} />
                            <span className={typography.label.md}>{formatBuildingLabel(building.code, building.name)}</span>
                        </div>
                        <BuildingBadge
                          status={building.status}
                          variant="secondary"
                          size="sm"
                          className={typography.body.xs}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn(typography.heading.sm, "text-primary")}>{building.progress}%</span>
                        <div className="w-full">
                          <ThemeProgressBar
                            progress={building.progress}
                            label=""
                            size="sm"
                            showPercentage={false}
                          />
                        </div>
                    </div>
                </article>
            ))}
        </section>
      </CardContent>
    </Card>
  );
}
