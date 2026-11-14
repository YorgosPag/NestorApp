'use client';

/**
 * @fileoverview **Από πού ήρθε κάθε άδεια της επαφής** — «Καταχωρίστηκε από το γραφείο» / «Δηλωμένο από τον ίδιο», με
 * ημερομηνία, και ο δρόμος του ελέγχου στο μητρώο (ADR-915 §40.5).
 * @module components/contacts/ContactLicenceProvenanceList
 *
 * 🔑 Μόνο οι **αποθηκευμένες** άδειες: μια τιμή που μόλις πληκτρολογήθηκε δεν έχει ακόμη προέλευση.
 * 🏆 Πρακτική Salesforce/HubSpot «πηγή τιμής» + ο σύνδεσμος του δημόσιου μητρώου που οι μεγάλοι δεν δίνουν.
 */

import React from 'react';

import { RegistryLookupLink } from '@/components/mandate/RegistryLookupLink';
import { PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { ContactLicence } from '@/types/contacts/contact-licences';

import { CONTACT_LICENCE_KEYS, CONTACT_LICENCE_SOURCE_KEYS } from './contact-licence-labels';

const NAMESPACES = ['contacts-form', 'property-market'];

export function ContactLicenceProvenanceList({
  licences,
}: {
  readonly licences: readonly ContactLicence[] | undefined;
}): React.JSX.Element | null {
  const { t } = useTranslation(NAMESPACES);
  if (!licences || licences.length === 0) return null;
  return (
    <ul aria-label={t(CONTACT_LICENCE_KEYS.provenanceRegion)} className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs text-muted-foreground">
      {licences.map((held) => (
        <li key={held.licence} className="flex flex-wrap items-center gap-x-2">
          {t(CONTACT_LICENCE_KEYS.provenanceLine, {
            licence: t(PROFESSIONAL_LICENCE_SPECS[held.licence].nameKey),
            source: t(CONTACT_LICENCE_SOURCE_KEYS[held.provenance.source]),
            date: formatDate(held.provenance.recordedAt),
          })}
          <RegistryLookupLink licence={held.licence} />
        </li>
      ))}
    </ul>
  );
}
