'use client';

/**
 * **Η σελίδα προμηθευτή και κατηγορίας** (ADR-923 §5.13 Σ4). Δεν διαβάζει τίποτα: όλα έρχονται από τον διακομιστή, στο HTML.
 *
 * @module components/public-catalog/SupplierCatalogView
 */

import React from 'react';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import { Link } from '@/lib/workspace/navigation';
import { publicCategoryRoute, publicModelRoute, publicSegmentOf, publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import type { PublicModelCard } from '@/subapps/catalog/public/public-model-card';
import type { ShowcaseCardPrices, ShowcaseConsumerPrice } from '@/subapps/catalog/public/showcase-price';
import type { PublicProviderFacts, PublicServiceArea } from '@/subapps/catalog/public/public-provider-facts';
import type { PublicSupplierProfile } from '@/subapps/catalog/public/public-supplier-profile';
import type { PublicSupplierBrand, SupplierBrandRelation } from '@/subapps/catalog/types/supplier-brand-claim';

import { usePublicCatalogText } from './public-catalog-text';
import { PublicFromPriceSlot } from './public-catalog-surfaces';
import { SupplierAbout, SupplierPortfolio } from './SupplierPortfolio';

// ADR-744 §18: το route slice φτάνει στον φυλλομετρητή μόνο από client component, όχι από το `page.tsx`.
import routeSlice from '@/i18n/generated/routes/suppliers__alias.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export interface SupplierCatalogViewProps {
  readonly segment: string;
  readonly legalName: string;
  readonly cards: readonly PublicModelCard[];
  readonly categories: Readonly<Record<string, LocalizedText>>;
  readonly activeCategoryId: string | null;
  /** Η διεύθυνση της επόμενης σελίδας, έτοιμη από τον διακομιστή. */
  readonly nextHref: string | null;
  /** Λογότυπο, ιστοσελίδα, περιοχή (§22 Υ8). Μόνο στη σελίδα προμηθευτή: η κατηγορία μένει χωρίς δεύτερη ανάγνωση. */
  readonly provider?: PublicProviderFacts;
  /** Η ανώνυμη τιμή «από» ανά κάρτα (§5.13 Σ6). Απούσα ή `null` ⇒ κλειστός διακόπτης: όλες «Κατόπιν προσφοράς», όπως πριν. */
  readonly cardPrices?: ShowcaseCardPrices | null;
  /** Περιγραφή και portfolio (§22 Υ8). `null` ⇒ ο χώρος δεν έχει δημόσιο προφίλ. */
  readonly profile?: PublicSupplierProfile | null;
  /** Μάρκες σε ισχύ (§16). */
  readonly brands?: readonly PublicSupplierBrand[];
}

/** Ακτίνα και περίγραμμα: το μέγεθος, και μετά οι περιοχές που εξυπηρετούν — οι ίδιες που δηλώνει το JSON-LD (Ν11 ε). */
function ServiceAreaText({ area }: { readonly area: PublicServiceArea }): React.JSX.Element {
  const { t } = usePublicCatalogText();
  if (area.kind === 'nationwide') return <>{t('supplier.areaNationwide')}</>;
  const extent = area.kind === 'radius'
    ? t('supplier.areaRadius', { km: area.radiusKm })
    : area.kind === 'outline' ? t('supplier.areaOutline', { km2: area.km2 }) : null;
  return <>{[extent, ...area.names].filter((part) => part !== null).join(' · ')}</>;
}

function ProviderFacts({ provider }: { readonly provider: PublicProviderFacts }): React.JSX.Element | null {
  const { t } = usePublicCatalogText();
  const { area, website } = provider;
  if (area === null && website === null) return null;
  return (
    <dl className="m-0 flex flex-col gap-1 text-sm">
      {area !== null && (
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{t('supplier.areaServed')}</dt>
          <dd className="m-0"><ServiceAreaText area={area} /></dd>
        </div>
      )}
      {website !== null && (
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{t('supplier.website')}</dt>
          <dd className="m-0 min-w-0 break-all"><a href={website} rel="noopener noreferrer" target="_blank">{website}</a></dd>
        </div>
      )}
    </dl>
  );
}

