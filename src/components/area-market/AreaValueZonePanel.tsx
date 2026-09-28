'use client';

/**
 * **Ό,τι λέει ο χάρτης ζωνών σε λέξεις** (ADR-889 Φ5) — διακόπτης, υπόμνημα με **αριθμούς**, η επιλεγμένη ζώνη, CC-BY.
 *
 * 🔑 **Ποτέ μόνο χρώμα** (CHECK 3.41 / WCAG 1.4.1): κάθε απόχρωση του υπομνήματος γράφει το εύρος της, και το κλικ σε
 * ζώνη δίνει **κείμενο** («Ζώνη Θ: 3.850 €/m²»), ανακοινωμένο σε αναγνώστη οθόνης.
 */

import React, { useId } from 'react';

import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { pricePerAreaLabel } from '@/lib/listings/listing-price-label';
import { formatCurrency } from '@/lib/intl-formatting';
import { rampStepOf, type PriceClass } from '@/lib/market/value-zone-classes';

import type { ValueZoneSelection } from './AreaValueZoneLayer';

const NS = 'market-contracts';

/** Στατικές κλάσεις (το Tailwind δεν βλέπει δυναμικά ονόματα) — μία ανά απόχρωση της `--map-seq-*`. */
const SWATCH_CLASS: Readonly<Record<number, string>> = {
  1: 'bg-[hsl(var(--map-seq-1))]',
  2: 'bg-[hsl(var(--map-seq-2))]',
  3: 'bg-[hsl(var(--map-seq-3))]',
  4: 'bg-[hsl(var(--map-seq-4))]',
  5: 'bg-[hsl(var(--map-seq-5))]',
};

export type ValueZonePanelStatus = 'loading' | 'ready' | 'none' | 'unavailable';

interface AreaValueZonePanelProps {
  readonly status: ValueZonePanelStatus;
  readonly visible: boolean;
  readonly onVisibleChange: (visible: boolean) => void;
  readonly classes: readonly PriceClass[];
  readonly selection: ValueZoneSelection | null;
}

function Legend({ classes }: { readonly classes: readonly PriceClass[] }) {
  const { t } = useTranslation([NS]);
  return (
    <figure className="m-0 flex flex-col gap-1">
      <figcaption className="text-xs font-medium text-muted-foreground">{t(`${NS}:valueZone.map.legend`)}</figcaption>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-foreground">
        {classes.map((item, index) => (
          <li key={item.low} className="flex items-center gap-1.5">
            <span aria-hidden className={`block size-3 rounded-sm border border-border ${SWATCH_CLASS[rampStepOf(index, classes.length)]}`} />
            {item.low === item.high
              ? formatCurrency(item.low)
              : t(`${NS}:valueZone.map.class`, { low: formatCurrency(item.low), high: formatCurrency(item.high) })}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="block h-1 w-4 rounded-full bg-[hsl(var(--map-seq-5))]" />
          {t(`${NS}:valueZone.map.fronts`)}
        </li>
      </ul>
    </figure>
  );
}

function SelectionLine({ selection }: { readonly selection: ValueZoneSelection | null }) {
  const { t } = useTranslation([NS, 'common']);
  if (selection === null) return <span className="text-xs text-muted-foreground">{t(`${NS}:valueZone.map.hint`)}</span>;
  const price = pricePerAreaLabel(t, { role: 'sale', amount: selection.price });
  return (
    <span className="text-sm font-medium text-foreground">
      {selection.kind === 'zone'
        ? t(`${NS}:valueZone.map.selectedZone`, { name: selection.name, price })
        : t(`${NS}:valueZone.map.selectedFront`, { street: selection.street, price })}
    </span>
  );
}

export function AreaValueZonePanel({ status, visible, onVisibleChange, classes, selection }: AreaValueZonePanelProps) {
  const { t } = useTranslation([NS]);
  const switchId = useId();
  if (status === 'none') return <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:valueZone.map.none`)}</p>;
  if (status === 'unavailable') return <p role="alert" className="m-0 text-xs text-muted-foreground">{t(`${NS}:valueZone.map.unavailable`)}</p>;

  return (
    <section aria-label={t(`${NS}:valueZone.map.toggle`)} className="flex flex-col gap-2">
      <label htmlFor={switchId} className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Switch id={switchId} checked={visible} onCheckedChange={onVisibleChange} disabled={status !== 'ready'} />
        {t(`${NS}:valueZone.map.toggle`)}
      </label>
      {status === 'loading' && <p role="status" className="m-0 text-xs text-muted-foreground">{t(`${NS}:valueZone.map.loading`)}</p>}
      {status === 'ready' && visible && (
        <>
          <Legend classes={classes} />
          <output aria-live="polite" className="block">
            <SelectionLine selection={selection} />
          </output>
          <OpenDataAttribution source="valueZones" />
        </>
      )}
    </section>
  );
}
