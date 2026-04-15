'use client';

/**
 * @module hooks/reports/useContactsReport
 * @enterprise ADR-265 Phase 9 — Contacts & Customers Report hook
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, UserPlus, UserCheck, Building2,
  MapPin, Briefcase, CheckCircle, TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type {
  ContactsReportPayload,
  CityDistributionItem,
} from '@/components/reports/sections/contacts/types';
import type { TopBuyerItem } from '@/services/report-engine';
import { getErrorMessage } from '@/lib/error-utils';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ---------------------------------------------------------------------------
// Cache (ADR-300: module-level stale-while-revalidate)
// ---------------------------------------------------------------------------

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const contactsReportCache = createStaleCache<ContactsReportPayload>('report-contacts');

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseContactsReportReturn {
  kpis: ReportKPI[];
  typePie: { name: string; value: number }[];
  statusPie: { name: string; value: number }[];
  personaBars: { persona: string; count: number }[];
  cityBars: CityDistributionItem[];
  topBuyers: TopBuyerItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Pure transforms
// ---------------------------------------------------------------------------

function buildContactKPIs(
  data: ContactsReportPayload,
  t: (key: string) => string,
): ReportKPI[] {
  const activeCount = data.byStatus['active'] ?? 0;
  const companyCount = data.byType['company'] ?? 0;
  const personaCount = Object.keys(data.byPersona).filter(k => k !== 'unknown').length;
  const cityCount = Object.keys(data.byCity).length;

  return [
    { title: t('contacts.kpis.total'), value: data.total, icon: Users, color: 'blue' as const },
    { title: t('contacts.kpis.active'), value: activeCount, icon: UserCheck, color: 'green' as const },
    { title: t('contacts.kpis.newInPeriod'), value: data.newInPeriod, icon: UserPlus, color: 'cyan' as const },
    { title: t('contacts.kpis.companies'), value: companyCount, icon: Building2, color: 'purple' as const },
    { title: t('contacts.kpis.cities'), value: cityCount, icon: MapPin, color: 'orange' as const },
    { title: t('contacts.kpis.personas'), value: personaCount, icon: Briefcase, color: 'indigo' as const },
    { title: t('contacts.kpis.completeness'), value: `${data.completenessRate}%`, icon: CheckCircle, color: 'pink' as const },
    { title: t('contacts.kpis.topBuyers'), value: data.topBuyers.length, icon: TrendingUp, color: 'yellow' as const },
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

function buildPersonaBars(
  data: Record<string, number>,
  t: (key: string) => string,
): { persona: string; count: number }[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([persona, count]) => ({
      persona: t(`contacts.personas.${persona}`),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildCityBars(data: Record<string, number>): CityDistributionItem[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useContactsReport(): UseContactsReportReturn {
  const { t } = useTranslation('reports');
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [payload, setPayload] = useState<ContactsReportPayload | null>(contactsReportCache.get());
  const [loading, setLoading] = useState(!contactsReportCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!contactsReportCache.hasLoaded() || force) setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<ContactsReportPayload>(
        '/api/reports/contacts',
      );
      // ADR-300: Write to module-level cache so next remount skips spinner
      contactsReportCache.set(data);
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
    () => payload ? buildContactKPIs(payload, t) : [],
    [payload, t],
  );
  const typePie = useMemo(
    () => payload ? buildRecordPie(payload.byType, 'contacts.types', t) : [],
    [payload, t],
  );
  const statusPie = useMemo(
    () => payload ? buildRecordPie(payload.byStatus, 'contacts.statuses', t) : [],
    [payload, t],
  );
  const personaBars = useMemo(
    () => payload ? buildPersonaBars(payload.byPersona, t) : [],
    [payload, t],
  );
  const cityBars = useMemo(
    () => payload ? buildCityBars(payload.byCity) : [],
    [payload],
  );

  return {
    kpis,
    typePie,
    statusPie,
    personaBars,
    cityBars,
    topBuyers: payload?.topBuyers ?? [],
    loading,
    error,
    refetch,
  };
}
