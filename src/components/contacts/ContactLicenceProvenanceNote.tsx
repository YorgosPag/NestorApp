'use client';

/**
 * @fileoverview **Από πού ήρθε ΚΑΘΕ ΠΕΔΙΟ αυτής της άδειας της επαφής** — «Καταχωρίστηκε από το γραφείο» / «Δηλωμένο από
 * τον ίδιο», με ημερομηνία, και ο δρόμος του ελέγχου στο μητρώο (ADR-915 §40.5).
 * @module components/contacts/ContactLicenceProvenanceNote
 *
 * 🔑 **Μέσα στο μπλοκ της άδειας**, κάτω από τον αριθμό της (υποδοχή `renderBelowLicence` του `ShowcaseLicenceField`) —
 *    ποτέ σε χωριστή λίστα στο τέλος: εκεί κάθισε κάτω από τη γειτονική, αξετσεκάριστη άδεια και έμοιαζε δική της
 *    (εύρημα ζωντανής δοκιμής 2026-11-14). Πρακτική Google Contacts / Figma: η πληροφορία ζει δίπλα στην τιμή που αφορά.
 * 🔑 **Ανά πεδίο** (εγγραφή · τάξεις — πρακτική HubSpot property history): όταν τα δύο πεδία έχουν **την ίδια**
 *    προέλευση, μία γραμμή όπως πριν· όταν διαφέρουν, μία γραμμή ανά πεδίο με το όνομά του. Ο άνθρωπος βλέπει ότι ο
 *    αριθμός είναι «Δηλωμένο από τον ίδιο» ενώ τις τάξεις τις καταχώρισε το γραφείο — ποτέ το ένα να σβήνει το άλλο.
 * 🔑 Το όνομα της άδειας **δεν** επαναλαμβάνεται — το λέει ήδη το checkbox από πάνω.
 * 🔑 Μόνο **αποθηκευμένο** πεδίο έχει προέλευση: ο καλών περνά ό,τι επιστρέφει το `storedLicenceProvenanceShownBy`.
 * 🏆 Πρακτική Salesforce/HubSpot «πηγή τιμής» + ο σύνδεσμος του δημόσιου μητρώου που οι μεγάλοι δεν δίνουν.
 */

import React from 'react';

import { RegistryLookupLink } from '@/components/mandate/RegistryLookupLink';
import type { ProfessionalLicence } from '@/config/professional-licences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { ContactLicenceFieldProvenance, ContactLicenceProvenance } from '@/types/contacts/contact-licences';

import { CONTACT_LICENCE_KEYS, CONTACT_LICENCE_SOURCE_KEYS } from './contact-licence-labels';

const NAMESPACES = ['contacts-form', 'property-market'];

/** Ίδια προέλευση = ίδια πράξη: ίδια πηγή, ίδια ώρα, ίδια συμμετοχή. */
function sameProvenance(a: ContactLicenceProvenance, b: ContactLicenceProvenance): boolean {
  return a.source === b.source && a.recordedAt === b.recordedAt && a.engagementId === b.engagementId;
}

interface ProvenanceLine {
  readonly key: string;
  readonly provenance: ContactLicenceProvenance;
}

/** Οι γραμμές που δείχνονται: μία όταν τα πεδία μοιράζονται προέλευση, αλλιώς μία ανά αποθηκευμένο πεδίο. */
function linesOf({ registration, grades }: ContactLicenceFieldProvenance): readonly ProvenanceLine[] {
  if (registration !== null && (grades === null || sameProvenance(registration, grades))) {
    return [{ key: CONTACT_LICENCE_KEYS.provenanceLine, provenance: registration }];
  }
  const lines: ProvenanceLine[] = [];
  if (registration !== null) lines.push({ key: CONTACT_LICENCE_KEYS.provenanceRegistrationLine, provenance: registration });
  if (grades !== null) lines.push({ key: CONTACT_LICENCE_KEYS.provenanceGradesLine, provenance: grades });
  return lines;
}

export interface ContactLicenceProvenanceNoteProps {
  readonly licence: ProfessionalLicence;
  readonly provenance: ContactLicenceFieldProvenance;
}

export function ContactLicenceProvenanceNote({ licence, provenance }: ContactLicenceProvenanceNoteProps): React.JSX.Element | null {
  const { t } = useTranslation(NAMESPACES);
  const lines = linesOf(provenance);
  if (lines.length === 0) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      {lines.map((line) => (
        <span key={line.key}>
          {t(line.key, {
            source: t(CONTACT_LICENCE_SOURCE_KEYS[line.provenance.source]),
            date: formatDate(line.provenance.recordedAt),
          })}
        </span>
      ))}
      {provenance.registration !== null && <RegistryLookupLink licence={licence} />}
    </p>
  );
}
