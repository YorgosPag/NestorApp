'use client';

/**
 * @module hooks/reports/useExportCenter
 * @enterprise ADR-265 Phase 13 — Export Center state management
 */

import { useState, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, CircleDollarSign, ShoppingCart, Building2,
  Users, UserCheck, Archive, Construction, Shield, CalendarClock,
} from 'lucide-react';
import type { ExportDomainCard, ExportDomain, ExportJob } from '@/components/reports/sections/export/types';
import type { ExportFormat } from '@/components/reports/core/ReportExportBar';

// ---------------------------------------------------------------------------
// Domain catalog
// ---------------------------------------------------------------------------

const DOMAIN_CARDS: ExportDomainCard[] = [
  {
    domain: 'executive',
    titleKey: 'nav.overview',
    descriptionKey: 'executive.description',
    icon: LayoutDashboard,
    href: '/reports',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'financial',
    titleKey: 'nav.financial',
    descriptionKey: 'financial.description',
    icon: CircleDollarSign,
    href: '/reports/financial',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'sales',
    titleKey: 'nav.sales',
    descriptionKey: 'sales.description',
    icon: ShoppingCart,
    href: '/reports/sales',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'projects',
    titleKey: 'nav.projects',
    descriptionKey: 'projects.description',
    icon: Building2,
    href: '/reports/projects',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'crm',
    titleKey: 'nav.crm',
    descriptionKey: 'crm.description',
    icon: Users,
    href: '/reports/crm',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'contacts',
    titleKey: 'nav.contacts',
    descriptionKey: 'contacts.description',
    icon: UserCheck,
    href: '/reports/contacts',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'spaces',
    titleKey: 'nav.spaces',
    descriptionKey: 'spaces.description',
    icon: Archive,
    href: '/reports/spaces',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'construction',
    titleKey: 'nav.construction',
    descriptionKey: 'construction.description',
    icon: Construction,
    href: '/reports/construction',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'compliance',
    titleKey: 'nav.compliance',
    descriptionKey: 'compliance.description',
    icon: Shield,
    href: '/reports/compliance',
    formats: ['pdf', 'excel'],
  },
  {
    domain: 'schedule',
    titleKey: 'nav.schedule',
    descriptionKey: 'schedule.description',
    icon: CalendarClock,
    href: '/reports/schedule',
    formats: ['pdf', 'excel'],
  },
];

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseExportCenterReturn {
  domains: ExportDomainCard[];
  jobs: ExportJob[];
  exportingDomains: Set<string>;
  handleExport: (domain: ExportDomain, format: ExportFormat) => void;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useExportCenter(): UseExportCenterReturn {
  const [jobs, setJobs] = useState<ExportJob[]>([]);

  const exportingDomains = useMemo(
    () => new Set(jobs.filter(j => j.status === 'exporting').map(j => j.domain)),
    [jobs],
  );

  const handleExport = useCallback(async (domain: ExportDomain, format: ExportFormat) => {
    const jobIndex = jobs.length;

    setJobs(prev => [...prev, { domain, format, status: 'exporting' }]);

    try {
      // Dynamic import the exporters only when needed
      const { apiClient } = await import('@/lib/api/enterprise-api-client');

      // Map domain to API route
      const apiRoute = domain === 'executive'
        ? '/api/reports/financial'
        : `/api/reports/${domain}`;

      const data = await apiClient.get(apiRoute);

      if (format === 'pdf') {
        const { exportReportToPdf } = await import('@/services/report-engine/report-pdf-exporter');
        await exportReportToPdf({
          title: domain.charAt(0).toUpperCase() + domain.slice(1) + ' Report',
          orientation: 'portrait',
          filename: `report-${domain}-${new Date().toISOString().slice(0, 10)}.pdf`,
          kpiCards: [],
          tables: [{
            title: 'Report Data',
            headers: ['Key', 'Value'],
            rows: Object.entries(data as Record<string, unknown>)
              .filter(([k]) => k !== 'generatedAt')
              .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]),
          }],
        });
      } else if (format === 'excel') {
        const { exportReportToExcel } = await import('@/services/report-engine/report-excel-exporter');
        await exportReportToExcel({
          title: domain.charAt(0).toUpperCase() + domain.slice(1) + ' Report',
          filename: `report-${domain}-${new Date().toISOString().slice(0, 10)}.xlsx`,
          summaryRows: Object.entries(data as Record<string, unknown>)
            .filter(([k]) => k !== 'generatedAt' && typeof (data as Record<string, unknown>)[k] !== 'object')
            .map(([k, v]) => ({ metric: k, value: typeof v === 'number' ? v : String(v) })),
          detailColumns: [
            { header: 'Key', key: 'key', width: 30 },
            { header: 'Value', key: 'value', width: 50 },
          ],
          detailRows: Object.entries(data as Record<string, unknown>)
            .filter(([k]) => k !== 'generatedAt')
            .map(([k, v]) => ({
              key: k,
              value: typeof v === 'object' ? JSON.stringify(v) : String(v),
            })),
        });
      }

      setJobs(prev => prev.map((j, i) =>
        i === jobIndex ? { ...j, status: 'done' as const } : j,
      ));
    } catch (err) {
      setJobs(prev => prev.map((j, i) =>
        i === jobIndex ? { ...j, status: 'error' as const, error: String(err) } : j,
      ));
    }
  }, [jobs.length]);

  return {
    domains: DOMAIN_CARDS,
    jobs,
    exportingDomains,
    handleExport,
  };
}
