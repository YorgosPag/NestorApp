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
import { ContactLicenceRegistryCheck } from './ContactLicenceRegistryCheck';

export interface ContactLicencesFieldProps {
  readonly value: LicenceDrafts;
  readonly onChange: (next: LicenceDrafts) => void;
  /** Οι αποθηκευμένες άδειες — μόνο αυτές έχουν προέλευση. */
  readonly licences: readonly ContactLicence[] | undefined;
  readonly disabled: boolean;
  /**
   * ADR-915 §40.7 Φ2 — η **αποθηκευμένη** επαφή: μόνο τότε υπάρχει «Έλεγχος στο μητρώο» (ο server ελέγχει τον αριθμό
   * της βάσης, όχι της φόρμας). Νέα επαφή ⇒ απόν.
   */
  readonly contactId?: string;
}

export function ContactLicencesField({ value, onChange, licences, disabled, contactId }: ContactLicencesFieldProps): React.JSX.Element {
  return (
    <ShowcaseLicenceField
      voice="office"
      heldThrough={[]}
      disabled={disabled}
      value={value}
      onChange={onChange}
      renderBelowLicence={(licence, draft) => {
        const held = storedLicenceShownBy(licences, licence, draft);
        if (held === null) return null;
        return (
          <>
            <ContactLicenceProvenanceNote held={held} />
            {contactId && <ContactLicenceRegistryCheck contactId={contactId} held={held} />}
          </>
        );
      }}
    />
  );
}
