'use client';

/**
 * **Ό,τι λέει ο χάρτης σύγκρισης σε λέξεις** (ADR-890 §15) — τύπος ακινήτου, υπόμνημα με **αριθμούς** (τα **ίδια** όρια
 * με τον χάρτη της αναζήτησης), η ενεργή Δ.Ε. (`aria-live`) με σύνδεσμο, η ημερομηνία των συμβολαίων, CC-BY.
 *
 * 🔑 **Οι λέξεις είναι οι ΙΔΙΕΣ με της αναζήτησης** (`components/market/choropleth/price-map-words`): η ίδια περιοχή δεν
 *   περιγράφεται ποτέ με δύο τρόπους.
 */

import React from 'react';

import {
  PRICE_MAP_WORD_NAMESPACES,
  PriceMapLegend,
  priceMapSelectionText,
} from '@/components/market/choropleth/price-map-words';
import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { areaMarketHref } from '@/lib/listings/listing-routes';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import { Link } from '@/lib/workspace/navigation';

import type { AreaChildMapModel } from './useAreaChildMap';

const NAMESPACES = [...PRICE_MAP_WORD_NAMESPACES];

function SegmentPicker({ model }: { readonly model: AreaChildMapModel }) {
  const { t } = useTranslation(NAMESPACES);
  if (model.segments.length < 2) return null;
  const pick = (value: string) => {
    const segment = model.segments.find((item) => item === value);
    if (segment !== undefined) model.setSegment(segment);
  };
  return (
    <Select value={model.choice.segment} onValueChange={pick}>
      <SelectTrigger aria-label={t('price-map:segmentLabel')} className="w-full sm:w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {model.segments.map((segment) => (
          <SelectItem key={segment} value={segment}>{t(`area-market:segment.${segment}`)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActiveOutput({ model }: { readonly model: AreaChildMapModel }) {
  const { t } = useTranslation(NAMESPACES);
  const row = model.activeRow;
  return (
    <output aria-live="polite" className="flex min-h-10 flex-col gap-0.5 text-sm">
      {row === null ? (
        <span className="text-xs text-muted-foreground">{model.words.hint}</span>
      ) : (
        <>
          <span className="font-medium text-foreground">{priceMapSelectionText(t, model.choice, row)}</span>
          <Link href={areaMarketHref(row.id)} className={`text-xs ${VISIBLE_LINK_CLASS}`}>
            {t('area-market:childMap.open', { name: row.name })}
          </Link>
        </>
      )}
    </output>
  );
}

function GeometryStatus({ model }: { readonly model: AreaChildMapModel }) {
  const { t } = useTranslation(NAMESPACES);
  if (model.geometry === 'unavailable') return <p role="alert" className="m-0 text-xs text-muted-foreground">{t('price-map:status.geometryUnavailable')}</p>;
  if (model.geometry === null) return <p role="status" className="m-0 text-xs text-muted-foreground">{t('price-map:status.loading')}</p>;
  return null;
}

export function AreaChildPricePanel({ model }: { readonly model: AreaChildMapModel }) {
  const { t } = useTranslation(NAMESPACES);
  return (
    <section aria-label={model.words.prices} className="flex flex-col gap-2">
      <SegmentPicker model={model} />
      <GeometryStatus model={model} />
      <PriceMapLegend choice={model.choice} inherited={model.words.inherited} />
      <ActiveOutput model={model} />
      <p className="m-0 text-xs text-muted-foreground">{t('price-map:asOf.contracts', { date: formatCalendarDay(model.asOf, true) })}</p>
      <OpenDataAttribution source="transferValues" />
    </section>
  );
}
