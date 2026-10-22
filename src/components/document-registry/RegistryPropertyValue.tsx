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

import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { mandateDetailHref } from '@/lib/mandate/mandate-routes';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link } from '@/lib/workspace/navigation';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
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

// WCAG 2.5.8: όνομα σε δύο γραμμές + «Έγγραφα ακινήτου» από κάτω = στόχοι που εφάπτονται (μετρημένο 390 px, §37.6).
const LINK = `${TOUCH_TARGET_MIN} underline underline-offset-4`;

/** Το `<dd>` της ετικέτας «Ακίνητο»: όνομα με σύνδεσμο + ο δρόμος προς τα έγγραφά του. */
export function RegistryPropertyValue({ propertyId, names }: RegistryPropertyValueProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  if (propertyId === null) return <dd className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.propertyNone)}</dd>;
  const label = names.properties[propertyId];
  const name = label?.name ?? t(REGISTRY_KEYS.propertyUnnamed);
  if (label?.scope === 'owner-property') {
    // Τα έγγραφα της εντολής ζουν στη σελίδα της — ένας σύνδεσμος, όχι δύο προς τον ίδιο προορισμό.
    return (
      <dd className="m-0 text-sm">
        <Link href={mandateDetailHref(propertyId)} className={`text-foreground ${LINK}`}>{name}</Link>
      </dd>
    );
  }
  return (
    <dd className="m-0 flex flex-wrap gap-x-3 text-sm">
      <Link href={ENTITY_ROUTES.properties.withId(propertyId)} className={`text-foreground ${LINK}`}>{name}</Link>
      <Link href={ENTITY_ROUTES.properties.withTab(propertyId, 'documents')} className={`text-muted-foreground ${LINK}`}>
        {t(REGISTRY_KEYS.openDocuments)}
      </Link>
    </dd>
  );
}
