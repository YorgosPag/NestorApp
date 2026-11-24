/**
 * @module lib/navigation/company-settings-urls
 *
 * **Η ΜΙΑ δήλωση της σελίδας «Ρυθμίσεις Εταιρείας»** (ADR-ACC-018 §17.4): η διαδρομή, η παράμετρος της καρτέλας, οι
 * καρτέλες που υπάρχουν και ο builder των συνδέσμων. Η σελίδα διαβάζει από εδώ τις καρτέλες της
 * (`useActiveUrlTab`)· κάθε σύνδεσμος προς τη σελίδα χτίζεται από εδώ — **κανείς** δεν γράφει `?tab=` με το χέρι.
 *
 * 🔑 Η πρώτη καρτέλα (`info`) είναι η προεπιλογή και **δεν** γράφεται στη διεύθυνση (μία οθόνη = μία διεύθυνση),
 *    όπως στο `project-urls.ts` και στο `useActiveUrlTab`.
 * ⚠️ Χωρίς πρόθεμα χώρου — το βάζει ο `Link` του `@/lib/workspace/navigation` (CHECK 3.61).
 *
 * @see ADR-ACC-018 §17.4 · ADR-242 Βήμα 3 (`useActiveUrlTab`)
 */

import { withQuery } from '@/lib/workspace/route-worlds';

/** Η σελίδα — το ΕΝΑ κυριολεκτικό της διαδρομής (το `mandate-routes` το επανεξάγει). */
export const COMPANY_SETTINGS_ROUTE = '/settings/company' as const;

/** Το κλειδί της ενεργής καρτέλας — απόν ⇒ η προεπιλογή. */
export const COMPANY_SETTINGS_TAB_PARAM = 'tab';

/** Οι καρτέλες της σελίδας, με τη σειρά που φαίνονται· η πρώτη είναι η προεπιλογή. */
export const COMPANY_SETTINGS_TABS = ['info', 'tax', 'org', 'routing', 'boqCats', 'ai'] as const;

export type CompanySettingsTab = (typeof COMPANY_SETTINGS_TABS)[number];

export const DEFAULT_COMPANY_SETTINGS_TAB: CompanySettingsTab = COMPANY_SETTINGS_TABS[0];

/** Σύνδεσμος προς τη σελίδα — σε συγκεκριμένη καρτέλα, ή στην προεπιλογή χωρίς ερώτημα. */
export function getCompanySettingsUrl(tab: CompanySettingsTab = DEFAULT_COMPANY_SETTINGS_TAB) {
  if (tab === DEFAULT_COMPANY_SETTINGS_TAB) return COMPANY_SETTINGS_ROUTE;
  return withQuery(COMPANY_SETTINGS_ROUTE, new URLSearchParams({ [COMPANY_SETTINGS_TAB_PARAM]: tab }).toString());
}
