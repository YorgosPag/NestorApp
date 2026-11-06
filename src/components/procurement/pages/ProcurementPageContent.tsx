'use client';

/**
 * @module procurement/hub
 * @enterprise ADR-330 §1.C — Top-level Hub redesign (S5)
 *
 * Replaces the old PO list split-panel with a Hub landing page.
 * Company-wide master data (Vendor, Material, Agreements, Analytics)
 * via 4 placeholder cards — each pointing to its own sub-section.
 */

import { Package } from 'lucide-react';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { PageHeader } from '@/core/headers';
import { ProcurementSectionShell } from '@/subapps/procurement/components/ProcurementSectionShell';
import { HubLanding } from '@/components/procurement/hub/HubLanding';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function ProcurementPageContent() {
  const { t } = useTranslation('procurement');

  return (
    <ProcurementSectionShell ariaLabel={t('hub.pageLabel')}>
      <PageHeader
        title={{ icon: Package, title: t('hub.pageLabel') }}
        breadcrumb={<ModuleBreadcrumb />}
      />

      <HubLanding />
    </ProcurementSectionShell>
  );
}

export default ProcurementPageContent;
