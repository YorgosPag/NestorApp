'use client';

/**
 * @module /procurement
 * @enterprise ADR-267 — Procurement Dashboard
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 *
 * ADR-928 §5.24.2 — το ΕΝΑ κέλυφος της ενότητας (υποπλοήγηση) μπαίνει ΕΔΩ, έξω από το όριο `next/dynamic` του κορμού,
 *   όπως σε κάθε άλλη σελίδα της ενότητας. Μετρημένο ζωντανά (2026-11-06): η αρχική ήταν η ΜΟΝΗ σελίδα όπου η
 *   υποπλοήγηση έλειπε από το HTML του server ⇒ στο F5 εμφανιζόταν μετά το «Φόρτωση…» και η σελίδα πηδούσε.
 *   `scroll="shell"`: η αρχική είναι έγγραφο που ρέει (κάρτες + ταμπλό) χωρίς δική του κύλιση· με την προεπιλογή
 *   `'self'` το `overflow-hidden` του κελύφους έκοβε ό,τι δεν χωρούσε (στενή/χαμηλή οθόνη, κινητό σε μία στήλη).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ProcurementSectionShell } from '@/subapps/procurement/components/ProcurementSectionShell';
import { LazyRoutes } from '@/utils/lazyRoutes';
// ADR-781 §19 — το κέλυφος αποδίδεται στον server· το `procurement` ΔΕΝ είναι στο κέλυφος της εφαρμογής ⇒ χωρίς το
// slice, ωμά κλειδιά στο HTML. Καταχωρείται πριν από κάθε απόδοση.
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const Procurement = LazyRoutes.Procurement;

export default function ProcurementPage() {
  const { t } = useTranslation('procurement');
  return (
    <ProcurementSectionShell ariaLabel={t('hub.pageLabel')} scroll="shell">
      <Procurement />
    </ProcurementSectionShell>
  );
}
