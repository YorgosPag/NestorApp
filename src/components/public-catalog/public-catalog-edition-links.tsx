'use client';

/**
 * @fileoverview **Οι σύνδεσμοι των δημόσιων εντύπων** (ADR-923 §5.15.3) — ένα σημείο για το ράφι και τον αναγνώστη: πώς ανοίγει
 *   ένα έντυπο και πώς γυρνά κανείς στον προμηθευτή.
 * @module components/public-catalog/public-catalog-edition-links
 *
 * 🔑 Άνοιγμα με **σύνδεσμο**: βαθύς σύνδεσμος, νέα καρτέλα, ιστορικό — η βιτρίνα είναι ιστός, όχι εφαρμογή. Το τμήμα της διεύθυνσης
 *    βγαίνει από τον **ίδιο** builder με τον διακομιστή (κανονική μορφή, 308).
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';

import type { CatalogEditionOpener } from '@/components/catalog/editions/CatalogEditionShelf';
import { publicCatalogEditionRoute, publicCatalogEditionSegmentOf, publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import { usePublicCatalogText } from './public-catalog-text';

export const publicEditionOpener = (segment: string): CatalogEditionOpener => ({
  kind: 'link',
  hrefOf: (edition) => publicCatalogEditionRoute(segment, publicCatalogEditionSegmentOf(edition)),
});

export function BackToSupplier({ segment, legalName }: { readonly segment: string; readonly legalName: string }) {
  const { t } = usePublicCatalogText();
  return <p className="m-0 text-sm"><Link href={publicSupplierRoute(segment)}>{t('editions.backToSupplier', { name: legalName })}</Link></p>;
}
