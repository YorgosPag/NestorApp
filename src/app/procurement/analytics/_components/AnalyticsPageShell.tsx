'use client';

/**
 * AnalyticsPageShell — Client wrapper for the spend analytics page.
 *
 * Hosts the procurement sub-nav and the data-driven content. Kept as a thin
 * client shell so the parent server component can perform RBAC redirects
 * before any client bundle ships.
 *
 * @see ADR-331 §2.2 Phase D
 */

import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { AnalyticsPageContent } from './AnalyticsPageContent';

export function AnalyticsPageShell() {
  const { t } = useTranslation('procurement');

  return (
    <PageContainer ariaLabel={t('analytics.title')}>
      <header className="shrink-0 px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnalyticsPageContent />
      </div>
    </PageContainer>
  );
}
