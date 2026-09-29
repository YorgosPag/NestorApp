'use client';

/**
 * **Οι Δημοτικές Ενότητες ενός Δήμου, με την τιμή τους** (ADR-890 §15) — ο πίνακας ακριβώς κάτω από τον χάρτη.
 *
 * 🔑 **Αποδίδεται στον server** (οι τιμές έρχονται με τη σελίδα): μηχανές αναζήτησης και πληκτρολόγιο βλέπουν ό,τι
 *   βλέπει το ποντίκι στον χάρτη (WCAG 2.1.1) — και οι εσωτερικοί σύνδεσμοι προς κάθε Δ.Ε. έχουν πλέον κείμενο με τιμή.
 * 🔑 **Αμφίδρομος με τον χάρτη** (ιδίωμα λίστας ↔ χάρτη του Zillow): δείκτης ή εστίαση σε γραμμή ⇒ η Δ.Ε. τονίζεται
 *   στον χάρτη· δείκτης σε Δ.Ε. του χάρτη ⇒ η γραμμή τονίζεται εδώ.
 * 🔑 **Ίδια σειρά, ίδιες λέξεις** με τον πίνακα του χάρτη της αναζήτησης (`rankedSelectionsOf` · `priceMapRowPrice`).
 */

import React from 'react';

import { PRICE_MAP_WORD_NAMESPACES, priceMapCountOf, priceMapRowPrice } from '@/components/market/choropleth/price-map-words';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { areaMarketHref } from '@/lib/listings/listing-routes';
import type { PriceMapSelection } from '@/lib/market/price-map-view';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import { Link } from '@/lib/workspace/navigation';

import type { AreaChildMapModel } from './useAreaChildMap';

const NAMESPACES = [...PRICE_MAP_WORD_NAMESPACES];

type T = ReturnType<typeof useTranslation>['t'];

function ChildRow({ model, row, t }: { readonly model: AreaChildMapModel; readonly row: PriceMapSelection; readonly t: T }) {
  const { choice, active, activate } = model;
  const enter = () => activate({ id: row.id, via: 'row' });
  const leave = () => { if (active?.via === 'row' && active.id === row.id) activate(null); };
  return (
    <tr className={cn('border-t border-border', active?.id === row.id && 'bg-muted')} onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}>
      <th scope="row" className="py-2 pr-3 font-normal">
        <Link href={areaMarketHref(row.id)} className={cn('text-foreground', VISIBLE_LINK_CLASS)}>{row.name}</Link>
      </th>
      <td className="py-2 pr-3 tabular-nums text-foreground">{priceMapRowPrice(t, choice, row, model.words.inheritedShort)}</td>
      <td className="py-2 tabular-nums text-muted-foreground">{priceMapCountOf(t, choice.source, row.resolution.n)}</td>
    </tr>
  );
}

export function AreaChildrenTable({ model }: { readonly model: AreaChildMapModel }) {
  const { t } = useTranslation(NAMESPACES);
  const segment = t(`area-market:segment.${model.choice.segment}`);
  return (
    <section aria-labelledby="area-children" className="flex flex-col gap-2">
      <h2 id="area-children" className="m-0 text-lg font-semibold text-foreground">{model.words.title}</h2>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{model.words.caption(segment)}</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="py-1 pr-3 font-medium">{t('price-map:table.area')}</th>
            <th scope="col" className="py-1 pr-3 font-medium">{t('price-map:table.price')}</th>
            <th scope="col" className="py-1 font-medium">{t('price-map:table.sample')}</th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => <ChildRow key={row.id} model={model} row={row} t={t} />)}
        </tbody>
      </table>
    </section>
  );
}
