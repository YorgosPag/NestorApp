'use client';

/**
 * @fileoverview **Η σελίδα «Λήξεις εγγράφων»** — το μητρώο της εταιρείας (ADR-915 Φ4γ).
 * @related ADR-915 §11 · hooks/document-registry/useDocumentRegistry.ts · lib/document-validity/document-registry-view.ts
 * @module components/document-registry/DocumentRegistryContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ ΠΟΥ ΠΑΜΕ ΠΙΟ ΠΕΡΑ (§11.1)
 * ────────────────────────────────────────────────────────────────────────────
 * Procore: κατάσταση **παραγόμενη** από την ημερομηνία · Ironclad: κάρτες σύνοψης + κυλιόμενα παράθυρα + αποθηκευμένες
 * όψεις · Street: «χωρίς έγκυρο EPC». Εδώ, επιπλέον: **τι σταματά** σε κάθε γραμμή · τυπωμένη λήξη έναντι κανόνα (Α4)
 * · «λήγει» = ο χρόνος ανανέωσης **του είδους** · μετρητής **ανά προβολή** από τον ΙΔΙΟ ταξινομητή.
 *
 * 🔑 **Η ΟΘΟΝΗ ΔΕΝ ΚΡΙΝΕΙ ΤΙΠΟΤΑ.** Κατάσταση και «μπλοκάρει» ήρθαν από τον διακομιστή· οι προβολές περνούν από τον
 *    `matchesRegistryFilter` με το `asOf` **της απόκρισης**.
 * 🔑 **Η προβολή ζει στη διεύθυνση** (`?view=`): σύνδεσμος που μοιράζεται, «πίσω» που δουλεύει, στόχος για τις
 *    ειδοποιήσεις της Φ5. Αλλαγή με `replace` — η εναλλαγή φίλτρων δεν γεμίζει το ιστορικό.
 * 🔴 **`truncated` ⇒ ορατή ειδοποίηση με τις πηγές, ΠΑΝΩ από τις μετρήσεις** — αλλιώς «0 έληξαν» θα διαβαζόταν βέβαιο.
 * ⚠️ `section w-full`, όχι `main`/`p-*`: το `<main>` και το κενό τα δίνει το κέλυφος (CHECK 3.63 · `MandateCatalogContent`).
 */

import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useDocumentRegistry, type DocumentRegistryState } from '@/hooks/document-registry/useDocumentRegistry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateKey, formatList } from '@/lib/intl-formatting';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link, useRouter } from '@/lib/workspace/navigation';
import {
  REGISTRY_ROW_STATES,
  REGISTRY_WINDOW_DAYS,
  registryRowIdOf,
  type RegistryRow,
} from '@/lib/document-validity/document-registry';
import {
  documentExpiryHref,
  REGISTRY_PICKER_VIEWS,
  REGISTRY_VIEW_PARAM,
  registryViewOf,
  registryViewTally,
  rowsOfRegistryView,
  type RegistryPickerView,
  type RegistryView,
} from '@/lib/document-validity/document-registry-view';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { documentNameOf, RegistryRowItem } from '@/components/document-registry/RegistryRowItem';
import { RegistryGapItem } from '@/components/document-registry/RegistryGapItem';
import { RegistryTally } from '@/components/document-registry/RegistryTally';
import {
  REGISTRY_KEYS,
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_NS,
  REGISTRY_STATE_LABEL_KEYS,
  REGISTRY_VIEW_LABEL_KEYS,
  TRUNCATED_SOURCE_KEYS,
} from '@/components/document-registry/document-registry-labels';

// 🧩 ADR-744 §15 — PER-ROUTE SLICE. Εδώ (Client Component, εμβέλεια module, στατική εισαγωγή), ΟΧΙ στο `page.tsx`:
//    αλλιώς το πρώτο καρέ βάφει ωμά κλειδιά (CHECK 3.51). Ίδιο ιδίωμα με το `MandateCatalogContent`.
import routeSlice from '@/i18n/generated/routes/o__workspace__document-expiry.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

type Translate = ReturnType<typeof useTranslation>['t'];

/** Η προβολή από τη διεύθυνση, και η αλλαγή της (`replace`). */
function useRegistryView(): readonly [RegistryView, (next: RegistryView) => void] {
  const view = registryViewOf(useSearchParams().get(REGISTRY_VIEW_PARAM));
  const router = useRouter();
  const select = useCallback((next: RegistryView) => router.replace(documentExpiryHref(next), { scroll: false }), [router]);
  return [view, select];
}

function TruncatedNotice({ registry }: { readonly registry: DocumentRegistryResponse }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  if (!registry.truncated) return null;
  const sources = formatList(registry.truncatedSources.map((source) => t(TRUNCATED_SOURCE_KEYS[source])));
  return (
    <Alert>
      <AlertTitle>{t(REGISTRY_KEYS.truncatedTitle)}</AlertTitle>
      <AlertDescription>{t(REGISTRY_KEYS.truncatedBody, { sources })}</AlertDescription>
    </Alert>
  );
}

function EmptyState(): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="m-0 font-medium text-foreground">{t(REGISTRY_KEYS.emptyTitle)}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.emptyHint)}</p>
      <nav>
        <Link href={ENTITY_ROUTES.properties.list} className="text-sm underline underline-offset-4">
          {t(REGISTRY_KEYS.emptyAction)}
        </Link>
      </nav>
    </Card>
  );
}

function viewLabel(t: Translate, view: RegistryPickerView, count: number): string {
  const label = t(REGISTRY_VIEW_LABEL_KEYS[view], { days: REGISTRY_WINDOW_DAYS });
  return t(REGISTRY_KEYS.filterOption, { label, count });
}

