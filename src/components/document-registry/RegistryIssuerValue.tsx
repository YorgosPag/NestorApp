'use client';

/**
 * @fileoverview **«Εκδίδει · Το φέρνει»** — δύο ζεύγη `<dt>/<dd>` μιας γραμμής του μητρώου (ADR-915 §18).
 * @related config/document-validity/document-issuers.ts (το λεξιλόγιο) · RegistryRowItem.tsx · RegistryGapItem.tsx
 * @module components/document-registry/RegistryIssuerValue
 *
 * 🔑 **Μία πηγή για δύο γραμμές**: το έγγραφο που υπάρχει και το έγγραφο που λείπει ρωτούν την ίδια απάντηση του
 *    καταλόγου — ένα component, όχι δίδυμα.
 * 🔑 **Προσόν, όχι επάγγελμα**: το ΠΕΑ λέει «Ενεργειακός επιθεωρητής, εγγεγραμμένος στο Μητρώο…», όχι «Μηχανικός».
 * 🔑 Τα προσόντα ενώνονται με `formatList(…, 'disjunction')` («Α, Β ή Γ»): αρκεί **ένας** από αυτούς.
 * 🔑 ADR-915 §25 — **ο ρόλος ΚΑΙ ο άνθρωπος**: «Ο ιδιοκτήτης» λέει τον κανόνα του είδους, το όνομα ποιος είναι σε αυτό
 *    το ακίνητο. Κανένα από τα δύο δεν αντικαθιστά το άλλο. Οι άνθρωποι (και, με πολλούς ιδιοκτήτες, ο **υπεύθυνος** —
 *    §26) ζουν στο `RegistryObligorPeople.tsx`.
 */

import React from 'react';

import { issuerAuthorityOf, type DocumentIssuer } from '@/config/document-validity/document-issuers';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatList } from '@/lib/intl-formatting';
import type { RegistryObligors } from '@/components/document-registry/registry-obligors';
import { ObligorPeople } from '@/components/document-registry/RegistryObligorPeople';
import {
  APPOINTED_BY_LABEL_KEYS,
  ISSUER_AUTHORITY_LABEL_KEYS,
  ISSUER_KEYS,
  OBLIGOR_LABEL_KEYS,
  PROPERTY_MARKET_NS,
  qualificationText,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';


function IssuerValue({ issuer }: { readonly issuer: DocumentIssuer }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, PROPERTY_MARKET_NS]);
  if (issuer.kind === 'authority') {
    return (
      <dd className="m-0 text-sm text-foreground">
        {t(ISSUER_KEYS.selfService, { authority: t(ISSUER_AUTHORITY_LABEL_KEYS[issuerAuthorityOf(issuer)]) })}
      </dd>
    );
  }
  return (
    <dd className="m-0 flex flex-col gap-0.5 text-sm text-foreground">
      <span>{formatList(issuer.qualifications.map((q) => qualificationText(t, q)), 'disjunction')}</span>
      <span className="text-xs text-muted-foreground">{t(APPOINTED_BY_LABEL_KEYS[issuer.appointedBy])}</span>
    </dd>
  );
}

export interface RegistryIssuerValueProps {
  readonly kind: DocumentKind;
  /** Ποιος φέρνει το έγγραφο, συγκεκριμένα (`registryObligorsOf`). */
  readonly obligors: RegistryObligors;
}

export function RegistryIssuerValue({ kind, obligors }: RegistryIssuerValueProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const { issuer, obligor } = documentKindSpec(kind);
  return (
    <>
      <dt className="text-sm text-muted-foreground">{t(ISSUER_KEYS.heading)}</dt>
      <IssuerValue issuer={issuer} />
      <dt className="text-sm text-muted-foreground">{t(ISSUER_KEYS.obligorHeading)}</dt>
      <dd className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-foreground">
        <span>{t(OBLIGOR_LABEL_KEYS[obligor])}</span>
        <ObligorPeople obligors={obligors} />
      </dd>
    </>
  );
}
