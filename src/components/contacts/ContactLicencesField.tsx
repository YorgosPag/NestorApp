'use client';

/**
 * @fileoverview **Οι άδειες της επαφής στη φόρμα** — το πεδίο (φωνή γραφείου) και από κάτω η προέλευση κάθε
 * αποθηκευμένης τιμής (ADR-915 §40.5).
 * @module components/contacts/ContactLicencesField
 *
 * 🔑 Φορτώνεται **τεμπέλικα** (`ContactLinkSurfaces.ContactLicencesField`): το όνομα της άδειας και τα κείμενα του
 *    πεδίου ζουν στο `property-market`, που **δεν** ανήκει στο slice των σελίδων επαφών (CHECK 3.34 · ADR-744 §27.4).
 */

import React from 'react';

import { ShowcaseLicenceField } from '@/components/mandate/ShowcaseLicenceField';
import type { LicenceDrafts } from '@/lib/professional/licence-drafts';
import type { ContactLicence } from '@/types/contacts/contact-licences';

import { ContactLicenceProvenanceList } from './ContactLicenceProvenanceList';

export interface ContactLicencesFieldProps {
  readonly value: LicenceDrafts;
  readonly onChange: (next: LicenceDrafts) => void;
  /** Οι αποθηκευμένες άδειες — μόνο αυτές έχουν προέλευση. */
  readonly licences: readonly ContactLicence[] | undefined;
  readonly disabled: boolean;
}

export function ContactLicencesField({ value, onChange, licences, disabled }: ContactLicencesFieldProps): React.JSX.Element {
  return (
    <>
      <ShowcaseLicenceField voice="office" heldThrough={[]} disabled={disabled} value={value} onChange={onChange} />
      <ContactLicenceProvenanceList licences={licences} />
    </>
  );
}
