'use client';

/**
 * =============================================================================
 * SHOWCASE CORE — Specs Grid (ADR-321 Phase 1.5b)
 * =============================================================================
 *
 * Simple config-driven specs grid lifted from the project + building showcase
 * specs components (95 %-identical render; the only variance is the row list,
 * which is already built by the surface-specific caller). Uses the shared
 * `showcase-*` CSS variables so all three showcases share the visual
 * identity.
 *
 * Usage (Phase 2+ migration):
 *   const rows = buildSpecRows(building, t);        // caller owns formatting
 *   <ShowcaseSpecsGrid title={t('xxx.specs.title')} rows={rows} />
 *
 * @module components/showcase-core/ShowcaseSpecsGrid
 */

import React from 'react';
import { gridPatterns } from '@/styles/design-tokens';

export interface ShowcaseSpecsGridRow {
  label: string;
  value: string;
}

export interface ShowcaseSpecsGridProps {
  title: string;
  rows: ShowcaseSpecsGridRow[];
}

export function ShowcaseSpecsGrid({ title, rows }: ShowcaseSpecsGridProps) {
  if (rows.length === 0) return null;
  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">{title}</h2>
      {/* ADR-784 §10 — δάπεδο 15rem μετρημένο από την ΙΔΙΑ τη σειρά: ελληνική ετικέτα ~150 px
          + κενό 12 + τιμή ~80 ≈ 242 px. Η σκάλα έδινε δύο στήλες των 176 px σε παράθυρο 700 px
          με ανοιχτό πλευρικό μενού — στριμωγμένες κάτω από το δάπεδο. */}
      <dl className={`grid gap-x-6 gap-y-3 text-sm ${gridPatterns.cards.tile}`}>
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex justify-between gap-3 border-b border-[hsl(var(--showcase-border))] pb-2"
          >
            <dt className="text-[hsl(var(--showcase-muted-fg))]">{label}</dt>
            <dd className="text-[hsl(var(--showcase-fg))] font-medium text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Helper for building the `rows` array — callers typically chain several
 * calls to `pushSpecRow` and pass the result to `<ShowcaseSpecsGrid rows />`.
 * Kept separate so surface-specific code can add custom formatters without
 * re-implementing the "skip empty values" contract.
 */
export function pushSpecRow(
  rows: ShowcaseSpecsGridRow[],
  label: string,
  value: string | number | null | undefined,
): void {
  if (value === undefined || value === null || value === '') return;
  rows.push({ label, value: String(value) });
}
