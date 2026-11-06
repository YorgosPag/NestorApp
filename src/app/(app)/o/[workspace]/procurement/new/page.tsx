'use client';

/**
 * @module /procurement/new
 * @enterprise ADR-330 S6 — PO create form at dedicated route.
 *   Restores PO creation after deletion of the [poId] catch-all in S5.
 *   ProcurementDetailPageContent reads params.poId ?? 'new' and
 *   searchParams.get('projectId') for the initialProjectId.
 * ADR-928 §5.24.1 — λεπτός φάκελος: το ΕΝΑ κέλυφος της ενότητας (υποπλοήγηση) μπαίνει ΕΔΩ, όχι μέσα στο
 *   `ProcurementDetailPageContent`, γιατί τον ίδιο κορμό αποδίδει και το έργο (`projects/[id]/procurement/po/[poId]`).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ProcurementSectionShell } from '@/subapps/procurement/components/ProcurementSectionShell';
import { LazyRoutes } from '@/utils/lazyRoutes';
// ADR-781 §19 — το κέλυφος (υποπλοήγηση) αποδίδεται ΕΞΩ από το όριο `next/dynamic` του κορμού, άρα στον server: χωρίς
// το slice, το `procurement` (εκτός κελύφους) θα έβγαινε ωμά κλειδιά στο HTML. Καταχωρείται πριν από κάθε απόδοση.
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__new.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const ProcurementDetail = LazyRoutes.ProcurementDetail;

export default function NewPurchaseOrderPage() {
  const { t } = useTranslation('procurement');
  return (
    <ProcurementSectionShell ariaLabel={t('nav.purchaseOrders')} scroll="shell">
      <ProcurementDetail />
    </ProcurementSectionShell>
  );
}
