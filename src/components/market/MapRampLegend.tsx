/**
 * **Το υπόμνημα των χαρτών τιμών** — δείγμα + **αριθμός** σε κάθε γραμμή (ADR-889 Φ5 · ADR-890 §14).
 *
 * 🔑 **Ποτέ μόνο χρώμα** (CHECK 3.41 / WCAG 1.4.1): κάθε απόχρωση γράφει το εύρος της, και οι καταστάσεις χωρίς
 * δικό τους αριθμό («τιμή Δήμου», «λίγα δεδομένα») έχουν **διαγράμμιση** — το ίδιο μοτίβο με τον χάρτη.
 * Παρουσιαστικό: τις ετικέτες τις γράφει ο καλών, στο δικό του namespace.
 */

import React from 'react';

import { HATCH_SWATCH_CLASS, RAMP_SWATCH_CLASS } from './map-ramp';

export type MapLegendSwatch =
  | { readonly kind: 'ramp'; readonly step: number }
  | { readonly kind: 'line'; readonly step: number }
  | { readonly kind: 'inherited' }
  | { readonly kind: 'few' };

export interface MapLegendItem {
  readonly key: string;
  readonly swatch: MapLegendSwatch;
  readonly label: string;
}

const BOX = 'block size-3 shrink-0 rounded-sm border border-border';

function swatchClass(swatch: MapLegendSwatch): string {
  switch (swatch.kind) {
    case 'ramp':
      return `${BOX} ${RAMP_SWATCH_CLASS[swatch.step]}`;
    case 'line':
      return `block h-1 w-4 shrink-0 rounded-full ${RAMP_SWATCH_CLASS[swatch.step]}`;
    case 'inherited':
      return `${BOX} ${HATCH_SWATCH_CLASS.inherited}`;
    case 'few':
      return `${BOX} ${HATCH_SWATCH_CLASS.few}`;
  }
}

interface MapRampLegendProps {
  readonly caption: string;
  readonly items: readonly MapLegendItem[];
}

export function MapRampLegend({ caption, items }: MapRampLegendProps) {
  return (
    <figure className="m-0 flex flex-col gap-1">
      <figcaption className="text-xs font-medium text-muted-foreground">{caption}</figcaption>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-foreground">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span aria-hidden className={swatchClass(item.swatch)} />
            {item.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
