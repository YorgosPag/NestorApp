'use client';

/**
 * AnalyticsPageShell — Client wrapper for the spend analytics page.
 *
 * Hosts the data-driven content inside the procurement section shell
 * (`ProcurementSectionShell`, ADR-928 §5.24 — sub-nav + one scroll region). Kept as a thin
 * client shell so the parent server component can perform RBAC redirects
 * before any client bundle ships.
 *
 * @see ADR-331 §2.2 Phase D
 */

import { ProcurementSectionShell } from '@/subapps/procurement/components/ProcurementSectionShell';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { AnalyticsPageContent } from './AnalyticsPageContent';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__analytics.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function AnalyticsPageShell() {
  const { t } = useTranslation('procurement');

  return (
    <ProcurementSectionShell ariaLabel={t('analytics.title')} scroll="shell">
      <AnalyticsPageContent />
    </ProcurementSectionShell>
  );
}
