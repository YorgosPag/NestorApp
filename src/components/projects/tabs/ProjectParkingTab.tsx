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
import { formatCurrency } from '@/lib/intl-utils';
import { ProjectFloorplanTab } from './ProjectFloorplanTab';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import {
  PARKING_TYPE_LABELS,
  PARKING_STATUS_LABELS,
  PARKING_LOCATION_ZONE_LABELS,
} from '@/types/parking';
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
  const { t: _tBuilding } = useTranslation('building');
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
          {t('projectTab.subtabs.floorplans', 'Κατόψεις')}
        </TabsTrigger>
        <TabsTrigger value="list" className="flex items-center gap-2">
          <List className={iconSizes.sm} />
          {t('projectTab.subtabs.list', 'Λίστα')}
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
          {t('projectTab.empty', 'Δεν υπάρχουν θέσεις στάθμευσης σε αυτό το έργο')}
        </p>
      </section>
    );
  }

  return (
    <section className={spacing.spaceBetween.sm}>
      {/* Summary */}
      <header className={cn('grid grid-cols-2 md:grid-cols-4', spacing.gap.sm)}>
        <article className={cn('bg-card p-2 text-center', quick.card)}>
          <p className={cn(typography.heading.h3, colors.text.accent)}>{parkingSpots.length}</p>
          <p className={typography.special.secondary}>{t('projectTab.stats.total', 'Σύνολο')}</p>
        </article>
        <article className={cn('bg-card p-2 text-center', quick.card)}>
          <p className={cn(typography.heading.h3, colors.text.success)}>
            {parkingSpots.filter(s => s.status === 'available').length}
          </p>
          <p className={typography.special.secondary}>{t('projectTab.stats.available', 'Διαθέσιμες')}</p>
        </article>
        <article className={cn('bg-card p-2 text-center', quick.card)}>
          <p className={cn(typography.heading.h3, colors.text.warning)}>
            {parkingSpots.filter(s => s.status === 'reserved').length}
          </p>
          <p className={typography.special.secondary}>{t('projectTab.stats.reserved', 'Δεσμευμένες')}</p>
        </article>
        <article className={cn('bg-card p-2 text-center', quick.card)}>
          <p className={cn(typography.heading.h3, colors.text.info)}>
            {parkingSpots.filter(s => s.status === 'sold').length}
          </p>
          <p className={typography.special.secondary}>{t('projectTab.stats.sold', 'Πωλημένες')}</p>
        </article>
      </header>

      {/* Table */}
      <article className={cn('overflow-x-auto', quick.card)}>
        <table className={cn("w-full", typography.body.sm)}>
          <thead>
            <tr className={cn("border-b text-left", colors.text.muted)}>
              <th className={cn("p-2", typography.label.sm)}>{t('fields.number', 'Αριθμός')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('fields.type', 'Τύπος')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('fields.status', 'Κατάσταση')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('fields.floor', 'Όροφος')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('fields.locationZone', 'Ζώνη')}</th>
              <th className={cn("p-2", typography.label.sm)}>{t('fields.area', 'Εμβαδόν')}</th>
              <th className={cn("p-2 text-right", typography.label.sm)}>{t('fields.price', 'Τιμή')}</th>
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
                  <ParkingStatusBadge status={spot.status || 'available'} colors={colors} />
                </td>
                <td className="p-2">{spot.floor || '—'}</td>
                <td className="p-2">
                  {spot.locationZone ? PARKING_LOCATION_ZONE_LABELS[spot.locationZone] : '—'}
                </td>
                <td className="p-2">{spot.area ? `${spot.area} m²` : '—'}</td>
                <td className="p-2 text-right">{spot.price ? formatCurrency(spot.price) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

// =============================================================================
// STATUS BADGE
// =============================================================================

function ParkingStatusBadge({ status, colors }: { status: string; colors: ReturnType<typeof useSemanticColors> }) {
  const typography = useTypography();
  const colorMap: Record<string, string> = {
    available: `${colors.bg.successSubtle} ${colors.text.success}`,
    occupied: `${colors.bg.warningSubtle} ${colors.text.warning}`,
    reserved: `${colors.bg.infoSubtle} ${colors.text.info}`,
    sold: `${colors.bg.accentSubtle} ${colors.text.accent}`,
    maintenance: `${colors.bg.errorSubtle} ${colors.text.error}`,
  };

  const label = status ? (PARKING_STATUS_LABELS[status as keyof typeof PARKING_STATUS_LABELS] || status) : '—';

  return (
    <span className={cn('rounded px-2 py-1', typography.body.xs, colorMap[status] || `${colors.bg.muted} ${colors.text.muted}`)}>
      {label}
    </span>
  );
}

export default ProjectParkingTab;
