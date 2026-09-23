'use client';

/**
 * **Όσα ακίνητα του κατόχου ΔΕΝ είναι στον χάρτη — και γιατί** (ADR-777 §8.71).
 *
 * 🏆 Ο δημόσιος χάρτης λέει «N ακόμη χωρίς θέση»· εδώ ο κάτοχος μαθαίνει **γιατί** λείπει
 * κάθε ακίνητο από τον κόσμο (εκτός αγοράς · η δημοσίευση απέτυχε · χωρίς θέση στον χάρτη),
 * με τη θεραπεία ένα κλικ μακριά: την κάρτα του. Η αιτία βγαίνει από τον **έναν** κριτή
 * (`partitionOwnerPortfolio` → `ownerListingVisibility`), όχι από εδώ.
 *
 * Προσαρμογέας πάνω στο κοινό κέλυφος `UnmappedRow`, όπως το `UnmappedListingsRow` της αναζήτησης.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  OwnerPortfolioUnmappedReason,
  UnmappedOwnerProperty,
} from '@/lib/owner-property/owner-portfolio-map';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { Link } from '@/lib/workspace/navigation';
import { UNMAPPED_ROW_LINK_CLASS, UnmappedRow } from '@/components/search-results/UnmappedRow';

const K = 'property-market:offer.portfolio.unmapped';

const REASON_KEY: Record<OwnerPortfolioUnmappedReason, string> = {
  withdrawn: `${K}.reason.withdrawn`,
  failed: `${K}.reason.failed`,
  'no-mark': `${K}.reason.noMark`,
  unrecorded: `${K}.reason.unrecorded`,
};

export function OwnerPortfolioUnmappedRow({ unmapped }: { readonly unmapped: readonly UnmappedOwnerProperty[] }) {
  const { t } = useTranslation(['property-market']);

  const items = unmapped.map(({ property, reason }) => ({
    id: property.id,
    link: (
      <Link href={offerDetailHref(property.id)} className={UNMAPPED_ROW_LINK_CLASS}>
        {property.title}
      </Link>
    ),
    note: t(REASON_KEY[reason]),
  }));

  return <UnmappedRow heading={t(`${K}.heading`, { count: unmapped.length })} hint={t(`${K}.hint`)} items={items} />;
}
