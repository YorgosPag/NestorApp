'use client';

/**
 * @fileoverview **«Οι φάκελοί μου»** — `/dossiers` (ADR-866 Φ1.2).
 * @related ADR-866 §2.9.6 · §2.9.8 (Δ1-Δ4) · useMyPropertyDossiers.ts · property-dossier-view.ts
 * @module components/property-dossier/MyPropertyDossiersContent
 *
 * 🔑 **Φίλτρο «Ενεργοί · Αρχειοθετημένοι», με πλήθος** (Ε-Φ1.2-2 — ACC «ARCHIVED» filter): ο αρχειοθετημένος φάκελος
 * **φεύγει** από την καθημερινή λίστα (όχι απλώς χαμηλότερα), και το πλήθος λέει ότι «κάτι υπάρχει εκεί» χωρίς κλικ.
 * Radix `Tabs` (WAI-ARIA tablist): το φίλτρο **είναι** επιλογή πάνελ, όχι φόρμα.
 *
 * ⚠️ **Ζωντανή λίστα, καμία αισιόδοξη αντιγραφή**: μετά από αρχειοθέτηση/γέννηση ο φάκελος εμφανίζεται/μετακινείται
 * μόνος του από το `onSnapshot` — **μία** πηγή αλήθειας, όπως οι λίστες του Drive.
 *
 * ⚠️ Κανένα `mx-auto max-w-* p-*`: διάδρομο και μέτρο τα κατέχει το `ShellSurface` του `PrivateSpaceShell` (ADR-797).
 */

import React from 'react';
import '@/lib/design-system';

import { useAuth } from '@/auth/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import routeSlice from '@/i18n/generated/routes/dossiers.el.json';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { registerRouteSlice } from '@/i18n/route-slice';
import { dossierDetailHref } from '@/lib/property-dossier/property-dossier-routes';
import { partitionDossiers } from '@/lib/property-dossier/property-dossier-view';
import { cn } from '@/lib/utils';
import { useRouter } from '@/lib/workspace/navigation';
import { useMyPropertyDossiers } from '@/services/realtime/hooks/useMyPropertyDossiers';
import {
  PROPERTY_DOSSIER_LIFECYCLES,
  type PropertyDossier,
  type PropertyDossierLifecycle,
} from '@/types/property-dossier';

import { PropertyDossierCard } from './PropertyDossierCard';
import { PropertyDossierDialog, type PropertyDossierDialogMode } from './PropertyDossierDialog';
import { usePropertyDossierLifecycle } from './usePropertyDossierLifecycle';

registerRouteSlice(routeSlice);

const NS = 'property-market';
const K = `${NS}:dossier.list`;

/** Άδεια όψη — **εξηγεί** τι είναι (ενεργοί) ή τι σημαίνει η αρχειοθέτηση (αρχειοθετημένοι). */
function EmptyDossiers({ lifecycle }: { readonly lifecycle: PropertyDossierLifecycle }) {
  const { t } = useTranslation([NS]);
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <p className="m-0 font-medium text-foreground">{t(`${K}.empty.${lifecycle}.title`)}</p>
      <p className="mt-1 mb-0 text-sm text-muted-foreground">{t(`${K}.empty.${lifecycle}.body`)}</p>
    </section>
  );
}

interface DossierListProps {
  readonly dossiers: readonly PropertyDossier[];
  readonly lifecycle: PropertyDossierLifecycle;
  readonly onRename: (dossier: PropertyDossier) => void;
}

function DossierList({ dossiers, lifecycle, onRename }: DossierListProps) {
  const controls = usePropertyDossierLifecycle();
  if (dossiers.length === 0) return <EmptyDossiers lifecycle={lifecycle} />;
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {dossiers.map((dossier) => (
        <li key={dossier.id}>
          <PropertyDossierCard dossier={dossier} lifecycle={controls} onRename={onRename} />
        </li>
      ))}
    </ul>
  );
}

/** Το φίλτρο + τα δύο πάνελ. Προεπιλογή: **ενεργοί** — εκεί ζει η καθημερινή δουλειά. */
function DossierFilter({ dossiers, onRename }: { readonly dossiers: readonly PropertyDossier[]; readonly onRename: DossierListProps['onRename'] }) {
  const { t } = useTranslation([NS]);
  const partitioned = partitionDossiers(dossiers);
  return (
    <Tabs defaultValue="active" className="flex flex-col gap-4">
      <TabsList aria-label={t(`${K}.filterLabel`)} className="self-start">
        {PROPERTY_DOSSIER_LIFECYCLES.map((lifecycle) => (
          <TabsTrigger key={lifecycle} value={lifecycle}>
            {t(`${K}.filter.${lifecycle}`)} ({partitioned[lifecycle].length})
          </TabsTrigger>
        ))}
      </TabsList>
      {PROPERTY_DOSSIER_LIFECYCLES.map((lifecycle) => (
        <TabsContent key={lifecycle} value={lifecycle} className="m-0">
          <DossierList dossiers={partitioned[lifecycle]} lifecycle={lifecycle} onRename={onRename} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function DossiersBody({ onRename }: { readonly onRename: DossierListProps['onRename'] }) {
  const { t } = useTranslation([NS]);
  const { user } = useAuth();
  const state = useMyPropertyDossiers(user?.uid ?? null);
  switch (state.state) {
    case 'anonymous':
      return <p className="text-foreground">{t(`${NS}:demand.space.signInNeeded`)}</p>;
    case 'loading':
      return <p className="text-muted-foreground">{t(`${K}.loading`)}</p>;
    case 'error':
      return <p className="text-foreground">{t(`${K}.error`)}</p>;
    case 'ready':
      return <DossierFilter dossiers={state.items} onRename={onRename} />;
  }
}

export function MyPropertyDossiersContent(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const router = useRouter();
  const [dialog, setDialog] = React.useState<PropertyDossierDialogMode | null>(null);
  return (
    <main className="flex w-full flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <hgroup className="flex flex-col gap-2">
          <h1 className="m-0 text-2xl font-semibold text-foreground">{t(`${K}.title`)}</h1>
          <p className="m-0 text-sm text-muted-foreground">{t(`${K}.lead`)}</p>
        </hgroup>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'create' })}
          className={cn('rounded-md px-4 py-2 font-medium', COLOR_BRIDGE.action.primary)}
        >
          {t(`${K}.create`)}
        </button>
      </header>
      <DossiersBody onRename={(dossier) => setDialog({ kind: 'rename', dossier })} />
      <PropertyDossierDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        onSaved={(saved) => {
          // Νέος φάκελος ⇒ άνοιξέ τον (Figma/Notion: το νέο στοιχείο ανοίγει — η επόμενη κίνηση είναι να ανεβάσεις
          // αρχεία)· μετονομασία ⇒ μένεις στη λίστα.
          if (dialog?.kind === 'create') router.push(dossierDetailHref(saved.id));
        }}
      />
    </main>
  );
}