const BRAND_RELATION_KEYS: Readonly<Record<SupplierBrandRelation, string>> = {
  manufacturer: 'supplier.brandManufacturer',
  'authorized-representative': 'supplier.brandRepresentative',
};

function SupplierBrands({ brands }: { readonly brands: readonly PublicSupplierBrand[] }): React.JSX.Element | null {
  const { t } = usePublicCatalogText();
  if (brands.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm" aria-label={t('supplier.brands')}>
      {brands.map(({ brandName, relation }) => <li key={brandName} className="rounded-sm border px-2 py-0.5">{brandName} · {t(BRAND_RELATION_KEYS[relation])}</li>)}
    </ul>
  );
}

interface ModelCardProps {
  readonly segment: string;
  readonly card: PublicModelCard;
  readonly fromPrice: ShowcaseConsumerPrice | undefined;
}

function ModelCard({ segment, card, fromPrice }: ModelCardProps): React.JSX.Element {
  const { t, text } = usePublicCatalogText();
  return (
    <li className="rounded-md border">
      <article className="flex flex-col gap-1 p-3">
        {card.image !== null && <img src={card.image.url} alt={text(card.image.labels) || card.title} loading="lazy" className="aspect-square w-full rounded-sm object-contain" />}
        <h3 className="m-0 text-base font-semibold">
          <Link href={publicModelRoute(segment, publicSegmentOf(card.title, card.modelId))}>{card.title}</Link>
        </h3>
        <p className="m-0 text-sm text-muted-foreground">{text(card.familyLabels)}</p>
        <p className="m-0 text-sm text-muted-foreground">{t('model.variantCount', { count: card.variantCount })}</p>
        {fromPrice === undefined ? <p className="m-0 text-sm text-foreground">{t('model.priceOnRequest')}</p> : <PublicFromPriceSlot price={fromPrice} />}
      </article>
    </li>
  );
}

function CategoryNav({ segment, categories, activeCategoryId }: Pick<SupplierCatalogViewProps, 'segment' | 'categories' | 'activeCategoryId'>): React.JSX.Element | null {
  const { t, text } = usePublicCatalogText();
  const entries = Object.entries(categories);
  if (entries.length === 0) return null;
  return (
    <nav aria-label={t('supplier.categories')}>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        <li><Link href={publicSupplierRoute(segment)} aria-current={activeCategoryId === null ? 'page' : undefined}>{t('supplier.allCategories')}</Link></li>
        {entries.map(([id, labels]) => (
          <li key={id}>
            <Link href={publicCategoryRoute(segment, publicSegmentOf(resolveLocalizedText(labels, DEFAULT_LANGUAGE), id))} aria-current={activeCategoryId === id ? 'page' : undefined}>
              {text(labels)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SupplierCatalogView(props: SupplierCatalogViewProps): React.JSX.Element {
  const { segment, legalName, cards, nextHref, provider, profile, brands = [], cardPrices = null } = props;
  const { t } = usePublicCatalogText();
  const logo = provider?.logo ?? null;
  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6">
      <header className="flex items-start gap-4">
        {logo !== null && (
          <img src={logo.url} srcSet={listingImageSrcSet(logo)} sizes="4rem" width={logo.width} height={logo.height} alt={t('supplier.logoAlt', { name: legalName })} className="size-16 shrink-0 rounded-md object-contain" />
        )}
        <section className="flex min-w-0 flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold">{legalName}</h1>
          <p className="m-0 text-sm text-muted-foreground">{t('supplier.verified')}</p>
          {provider !== undefined && <ProviderFacts provider={provider} />}
          <SupplierBrands brands={brands} />
        </section>
      </header>
      {profile && <SupplierAbout profile={profile} />}
      <CategoryNav {...props} />
      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold">{t('supplier.products')}</h2>
        {cards.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">{t('supplier.empty')}</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3 p-0">
            {cards.map((card) => <ModelCard key={card.modelId} segment={segment} card={card} fromPrice={cardPrices?.[card.modelId]} />)}
          </ul>
        )}
        {nextHref !== null && <footer><Link href={nextHref}>{t('supplier.next')}</Link></footer>}
      </section>
      {profile && <SupplierPortfolio profile={profile} />}
    </ShellSurface>
  );
}
