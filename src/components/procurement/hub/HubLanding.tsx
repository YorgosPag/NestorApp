'use client';

import { RfqCard } from './cards/RfqCard';
import { QuotesCard } from './cards/QuotesCard';
import { PurchaseOrdersCard } from './cards/PurchaseOrdersCard';
import { VendorMasterCard } from './cards/VendorMasterCard';
import { MaterialCatalogCard } from './cards/MaterialCatalogCard';
import { FrameworkAgreementsCard } from './cards/FrameworkAgreementsCard';
import { SpendAnalyticsCard } from './cards/SpendAnalyticsCard';
import { ProcurementDashboardSection } from './ProcurementDashboardSection';

export function HubLanding() {
  return (
    <>
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 p-4"
        aria-label="Procurement Hub"
      >
        <RfqCard />
        <QuotesCard />
        <PurchaseOrdersCard />
        <VendorMasterCard />
        <MaterialCatalogCard />
        <FrameworkAgreementsCard />
        <SpendAnalyticsCard />
      </section>
      <ProcurementDashboardSection />
    </>
  );
}
