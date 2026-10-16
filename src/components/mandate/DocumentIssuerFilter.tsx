'use client';

/**
 * @fileoverview **«Μπορούν να εκδώσουν: {έγγραφο}»** — το φίλτρο `?occupation=document:<είδος>` του `/pro` (ADR-915 §21).
 * @related lib/agency/occupation-query.ts (ο κριτής) · config/document-validity/document-issuers.ts (τα προσόντα) ·
 *   components/ui/filter-chip.tsx · AgencyDirectoryFilters.tsx
 * @module components/mandate/DocumentIssuerFilter
 *
 * 🏆 **Πέρα από Zillow/Houzz**: ο επισκέπτης ψάχνει με αυτό που **χρειάζεται** (ΠΕΑ), όχι με ένα επάγγελμα που ίσως δεν
 *    ξέρει. Και η οθόνη λέει **το κριτήριο** με το οποίο φιλτράρει — αλλιώς «Μπορούν να εκδώσουν» θα διαβαζόταν ως
 *    εγγύηση που η πλατφόρμα δεν δίνει (Angi: πρόστιμο για «Certified» χωρίς άδεια, Vermont 2025).
 * 🔑 Όταν το φίλτρο είναι έγγραφο, **αντικαθιστά** τα τσιπ/dropdown ειδικότητας: είναι η ίδια τιμή (`occupation`), και
 *    ένα dropdown με τιμή εκτός λίστας θα έδειχνε «Όλες οι ειδικότητες» — ψέμα για το τι φιλτράρεται.
 */

import React from 'react';

import { FilterChip } from '@/components/ui/filter-chip';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  ISSUER_QUALIFICATION_LABEL_KEYS,
  LEGALITY_NS,
  LICENCE_REGISTRY_LABEL_KEYS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';
import {
  ISSUER_QUALIFICATION_SPECS,
  type IssuerQualification,
} from '@/config/document-validity/document-issuers';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatList } from '@/lib/intl-formatting';

import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';

/** Τα προσόντα που ο κατάλογος **μπορεί** να βρει — τίτλος χωρίς ισοδύναμο ESCO δεν λέγεται ως κριτήριο που δεν τηρείται. */
function searchableQualifications(kind: DocumentKind): readonly IssuerQualification[] {
  const { issuer } = documentKindSpec(kind);
  if (issuer.kind !== 'professional') return [];
  return issuer.qualifications.filter((q) => {
    const spec = ISSUER_QUALIFICATION_SPECS[q];
    return spec.kind === 'licence' || spec.escoUris.length > 0;
  });
}

export interface DocumentIssuerFilterProps {
  readonly documentKind: DocumentKind;
  readonly onClear: () => void;
}

export function DocumentIssuerFilter({ documentKind, onClear }: DocumentIssuerFilterProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS, REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const label = t(DIRECTORY_KEYS.issuerChip, { document: t(DOCUMENT_KIND_LABEL_KEYS[documentKind]) });
  const qualifications = searchableQualifications(documentKind);
  const licences = qualifications.flatMap((q) => {
    const spec = ISSUER_QUALIFICATION_SPECS[q];
    return spec.kind === 'licence' ? [spec.licence] : [];
  });

  return (
    <section className="flex basis-full flex-col gap-2">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        <li>
          <FilterChip label={label} removeLabel={t(DIRECTORY_KEYS.whereChipRemove, { filter: label })} onRemove={onClear} />
        </li>
      </ul>
      <p className="m-0 text-sm text-muted-foreground">
        {qualifications.length === 0
          ? t(DIRECTORY_KEYS.issuerCriterionAuthority)
          : licences.length > 0
            ? t(DIRECTORY_KEYS.issuerCriterionLicence, {
                registry: formatList(licences.map((licence) => t(LICENCE_REGISTRY_LABEL_KEYS[licence]))),
              })
            : t(DIRECTORY_KEYS.issuerCriterionOccupation, {
                qualifications: formatList(qualifications.map((q) => t(ISSUER_QUALIFICATION_LABEL_KEYS[q])), 'disjunction'),
              })}
      </p>
    </section>
  );
}
