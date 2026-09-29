'use client';

/**
 * **Ό,τι λέει ο χάρτης τιμών σε λέξεις** (ADR-890 §14.5) — διάθεση, πηγή, τύπος ακινήτου, υπόμνημα με **αριθμούς**,
 * η επιλεγμένη περιοχή (`aria-live`) με σύνδεσμο στην ανάλυσή της, και ο πίνακας «Περιοχές στην οθόνη».
 *
 * 🔑 **Ποτέ μόνο χρώμα** (CHECK 3.41 / WCAG 1.4.1) και **ποτέ μόνο ποντίκι** (WCAG 2.1.1): ό,τι δίνει το κλικ στον
 *   χάρτη το δίνει και ο πίνακας, με πληκτρολόγιο — κάτι που κανένα από τα portals που μελετήθηκαν δεν προσφέρει.
 * 🔑 Φορτώνεται **μόνο** όταν ανοίξει η στρώση (`next/dynamic`): τα κλειδιά του δεν βαραίνουν το πρώτο καρέ.
 */

import React, { useMemo } from 'react';

import { MapRampLegend, type MapLegendItem } from '@/components/market/MapRampLegend';
import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { unitPriceLabel } from '@/components/area-market/area-market-format';
import { usePriceMapModel } from '@/components/search-results/price-map/PriceMapProvider';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { areaMarketHref } from '@/lib/listings/listing-routes';
import type { MarketSegment } from '@/lib/market/market-segments';
import { MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';
import { PRICE_MAP_BREAKS, priceMapLegend, type PriceMapSource } from '@/lib/market/price-map';
import {
  segmentsFor,
  selectionOf,
  sourcesFor,
  visibleRowsOf,
  type PriceMapChoice,
  type PriceMapSelection,
} from '@/lib/market/price-map-view';
import { Link } from '@/lib/workspace/navigation';
import { ASKING_OFFERS, type AskingOffer } from '@/types/area-market';

const NS = 'price-map';
const NAMESPACES = [NS, 'area-market', 'market-contracts', 'common'];

type T = ReturnType<typeof useTranslation>['t'];

function priceOf(t: T, choice: PriceMapChoice, amount: number): string {
  return unitPriceLabel(t, choice.offer, choice.segment, amount);
}

function countOf(t: T, source: PriceMapSource, count: number): string {
  return t(`${NS}:count.${source}`, { count });
}

function ChoiceControls({ choice, onChange }: { readonly choice: PriceMapChoice; readonly onChange: (next: PriceMapChoice) => void }) {
  const { t } = useTranslation(NAMESPACES);
  const sources = sourcesFor(choice.offer);
  const pickOffer = (offer: AskingOffer) => onChange({ ...choice, offer });
  const pickSource = (source: PriceMapSource) => onChange({ ...choice, source });
  const pickSegment = (value: string) => {
    const segment = segmentsFor(choice.offer).find((item) => item === value);
    if (segment !== undefined) onChange({ ...choice, segment });
  };
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <SegmentedControl value={choice.offer} onValueChange={pickOffer} aria-label={t(`${NS}:offerLabel`)}>
        {ASKING_OFFERS.map((offer) => (
          <SegmentedControlItem key={offer} value={offer}>{t(`area-market:offer.${offer}`)}</SegmentedControlItem>
        ))}
      </SegmentedControl>
      <SegmentedControl value={choice.source} onValueChange={pickSource} aria-label={t(`${NS}:source.label`)}>
        {sources.map((source) => (
          <SegmentedControlItem key={source} value={source}>{t(`${NS}:source.${source}`)}</SegmentedControlItem>
        ))}
      </SegmentedControl>
      {choice.offer === 'rent' && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:source.rentOnlyAsking`)}</p>}
      <Select value={choice.segment} onValueChange={pickSegment}>
        <SelectTrigger aria-label={t(`${NS}:segmentLabel`)} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {segmentsFor(choice.offer).map((segment: MarketSegment) => (
            <SelectItem key={segment} value={segment}>{t(`area-market:segment.${segment}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </fieldset>
  );
}

function Legend({ choice }: { readonly choice: PriceMapChoice }) {
  const { t } = useTranslation(NAMESPACES);
  const items = useMemo((): MapLegendItem[] => {
    const classes = priceMapLegend(PRICE_MAP_BREAKS[choice.offer][choice.segment] ?? []);
    const ramp = classes.map((item, index): MapLegendItem => {
      const low = item.low === null ? '' : priceOf(t, choice, item.low);
      const high = item.high === null ? '' : priceOf(t, choice, item.high);
      const key = item.low === null ? 'below' : item.high === null ? 'above' : 'range';
      return { key: `c${index}`, swatch: { kind: 'ramp', step: index + 1 }, label: t(`${NS}:legend.${key}`, { low, high }) };
    });
    return [
      ...ramp,
      { key: 'inherited', swatch: { kind: 'inherited' }, label: t(`${NS}:legend.inherited`) },
      { key: 'few', swatch: { kind: 'few' }, label: t(`${NS}:legend.few`, { min: MARKET_STAT_MIN_SAMPLE }) },
    ];
  }, [choice, t]);
  return <MapRampLegend caption={t(`${NS}:legend.caption`)} items={items} />;
}

/** Η πρόταση μιας περιοχής — **ίδια** για το κλικ και για τη γραμμή του πίνακα. */
function selectionText(t: T, choice: PriceMapChoice, selection: PriceMapSelection): string {
  const { resolution } = selection;
  const count = countOf(t, choice.source, resolution.n);
  if (resolution.kind === 'own') return t(`${NS}:selection.own`, { name: selection.name, price: priceOf(t, choice, resolution.median), count });
  if (resolution.kind === 'parent') {
    return t(`${NS}:selection.parent`, {
      name: selection.name,
      count,
      parentName: selection.parentName ?? '',
      price: priceOf(t, choice, resolution.median),
      parentCount: countOf(t, choice.source, resolution.parentN),
    });
  }
  return t(`${NS}:selection.few`, { name: selection.name, min: MARKET_STAT_MIN_SAMPLE, count });
}

function SelectionOutput({ choice, selection }: { readonly choice: PriceMapChoice; readonly selection: PriceMapSelection | null }) {
  const { t } = useTranslation(NAMESPACES);
  return (
    <output aria-live="polite" className="flex flex-col gap-0.5 text-sm">
      {selection === null ? (
        <span className="text-xs text-muted-foreground">{t(`${NS}:selection.hint`)}</span>
      ) : (
        <>
          <span className="font-medium text-foreground">{selectionText(t, choice, selection)}</span>
          <Link href={areaMarketHref(selection.id)} className="text-xs underline underline-offset-4">
            {t(`${NS}:selection.link`)}
          </Link>
        </>
      )}
    </output>
  );
}

function rowPrice(t: T, choice: PriceMapChoice, row: PriceMapSelection): string {
  const { resolution } = row;
  if (resolution.kind === 'few') return t(`${NS}:table.few`);
  const price = priceOf(t, choice, resolution.median);
  return resolution.kind === 'parent' ? `${price} (${t(`${NS}:table.inherited`)})` : price;
}

interface VisibleAreasProps {
  readonly choice: PriceMapChoice;
  readonly rows: readonly PriceMapSelection[];
  /** Πόσες περιοχές φαίνονται συνολικά — ο πίνακας δείχνει τις πρώτες `rows.length`. */
  readonly total: number;
}

function VisibleAreas({ choice, rows, total }: VisibleAreasProps) {
  const { t } = useTranslation(NAMESPACES);
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-foreground">
        {t(`${NS}:table.summary`, { count: total })}
        {total > rows.length && ` · ${t(`${NS}:table.limited`, { shown: rows.length })}`}
      </summary>
      {rows.length === 0 ? (
        <p className="m-0 mt-1 text-muted-foreground">{t(`${NS}:table.empty`)}</p>
      ) : (
        <table className="mt-1 w-full border-collapse text-left">
          <caption className="sr-only">{t(`${NS}:table.caption`)}</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-2 font-medium">{t(`${NS}:table.area`)}</th>
              <th scope="col" className="py-1 pr-2 font-medium">{t(`${NS}:table.price`)}</th>
              <th scope="col" className="py-1 font-medium">{t(`${NS}:table.sample`)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <th scope="row" className="py-1 pr-2 font-normal">
                  <Link href={areaMarketHref(row.id)} className="underline-offset-4 hover:underline">{row.name}</Link>
                </th>
                <td className="py-1 pr-2 tabular-nums">{rowPrice(t, choice, row)}</td>
                <td className="py-1 tabular-nums">{row.resolution.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}

function StatusLine() {
  const { t } = useTranslation(NAMESPACES);
  const { data, municipalities, choice } = usePriceMapModel();
  if (municipalities === 'unavailable') return <p role="alert" className="m-0 text-xs text-muted-foreground">{t(`${NS}:status.geometryUnavailable`)}</p>;
  if (data.status === 'loading' || municipalities === null) return <p role="status" className="m-0 text-xs text-muted-foreground">{t(`${NS}:status.loading`)}</p>;
  if (data.status === 'unavailable') return <p role="alert" className="m-0 text-xs text-muted-foreground">{t(`${NS}:status.unavailable`)}</p>;
  if (data.status === 'none') return <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:status.none`)}</p>;
  return <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:asOf.${choice.source}`, { date: formatCalendarDay(data.asOf, true) })}</p>;
}

export default function PriceMapPanel() {
  const { t } = useTranslation(NAMESPACES);
  const { choice, setChoice, data, selected, rendered } = usePriceMapModel();
  const areas = data.status === 'ready' ? data.areas : null;
  const selection = useMemo(() => (selected === null || areas === null ? null : selectionOf(selected, areas, choice)), [areas, choice, selected]);
  const rows = useMemo(() => (areas === null ? [] : visibleRowsOf(rendered, areas, choice)), [areas, choice, rendered]);

  return (
    <section aria-label={t(`${NS}:title`)} className="pointer-events-auto flex max-h-[55vh] w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-md">
      <h2 className="m-0 text-sm font-semibold text-foreground">{t(`${NS}:title`)}</h2>
      <ChoiceControls choice={choice} onChange={setChoice} />
      <StatusLine />
      {areas !== null && (
        <>
          <Legend choice={choice} />
          <SelectionOutput choice={choice} selection={selection} />
          <VisibleAreas choice={choice} rows={rows} total={rendered.length} />
        </>
      )}
      <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:note`)}</p>
      {choice.source === 'contracts' && <OpenDataAttribution source="transferValues" />}
    </section>
  );
}
