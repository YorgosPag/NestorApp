'use client';

/**
 * @fileoverview **Από πού ήρθε ΑΥΤΗ η άδεια της επαφής** — «Καταχωρίστηκε από το γραφείο» / «Δηλωμένο από τον ίδιο», με
 * ημερομηνία, και ο δρόμος του ελέγχου στο μητρώο (ADR-915 §40.5).
 * @module components/contacts/ContactLicenceProvenanceNote
 *
 * 🔑 **Μέσα στο μπλοκ της άδειας**, κάτω από τον αριθμό της (υποδοχή `renderBelowLicence` του `ShowcaseLicenceField`) —
 *    ποτέ σε χωριστή λίστα στο τέλος: εκεί κάθισε κάτω από τη γειτονική, αξετσεκάριστη άδεια και έμοιαζε δική της
 *    (εύρημα ζωντανής δοκιμής 2026-11-14). Πρακτική Google Contacts / Figma: η πληροφορία ζει δίπλα στην τιμή που αφορά.
 * 🔑 Το όνομα της άδειας **δεν** επαναλαμβάνεται — το λέει ήδη το checkbox από πάνω.
 * 🔑 Μόνο **αποθηκευμένη** τιμή έχει προέλευση: ο καλών περνά ό,τι επιστρέφει το `storedLicenceShownBy`.
 * 🏆 Πρακτική Salesforce/HubSpot «πηγή τιμής» + ο σύνδεσμος του δημόσιου μητρώου που οι μεγάλοι δεν δίνουν.
 */

import React from 'react';

import { RegistryLookupLink } from '@/components/mandate/RegistryLookupLink';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { ContactLicence } from '@/types/contacts/contact-licences';

import { CONTACT_LICENCE_KEYS, CONTACT_LICENCE_SOURCE_KEYS } from './contact-licence-labels';

const NAMESPACES = ['contacts-form', 'property-market'];

export function ContactLicenceProvenanceNote({ held }: { readonly held: ContactLicence }): React.JSX.Element {
  const { t } = useTranslation(NAMESPACES);
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      {t(CONTACT_LICENCE_KEYS.provenanceLine, {
        source: t(CONTACT_LICENCE_SOURCE_KEYS[held.provenance.source]),
        date: formatDate(held.provenance.recordedAt),
      })}
      <RegistryLookupLink licence={held.licence} />
    </p>
  );
}
