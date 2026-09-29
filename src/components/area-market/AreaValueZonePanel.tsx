'use client';

/**
 * **Ό,τι λέει ο χάρτης ζωνών σε λέξεις** (ADR-889 Φ5) — διακόπτης, υπόμνημα με **αριθμούς**, η επιλεγμένη ζώνη, CC-BY.
 *
 * 🔑 **Ποτέ μόνο χρώμα** (CHECK 3.41 / WCAG 1.4.1): κάθε απόχρωση του υπομνήματος γράφει το εύρος της, και το κλικ σε
 * ζώνη δίνει **κείμενο** («Ζώνη Θ: 3.850 €/m²»), ανακοινωμένο σε αναγνώστη οθόνης.
 */

import React, { useId } from 'react';

import { MapRampLegend, type MapLegendItem } from '@/components/market/MapRampLegend';
import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { pricePerAreaLabel } from '@/lib/listings/listing-price-label';
import { formatCurrency } from '@/lib/intl-formatting';
import { rampStepOf, type PriceClass } from '@/lib/market/value-zone-classes';

import type { ValueZoneSelection } from './AreaValueZoneLayer';

const NS = 'market-contracts';

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
  const items: MapLegendItem[] = classes.map((item, index) => ({
    key: String(item.low),
    swatch: { kind: 'ramp', step: rampStepOf(index, classes.length) },
    label:
      item.low === item.high
        ? formatCurrency(item.low)
        : t(`${NS}:valueZone.map.class`, { low: formatCurrency(item.low), high: formatCurrency(item.high) }),
  }));
  items.push({ key: 'fronts', swatch: { kind: 'line', step: 5 }, label: t(`${NS}:valueZone.map.fronts`) });
  return <MapRampLegend caption={t(`${NS}:valueZone.map.legend`)} items={items} />;
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