interface ViewPickerProps {
  readonly view: RegistryView;
  readonly onSelect: (next: RegistryView) => void;
  readonly tally: Readonly<Record<RegistryView, number>>;
}

function ViewPicker({ view, onSelect, tally }: ViewPickerProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    // Προβολή κατάστασης (από κάρτα) ⇒ κανένα τσιπ πατημένο — την πατημένη τη δείχνει η κάρτα.
    <SegmentedControl value={view} onValueChange={onSelect} aria-label={t(REGISTRY_KEYS.filterLabel)}>
      {REGISTRY_PICKER_VIEWS.map((option) => (
        <SegmentedControlItem key={option} value={option} size="sm">
          {viewLabel(t, option, tally[option])}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

/** `id` γραμμής → όνομα εγγράφου: για το «αντικαταστάθηκε από …» χωρίς δεύτερη αναζήτηση ανά γραμμή. */
function useRowNames(t: Translate, registry: DocumentRegistryResponse): ReadonlyMap<string, string> {
  return useMemo(
    () => new Map(registry.rows.flatMap((row) =>
      row.kind === 'document' ? [[row.document.id, documentNameOf(t, row.document, registry)] as const] : [])),
    [t, registry],
  );
}

/** Έγγραφο ή κενό — ο τύπος της γραμμής διαλέγει το στοιχείο, ποτέ η οθόνη μόνη της. */
function RowItem({ row, registry, names }: {
  readonly row: RegistryRow;
  readonly registry: DocumentRegistryResponse;
  readonly names: ReadonlyMap<string, string>;
}): React.ReactElement {
  if (row.kind === 'gap') return <RegistryGapItem row={row} registry={registry} />;
  const supersededByName = row.supersededBy === null ? null : (names.get(row.supersededBy) ?? null);
  return <RegistryRowItem row={row} registry={registry} supersededByName={supersededByName} />;
}

interface GroupsProps {
  readonly rows: readonly RegistryRow[];
  readonly registry: DocumentRegistryResponse;
}

/** Ομάδες ανά κατάσταση, στη σειρά επείγοντος. Η **άδεια** ομάδα δεν ζωγραφίζεται — τα μηδενικά ζουν στις κάρτες. */
function RegistryGroups({ rows, registry }: GroupsProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const names = useRowNames(t, registry);
  if (rows.length === 0) return <p className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.filterEmpty)}</p>;
  return (
    <>
      {REGISTRY_ROW_STATES.map((state) => {
        const members = rows.filter((row) => row.state === state);
        if (members.length === 0) return null;
        return (
          <section key={state} className="flex flex-col gap-3">
            <h2 className="m-0 text-lg font-semibold text-foreground">
              {t(REGISTRY_STATE_LABEL_KEYS[state])}{' '}
              <span className="text-sm font-normal text-muted-foreground">{t(REGISTRY_KEYS.groupCount, { count: members.length })}</span>
            </h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {members.map((row) => (
                <li key={registryRowIdOf(row)}>
                  <RowItem row={row} registry={registry} names={names} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function ReadyBody({ registry }: { readonly registry: DocumentRegistryResponse }): React.ReactElement {
  const [view, select] = useRegistryView();
  const tally = useMemo(() => registryViewTally(registry.rows, registry.asOf), [registry]);
  const rows = useMemo(() => rowsOfRegistryView(registry.rows, view, registry.asOf), [registry, view]);
  return (
    <>
      <TruncatedNotice registry={registry} />
      <RegistryTally tally={registry.tally} view={view} onSelect={select} />
      {registry.rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ViewPicker view={view} onSelect={select} tally={tally} />
          <RegistryGroups rows={rows} registry={registry} />
        </>
      )}
    </>
  );
}

/** Τρεις καταστάσεις φόρτωσης, ρητά. Η αποτυχία δίνει **κουμπί**, όχι μόνο μήνυμα. */
function RegistryBody({ view, reload }: { readonly view: DocumentRegistryState; readonly reload: () => void }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  if (view.state === 'loading') return <p className="m-0 text-muted-foreground">{t(REGISTRY_KEYS.loading)}</p>;
  if (view.state === 'failed') {
    return (
      <section className="flex flex-col items-start gap-2">
        <p className="m-0 text-foreground">{t(REGISTRY_KEYS.error)}</p>
        <Button type="button" size="sm" variant="secondary" onClick={reload}>{t(REGISTRY_KEYS.retry)}</Button>
      </section>
    );
  }
  return <ReadyBody registry={view.registry} />;
}

export function DocumentRegistryContent(): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const { view, reload } = useDocumentRegistry();
  return (
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(REGISTRY_KEYS.title)}</h1>
        <p className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.lead)}</p>
        {view.state === 'ready' ? (
          <p className="m-0 text-xs text-muted-foreground">
            <time dateTime={view.registry.asOf}>{t(REGISTRY_KEYS.asOf, { date: formatDateKey(view.registry.asOf) })}</time>
          </p>
        ) : null}
      </header>
      <RegistryBody view={view} reload={reload} />
      {/* 🔑 Τα όρια λέγονται, δεν κρύβονται (Γ1) — και όπου μετριούνται, λέγονται με ΑΡΙΘΜΟ (Φ4δ Ε11). */}
      <footer className="flex flex-col gap-1">
        <p className="m-0 text-xs text-muted-foreground">{t(REGISTRY_KEYS.scopeNote)}</p>
        {view.state === 'ready' ? (
          <p className="m-0 text-xs text-muted-foreground">
            {t(REGISTRY_KEYS.unscopedListings, { count: view.registry.unscopedListings })}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
