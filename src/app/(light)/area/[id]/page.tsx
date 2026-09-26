/**
 * `/area/<ταυτότητα ADR-883>` — **η δημόσια σελίδα αγοράς μιας περιοχής** (ADR-890 Φ1): Δήμος ή Δημοτική Ενότητα.
 *
 * 🔑 **ΤΡΕΙΣ ΕΚΒΑΣΕΙΣ** (ίδιο ιδίωμα με το `/pro/[alias]`): άγνωστη ταυτότητα ή βαθμίδα χωρίς σελίδα ⇒ **404** ·
 * «δεν μπόρεσα να ρωτήσω» (ευρετήριο ή Firestore) ⇒ **5xx** μέσω `throwBackendUnavailable`, **ποτέ** 404 και ποτέ
 * 200 με οθόνη σφάλματος (soft 404) · αλλιώς η σελίδα.
 *
 * 🔑 **SEO (ADR-890 §5.5)**: απόδοση στον διακομιστή, `generateMetadata` ανά περιοχή, canonical, JSON-LD
 * (`AdministrativeArea` + `BreadcrumbList`) μέσα στο HTML που στέλνεται. Περιοχή **χωρίς καμία αγγελία** ⇒
 * `noindex`: σελίδα χωρίς περιεχόμενο είναι «λεπτή» σελίδα κατά Google, και θα έβλαπτε τις υπόλοιπες.
 * ⚠️ Ο ευρετηριασμός ολόκληρου του ιστότοπου είναι σήμερα κλειστός (`public/robots.txt` = `Disallow: /`) —
 * απόφαση έναρξης λειτουργίας (ADR-890 §5.5), όχι αυτής της σελίδας.
 *
 * 🔑 **ISR 15′**: οι τιμές αλλάζουν μία φορά τη νύχτα και οι αγγελίες λίγες φορές την ημέρα· κάθε προβολή δεν
 * χρειάζεται δικές της αναγνώσεις Firestore. Το `cache()` κάνει τα `generateMetadata` και `page` να μοιράζονται
 * **μία** φόρτωση ανά αίτημα.
 *
 * ⚠️ **Το `params` είναι `Promise` (Next 15)**, και η ταυτότητα έρχεται είτε ως `municipality:0701` είτε
 * κωδικοποιημένη (`municipality%3A0701`) — δεχόμαστε και τις δύο.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import React, { cache, Suspense } from 'react';

import { AreaMarketContent } from '@/components/area-market/AreaMarketContent';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { StaticPageLoading } from '@/core/states';
import { throwBackendUnavailable } from '@/lib/errors/backend-unavailable';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { marketDayOf } from '@/lib/listings/listing-stats';
import { areaMarketMetadataCopy, areaMarketStructuredData } from '@/services/market/area-market-seo';
import { loadAreaMarketPage } from '@/services/market/area-market-page.service';
import type { AreaMarketPageData } from '@/types/area-market';

export const revalidate = 900;

interface AreaMarketPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/** `%3A` ⇒ `:` · κακοσχηματισμένο `%` ⇒ `null` (404), ποτέ `URIError` προς τον επισκέπτη. */
function decodeAreaId(rawId: string): string | null {
  try {
    return decodeURIComponent(rawId);
  } catch {
    return null;
  }
}

/** Η μία φόρτωση ανά αίτημα — `found` ή `null` (404)· ρίχνει 5xx όταν δεν μπορέσαμε να ρωτήσουμε. */
const loadPage = cache(async (rawId: string): Promise<AreaMarketPageData | null> => {
  const areaId = decodeAreaId(rawId);
  if (areaId === null) return null;
  const page = await loadAreaMarketPage(getAdminFirestore(), areaId, marketDayOf(Date.now()));
  if (page.kind === 'unavailable') throwBackendUnavailable('area-market');
  return page.kind === 'found' ? page : null;
});

export async function generateMetadata({ params }: AreaMarketPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await loadPage(id);
  return data === null ? {} : areaMarketMetadataCopy(data);
}

export default async function AreaMarketPage({ params }: AreaMarketPageProps) {
  const { id } = await params;
  const data = await loadPage(id);
  if (data === null) notFound();

  const structuredData = areaMarketStructuredData(data);
  return (
    <>
      {structuredData === null ? null : <JsonLdScript data={structuredData} />}
      <Suspense fallback={<StaticPageLoading />}>
        <AreaMarketContent data={data} />
      </Suspense>
    </>
  );
}
