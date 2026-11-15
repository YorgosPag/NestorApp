'use client';

/**
 * @fileoverview ADR-915 §43 — **οι σύνδεσμοι του μητρώου**: πού οδηγεί το ακίνητο μιας γραμμής και πού η διαδικασία που
 *   χρειάζεται το έγγραφο. ΕΝΑΣ κανόνας για κάρτα (πλαϊνό πάνελ) και πίνακα.
 * @related RegistryPropertyValue.tsx · RegistryDependents.tsx · RegistryRowCells.tsx · RegistryTable.tsx
 * @module components/document-registry/registry-links
 *
 * 🔑 **Τη διεύθυνση του ακινήτου την αποφασίζει το `scope` του διακομιστή**, ποτέ το πρόθεμα της ταυτότητας: ακίνητο
 *    εταιρείας ⇒ η σελίδα του · ακίνητο ιδιώτη υπό εντολή ⇒ η σελίδα της εντολής (`mandateDetailHref`).
 * 🔑 **Η μεταβίβαση και η μόνιμη υποχρέωση ζουν στο ακίνητο** (η υπόθεση δεν έχει δική της διεύθυνση) — άρα περνούν από
 *    τον ΙΔΙΟ κανόνα ακινήτου· η αγγελία έχει δική της σελίδα. Πριν από την §43 η κάρτα έστελνε **πάντα** στη σελίδα
 *    ακινήτου εταιρείας — για ακίνητο ιδιώτη ήταν σύνδεσμος σε «δεν υπάρχει».
 * ⚠️ Κάθε κλάδος καλεί το `Link` **χωριστά** (όχι τερνάριο στο `href`): οι τύποι διευθύνσεων φαρδαίνουν σε τερνάρια
 *    (`listing-routes.ts`). Εσωτερικός σύνδεσμος ⇒ **μόνο** από το σύνορο πλοήγησης (CHECK 3.61).
 */

import React from 'react';

import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { mandateDetailHref } from '@/lib/mandate/mandate-routes';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link } from '@/lib/workspace/navigation';
import type { DocumentRequirement, RequirementProcessRef } from '@/lib/document-validity/document-requirement';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { RegistryObligorPerson } from '@/components/document-registry/registry-obligors';
import { ISSUER_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';

type Names = Pick<DocumentRegistryResponse, 'properties'>;

/** WCAG 2.5.8: όνομα σε δύο γραμμές + δεύτερος σύνδεσμος από κάτω = στόχοι που εφάπτονται (μετρημένο 390 px, §37.6). */
export const REGISTRY_LINK_CLASS = `${TOUCH_TARGET_MIN} underline underline-offset-4`;

interface LinkLookProps {
  readonly className?: string;
  readonly children: React.ReactNode;
}

/**
 * Σταθερή ταυτότητα μιας διαδικασίας (`kind:id`) — κλειδί λίστας για κάρτα και πίνακα. Εξαντλητικά: νέα διαδικασία δεν
 * μεταγλωττίζεται χωρίς απάντηση.
 */
export function registryProcessKeyOf(process: RequirementProcessRef): string {
  switch (process.kind) {
    case 'conveyance': return `${process.kind}:${process.caseId}`;
    case 'listing-publication': return `${process.kind}:${process.listingId}`;
    case 'property-upkeep': return `${process.kind}:${process.propertyId}`;
  }
}

export interface RegistryPropertyLinkProps extends LinkLookProps {
  readonly propertyId: string;
  readonly names: Names;
}

/** Σύνδεσμος προς το ακίνητο της γραμμής — εταιρείας ή ιδιώτη υπό εντολή. */
export function RegistryPropertyLink({ propertyId, names, className, children }: RegistryPropertyLinkProps): React.ReactElement {
  if (names.properties[propertyId]?.scope === 'owner-property') {
    return <Link href={mandateDetailHref(propertyId)} className={className}>{children}</Link>;
  }
  return <Link href={ENTITY_ROUTES.properties.withId(propertyId)} className={className}>{children}</Link>;
}

/**
 * Μία επαφή του μητρώου ως σύνδεσμος προς την καρτέλα της — ξένη ή διαγραμμένη ⇒ κείμενο, ποτέ σύνδεσμος σε «δεν υπάρχει».
 * Ζει εδώ (όχι στο `RegistryObligorPeople`) ώστε ο **πίνακας** (§45 Φ1) να μη σέρνει τον επιλογέα υπευθύνου (CHECK 3.34).
 */
export function ObligorPerson({ person }: { readonly person: RegistryObligorPerson }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  if (!person.reachable) return <span className="text-muted-foreground">{t(ISSUER_KEYS.obligorUnavailable)}</span>;
  return (
    <Link href={ENTITY_ROUTES.contacts.withId(person.contactId)} className="text-foreground underline underline-offset-4">
      {person.name ?? t(ISSUER_KEYS.obligorUnnamed)}
    </Link>
  );
}

export interface RegistryProcessLinkProps extends LinkLookProps {
  readonly requirement: Pick<DocumentRequirement, 'process' | 'subject'>;
  readonly names: Names;
}

/** Σύνδεσμος προς τη διαδικασία που χρειάζεται το έγγραφο: αγγελία ⇒ η σελίδα της · αλλιώς ⇒ το ακίνητο. */
export function RegistryProcessLink({ requirement, names, className, children }: RegistryProcessLinkProps): React.ReactElement {
  const { process, subject } = requirement;
  if (process.kind === 'listing-publication') {
    return <Link href={listingDetailHref(process.listingId)} className={className}>{children}</Link>;
  }
  return <RegistryPropertyLink propertyId={subject.propertyId} names={names} className={className}>{children}</RegistryPropertyLink>;
}
