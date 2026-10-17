'use client';

/**
 * @fileoverview **Οι άνθρωποι του «Το φέρνει»** (ADR-915 §25 · §26): σύνδεσμος στην επαφή, λίστα με «+N ακόμη», και — με
 *   πολλούς ιδιοκτήτες σε έγγραφο ακινήτου — ο ΕΝΑΣ υπεύθυνος πρώτος, με τον **λόγο**, και οι συνιδιοκτήτες.
 * @related registry-obligors.ts (η κρίση) · RegistryIssuerValue.tsx (το ζεύγος `<dt>/<dd>`) · RegistryObligorLeadPicker.tsx
 * @module components/document-registry/RegistryObligorPeople
 *
 * 🔑 Τα ονόματα σε `<ul>` (όχι συρραφή με κόμμα): κάθε ένα σύνδεσμος, και καμία στίξη να μεταφραστεί.
 * 🔑 §26 — ο ρόλος «υπεύθυνος» είναι **λέξη**, όχι μόνο έμφαση: χωρίς χρώμα ή βάρος γραμματοσειράς ο αναγνώστης οθόνης
 *    και ο άνθρωπος βλέπουν το ίδιο.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatPercentage } from '@/lib/intl-formatting';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link } from '@/lib/workspace/navigation';
import type { RegistryObligorLead, RegistryObligorPerson, RegistryObligors } from '@/components/document-registry/registry-obligors';
import { RegistryObligorLeadPicker } from '@/components/document-registry/RegistryObligorLeadPicker';
import {
  ISSUER_KEYS,
  LEAD_BASIS_KEYS,
  LEAD_KEYS,
  LEAD_UNDESIGNATED_KEYS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';

type PeopleObligors = Extract<RegistryObligors, { kind: 'people' }>;

const LINK = 'underline underline-offset-4';

export function ObligorPerson({ person }: { readonly person: RegistryObligorPerson }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  if (!person.reachable) return <span className="text-muted-foreground">{t(ISSUER_KEYS.obligorUnavailable)}</span>;
  return (
    <Link href={ENTITY_ROUTES.contacts.withId(person.contactId)} className={`text-foreground ${LINK}`}>
      {person.name ?? t(ISSUER_KEYS.obligorUnnamed)}
    </Link>
  );
}

/** Οι ονομαζόμενοι + «+N ακόμη». Κενή λίστα ⇒ τίποτα. */
export function ObligorList({ obligors, label }: { readonly obligors: PeopleObligors; readonly label: string }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  if (obligors.shown.length === 0) return null;
  return (
    <ul aria-label={label} className="m-0 inline-flex list-none flex-wrap gap-x-3 p-0">
      {obligors.shown.map((person) => <li key={person.contactId}><ObligorPerson person={person} /></li>)}
      {obligors.more > 0 ? <li className="text-muted-foreground">{t(ISSUER_KEYS.obligorMore, { count: obligors.more })}</li> : null}
    </ul>
  );
}

/** «Α · υπεύθυνος — πλειοψηφία μεριδίων (60 %)» ή «Δεν έχει οριστεί υπεύθυνος — …». */
function LeadLine({ lead }: { readonly lead: RegistryObligorLead }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  if (lead.kind === 'undesignated') return <span className="text-foreground">{t(LEAD_UNDESIGNATED_KEYS[lead.reason])}</span>;
  const share = lead.sharePct === null ? '' : formatPercentage(lead.sharePct);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <ObligorPerson person={lead.person} />
      <span className="text-muted-foreground">{t(LEAD_KEYS.role, { basis: t(LEAD_BASIS_KEYS[lead.basis], { share }) })}</span>
    </span>
  );
}

/** §26 — πολλοί ιδιοκτήτες σε έγγραφο ακινήτου: υπεύθυνος · συνιδιοκτήτες · «ένα έγγραφο» · παλιά επιλογή · κουμπί. */
function CoOwnedObligors({ obligors, lead }: { readonly obligors: PeopleObligors; readonly lead: RegistryObligorLead }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const coOwners = t(LEAD_KEYS.coOwners);
  return (
    <span className="flex w-full flex-col gap-1">
      <LeadLine lead={lead} />
      {obligors.shown.length > 0 ? (
        <span className="inline-flex flex-wrap items-baseline gap-x-2">
          <span className="text-muted-foreground">{t(LEAD_KEYS.coOwnersHeading)}</span>
          <ObligorList obligors={obligors} label={coOwners} />
        </span>
      ) : null}
      {lead.stale !== null ? (
        <span className="text-xs text-muted-foreground">{t(LEAD_KEYS.stale, { name: lead.stale.name ?? t(ISSUER_KEYS.obligorUnnamed) })}</span>
      ) : null}
      <span className="text-xs text-muted-foreground">
        {t(lead.kind === 'designated' ? LEAD_KEYS.onePerProperty : LEAD_KEYS.onePerPropertyUndesignated)}
      </span>
      {obligors.choice !== null ? <RegistryObligorLeadPicker choice={obligors.choice} hasLead={lead.kind === 'designated'} /> : null}
    </span>
  );
}

/** ADR-915 §25 — **ποιος**, δίπλα στον ρόλο: σύνδεσμος στην επαφή · «+N ακόμη» · «δεν έχει οριστεί» · ή τίποτα (άγνωστο). */
export function ObligorPeople({ obligors }: { readonly obligors: RegistryObligors }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  if (obligors.kind === 'unknown') return null;
  if (obligors.kind === 'none') return <span className="text-muted-foreground">{t(ISSUER_KEYS.obligorNone)}</span>;
  if (obligors.lead !== null) return <CoOwnedObligors obligors={obligors} lead={obligors.lead} />;
  return <ObligorList obligors={obligors} label={t(ISSUER_KEYS.obligorPeople)} />;
}
