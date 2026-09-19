/* eslint-disable design-system/prefer-design-system-imports */
/**
 * ProjectParkingTab — Unified parking tab for project detail view
 *
 * Contains 2 sub-tabs:
 * 1. Floorplans — existing ProjectFloorplanTab (parking floorplan images/DXF)
 * 2. List — all parking spots across all buildings of the project
 *
 * @module components/projects/tabs/ProjectParkingTab
 */

'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { Map, List, Car, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { ProjectFloorplanTab } from './ProjectFloorplanTab';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import {
  PARKING_TYPE_LABELS,
  PARKING_LOCATION_ZONE_LABELS,
} from '@/types/parking';
import { SpaceStatusBadges } from '@/components/shared/unit-status/SpaceStatusBadges';
import { countSpaceStatuses } from '@/lib/spaces/space-availability';
import { resolveDisplayPrice } from '@/lib/properties/price-resolver';
import { priceCellLabel } from '@/lib/listings/listing-price-label';
import type { Project } from '@/types/project';

// =============================================================================
// TYPES
// =============================================================================

interface ProjectParkingTabProps {
  project?: Project & { id: string | number; name?: string };
  data?: Project;
  floorplanType?: 'parking';
  title?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectParkingTab({ project, data, title }: ProjectParkingTabProps) {
  const { t } = useTranslation('parking');
  const { t: _tBuilding } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const { quick } = useBorderTokens();
  const iconSizes = useIconSizes();

  const resolvedProject = project || data;
  const projectId = resolvedProject?.id ? String(resolvedProject.id) : undefined;

  const { parkingSpots, loading, error } = useFirestoreParkingSpots({
    projectId: projectId,
    autoFetch: !!projectId,
  });

  return (
    <Tabs defaultValue="floorplans" className="w-full">
      <TabsList className={cn('flex w-full h-auto min-h-fit', spacing.gap.sm)}>
        <TabsTrigger value="floorplans" className="flex items-center gap-2">
          <Map className={iconSizes.sm} />
          {t('projectTab.subtabs.floorplans')}
        </TabsTrigger>
        <TabsTrigger value="list" className="flex items-center gap-2">
          <List className={iconSizes.sm} />
          {t('projectTab.subtabs.list')}
          {!loading && parkingSpots.length > 0 && (
            <span className={cn('ml-1 rounded-full px-2 py-0.5', typography.body.xs, colors.bg.accentSubtle, colors.text.accent)}>
              {parkingSpots.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="floorplans" className={spacing.padding.top.md}>
        <ProjectFloorplanTab
          project={project}
          data={data}
          floorplanType="parking"
          title={title}
        />
      </TabsContent>

      <TabsContent value="list" className={spacing.padding.top.md}>
        <ParkingSpotsList
          parkingSpots={parkingSpots}
          loading={loading}
          error={error}
          t={t}
          colors={colors}
          quick={quick}
          iconSizes={iconSizes}
          spacing={spacing}
        />
      </TabsContent>
    </Tabs>
  );
}

// =============================================================================
// PARKING SPOTS LIST SUB-COMPONENT
// =============================================================================

interface ParkingSpotsListProps {
  parkingSpots: ReturnType<typeof useFirestoreParkingSpots>['parkingSpots'];
  loading: boolean;
  error: string | null;
  t: ReturnType<typeof useTranslation>['t'];
  colors: ReturnType<typeof useSemanticColors>;
  quick: ReturnType<typeof useBorderTokens>['quick'];
  iconSizes: ReturnType<typeof useIconSizes>;
  spacing: ReturnType<typeof useSpacingTokens>;
}

function ParkingSpotsList({ parkingSpots, loading, error, t, colors, quick, iconSizes, spacing }: ParkingSpotsListProps) {
  const typography = useTypography();

  if (loading) {
    return (
      <section className="flex items-center justify-center p-2">
        <Spinner size="large" />
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn('flex items-center gap-2 p-2', colors.text.error)}>
        <AlertCircle className={iconSizes.md} />
        <p>{error}</p>
      </section>
    );
  }

  if (parkingSpots.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center gap-2 p-2 text-center">
        <Car className={cn(iconSizes.xl2, colors.text.muted)} />
        <p className={colors.text.muted}>
          {t('projectTab.empty')}
        </p>
      </section>
    );
  }

  // ADR-777 §8.60.20 — οι μετρήσεις από το ΕΝΑ SSoT (κουβάδες του `commercialStatus`).
  const counts = countSpaceStatuses(parkingSpots);

  return (
    <section className={spacing.spaceBetween.sm}>
      {/* Summary */}
      <header className={cn('grid grid-cols-2 md:grid-cols-4', spacing.gap.sm)}>
        <article className={cn('bg-card p-2 text-center', quick.card)}>
          <p className={cn(typography.heading.h3, colors.text.accent)}>{parkingSpots.length}</p>
          <p className={typography.special.secondary}>{t('projectTab.stats.total')}</p>
        </article>
        <article className={cn('bg-card p-2 text-center', quick.card)}>
          <p className={cn(typography.heading.h3, colors.text.success)}>
            {counts.byAvailability.listed}
          </p>
          <p className={typography.special.secondary}>{t('projectTab.stats.available')}</p>
        </article>
        <article className={cn('bg-card p-2 text-center', quick.card)}>
          <p className={cn(typography.heading.h3, colors.text.warning)}>
            {counts.byAvailability.reserved}
          </p>
          <p className={typography.special.secondary}>{t('projectTab.stats.reserved')}</p>
        </article>
        <article className={cn('bg-card p-2 text-center', quick.card)}>
          <p className={cn(typography.heading.h3, colors.text.info)}>
            {counts.byAvailability.sold}
          </p>
          <p className={typography.special.secondary}>{t('projectTab.stats.sold')}</p>
        </article>
      </header>

      {/* Table */}
      <article className={cn('overflow-x-auto', quick.card)}>
        <table className={cn("w-full", typography.body.sm)}>
          <thead>
            <tr className={cn("border-b text-left", colors.text.muted)}>
              <th className={cn("p-2", typography.label.sm)}>{t('general.fields.spotCode')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('general.fields.type')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('general.fields.status')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('general.fields.floor')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('general.fields.locationZone')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('general.fields.area')}</th>
              <th className={cn("p-2 text-right", typography.label.sm)}>{t('general.fields.price')}</th>
            </tr>
          </thead>
          <tbody>
            {parkingSpots.map(spot => (
              <tr key={spot.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className={cn("p-2", typography.label.sm)}>{spot.number}</td>
                <td className="p-2">
                  <span className={cn('rounded px-2 py-1', typography.body.xs, colors.bg.accentSubtle)}>
                    {spot.type ? PARKING_TYPE_LABELS[spot.type] : '—'}
                  </span>
                </td>
                <td className="p-2">
                  <SpaceStatusBadges space={spot} />
                </td>
                <td className="p-2">{spot.floor || '—'}</td>
                <td className="p-2">
                  {spot.locationZone ? PARKING_LOCATION_ZONE_LABELS[spot.locationZone] : '—'}
                </td>
                <td className="p-2">{spot.area ? `${spot.area} m²` : '—'}</td>
                {/* ADR-777 §8.60.18/§8.60.20 — ο ΕΝΑΣ επιλυτής, με μονάδα (ήταν το @deprecated `price`, που δεν γράφεται πια ⇒ πάντα «—»). */}
                <td className="p-2 text-right">{priceCellLabel(t, resolveDisplayPrice(spot))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

export default ProjectParkingTab;
