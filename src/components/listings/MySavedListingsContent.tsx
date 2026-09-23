'use client';

/**
 * @fileoverview **«ΑΠΟΘΗΚΕΥΜΕΝΕΣ ΑΓΓΕΛΙΕΣ»** — ό,τι κράτησε ο άνθρωπος, με την τρέχουσα τιμή του (ADR-777 §8.74).
 * @related SavedListingsProvider.tsx · services/listings/saved-listing.service.ts · app/(me)/saved-listings
 * @module components/listings/MySavedListingsContent
 *
 * 🏆 **Πού ξεπερνάμε τους μεγάλους:**
 * - **«↓ 5% από τότε που την αποθηκεύσατε»** — η σύγκριση είναι με την τιμή που **είδε ο ίδιος**, όχι με
 *   ένα γενικό «μειώθηκε»· αλλαγή ρόλου (πώληση → ενοικίαση) δεν γίνεται ποτέ ψεύτικο ποσοστό.
 * - Αγγελία που **αποσύρθηκε** μένει ως «Δεν είναι πια στην αγορά» — δεν εξαφανίζεται σιωπηλά.
 * - Η αφαίρεση **αναιρείται**: η γραμμή μένει με άδεια καρδιά μέχρι να ξαναφορτώσει η σελίδα.
 */

import React from 'react';
import '@/lib/design-system';

import { OwnedListStatus } from '@/components/private-space/OwnedListStatus';
import { ListingCard } from '@/components/search-results/ListingCard';
import routeSlice from '@/i18n/generated/routes/saved-listings.el.json';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { registerRouteSlice } from '@/i18n/route-slice';
import { formatCalendarDay, formatPercentage } from '@/lib/intl-formatting';
import { marketDayOf } from '@/lib/listings/listing-stats';
import { SEARCH_LANDING_ROUTE } from '@/lib/listings/listing-routes';
import { Link } from '@/lib/workspace/navigation';
import type { PriceSinceSave, SavedListingRow } from '@/types/saved-listing';

import { SaveListingToggle } from './SaveListingToggle';
import { SavedListingsProvider, useSavedListingsPage } from './SavedListingsProvider';

// 🧩 ADR-744 §15 — per-route slice (ίδιος λόγος και θέση με το `MyDemandsContent`).
registerRouteSlice(routeSlice);

const P = 'property-market:savedListings';

/** «Αποθηκεύτηκε 12 Σεπ · ↓ 5% από τότε που την αποθηκεύσατε». */
function annotationOf(savedAt: string, change: PriceSinceSave, t: Translate): string {
  // Η ημέρα είναι ημέρα **Αθήνας** (`marketDayOf`), όχι το UTC του ISO — ίδιο συμβόλαιο με τα στατιστικά.
  const savedOn = t(`${P}.savedOn`, { date: formatCalendarDay(marketDayOf(Date.parse(savedAt))) });
  if (change.kind !== 'reduced' && change.kind !== 'raised') return savedOn;
  const percent = formatPercentage((Math.abs(change.to - change.from) / change.from) * 100, { maximumFractionDigits: 1 });
  return `${savedOn} · ${t(`${P}.${change.kind}`, { percent })}`;
}

function WithdrawnRow({ row }: { readonly row: Extract<SavedListingRow, { kind: 'withdrawn' }> }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <p className="m-0 text-sm text-foreground">
        {t(`${P}.withdrawn`)}
        <span className="ml-2 text-xs text-muted-foreground">{annotationOf(row.savedAt, { kind: 'not-comparable' }, t)}</span>
      </p>
      <SaveListingToggle listingId={row.listingId} appearance="labeled" />
    </li>
  );
}

function SavedRows({ rows, truncated }: { readonly rows: readonly SavedListingRow[]; readonly truncated: boolean }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  if (rows.length === 0) {
    return (
      <section className="rounded-md border border-border bg-card p-4">
        <p className="m-0 text-sm text-foreground">{t(`${P}.empty`)}</p>
        <Link href={SEARCH_LANDING_ROUTE} className="mt-2 inline-block text-sm underline">{t(`${P}.search`)}</Link>
      </section>
    );
  }
  return (
    <>
      <ul aria-label={t(`${P}.listLabel`)} className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4 p-0">
        {rows.map((row) =>
          row.kind === 'withdrawn' ? (
            <WithdrawnRow key={row.listingId} row={row} />
          ) : (
            <ListingCard key={row.listingId} listing={row.listing} annotation={annotationOf(row.savedAt, row.priceSinceSave, t)} />
          ),
        )}
      </ul>
      {truncated && <p className="m-0 text-xs text-muted-foreground">{t(`${P}.truncated`, { count: rows.length })}</p>}
    </>
  );
}

function SavedBody(): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  const page = useSavedListingsPage();
  if (page === null) return null;
  // Ο ιδιωτικός χώρος είναι ήδη πίσω από σύνδεση· η «βλάβη» του παρόχου είναι το `error` της λίστας.
  const state =
    page.status === 'ready'
      ? { state: 'ready' as const, rows: page.rows, truncated: page.truncated }
      : { state: page.status === 'unavailable' ? ('error' as const) : page.status === 'anonymous' ? ('anonymous' as const) : ('loading' as const) };
  return (
    <OwnedListStatus
      state={state}
      loadingText={t(`${P}.loading`)}
      errorText={t(`${P}.unavailable`)}
      renderReady={(ready) => <SavedRows rows={ready.rows} truncated={ready.truncated} />}
    />
  );
}

export function MySavedListingsContent(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    // Καμία κλάση ύψους/διαδρόμου: τα κατέχει το `ShellSurface` του `(me)` (ίδια σύμβαση με `MyDemandsContent`).
    <main className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t(`${P}.title`)}</h1>
        <p className="text-sm text-muted-foreground">{t(`${P}.intro`)}</p>
      </header>
      <SavedListingsProvider>
        <SavedBody />
      </SavedListingsProvider>
    </main>
  );
}
