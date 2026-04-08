'use client';

/**
 * @module reports/contacts
 * @enterprise ADR-265 Phase 9 — Contacts & Customers Report Dashboard
 * @lazy ADR-294 Batch 2 — Extracted for dynamic import
 *
 * KPIs, type/status distribution, personas, geography, top buyers.
 */

import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useContactsReport } from '@/hooks/reports/useContactsReport';
import {
  ContactsKPIs,
  ContactDistributionChart,
  PersonaDistributionChart,
  GeographicDistributionChart,
  TopBuyersTable,
} from '@/components/reports/sections/contacts';

export function ReportsContactsPageContent() {
  const { t } = useTranslation('reports');
  const report = useContactsReport();

  return (
    <ReportPage
      title={t('nav.contacts')}
      description={t('contacts.description')}
      icon={Users}
      onRefresh={report.refetch}
    >
      <ContactsKPIs kpis={report.kpis} loading={report.loading} />

      <ContactDistributionChart
        typeData={report.typePie}
        statusData={report.statusPie}
        loading={report.loading}
      />

      <PersonaDistributionChart data={report.personaBars} loading={report.loading} />

      <GeographicDistributionChart data={report.cityBars} loading={report.loading} />

      <TopBuyersTable data={report.topBuyers} loading={report.loading} />
    </ReportPage>
  );
}

export default ReportsContactsPageContent;
