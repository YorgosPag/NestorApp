'use client';

import { VendorMasterCard } from './cards/VendorMasterCard';
import { MaterialCatalogCard } from './cards/MaterialCatalogCard';
import { FrameworkAgreementsCard } from './cards/FrameworkAgreementsCard';
import { SpendAnalyticsCard } from './cards/SpendAnalyticsCard';

export function HubLanding() {
  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 p-4"
      aria-label="Procurement Hub"
    >
      <VendorMasterCard />
      <MaterialCatalogCard />
      <FrameworkAgreementsCard />
      <SpendAnalyticsCard />
    </section>
  );
}
