'use client';

/**
 * @fileoverview **Η ΦΟΡΜΑ ΤΗΣ ΕΠΑΦΗΣ, ΠΡΟΣΒΑΣΙΜΗ ΑΠΟ ΤΗ ΛΙΣΤΑ ΑΡΧΕΙΩΝ** — προαιρετικό context (ADR-950 §4.4).
 * @module components/contacts/document-evidence/ContactEvidenceContext
 *
 * Το κοινό `EntityFilesManager` **δεν** ξέρει τίποτα για επαφές, και έτσι πρέπει να μείνει. Το context το παρέχει
 * **μόνο** η φόρμα επαφής (`contactRenderersCore`, renderer `files`)· σε κάθε άλλη οντότητα λείπει ⇒ τα δύο
 * components της σύγκρισης (`ContactEvidenceBadge` · `ContactEvidencePanel`) δεν αποδίδουν τίποτα.
 *
 * 🔑 **Αισιόδοξη «Αγνόηση»** (Gmail-style): η απόφαση φαίνεται **αμέσως** στο σήμα **και** στον πίνακα, πριν απαντήσει ο
 *    διακομιστής· αποτυχία ⇒ επαναφορά. Ζει **εδώ** (όχι στο panel) ώστε σήμα και πίνακας να λένε **το ίδιο**. Η εκκρεμής
 *    τιμή σβήνει μόνη της μόλις το αρχείο από τον δίσκο τη δείχνει (καμία δεύτερη αλήθεια που μένει για πάντα).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { EvidenceRowKey } from '@/config/contact-document-evidence';
import { compareEvidenceWithForm, type EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import { isEvidenceRowKey, readEvidenceDismissals } from '@/lib/contacts/contact-evidence-dismissals';
import type { ContactType } from '@/types/contacts/contracts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { EvidenceDismissal, FileRecord } from '@/types/file-record';

export interface ContactEvidenceHost {
  readonly contactId: string;
  readonly contactType: ContactType;
  readonly formData: ContactFormData;
  readonly setFormData?: (next: ContactFormData) => void;
  /** Επεξεργασία (όχι προβολή) **και** υπάρχει γραφέας φόρμας — ίδιος κανόνας με το ADR-948 `canEdit`. */
  readonly canEdit: boolean;
  readonly onOpenAddresses?: () => void;
}

/** `null` = «αναιρέθηκε» · τιμή = «αγνοήθηκε» · απουσία = καμία εκκρεμής απόφαση. */
type PendingDecisions = Readonly<Record<string, Readonly<Partial<Record<EvidenceRowKey, EvidenceDismissal | null>>>>>;

interface ContactEvidenceContextValue extends ContactEvidenceHost {
  readonly pending: PendingDecisions;
  readonly setPending: (fileId: string, row: EvidenceRowKey, value: EvidenceDismissal | null | undefined) => void;
}

const ContactEvidenceContext = createContext<ContactEvidenceContextValue | null>(null);

export function ContactEvidenceProvider({
  children,
  contactId,
  contactType,
  formData,
  setFormData,
  canEdit,
  onOpenAddresses,
}: ContactEvidenceHost & { readonly children: React.ReactNode }) {
  const [pending, setPendingState] = useState<PendingDecisions>({});
  const setPending = useCallback((fileId: string, row: EvidenceRowKey, value: EvidenceDismissal | null | undefined) => {
    setPendingState((current) => {
      const forFile = { ...(current[fileId] ?? {}) };
      if (value === undefined) delete forFile[row];
      else forFile[row] = value;
      return { ...current, [fileId]: forFile };
    });
  }, []);
  const value = useMemo(
    () => ({ contactId, contactType, formData, setFormData, canEdit, onOpenAddresses, pending, setPending }),
    [contactId, contactType, formData, setFormData, canEdit, onOpenAddresses, pending, setPending],
  );
  return <ContactEvidenceContext.Provider value={value}>{children}</ContactEvidenceContext.Provider>;
}

/** Το context — `null` έξω από φόρμα επαφής. */
export function useContactEvidenceHost(): ContactEvidenceContextValue | null {
  return useContext(ContactEvidenceContext);
}

/** Ο δίσκος + οι εκκρεμείς αποφάσεις αυτού του αρχείου — οι εκκρεμείς κερδίζουν. */
function mergeDismissals(
  stored: readonly EvidenceDismissal[],
  pending: Readonly<Partial<Record<EvidenceRowKey, EvidenceDismissal | null>>> | undefined,
): readonly EvidenceDismissal[] {
  if (pending === undefined) return stored;
  const overridden = new Set(Object.keys(pending));
  const kept = stored.filter((d) => !overridden.has(d.row));
  const added = Object.values(pending).filter((d): d is EvidenceDismissal => d !== null && d !== undefined);
  return [...kept, ...added];
}

/** Επιβεβαίωσε ο δίσκος την εκκρεμή απόφαση; (ίδια γραμμή, ίδια τιμή — ή απουσία για την αναίρεση) */
function storedReflects(stored: readonly EvidenceDismissal[], row: EvidenceRowKey, value: EvidenceDismissal | null): boolean {
  const onDisk = stored.find((d) => d.row === row) ?? null;
  if (value === null) return onDisk === null;
  return onDisk !== null && onDisk.documentValueAtDecision === value.documentValueAtDecision && onDisk.reason === value.reason;
}

/**
 * **Οι γραμμές του πίνακα για ένα αρχείο** — `null` όταν δεν υπάρχει context, ανάγνωση ή χάρτης πεδίων.
 * Ζωντανή πάνω στη φόρμα: αλλάζει η φόρμα ⇒ αλλάζει η κρίση.
 */
export function useContactEvidenceRows(file: FileRecord): readonly EvidenceRow[] | null {
  const host = useContactEvidenceHost();
  const analysis = file.ingestion?.analysis;
  const stored = useMemo(() => readEvidenceDismissals(file.evidenceDismissals), [file.evidenceDismissals]);
  const pendingForFile = host?.pending[file.id];

  useEffect(() => {
    if (host === null || pendingForFile === undefined) return;
    for (const row of Object.keys(pendingForFile)) {
      if (!isEvidenceRowKey(row)) continue;
      const value = pendingForFile[row];
      if (value !== undefined && storedReflects(stored, row, value)) host.setPending(file.id, row, undefined);
    }
  }, [host, pendingForFile, stored, file.id]);

  return useMemo(() => {
    if (host === null || analysis?.fields === undefined || analysis.evidencePurpose === undefined) return null;
    return compareEvidenceWithForm({
      fields: analysis.fields,
      purpose: analysis.evidencePurpose,
      formData: host.formData,
      contactType: host.contactType,
      dismissals: mergeDismissals(stored, pendingForFile),
    });
  }, [host, analysis, stored, pendingForFile]);
}
