'use client';

/**
 * @fileoverview **ΣΕΛΙΔΑ ΚΑΤΑΣΤΑΣΕΩΝ ΤΟΥ ΠΙΝΑΚΑ «ΕΓΓΡΑΦΟ ↔ ΕΠΑΦΗ»** (ADR-950 §8.19) — ο **πραγματικός**
 * `ContactEvidencePanel`, με σταθερές αναγνώσεις, σε καταστάσεις που η παραγωγή δεν παράγει κατά παραγγελία.
 *
 * 🔑 Κανένα mock: ο πραγματικός πίνακας, η πραγματική σύγκριση, ο πραγματικός διάλογος «Συμπλήρωση κενών». Η φόρμα
 *    ζει σε τοπική κατάσταση (επεξεργασία χωρίς αποθήκευση) — τίποτα δεν γράφεται πουθενά.
 * ⚠️ Η σελίδα ΔΕΝ κρίνει: η ετυμηγορία ζει στο `contact-evidence-states.e2e.spec.ts`.
 * 🔑 Ο `I18nProvider` μπαίνει εδώ, όχι στο `(bare)/layout` (ίδιος λόγος με το `address-field-width`).
 */

import React, { useState } from 'react';

import { ContactEvidenceProvider } from '@/components/contacts/document-evidence/ContactEvidenceContext';
import { ContactEvidencePanel } from '@/components/contacts/document-evidence/ContactEvidencePanel';
import I18nProvider from '@/components/providers/I18nProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import type { ContactFormData } from '@/types/ContactFormTypes';

import { CONTACT_EVIDENCE_CASE_ATTRIBUTE, CONTACT_EVIDENCE_CASES, type ContactEvidenceCase } from './contact-evidence-states-cases';

function EvidenceCase({ evidenceCase }: { readonly evidenceCase: ContactEvidenceCase }) {
  const [formData, setFormData] = useState<ContactFormData>(evidenceCase.formData);
  const attributes = { [CONTACT_EVIDENCE_CASE_ATTRIBUTE]: evidenceCase.id };
  return (
    <article {...attributes} aria-label={evidenceCase.id} className="rounded-md border">
      <h2 className="m-0 border-b p-3 font-mono text-sm">{evidenceCase.id}</h2>
      <ContactEvidenceProvider
        contactId="cont_test_harness"
        contactType="individual"
        formData={formData}
        setFormData={setFormData}
        canEdit
      >
        <ContactEvidencePanel file={evidenceCase.file} />
      </ContactEvidenceProvider>
    </article>
  );
}

export default function ContactEvidenceStatesHarness() {
  return (
    <I18nProvider>
      <NotificationProvider>
        <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
          {CONTACT_EVIDENCE_CASES.map((evidenceCase) => (
            <EvidenceCase key={evidenceCase.id} evidenceCase={evidenceCase} />
          ))}
        </main>
      </NotificationProvider>
    </I18nProvider>
  );
}
