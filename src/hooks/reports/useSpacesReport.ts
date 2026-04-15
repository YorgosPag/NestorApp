'use client';

/**
 * @module hooks/reports/useSpacesReport
 * @enterprise ADR-265 Phase 10 — Spaces (Parking/Storage) Report hook
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ParkingCircle, Warehouse, BarChart3, CircleDollarSign,
  Ruler, TrendingUp, ShoppingCart, Percent, Link, Unlink,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type {
  SpacesReportPayload,
  BuildingValueItem,
} from '@/components/reports/sections/spaces/types';
import { getErrorMessage } from '@/lib/error-utils';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const spacesReportCache = createStaleCache<SpacesReportPayload>('report-spaces');

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseSpacesReportReturn {
  kpis: ReportKPI[];
  parkingStatusPie: { name: string; value: number }[];
  parkingTypePie: { name: string; value: number }[];
  parkingZonePie: { name: string; value: number }[];
  storageStatusPie: { name: string; value: number }[];
  storageTypePie: { name: string; value: number }[];
  buildingValues: BuildingValueItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Pure transforms
// ---------------------------------------------------------------------------

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatArea(sqm: number): string {
  return `${sqm.toLocaleString('el-GR')} m²`;
}

function buildSpaceKPIs(
  data: SpacesReportPayload,
  t: (key: string) => string,
): ReportKPI[] {
  return [
    { title: t('spaces.kpis.totalParking'), value: data.parking.total, icon: ParkingCircle, color: 'blue' as const },
    { title: t('spaces.kpis.totalStorage'), value: data.storage.total, icon: Warehouse, color: 'purple' as const },
    { title: t('spaces.kpis.parkingUtilization'), value: `${data.parking.utilizationRate}%`, icon: Percent, color: 'green' as const },
    { title: t('spaces.kpis.storageUtilization'), value: `${data.storage.utilizationRate}%`, icon: BarChart3, color: 'orange' as const },
    { title: t('spaces.kpis.totalValue'), value: formatEuro(data.parking.totalValue + data.storage.totalValue), icon: CircleDollarSign, color: 'cyan' as const },
    { title: t('spaces.kpis.totalArea'), value: formatArea(data.storage.totalArea), icon: Ruler, color: 'indigo' as const },
    { title: t('spaces.kpis.avgPricePerSqm'), value: formatEuro(data.storage.avgPricePerSqm), icon: TrendingUp, color: 'pink' as const },
    { title: t('spaces.kpis.totalSold'), value: data.parking.soldCount + data.storage.soldCount, icon: ShoppingCart, color: 'yellow' as const },
    { title: t('spaces.kpis.linked'), value: data.linkedSpaces, icon: Link, color: 'green' as const },
    { title: t('spaces.kpis.unlinked'), value: data.unlinkedSpaces, icon: Unlink, color: 'red' as const },
  ];
}

function buildRecordPie(
  data: Record<string, number>,
  ns: string,
  t: (key: string) => string,
): { name: string; value: number }[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: t(`${ns}.${key}`), value }));
}

function buildBuildingValues(
  parkingByBuilding: Record<string, number>,
  storageByBuilding: Record<string, number>,
): BuildingValueItem[] {
  const allBuildings = new Set([
    ...Object.keys(parkingByBuilding),
    ...Object.keys(storageByBuilding),
  ]);

  return Array.from(allBuildings)
    .filter(b => b !== 'unassigned')
    .map(building => ({
      building,
      parkingValue: parkingByBuilding[building] ?? 0,
      storageValue: storageByBuilding[building] ?? 0,
    }))
    .sort((a, b) => (b.parkingValue + b.storageValue) - (a.parkingValue + a.storageValue))
    .slice(0, 15);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useSpacesReport(): UseSpacesReportReturn {
  const { t } = useTranslation('reports');
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [payload, setPayload] = useState<SpacesReportPayload | null>(spacesReportCache.get());
  const [loading, setLoading] = useState(!spacesReportCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!spacesReportCache.hasLoaded() || force) setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<SpacesReportPayload>(
        '/api/reports/spaces',
      );
      // ADR-300: Write to module-level cache so next remount skips spinner
      spacesReportCache.set(data);
      setPayload(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  const kpis = useMemo(
    () => payload ? buildSpaceKPIs(payload, t) : [],
    [payload, t],
  );
  const parkingStatusPie = useMemo(
    () => payload ? buildRecordPie(payload.parking.byStatus, 'spaces.parking.statuses', t) : [],
    [payload, t],
  );
  const parkingTypePie = useMemo(
    () => payload ? buildRecordPie(payload.parking.byType, 'spaces.parking.types', t) : [],
    [payload, t],
  );
  const parkingZonePie = useMemo(
    () => payload ? buildRecordPie(payload.parking.byZone, 'spaces.parking.zones', t) : [],
    [payload, t],
  );
  const storageStatusPie = useMemo(
    () => payload ? buildRecordPie(payload.storage.byStatus, 'spaces.storage.statuses', t) : [],
    [payload, t],
  );
  const storageTypePie = useMemo(
    () => payload ? buildRecordPie(payload.storage.byType, 'spaces.storage.types', t) : [],
    [payload, t],
  );
  const buildingValues = useMemo(
    () => payload ? buildBuildingValues(payload.parking.byBuilding, payload.storage.byBuilding) : [],
    [payload],
  );

  return {
    kpis,
    parkingStatusPie,
    parkingTypePie,
    parkingZonePie,
    storageStatusPie,
    storageTypePie,
    buildingValues,
    loading,
    error,
    refetch,
  };
}
