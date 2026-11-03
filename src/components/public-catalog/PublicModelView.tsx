'use client';

/**
 * **Η σελίδα μοντέλου** (ADR-923 §5.13 Σ4). Καμία τιμή: το έγγραφο δεν έχει, άρα όλα δείχνουν «Κατόπιν προσφοράς» ως το Σ6.
 *
 * 🔒 Το `richText` μπαίνει ως HTML **μόνο** αν περάσει τη γραμματική `checkRichText`. Αλλιώς δείχνεται ως απλό κείμενο, όπως στον
 *    εκδότη: το έγγραφο το γράφει ο διακομιστής, αλλά η οθόνη είναι δημόσια και δεν στηρίζεται σε αυτό.
 *
 * @module components/public-catalog/PublicModelView
 */

import React from 'react';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { Link } from '@/lib/workspace/navigation';
import type { PublicCatalogAttribute, PublicCatalogMedia, PublicCatalogModel, PublicCatalogValue } from '@/subapps/catalog/public/public-catalog-schema';
import { publicSupplierRoute } from '@/subapps/catalog/public/public-catalog-routes';
import { publicModelTitle } from '@/subapps/catalog/public/public-model-card';
import { publicValueIn, publicValueText } from '@/subapps/catalog/public/public-value-text';
import { checkRichText } from '@/subapps/catalog/values/rich-text';

import { usePublicCatalogText } from './public-catalog-text';

// ADR-744 §18: το route slice φτάνει στον φυλλομετρητή μόνο από client component, όχι από το `page.tsx`.
import routeSlice from '@/i18n/generated/routes/suppliers__alias__p__model.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

function ValueText({ value }: { readonly value: PublicCatalogValue }): React.JSX.Element {
  const { t, language } = usePublicCatalogText();
  if (value.type === 'boolean') return <>{t(value.value ? 'model.yes' : 'model.no')}</>;
  if (value.type !== 'richText') return <>{publicValueText(value, language)}</>;
  if (!checkRichText(value.html).ok) return <>{value.html}</>;
  return <span dangerouslySetInnerHTML={{ __html: value.html }} />;
}

function AttributeRows({ attributes }: { readonly attributes: readonly PublicCatalogAttribute[] }): React.JSX.Element {
  const { text, language } = usePublicCatalogText();
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-1 text-sm">
      {attributes.map((attribute) => {
        const value = publicValueIn(attribute.values, language);
        return value === null ? null : (
          <React.Fragment key={attribute.attributeId}>
            <dt className="text-muted-foreground">{text(attribute.labels)}</dt>
            <dd className="m-0"><ValueText value={value} /></dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
}

function MediaRow({ media, fallbackAlt }: { readonly media: readonly PublicCatalogMedia[]; readonly fallbackAlt: string }): React.JSX.Element | null {
  const { text } = usePublicCatalogText();
  if (media.length === 0) return null;
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3 p-0">
      {media.map((item) => <li key={item.assetId}><img src={item.url} alt={text(item.labels) || fallbackAlt} loading="lazy" className="w-full rounded-sm object-contain" /></li>)}
    </ul>
  );
}

function Variants({ model, title }: { readonly model: PublicCatalogModel; readonly title: string }): React.JSX.Element | null {
  const { t } = usePublicCatalogText();
  if (model.variants.length < 2) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-lg font-semibold">{t('model.variants')}</h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {model.variants.map((variant) => (
          <li key={variant.variantId} className="flex flex-col gap-2 rounded-md border p-3">
            <h3 className="m-0 text-base font-semibold">{variant.label ?? variant.code ?? title}</h3>
            <AttributeRows attributes={variant.attributes} />
            <MediaRow media={variant.media} fallbackAlt={title} />
            <p className="m-0 text-sm text-foreground">{t('model.priceOnRequest')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PublicModelView({ segment, model }: { readonly segment: string; readonly model: PublicCatalogModel }): React.JSX.Element {
  const { t, text } = usePublicCatalogText();
  const title = publicModelTitle(model);
  const [only, ...others] = model.variants;
  const single = others.length === 0;
  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6">
      <nav><Link href={publicSupplierRoute(segment)}>{t('model.backToSupplier')}</Link></nav>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold">{title}</h1>
        <p className="m-0 text-sm text-muted-foreground">{text(model.familyLabels)}</p>
        <p className="m-0 text-sm text-muted-foreground">{t('model.code', { code: model.code })}</p>
        <p className="m-0 text-sm text-foreground">{t('model.priceOnRequest')}</p>
      </header>
      <MediaRow media={single ? [...model.media, ...only.media] : model.media} fallbackAlt={title} />
      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold">{t('model.specifications')}</h2>
        <AttributeRows attributes={single ? [...model.attributes, ...only.attributes] : model.attributes} />
      </section>
      <Variants model={model} title={title} />
    </ShellSurface>
  );
}
