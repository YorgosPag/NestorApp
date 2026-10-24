/**
 * @fileoverview **Τα λόγια της προέλευσης ενός φακέλου** — ένα κλειδί ανά κατάσταση παράδοσης, για το σήμα και την εξήγηση.
 * @related ADR-916 Φ-Β2 · Φ-Δ.5 (Ο22) · `PropertyDossierOrigin` · άγκυρα `property-dossier-origin-labels.test.ts`
 * @module components/property-dossier/property-dossier-origin-labels
 *
 * 🔑 Ο τύπος `Record<PropertyHandoverLifecycle, …>` φυλά την **πληρότητα** του πίνακα· την **άλλη άκρη** (το κλειδί υπάρχει
 * με πραγματικό κείμενο σε el **και** en) τη φυλά η άγκυρα — η `withdrawn` γεννήθηκε χωρίς λόγια και ο αγοραστής θα έβλεπε
 * ωμό κλειδί (Ο22).
 */

import type { PropertyHandoverLifecycle } from '@/types/property-handover';

/** Το σήμα — λέξη, όχι χρώμα (CHECK 3.41). */
export const DOSSIER_ORIGIN_LIFECYCLE_KEY: Readonly<Record<PropertyHandoverLifecycle, string>> = {
  'awaiting-completion': 'property-market:dossier.origin.lifecycle.awaiting-completion',
  ready: 'property-market:dossier.origin.lifecycle.ready',
  cancelled: 'property-market:dossier.origin.lifecycle.cancelled',
  withdrawn: 'property-market:dossier.origin.lifecycle.withdrawn',
};

/** Τι σημαίνει η κατάσταση **για τον άνθρωπο** — μόνο στη σελίδα του φακέλου. */
export const DOSSIER_ORIGIN_EXPLAIN_KEY: Readonly<Record<PropertyHandoverLifecycle, string>> = {
  'awaiting-completion': 'property-market:dossier.origin.explain.awaiting-completion',
  ready: 'property-market:dossier.origin.explain.ready',
  cancelled: 'property-market:dossier.origin.explain.cancelled',
  // ADR-916 Φ-Δ.5 — «ό,τι παραδόθηκε μένει δικό σας»: ποτέ η αιτιολογία του γραφείου (Δ10).
  withdrawn: 'property-market:dossier.origin.explain.withdrawn',
};
