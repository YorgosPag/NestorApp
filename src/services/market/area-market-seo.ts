import 'server-only';

/**
 * @fileoverview **ΤΟ SEO ΤΗΣ ΣΕΛΙΔΑΣ ΠΕΡΙΟΧΗΣ** — τίτλος/περιγραφή/canonical/robots και JSON-LD, στον διακομιστή
 * (ADR-890 §5.5).
 * @related app/(light)/area/[id]/page.tsx · lib/seo/json-ld.ts · i18n/bundle-translate.ts
 * @module services/market/area-market-seo
 *
 * 🔑 **Στα ελληνικά, την κανονική γλώσσα του ιστότοπου.** Η γλώσσα του επισκέπτη είναι προτίμηση πελάτη, όχι
 * διεύθυνση· ο ανιχνευτής βλέπει μία διεύθυνση και μία γλώσσα (`<html lang="el">`). Κείμενα από το **ίδιο**
 * locale με την οθόνη (`area-market`), μέσω του συγχρονισμένου μεταφραστή — κανένα δεύτερο αντίγραφο.
 *
 * 🔑 **Λεπτή σελίδα ⇒ `noindex`**: περιοχή χωρίς καμία αγγελία δεν έχει τι να πει σε αναζήτηση.
 */

import type { Metadata } from 'next';

import { createBundleTranslate } from '@/i18n/bundle-translate';
import elAreaMarket from '@/i18n/locales/el/area-market.json';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import { publicUrl } from '@/lib/http/public-origin';
import { areaMarketHref } from '@/lib/listings/listing-routes';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import { hasAreaMarketPage, type AreaMarketPageData } from '@/types/area-market';

const t = createBundleTranslate({ 'area-market': elAreaMarket }, 'area-market');

/** Τίτλος, περιγραφή, canonical, robots και Open Graph μιας περιοχής. */
export function areaMarketMetadataCopy(data: AreaMarketPageData): Metadata {
  const name = data.area.name;
  const hasListings = data.listings.total > 0;
  const title = t('area-market:meta.title', { name });
  const description = t(hasListings ? 'area-market:meta.description' : 'area-market:meta.descriptionEmpty', { name });
  const url = publicUrl(areaMarketHref(data.area.id));
  return {
    title,
    description,
    ...(url === null ? {} : { alternates: { canonical: url } }),
    robots: { index: hasListings, follow: true },
    openGraph: { title, description, type: 'website', locale: 'el_GR', ...(url === null ? {} : { url }) },
  };
}

function breadcrumbItem(area: AdminArea, position: number): JsonLdValue {
  const url = hasAreaMarketPage(area.level) ? publicUrl(areaMarketHref(area.id)) : null;
  return { '@type': 'ListItem', position, name: area.name, ...(url === null ? {} : { item: url }) };
}

/** `AdministrativeArea` + `BreadcrumbList`, ή `null` όταν δεν ξέρουμε ποιοι είμαστε (καμία δημόσια προέλευση). */
export function areaMarketStructuredData(data: AreaMarketPageData): JsonLdValue | null {
  const url = publicUrl(areaMarketHref(data.area.id));
  if (url === null) return null;
  const chain = [...data.ancestors].reverse();
  const parent = data.ancestors[0];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AdministrativeArea',
        name: data.area.name,
        url,
        ...(parent === undefined ? {} : { containedInPlace: { '@type': 'AdministrativeArea', name: parent.name } }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [...chain, data.area].map((area, index) => breadcrumbItem(area, index + 1)),
      },
    ],
  };
}
