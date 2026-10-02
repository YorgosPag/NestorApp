'use client';

/**
 * @fileoverview **Ό,τι λέει ένας χωροπληθής τιμών σε λέξεις** (ADR-890 §14.5 · §15) — υπόμνημα με **αριθμούς**, η πρόταση
 * μιας περιοχής (κλικ ή γραμμή πίνακα) και το κελί τιμής. **Δύο χάρτες, ίδιες λέξεις**: η αναζήτηση και οι σελίδες
 * περιοχής. Μόνο η λέξη της **διαγράμμισης** αλλάζει ανά σελίδα (τιμή Δήμου · Π.Ε. · Περιφέρειας, ADR-890 §16).
 * @related `lib/market/price-map-view.ts` (`PriceMapSelection`) · `components/market/MapRampLegend.tsx` · namespace `price-map`
 * @module components/market/choropleth/price-map-words
 *
 * 🔑 **Ποτέ μόνο χρώμα** (CHECK 3.41 / WCAG 1.4.1): το υπόμνημα γράφει τα όρια, η διαγράμμιση έχει δική της γραμμή.
 */

import React, { useCallback, useMemo } from 'react';

import { unitPriceLabel } from '@/components/area-market/area-market-format';
import { MapRampLegend, type MapLegendItem } from '@/components/market/MapRampLegend';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';
import { PRICE_MAP_BREAKS, priceMapLegend, type PriceMapSource } from '@/lib/market/price-map';
import type { PriceMapChoice, PriceMapLabelText, PriceMapSelection } from '@/lib/market/price-map-view';

const NS = 'price-map';

/** Τα namespaces που χρειάζονται οι λέξεις του χάρτη — ο καλών τα φορτώνει μαζί με τα δικά του. */
export const PRICE_MAP_WORD_NAMESPACES = [NS, 'area-market', 'market-contracts', 'common'] as const;

type T = ReturnType<typeof useTranslation>['t'];

export function priceMapPriceOf(t: T, choice: PriceMapChoice, amount: number): string {
  return unitPriceLabel(t, choice.offer, choice.segment, amount);
}

export function priceMapCountOf(t: T, source: PriceMapSource, count: number): string {
  return t(`${NS}:count.${source}`, { count });
}

/**
 * Το υπόμνημα: οι πέντε κλάσεις **με τα όρια τους** + «τιμή Δήμου» + «λιγότερα από 5».
 * @param inherited η γραμμή της διαγράμμισης — η σελίδα περιοχής λέει **ποιου** γονέα (προεπιλογή: του Δήμου)
 */
export function PriceMapLegend({ choice, inherited }: { readonly choice: PriceMapChoice; readonly inherited?: string }) {
  const { t } = useTranslation([...PRICE_MAP_WORD_NAMESPACES]);
  const items = useMemo((): MapLegendItem[] => {
    const classes = priceMapLegend(PRICE_MAP_BREAKS[choice.offer][choice.segment] ?? []);
    const ramp = classes.map((item, index): MapLegendItem => {
      const low = item.low === null ? '' : priceMapPriceOf(t, choice, item.low);
      const high = item.high === null ? '' : priceMapPriceOf(t, choice, item.high);
      const key = item.low === null ? 'below' : item.high === null ? 'above' : 'range';
      return { key: `c${index}`, swatch: { kind: 'ramp', step: index + 1 }, label: t(`${NS}:legend.${key}`, { low, high }) };
    });
    return [
      ...ramp,
      { key: 'inherited', swatch: { kind: 'inherited' }, label: inherited ?? t(`${NS}:legend.inherited`) },
      { key: 'few', swatch: { kind: 'few' }, label: t(`${NS}:legend.few`, { min: MARKET_STAT_MIN_SAMPLE }) },
    ];
  }, [choice, inherited, t]);
  return <MapRampLegend caption={t(`${NS}:legend.caption`)} items={items} />;
}

/** Η πρόταση μιας περιοχής — **ίδια** για το κλικ και για τη γραμμή του πίνακα, σε κάθε χάρτη. */
export function priceMapSelectionText(t: T, choice: PriceMapChoice, selection: PriceMapSelection): string {
  const { resolution } = selection;
  const count = priceMapCountOf(t, choice.source, resolution.n);
  if (resolution.kind === 'own') return t(`${NS}:selection.own`, { name: selection.name, price: priceMapPriceOf(t, choice, resolution.median), count });
  if (resolution.kind === 'parent') {
    return t(`${NS}:selection.parent`, {
      name: selection.name,
      count,
      parentName: selection.parentName ?? '',
      price: priceMapPriceOf(t, choice, resolution.median),
      parentCount: priceMapCountOf(t, choice.source, resolution.parentN),
    });
  }
  return t(`${NS}:selection.few`, { name: selection.name, min: MARKET_STAT_MIN_SAMPLE, count });
}

/** Το κελί τιμής μιας γραμμής: τιμή · «τιμή (τιμή Δήμου)» · «λίγα». `inherited`: η λέξη του γονέα (σελίδα περιοχής). */
export function priceMapRowPrice(t: T, choice: PriceMapChoice, row: PriceMapSelection, inherited?: string): string {
  const { resolution } = row;
  if (resolution.kind === 'few') return t(`${NS}:table.few`);
  const price = priceMapPriceOf(t, choice, resolution.median);
  return resolution.kind === 'parent' ? `${price} (${inherited ?? t(`${NS}:table.inherited`)})` : price;
}

/**
 * **Το κείμενο της ετικέτας τιμής πάνω σε μια περιοχή** (ADR-890 §15 · §18) — **ίδιοι** κανόνες με το υπόμνημα και τον
 * πίνακα: δική τιμή ⇒ ο αριθμός · τιμή γονέα ⇒ «<βαθμίδα γονέα>: αριθμός» · λίγα ⇒ **ποτέ** αριθμός (`few`, ή `null` =
 * καμία ετικέτα).
 * @param parentLabel η τιμή του γονέα με το όνομα της βαθμίδας του (`childMapWordsOf(...).parentLabel`)
 */
export function priceMapLabelOf(
  t: T,
  choice: PriceMapChoice,
  row: PriceMapSelection,
  parentLabel: (price: string) => string,
  few: string | null,
): string | null {
  const { resolution } = row;
  if (resolution.kind === 'few') return few;
  const price = priceMapPriceOf(t, choice, resolution.median);
  return resolution.kind === 'own' ? price : parentLabel(price);
}

/** Σταθερή συνάρτηση κειμένου για το `priceMapLabelPointsOf` — αλλάζει μόνο όταν αλλάξουν επιλογή, λέξεις ή γλώσσα. */
export function usePriceMapLabelText(
  choice: PriceMapChoice | null,
  parentLabel: ((price: string) => string) | null,
  few: string | null,
): PriceMapLabelText {
  const { t } = useTranslation([...PRICE_MAP_WORD_NAMESPACES]);
  return useCallback(
    (row: PriceMapSelection) => (choice === null || parentLabel === null ? null : priceMapLabelOf(t, choice, row, parentLabel, few)),
    [choice, few, parentLabel, t],
  );
}
