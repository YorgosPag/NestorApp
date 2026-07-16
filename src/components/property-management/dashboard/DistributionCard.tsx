'use client';

/**
 * DistributionCard — a «how do they break down» panel: one dashboard card listing each bucket of a
 * `key → count` record against its label.
 *
 * Parking and Storages each grew two hand-rolled copies of this (status distribution + type
 * distribution), identical down to the utility classes and differing only in title, icon, the
 * record they read, and how a raw key becomes a label. That last one is the only interesting axis,
 * so it is a prop (`labelFor`) rather than an assumption: Parking resolves through a label
 * constant, Storages through an i18n key — both stay possible here, neither is baked in.
 *
 * Sibling of {@link StatusCard}, not a replacement: that one is the properties-domain card with
 * its own operational-status colour semantics. This one is domain-neutral.
 *
 * Semantics: a distribution IS a description list, so it renders as `<dl>` — the labels are `<dt>`,
 * the counts `<dd>`. Screen readers announce the pairing; the previous span/span markup did not.
 *
 * @component
 * @enterprise ADR-584 — Anti-Duplication
 */

import type { LucideIcon } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import '@/lib/design-system';

interface DistributionCardProps {
  /** Card heading — already translated. */
  title: string;
  /** Icon shown beside the heading. */
  icon: LucideIcon;
  /** The buckets: raw key → count. Rendered in the record's own key order. */
  distribution: Record<string, number>;
  /** Turns a raw bucket key into its display label (label catalog, i18n key, whatever fits). */
  labelFor: (key: string) => string;
}

export function DistributionCard({
  title,
  icon: Icon,
  distribution,
  labelFor,
}: DistributionCardProps) {
  const iconSizes = useIconSizes();

  return (
    <article className="bg-card rounded-lg border p-4">
      <h3 className="font-medium mb-3 flex items-center gap-2">
        <Icon className={iconSizes.sm} />
        {title}
      </h3>
      <dl className="space-y-2">
        {Object.entries(distribution).map(([key, count]) => (
          <div key={key} className="flex justify-between text-sm">
            <dt>{labelFor(key)}</dt>
            <dd className="font-medium">{count}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
