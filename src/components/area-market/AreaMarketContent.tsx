'use client';

/**
 * **Η σελίδα αγοράς μιας περιοχής** — `/area/[id]` (ADR-890 Φ1). Δεδομένα λυμένα στον διακομιστή, εδώ μόνο απόδοση.
 *
 * Σειρά: ταυτότητα (όνομα, βαθμίδα, διοικητική θέση, «στοιχεία της …») → όριο στον χάρτη → ζητούμενες τιμές
 * (πώληση, ενοίκιο) → τιμές συμβολαίων (ADR-890 Φ2) → αγγελίες → Δημοτικές Ενότητες → μεθοδολογία.
 *
 * 🔑 **Δύο ρολόγια, ονομασμένα**: οι τιμές είναι της **τελευταίας νύχτας** («στοιχεία της …»), η λίστα και το
 * πλήθος αγγελιών ανανεώνονται κάθε 15′ (ISR της σελίδας). Το λέει η σελίδα, ώστε μια νέα αγγελία που δεν μέτρησε
 * ακόμη στις τιμές να μη μοιάζει λάθος.
 */

import React from 'react';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { areaMarketHref } from '@/lib/listings/listing-routes';
import { Link } from '@/lib/workspace/navigation';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import { hasAreaMarketPage, MUNICIPALITY_LEVEL, type AreaMarketPageData } from '@/types/area-market';

import { offerViews } from './area-market-view';
import { AreaAskingSection } from './AreaAskingSection';
import { AreaBoundaryMap } from './AreaBoundaryMap';
import { AreaContractSection } from './AreaContractSection';
import { AreaListingsSection } from './AreaListingsSection';
import { AreaMethodology } from './AreaMethodology';

// 🔴 ADR-744 §18 — το route slice φτάνει στον φυλλομετρητή ΜΟΝΟ από client component (όχι από το `page.tsx`).
import routeSlice from '@/i18n/generated/routes/area__id.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'area-market';

/** Οι βαθμίδες με δική τους σελίδα γίνονται σύνδεσμοι· οι υπόλοιπες μένουν κείμενο. */
function AreaLineage({ ancestors }: { readonly ancestors: readonly AdminArea[] }) {
  const { t } = useTranslation([NS]);
  if (ancestors.length === 0) return null;
  return (
    <nav aria-label={t(`${NS}:header.lineage`)}>
      <ol className="m-0 flex list-none flex-wrap gap-x-2 p-0 text-sm text-muted-foreground">
        {[...ancestors].reverse().map((area) => (
          <li key={area.id}>
            {!hasAreaMarketPage(area.level)
              ? area.name
              : <Link href={areaMarketHref(area.id)} className="underline-offset-4 hover:underline">{area.name}</Link>}
            <span aria-hidden="true"> ›</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function AreaHeader({ data }: { readonly data: AreaMarketPageData }) {
  const { t } = useTranslation([NS]);
  const { market } = data;
  return (
    <header className="flex flex-col gap-1">
      <AreaLineage ancestors={data.ancestors} />
      <p className="m-0 text-sm font-medium text-muted-foreground">
        {t(`${NS}:header.eyebrow`)}
        {' · '}
        {t(data.area.level === MUNICIPALITY_LEVEL ? 'area-market:level.municipality' : 'area-market:level.municipalUnit')}
      </p>
      <h1 className="m-0 text-2xl font-semibold text-foreground md:text-3xl">{data.area.name}</h1>
      <p className="m-0 text-sm text-foreground">{t(`${NS}:header.listingsNow`, { count: data.listings.total })}</p>
      <p className="m-0 text-sm text-muted-foreground">
        {market.kind === 'ready'
          ? t(`${NS}:header.asOf`, { date: formatCalendarDay(market.run.day, true) })
          : t(`${NS}:header.noRun`)}
      </p>
    </header>
  );
}

function AreaChildren({ areas }: { readonly areas: readonly AdminArea[] }) {
  const { t } = useTranslation([NS]);
  if (areas.length === 0) return null;
  return (
    <nav aria-labelledby="area-children" className="flex flex-col gap-2">
      <h2 id="area-children" className="m-0 text-lg font-semibold text-foreground">{t(`${NS}:children.title`)}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {areas.map((area) => (
          <li key={area.id}>
            <Link
              href={areaMarketHref(area.id)}
              className="inline-block rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground underline-offset-4 hover:underline"
            >
              {area.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Το όνομα του Δήμου για την αναγωγή των συμβολαίων — μόνο όταν διαβάστηκε το αρχείο του. */
function contractsParentName(data: AreaMarketPageData): string | null {
  const { contracts } = data;
  return contracts.kind === 'ready' && contracts.parent !== null ? (data.ancestors[0]?.name ?? null) : null;
}

export function AreaMarketContent({ data }: { readonly data: AreaMarketPageData }) {
  const { market } = data;
  const snapshot = market.kind === 'ready' ? market.snapshot : null;
  const parent = market.kind === 'ready' ? market.parent : null;
  const parentName = parent === null ? null : (data.ancestors[0]?.name ?? null);
  const offers = snapshot === null ? [] : offerViews(snapshot, parent);

  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6 py-4">
      <AreaHeader data={data} />
      <AreaBoundaryMap areaId={data.area.id} valueZoneFiles={data.valueZoneFiles} />
      {offers.map((view) => (
        <AreaAskingSection key={view.offer} view={view} parentName={parentName} />
      ))}
      <AreaContractSection contracts={data.contracts} asking={snapshot} parentName={contractsParentName(data)} />
      <AreaListingsSection areaId={data.area.id} items={data.listings.items} total={data.listings.total} />
      <AreaChildren areas={data.children} />
      <AreaMethodology />
    </ShellSurface>
  );
}
