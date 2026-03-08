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
// 🏢 ENTERPRISE: Centralized API client
import { apiClient } from '@/lib/api/enterprise-api-client';
import { Loader2, Building2 } from 'lucide-react';

/** 🏢 ENTERPRISE: Building data from API */
interface ProjectBuilding {
  id: string;
  name: string;
  progress: number;
  status: BuildingStatus;
}

/** API response shape from GET /api/buildings */
interface BuildingsApiResponse {
  buildings: Array<{
    id: string;
    name?: string;
    progress?: number;
    status?: string;
  }>;
  count: number;
}

export function ProjectTimelineTab({ project }: { project: Project }) {
  const { t } = useTranslation('projects');
  const typography = useTypography();
  const iconSizes = useIconSizes();
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
          `/api/buildings?projectId=${project.id}`
        );

        if (cancelled) return;

        const mapped: ProjectBuilding[] = (result?.buildings || []).map(b => ({
          id: b.id,
          name: b.name || b.id,
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
      <CardContent className="space-y-6">
        <section>
            <h3 className="text-lg font-semibold mb-4">{t('timelineTab.totalProgress')}</h3>
            <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-primary">{aggregatedProgress}%</span>
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

        <section className="space-y-4">
            <h3 className="text-lg font-semibold">{t('timelineTab.buildingProgress')}</h3>

            {loading && (
              <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
                <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
                <span className="text-sm">{t('timelineTab.loading', { defaultValue: 'Φόρτωση κτιρίων...' })}</span>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive py-4 text-center">{error}</p>
            )}

            {!loading && !error && buildings.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Building2 className={iconSizes.lg} />
                <p className="text-sm">{t('timelineTab.noBuildings', { defaultValue: 'Δεν υπάρχουν κτίρια σε αυτό το έργο.' })}</p>
              </div>
            )}

            {buildings.map(building => (
                <article key={building.id} className={cn('p-4', quick.card)}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color)} />
                            <span className="font-medium">{building.name}</span>
                        </div>
                        <BuildingBadge
                          status={building.status}
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-primary">{building.progress}%</span>
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
