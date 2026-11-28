'use client';

/**
 * Μητρώο τεμπέλικων διαδρομών του τομέα «συγγραφές υποχρεώσεων» — ADR-954.
 *
 * Ο τομέας **κατέχει** τις σελίδες του (feature module, όπως το `loadChildren` του Angular / τα module
 * bundles του Odoo): η σελίδα εισάγει **μόνο** αυτό το αρχείο, άρα η μεταγλώττισή της δεν φτάνει σε
 * άλλον τομέα. Ένα κοινό μητρώο όλων των σελίδων έκανε κάθε σελίδα να μεταγλωττίζει **όλες** τις άλλες
 * (ADR-954 §1) — ⚠️ ΜΗΝ το ξαναφτιάξεις ενώνοντας μητρώα.
 *
 * ⚠️ Επίπεδο 2 (CHECK 3.80): εισάγει **μόνο** το factory. Το αρχείο είναι στο `lazyRouteRegistries`
 * (`scripts/lib/i18n-shell-slice/config.js`), ώστε το chunk να περιμένει τα κείμενά του (ADR-280 §11.8).
 *
 * @module components/obligations/obligation-routes
 * @enterprise ADR-954 · ADR-294 · ADR-280 §11.8
 */

import { defineLazyRoutes } from '@/utils/lazyRouteFactory';

export const ObligationRoutes = defineLazyRoutes({
  ObligationsHub: {
    load: () => import('@/components/obligations/pages/ObligationsHubPageContent').then(mod => ({ default: mod.ObligationsHubPageContent })),
    loadingType: 'list', ssr: false,
  },

  // Form routes (ADR-294 Batch 8 — replaced placeholder components with real implementations)
  ObligationsNew: {
    load: () => import('@/components/obligations/pages/NewObligationPageContent').then(mod => ({ default: mod.NewObligationPageContent })),
    loadingType: 'form', ssr: false,
  },

  ObligationsEdit: {
    load: () => import('@/components/obligations/pages/EditObligationPageContent').then(mod => ({ default: mod.EditObligationPageContent })),
    loadingType: 'form', ssr: false,
  },
});
