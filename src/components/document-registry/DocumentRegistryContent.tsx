'use client';

/**
 * @fileoverview **Η σελίδα «Λήξεις εγγράφων»** — το μητρώο της εταιρείας (ADR-915 Φ4γ · διάταξη §41).
 * @related ADR-915 §11 · §41 · hooks/document-registry/useDocumentRegistry.ts · lib/document-validity/document-registry-view.ts
 * @module components/document-registry/DocumentRegistryContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ ΠΟΥ ΠΑΜΕ ΠΙΟ ΠΕΡΑ (§11.1 · §41.2)
 * ────────────────────────────────────────────────────────────────────────────
 * Procore: κατάσταση **παραγόμενη** από την ημερομηνία · Ironclad: κάρτες σύνοψης + αποθηκευμένες όψεις · Drata:
 * εισερχόμενα ≠ βιβλιοθήκη, ένα λεξιλόγιο · Carbon: πυκνός πίνακας · Linear: λεπτομέρεια στο πλάι. Εδώ, επιπλέον: **τι
 * σταματά** σε κάθε γραμμή · τα εισερχόμενα κατά το **πότε μπλοκάρει συναλλαγή** · μετρητής ανά προβολή από τον ΙΔΙΟ ταξινομητή.
 *
 * 🔑 **Η ΟΘΟΝΗ ΔΕΝ ΚΡΙΝΕΙ ΤΙΠΟΤΑ.** Κατάσταση και «μπλοκάρει» ήρθαν από τον διακομιστή· προβολές και καρτέλες περνούν
 *    από τον `document-registry-view.ts` με το `asOf` **της απόκρισης**.
 * 🔑 **Ό,τι βλέπεις ζει στη διεύθυνση** (`?tab=` · `?view=` · `?group=` · `?doc=`), με ΕΝΑΝ μηχανισμό
 *    (`useRegistryAddress`): σύνδεσμος που μοιράζεται, «πίσω» που κλείνει το πάνελ, στόχος για τις ειδοποιήσεις της Φ5.
 * 🔴 **`truncated` ⇒ ορατή ειδοποίηση με τις πηγές, ΠΑΝΩ από τις μετρήσεις** — αλλιώς «0 έληξαν» θα διαβαζόταν βέβαιο.
 * ⚠️ `section w-full`, όχι `main`/`p-*`: το `<main>` και το κενό τα δίνει το κέλυφος (CHECK 3.63 · `MandateCatalogContent`).
 */

import React, { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCapability } from '@/auth/hooks/useCapability';
import { useDocumentRegistry, type DocumentRegistryApi, type DocumentRegistryState } from '@/hooks/document-registry/useDocumentRegistry';
import { useIssuanceAssignment } from '@/hooks/document-registry/useIssuanceAssignment';
import { useObligorDesignation } from '@/hooks/document-registry/useObligorDesignation';
import { useRegistryAddress } from '@/hooks/document-registry/useRegistryAddress';
import { useUpkeepDeclaration } from '@/hooks/document-registry/useUpkeepDeclaration';
import { isGranted } from '@/types/capability-authority';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateKey, formatList } from '@/lib/intl-formatting';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link } from '@/lib/workspace/navigation';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { IssuanceAssignmentProvider } from '@/components/document-registry/issuance-assignment-context';
import { ObligorDesignationProvider } from '@/components/document-registry/obligor-designation-context';
import { RegistryDocSheet } from '@/components/document-registry/RegistryDocSheet';
import { RegistryTabs } from '@/components/document-registry/RegistryTabs';
import { RegistryTally } from '@/components/document-registry/RegistryTally';
import {
  REGISTRY_KEYS,
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_NS,
  TRUNCATED_SOURCE_KEYS,
} from '@/components/document-registry/document-registry-labels';

// 🧩 ADR-744 §15 — PER-ROUTE SLICE. Εδώ (Client Component, εμβέλεια module, στατική εισαγωγή), ΟΧΙ στο `page.tsx`:
//    αλλιώς το πρώτο καρέ βάφει ωμά κλειδιά (CHECK 3.51). Ίδιο ιδίωμα με το `MandateCatalogContent`.
import routeSlice from '@/i18n/generated/routes/o__workspace__document-expiry.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

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

interface ReadyBodyProps {
  readonly registry: DocumentRegistryResponse;
  readonly revalidate: () => Promise<void>;
}

/**
 * ADR-915 §26 + §27 — ο ορισμός υπευθύνου και η ανάθεση έκδοσης: αισιόδοξο μητρώο (η μία προβολή πάνω στην άλλη) + οι
 * ενέργειες για όποια γραμμή τις ζητήσει. Ένα δικαίωμα και για τα δύο: αλλάζουν γεγονός του ακινήτου.
 */
function useDesignatedRegistry({ registry: loaded, revalidate }: ReadyBodyProps) {
  const canDesignate = isGranted(useCapability('properties:properties:update').verdict);
  const designation = useObligorDesignation(loaded, revalidate);
  const issuance = useIssuanceAssignment(designation.registry, revalidate);
  const { designate, pending } = designation;
  const actions = useMemo(() => ({ designate, pending, canDesignate }), [designate, pending, canDesignate]);
  const issuanceActions = useMemo(
    () => ({ act: issuance.act, pending: issuance.pending, canAct: canDesignate, revalidate }),
    [issuance.act, issuance.pending, canDesignate, revalidate],
  );
  return { registry: issuance.registry, actions, issuanceActions };
}

function ReadyBody(props: ReadyBodyProps): React.ReactElement {
  const { registry, actions, issuanceActions } = useDesignatedRegistry(props);
  // §35 — η απόφαση μόνιμης υποχρέωσης: ίδιο δικαίωμα (αλλάζει γεγονός του ακινήτου), ΟΧΙ αισιόδοξα.
  const upkeep = useUpkeepDeclaration(props.revalidate);
  const address = useRegistryAddress();
  const empty = registry.rows.length === 0 && registry.upkeep.length === 0;
  return (
    // Οι πάροχοι τυλίγουν ΚΑΙ το πάνελ: οι πράξεις της κάρτας (υπεύθυνος · ανάθεση) ζουν πλέον εκεί.
    <ObligorDesignationProvider value={actions}>
      <IssuanceAssignmentProvider value={issuanceActions}>
        <TruncatedNotice registry={registry} />
        <RegistryTally tally={registry.tally} view={address.tab === 'all' ? address.view : 'all'} onSelect={address.selectView} />
        {empty ? (
          <EmptyState />
        ) : (
          <RegistryTabs registry={registry} address={address} upkeep={upkeep} canDecide={actions.canDesignate} />
        )}
        <RegistryDocSheet registry={registry} doc={address.doc} onClose={address.closeDoc} />
      </IssuanceAssignmentProvider>
    </ObligorDesignationProvider>
  );
}

/** Τρεις καταστάσεις φόρτωσης, ρητά. Η αποτυχία δίνει **κουμπί**, όχι μόνο μήνυμα. */
function RegistryBody({ view, reload, revalidate }: Pick<DocumentRegistryApi, 'reload' | 'revalidate'> & { readonly view: DocumentRegistryState }): React.ReactElement {
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
  return <ReadyBody registry={view.registry} revalidate={revalidate} />;
}

export function DocumentRegistryContent(): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const { view, reload, revalidate } = useDocumentRegistry();
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
      <RegistryBody view={view} reload={reload} revalidate={revalidate} />
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
