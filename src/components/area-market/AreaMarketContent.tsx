'use client';

/**
 * **Η σελίδα αγοράς μιας περιοχής** — `/area/[id]` (ADR-890 Φ1). Δεδομένα λυμένα στον διακομιστή, εδώ μόνο απόδοση.
 *
 * Σειρά: ταυτότητα (όνομα, βαθμίδα, διοικητική θέση, «στοιχεία της …») → χάρτης ανά επίπεδο (§15: στον Δήμο οι Δ.Ε.
 * βαμμένες + ο πίνακάς τους· στη Δ.Ε. το όριο + οι ζώνες) → ζητούμενες τιμές (πώληση, ενοίκιο — με μηνιαία τάση, §13) →
 * απόδοση ενοικίου (§5.4) → τιμές συμβολαίων (ADR-890 Φ2) → αγγελίες → (Δ.Ε. ως σύνδεσμοι, μόνο χωρίς πίνακα) → μεθοδολογία.
 *
 * 🔑 **Δύο ρολόγια, ονομασμένα**: οι τιμές είναι της **τελευταίας νύχτας** («στοιχεία της …»), η λίστα και το
 * πλήθος αγγελιών ανανεώνονται κάθε 15′ (ISR της σελίδας). Το λέει η σελίδα, ώστε μια νέα αγγελία που δεν μέτρησε
 * ακόμη στις τιμές να μη μοιάζει λάθος.
 */

import React from 'react';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { monthOfDay } from '@/lib/market/market-statistics';
import { areaMarketHref } from '@/lib/listings/listing-routes';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import { Link } from '@/lib/workspace/navigation';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import { hasAreaMarketPage, type AreaMarketPageData } from '@/types/area-market';

import { areaLevelName, childMapWordsOf } from './area-level-words';
import { yieldViews, type AreaSeriesInput } from './area-market-insight-view';
import { offerViews } from './area-market-view';
import { AreaAskingSection } from './AreaAskingSection';
import { AreaMapSection } from './AreaMapSection';
import { AreaContractSection } from './AreaContractSection';
import { AreaListingsSection } from './AreaListingsSection';
import { AreaMethodology } from './AreaMethodology';
import { AreaYieldSection } from './AreaYieldSection';

// 🔴 ADR-744 §18 — το route slice φτάνει στον φυλλομετρητή ΜΟΝΟ από client component (όχι από το `page.tsx`).
import routeSlice from '@/i18n/generated/routes/area__id.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'area-market';

/**
 * Οι βαθμίδες με δική τους σελίδα γίνονται σύνδεσμοι· οι υπόλοιπες μένουν κείμενο. Ο σύνδεσμος **φαίνεται** σύνδεσμος
 * χωρίς hover (υπογράμμιση + χρώμα κειμένου, ADR-890 §15): αλλιώς στο κινητό δεν ξεχώριζε από τα απλά ονόματα δίπλα του.
 */
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
              : <Link href={areaMarketHref(area.id)} className={`text-foreground ${VISIBLE_LINK_CLASS}`}>{area.name}</Link>}
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
        {hasAreaMarketPage(data.area.level) ? areaLevelName(t, data.area.level) : null}
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

function AreaChildren({ level, areas }: { readonly level: number; readonly areas: readonly AdminArea[] }) {
  const { t } = useTranslation([NS, 'price-map']);
  const words = childMapWordsOf(t, level);
  if (areas.length === 0 || words === null) return null;
  return (
    <nav aria-labelledby="area-children" className="flex flex-col gap-2">
      <h2 id="area-children" className="m-0 text-lg font-semibold text-foreground">{words.title}</h2>
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

/** Η σειρά της περιοχής με τον μήνα της τελευταίας νύχτας — `null` πριν από την πρώτη νύχτα με σειρά (§13). */
function seriesInput(data: AreaMarketPageData): AreaSeriesInput | null {
  const { market } = data;
  return market.kind === 'ready' && market.series !== null ? { points: market.series, lastMonth: monthOfDay(market.run.day) } : null;
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
  const offers = snapshot === null ? [] : offerViews(snapshot, parent, seriesInput(data));
  const contractSummary = data.contracts.kind === 'ready' ? data.contracts.summary : null;
  const yields = snapshot === null ? [] : yieldViews(snapshot, contractSummary);

  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6 py-4">
      <AreaHeader data={data} />
      <AreaMapSection data={data} />
      {offers.map((view) => (
        <AreaAskingSection key={view.offer} view={view} parentName={parentName} />
      ))}
      <AreaYieldSection views={yields} />
      <AreaContractSection contracts={data.contracts} asking={snapshot} parentName={contractsParentName(data)} />
      <AreaListingsSection areaId={data.area.id} items={data.listings.items} total={data.listings.total} />
      {data.childPrices.kind !== 'ready' && <AreaChildren level={data.area.level} areas={data.children} />}
      <AreaMethodology />
    </ShellSurface>
  );
}
