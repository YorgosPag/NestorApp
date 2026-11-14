'use client';

/**
 * @fileoverview **Οι άδειες της επαφής στη φόρμα** — το πεδίο (φωνή γραφείου), με την προέλευση κάθε αποθηκευμένης
 * τιμής **μέσα** στο μπλοκ της άδειας που αφορά (ADR-915 §40.5).
 * @module components/contacts/ContactLicencesField
 *
 * 🔑 Φορτώνεται **τεμπέλικα** (`ContactLinkSurfaces.ContactLicencesField`): το όνομα της άδειας και τα κείμενα του
 *    πεδίου ζουν στο `property-market`, που **δεν** ανήκει στο slice των σελίδων επαφών (CHECK 3.34 · ADR-744 §27.4).
 */

import React from 'react';

import { ShowcaseLicenceField } from '@/components/mandate/ShowcaseLicenceField';
import { storedLicenceShownBy } from '@/lib/contacts/contact-licences';
import type { LicenceDrafts } from '@/lib/professional/licence-drafts';
import type { ContactLicence } from '@/types/contacts/contact-licences';

import { ContactLicenceProvenanceNote } from './ContactLicenceProvenanceNote';

export interface ContactLicencesFieldProps {
  readonly value: LicenceDrafts;
  readonly onChange: (next: LicenceDrafts) => void;
  /** Οι αποθηκευμένες άδειες — μόνο αυτές έχουν προέλευση. */
  readonly licences: readonly ContactLicence[] | undefined;
  readonly disabled: boolean;
}

export function ContactLicencesField({ value, onChange, licences, disabled }: ContactLicencesFieldProps): React.JSX.Element {
  return (
    <ShowcaseLicenceField
      voice="office"
      heldThrough={[]}
      disabled={disabled}
      value={value}
      onChange={onChange}
      renderBelowLicence={(licence, draft) => {
        const held = storedLicenceShownBy(licences, licence, draft);
        return held === null ? null : <ContactLicenceProvenanceNote held={held} />;
      }}
    />
  );
}
