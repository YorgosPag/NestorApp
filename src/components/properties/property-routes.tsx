'use client';

/**
 * Μητρώο τεμπέλικων διαδρομών του τομέα «ακίνητα» — ADR-954.
 *
 * Ο τομέας **κατέχει** τις σελίδες του (feature module, όπως το `loadChildren` του Angular / τα module
 * bundles του Odoo): η σελίδα εισάγει **μόνο** αυτό το αρχείο, άρα η μεταγλώττισή της δεν φτάνει σε
 * άλλον τομέα. Ένα κοινό μητρώο όλων των σελίδων έκανε κάθε σελίδα να μεταγλωττίζει **όλες** τις άλλες
 * (ADR-954 §1) — ⚠️ ΜΗΝ το ξαναφτιάξεις ενώνοντας μητρώα.
 *
 * ⚠️ Επίπεδο 2 (CHECK 3.80): εισάγει **μόνο** το factory. Το αρχείο είναι στο `lazyRouteRegistries`
 * (`scripts/lib/i18n-shell-slice/config.js`), ώστε το chunk να περιμένει τα κείμενά του (ADR-280 §11.8).
 *
 * @module components/properties/property-routes
 * @enterprise ADR-954 · ADR-294 · ADR-280 §11.8
 */

import { defineLazyRoutes } from '@/utils/lazyRouteFactory';

export const PropertyRoutes = defineLazyRoutes({
  Properties: {
    load: () => import('@/components/properties/PropertiesPageContent').then(mod => ({ default: mod.PropertiesPageContent })),
    loadingType: 'list', ssr: false,
  },

  // ADR-280 §11.8 Β4.3 — η καρτέλα ακινήτου (`/properties/[id]`): το chunk φέρνει τα κείμενά του (BIM/κάτοψη).
  PropertyDetail: {
    load: () => import('@/components/properties/detail/PropertyDetailPageContent').then(mod => ({ default: mod.PropertyDetailPageContent })),
    loadingType: 'list', ssr: false,
  },
});
