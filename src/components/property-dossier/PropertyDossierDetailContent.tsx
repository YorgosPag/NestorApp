'use client';

/**
 * @fileoverview **Ένας φάκελος ακινήτου** — `/dossiers/[dossierId]` (ADR-866 Φ1.2).
 * @related ADR-866 §2.9.6 · §2.9.3 (Κ1 · Κ4) · §2.9.8 · unified-tabs-factory.ts `'property-dossier'`
 * @module components/property-dossier/PropertyDossierDetailContent
 *
 * 🔑 **Κεφαλίδα = ταυτότητα του σπιτιού** (όνομα, επιτόπου μετονομάσιμο · είδος · κατάσταση), **καρτέλες = περιεχόμενο**
 * (Κάτοψη · Έγγραφα · Φωτογραφίες · Βίντεο · Ιστορικό) μέσω του **υπάρχοντος** `UniversalTabsRenderer` — η καρτέλα
 * **δεν** φορτώνει πριν ανοίξει (`LazyTabContent`), άρα τα τέσσερα ερωτήματα αρχείων δεν τρέχουν όλα μαζί.
 *
 * ⚠️ **Σε γη η «Κάτοψη» λέγεται «Τοπογραφικό»** (§2.7.1) — ίδια κατηγορία αρχείων, άλλη λέξη (`floorplanTabKind`).
 * ⚠️ **Αρχειοθετημένος ⇒ πλαίσιο + «Επαναφορά»**, τα αρχεία μένουν προσβάσιμα: η αρχειοθέτηση αλλάζει **πού φαίνεται**
 * ο φάκελος, όχι τι επιτρέπεται (§2.9.6 — δηλωμένο όριο: δεν κλειδώνει ανεβάσματα).
 */

import React from 'react';
import '@/lib/design-system';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '@/auth/hooks/useAuth';
import { UniversalTabsRenderer } from '@/components/generic/UniversalTabsRenderer';
import {
  PROPERTY_DOSSIER_COMPONENT_MAPPING,
  type PropertyDossierTabComponentProps,
} from '@/components/generic/mappings/propertyDossierMappings';
import { getSortedTabs, type UnifiedTabConfig } from '@/config/unified-tabs-factory';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useIconSizes } from '@/hooks/useIconSizes';
import routeSlice from '@/i18n/generated/routes/dossiers__dossierId.el.json';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { registerRouteSlice } from '@/i18n/route-slice';
import { MY_DOSSIERS_ROUTE } from '@/lib/property-dossier/property-dossier-routes';
import { floorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import { useMyPropertyDossier } from '@/services/realtime/hooks/useMyPropertyDossiers';
import type { PropertyDossier } from '@/types/property-dossier';

import { usePropertyDossierTypeLabel } from './PropertyDossierCard';
import { PropertyDossierDialog } from './PropertyDossierDialog';
import { PropertyDossierTitle } from './PropertyDossierTitle';
import { usePropertyDossierLifecycle } from './usePropertyDossierLifecycle';

registerRouteSlice(routeSlice);

const NS = 'property-market';
const K = `${NS}:dossier`;

/** Οι καρτέλες **αυτού** του φακέλου — του εργοστασίου, με την κάτοψη να λέγεται «τοπογραφικό» σε γη. */
function dossierTabs(type: PropertyDossier['type']): UnifiedTabConfig[] {
  const floorplanLabel = floorplanTabKind(type) === 'topographic' ? `dossier.tabs.topographic` : `dossier.tabs.floorplan`;
  return getSortedTabs('property-dossier').map((tab) => (tab.id === 'floor-plan' ? { ...tab, label: floorplanLabel } : tab));
}

/** Αρχειοθετημένος — λέει τι σημαίνει και δίνει την έξοδο **εκεί**, όχι κρυμμένη σε μενού. */
function ArchivedNotice({ dossier }: { readonly dossier: PropertyDossier }) {
  const { t } = useTranslation([NS]);
  const lifecycle = usePropertyDossierLifecycle();
  return (
    <aside className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
      <p className="m-0 text-sm text-foreground">{t(`${K}.lifecycle.archivedBanner`)}</p>
      <button
        type="button"
        disabled={lifecycle.busy}
        onClick={() => void lifecycle.restore(dossier)}
        className={cn('rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50', COLOR_BRIDGE.action.secondary)}
      >
        {t(`${K}.lifecycle.restore`)}
      </button>
    </aside>
  );
}

function DossierHeader({ dossier }: { readonly dossier: PropertyDossier }) {
  const { t } = useTranslation([NS]);
  const lifecycle = usePropertyDossierLifecycle();
  const typeLabel = usePropertyDossierTypeLabel(dossier.type);
  const [renaming, setRenaming] = React.useState(false);
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <hgroup className="flex min-w-0 flex-col gap-1">
        <PropertyDossierTitle dossier={dossier} />
        <p className="m-0 text-sm text-muted-foreground">{typeLabel}</p>
      </hgroup>
      <nav aria-label={t(`${K}.list.actions.label`, { label: dossier.label })} className="flex gap-2">
        <button type="button" onClick={() => setRenaming(true)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', COLOR_BRIDGE.action.secondary)}>
          {t(`${K}.list.actions.rename`)}
        </button>
        {dossier.lifecycle === 'active' && (
          <button type="button" disabled={lifecycle.busy} onClick={() => void lifecycle.archive(dossier)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50', COLOR_BRIDGE.action.caution)}>
            {t(`${K}.list.actions.archive`)}
          </button>
        )}
      </nav>
      <PropertyDossierDialog mode={renaming ? { kind: 'rename', dossier } : null} onClose={() => setRenaming(false)} />
    </header>
  );
}

function DossierView({ dossier }: { readonly dossier: PropertyDossier }) {
  const tabs = React.useMemo(() => dossierTabs(dossier.type), [dossier.type]);
  return (
    <>
      <DossierHeader dossier={dossier} />
      {dossier.lifecycle === 'archived' && <ArchivedNotice dossier={dossier} />}
      <UniversalTabsRenderer<PropertyDossier, PropertyDossierTabComponentProps>
        tabs={tabs}
        data={dossier}
        componentMapping={PROPERTY_DOSSIER_COMPONENT_MAPPING}
        translationNamespace={NS}
      />
    </>
  );
}

export function PropertyDossierDetailContent({ dossierId }: { readonly dossierId: string }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { user } = useAuth();
  const lookup = useMyPropertyDossier(dossierId, user?.uid ?? null);
  const iconSizes = useIconSizes();
  return (
    <main className="flex w-full flex-col gap-6">
      <nav>
        <Link href={MY_DOSSIERS_ROUTE} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline">
          <ArrowLeft className={iconSizes.sm} aria-hidden="true" />
          {t(`${K}.detail.back`)}
        </Link>
      </nav>
      {lookup.state === 'loading' && <p className="text-muted-foreground">{t(`${K}.detail.loading`)}</p>}
      {lookup.state === 'anonymous' && <p className="text-foreground">{t(`${NS}:demand.space.signInNeeded`)}</p>}
      {lookup.state === 'absent' && <p className="text-foreground">{t(`${K}.detail.absent`)}</p>}
      {lookup.state === 'error' && <p className="text-foreground">{t(`${K}.detail.error`)}</p>}
      {lookup.state === 'found' && <DossierView dossier={lookup.item} />}
    </main>
  );
}
