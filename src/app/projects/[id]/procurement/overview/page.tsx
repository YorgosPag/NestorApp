'use client';

/**
 * @module /projects/[id]/procurement/overview
 * @enterprise ADR-330 §5.1 S2 — Overview stub (5 KPIs land in S3).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function ProjectProcurementOverviewPage() {
  const { t } = useTranslation('projects');
  return (
    <section className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {t('tabs.subtabs.procurement.overviewComingSoon')}
      </p>
    </section>
  );
}
