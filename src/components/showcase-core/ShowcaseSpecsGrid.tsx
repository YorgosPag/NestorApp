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
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
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
