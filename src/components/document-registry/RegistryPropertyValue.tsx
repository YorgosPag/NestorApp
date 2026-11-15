'use client';

/**
 * @fileoverview **Το ακίνητο μιας γραμμής του μητρώου** — ακίνητο εταιρείας ή ακίνητο ιδιώτη υπό εντολή (ADR-915 Φ4δ Ε10).
 * @related RegistryRowItem.tsx · RegistryGapItem.tsx · services/document-registry/document-registry.types.ts (`scope`)
 * @module components/document-registry/RegistryPropertyValue
 *
 * 🔑 **Η διεύθυνση την αποφασίζει το είδος (`scope`) που έστειλε ο διακομιστής**, ποτέ το πρόθεμα της ταυτότητας: το
 *    ακίνητο εταιρείας ανοίγει στη σελίδα του (+ «Έγγραφα»), η εντολή στη δική της (`mandateDetailHref`, όπου ζουν και
 *    τα έγγραφά της). Ένα σημείο — έγγραφο και κενό δείχνουν το ακίνητο και τον δρόμο προς τα έγγραφά του με τον ΙΔΙΟ
 *    τρόπο, **μία** φορά ανά γραμμή.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link } from '@/lib/workspace/navigation';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { REGISTRY_LINK_CLASS, RegistryPropertyLink } from '@/components/document-registry/registry-links';
import {
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_KEYS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';

interface RegistryPropertyValueProps {
  readonly propertyId: string | null;
  readonly names: Pick<DocumentRegistryResponse, 'properties'>;
}

type Translate = ReturnType<typeof useTranslation>['t'];

/** Το όνομα του ακινήτου — ΕΝΑΣ κανόνας για κάρτα, πίνακα και ομάδα (ADR-915 §41.5). `null` = γραμμή χωρίς ακίνητο. */
export function registryPropertyNameOf(
  t: Translate,
  propertyId: string | null,
  names: Pick<DocumentRegistryResponse, 'properties'>,
): string | null {
  if (propertyId === null) return null;
  return names.properties[propertyId]?.name ?? t(REGISTRY_KEYS.propertyUnnamed);
}

/** Το `<dd>` της ετικέτας «Ακίνητο»: όνομα με σύνδεσμο + ο δρόμος προς τα έγγραφά του. */
export function RegistryPropertyValue({ propertyId, names }: RegistryPropertyValueProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  if (propertyId === null) return <dd className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.propertyNone)}</dd>;
  const name = registryPropertyNameOf(t, propertyId, names);
  const nameLink = (
    <RegistryPropertyLink propertyId={propertyId} names={names} className={`text-foreground ${REGISTRY_LINK_CLASS}`}>{name}</RegistryPropertyLink>
  );
  // Τα έγγραφα της εντολής ζουν στη σελίδα της — ένας σύνδεσμος, όχι δύο προς τον ίδιο προορισμό.
  if (names.properties[propertyId]?.scope === 'owner-property') return <dd className="m-0 text-sm">{nameLink}</dd>;
  return (
    <dd className="m-0 flex flex-wrap gap-x-3 text-sm">
      {nameLink}
      <Link href={ENTITY_ROUTES.properties.withTab(propertyId, 'documents')} className={`text-muted-foreground ${REGISTRY_LINK_CLASS}`}>
        {t(REGISTRY_KEYS.openDocuments)}
      </Link>
    </dd>
  );
}
