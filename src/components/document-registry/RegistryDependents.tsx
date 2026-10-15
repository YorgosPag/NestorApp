'use client';

/**
 * @fileoverview **«Τι σταματά αν λήξει»** — η στήλη που κανένας από τους μεγάλους δεν έχει (ADR-915 §2 · §11).
 * @related lib/document-validity/document-requirement.ts (`dependentsOf`) · document-registry-labels.ts
 * @module components/document-registry/RegistryDependents
 *
 * Το Procore λέει «non-compliant»· δεν λέει **ποια** πληρωμή σταματά και **πότε**. Εδώ κάθε διαδικασία που χρειάζεται
 * το έγγραφο ονομάζεται, με τη μέρα που θα βρεθεί χωρίς έγκυρο έγγραφο (`stopsOn`) και το αν **μπλοκάρει** (`block`,
 * μεταβίβαση) ή απλώς **προειδοποιεί** (`warn`, αγγελία — Α1: μένει δημοσιευμένη).
 *
 * 🔑 **Κανένας υπολογισμός**: `impact` · `stopsOn` · `blocking` ήρθαν έτοιμα από τον διακομιστή.
 * ⚠️ **Η υπόθεση του οικοδεσπότη δεν έχει δική της διεύθυνση** (ζει στην καρτέλα «Μεταβίβαση» της στήλης πωλήσεων):
 *    ο σύνδεσμος οδηγεί στο **ακίνητο**, και η γραμμή λέει ρητά την ημερομηνία υπογραφής. Μαντεμένη διεύθυνση θα
 *    έστελνε τον άνθρωπο σε «δεν υπάρχει».
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateKey } from '@/lib/intl-formatting';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link } from '@/lib/workspace/navigation';
import { isBlockingDependent, type RegistryRowState } from '@/lib/document-validity/document-registry';
import type { DocumentDependent, NeededOn } from '@/lib/document-validity/document-requirement';
import {
  IMPACT_LABEL_KEYS,
  POLICY_LABEL_KEYS,
  PROCESS_LABEL_KEYS,
  REGISTRY_KEYS,
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Πότε τη χρειάζεται η διαδικασία — με λέξεις. */
function neededOnText(t: Translate, neededOn: NeededOn): string {
  switch (neededOn.kind) {
    case 'on': return t(REGISTRY_KEYS.signingOn, { date: formatDateKey(neededOn.day) });
    case 'continuous': return t(REGISTRY_KEYS.continuous);
    case 'unscheduled': return t(REGISTRY_KEYS.unscheduled);
  }
}

function impactText(t: Translate, dependent: DocumentDependent): string {
  return dependent.impact === 'stops' && dependent.stopsOn !== null
    ? t(IMPACT_LABEL_KEYS.stops, { date: formatDateKey(dependent.stopsOn) })
    : t(IMPACT_LABEL_KEYS[dependent.impact]);
}

/** Ο σύνδεσμος της διαδικασίας — **μόνο** από τα μητρώα διαδρομών, μέσα από το σύνορο πλοήγησης (CHECK 3.61). */
function ProcessLink({ dependent }: { readonly dependent: DocumentDependent }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const { process, subject } = dependent.requirement;
  const href = process.kind === 'listing-publication'
    ? listingDetailHref(process.listingId)
    : ENTITY_ROUTES.properties.withId(subject.propertyId);
  const label = process.kind === 'listing-publication' ? REGISTRY_KEYS.openListing : REGISTRY_KEYS.openProperty;
  return <Link href={href} className="text-sm underline underline-offset-4">{t(label)}</Link>;
}

interface DependentProps {
  readonly dependent: DocumentDependent;
  /** Η κατάσταση της γραμμής — ο πυρήνας κρίνει με αυτήν αν η διαδικασία μπλοκάρει **ήδη**. */
  readonly state: RegistryRowState;
}

function DependentItem({ dependent, state }: DependentProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const { process, neededOn, policy } = dependent.requirement;
  return (
    <li className="flex flex-col gap-1">
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-foreground">
        <strong className="font-medium">{t(PROCESS_LABEL_KEYS[process.kind])}</strong>
        <span className="text-muted-foreground">{neededOnText(t, neededOn)}</span>
        <Badge variant="muted">{t(POLICY_LABEL_KEYS[policy])}</Badge>
        {/* 🔑 «Υποχρεωτικό» ≠ «μπλοκάρει τώρα»: ΠΕΑ ως το 2036 δεν μπλοκάρει σήμερα. Κρίνει ο ΠΥΡΗΝΑΣ (`isBlockingDependent`). */}
        {isBlockingDependent(dependent, state) ? <Badge variant="error">{t(REGISTRY_KEYS.blockingNow)}</Badge> : null}
      </p>
      <p className="m-0 text-sm text-muted-foreground">{impactText(t, dependent)}</p>
      <ProcessLink dependent={dependent} state={state} />
    </li>
  );
}

export function RegistryDependents({
  dependents,
  state,
}: {
  readonly dependents: readonly DocumentDependent[];
  readonly state: RegistryRowState;
}): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <section className="flex flex-col gap-2">
      <h4 className="m-0 text-sm font-semibold text-foreground">{t(REGISTRY_KEYS.dependentsHeading)}</h4>
      {dependents.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.dependentsNone)}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {dependents.map((dependent) => (
            <DependentItem key={`${dependent.requirement.process.kind}:${processIdOf(dependent)}`} dependent={dependent} state={state} />
          ))}
        </ul>
      )}
    </section>
  );
}

const processIdOf = (dependent: DocumentDependent): string => {
  const { process } = dependent.requirement;
  return process.kind === 'conveyance' ? process.caseId : process.listingId;
};
