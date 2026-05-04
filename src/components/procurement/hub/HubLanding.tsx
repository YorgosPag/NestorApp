'use client';

import { RfqCard } from './cards/RfqCard';
import { QuotesCard } from './cards/QuotesCard';
import { PurchaseOrdersCard } from './cards/PurchaseOrdersCard';
import { VendorMasterCard } from './cards/VendorMasterCard';
import { MaterialCatalogCard } from './cards/MaterialCatalogCard';
import { FrameworkAgreementsCard } from './cards/FrameworkAgreementsCard';
import { ProcurementDashboardSection } from './ProcurementDashboardSection';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function HubLanding() {
  const { t } = useTranslation('procurement');

  return (
    <>
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 p-4"
        aria-label={t('hub.pageLabel')}
      >
        <RfqCard />
        <QuotesCard />
        <PurchaseOrdersCard />
        <VendorMasterCard />
        <MaterialCatalogCard />
        <FrameworkAgreementsCard />
      </section>
      <ProcurementDashboardSection />
    </>
  );
}
