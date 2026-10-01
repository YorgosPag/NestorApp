import 'server-only';

/**
 * @fileoverview **ΤΟ SEO ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ ΑΝΤΙΚΕΙΜΕΝΙΚΗΣ ΑΞΙΑΣ** — τίτλος/περιγραφή/canonical και JSON-LD (`WebApplication`
 * · `HowTo` · `FAQPage` · `BreadcrumbList`), στον διακομιστή (ADR-898 Φ2).
 * @related app/(light)/ergaleia/antikeimeniki-axia/page.tsx · lib/objective-value/objective-value-page-sections.ts
 * @module services/objective-value/objective-value-seo
 *
 * 🔑 **Ίδιο ιδίωμα με τη σελίδα περιοχής** (`services/market/area-market-seo.ts`): ελληνικά, η κανονική γλώσσα του
 * ιστότοπου, από το **ίδιο** locale με την οθόνη μέσω του συγχρονισμένου μεταφραστή — κανένα δεύτερο αντίγραφο.
 *
 * 🔑 **Το `FAQPage` και το `HowTo` διαβάζουν τις ΙΔΙΕΣ λίστες με την οθόνη** (`OBJECTIVE_VALUE_FAQ` ·
 * `OBJECTIVE_VALUE_STEPS`): το δομημένο περιεχόμενο πρέπει να είναι ορατό στη σελίδα.
 */

import type { Metadata } from 'next';

import { createBundleTranslate } from '@/i18n/bundle-translate';
import elObjectiveValue from '@/i18n/locales/el/objective-value.json';
import { publicUrl } from '@/lib/http/public-origin';
import { objectiveValueHref, SEARCH_LANDING_ROUTE } from '@/lib/listings/listing-routes';
import { OBJECTIVE_VALUE_FAQ, OBJECTIVE_VALUE_STEPS } from '@/lib/objective-value/objective-value-page-sections';
import type { JsonLdValue } from '@/lib/seo/json-ld';

const NS = 'objective-value';
const t = createBundleTranslate({ [NS]: elObjectiveValue }, NS);

/** Τίτλος, περιγραφή, canonical και Open Graph. */
export function objectiveValueMetadata(): Metadata {
  const title = t(`${NS}:seo.title`);
  const description = t(`${NS}:seo.description`);
  const url = publicUrl(objectiveValueHref());
  return {
    title,
    description,
    ...(url === null ? {} : { alternates: { canonical: url } }),
    openGraph: { title, description, type: 'website', locale: 'el_GR', ...(url === null ? {} : { url }) },
  };
}

function faqPage(): JsonLdValue {
  return {
    '@type': 'FAQPage',
    mainEntity: OBJECTIVE_VALUE_FAQ.map((id) => ({
      '@type': 'Question',
      name: t(`${NS}:faq.${id}.q`),
      acceptedAnswer: { '@type': 'Answer', text: t(`${NS}:faq.${id}.a`) },
    })),
  };
}

function howTo(): JsonLdValue {
  return {
    '@type': 'HowTo',
    name: t(`${NS}:howTo.name`),
    step: OBJECTIVE_VALUE_STEPS.map((id, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text: t(`${NS}:howTo.${id}`),
    })),
  };
}

function breadcrumb(home: string, url: string): JsonLdValue {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t(`${NS}:seo.breadcrumbHome`), item: home },
      { '@type': 'ListItem', position: 2, name: t(`${NS}:seo.breadcrumbTools`) },
      { '@type': 'ListItem', position: 3, name: t(`${NS}:page.title`), item: url },
    ],
  };
}

/** Το δομημένο περιεχόμενο, ή `null` όταν δεν ξέρουμε τη δημόσια προέλευση (καμία απόλυτη διεύθυνση). */
export function objectiveValueStructuredData(): JsonLdValue | null {
  const url = publicUrl(objectiveValueHref());
  const home = publicUrl(SEARCH_LANDING_ROUTE);
  if (url === null || home === null) return null;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: t(`${NS}:page.title`),
        description: t(`${NS}:seo.description`),
        url,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        inLanguage: 'el',
        isAccessibleForFree: true,
      },
      howTo(),
      faqPage(),
      breadcrumb(home, url),
    ],
  };
}
