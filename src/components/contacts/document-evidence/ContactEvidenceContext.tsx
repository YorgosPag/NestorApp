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
 * 🔑 **Το ίδιο και η «Διόρθωση ανάγνωσης»** (ADR-950 §10): ΜΙΑ μηχανή εκκρεμών αποφάσεων (`usePendingDecisions`), δύο μητρώα.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { EvidenceRowKey } from '@/config/contact-document-evidence';
import type { EvidenceComparisonInput, EvidenceReading, EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import {
  compareEvidenceWithCorrections,
  previewEvidenceCorrection,
  readEvidenceCorrections,
  type EvidenceCorrectionValues,
} from '@/lib/contacts/contact-evidence-corrections';
import { isEvidenceRowKey, readEvidenceDismissals } from '@/lib/contacts/contact-evidence-dismissals';
import type { ContactType } from '@/types/contacts/contracts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { EvidenceCorrection, EvidenceDismissal, FileRecord } from '@/types/file-record';

export interface ContactEvidenceHost {
  readonly contactId: string;
  readonly contactType: ContactType;
  /** Το ΑΦΜ που έχει **ήδη** η επαφή — ίδιο ⇒ καμία υπόσχεση φραγμού/επιβεβαίωσης (ADR-944 §9.8). Χωρίς επαφή: `undefined`. */
  readonly storedVatNumber?: string;
  readonly formData: ContactFormData;
  readonly setFormData?: (next: ContactFormData) => void;
  /** Επεξεργασία (όχι προβολή) **και** υπάρχει γραφέας φόρμας — ίδιος κανόνας με το ADR-948 `canEdit`. */
  readonly canEdit: boolean;
  readonly onOpenAddresses?: () => void;
  /**
   * ADR-950 §9 — **«Καταχώριση»** από την προβολή: η νέα εικόνα της φόρμας + **μόνο** ό,τι άλλαξε, προς τη φυλαγμένη
   * αποθήκευση της καρτέλας. `undefined` ⇒ καμία καταχώριση (επεξεργασία · αποσυρμένη επαφή · φόρμα δημιουργίας).
   */
  readonly onRegister?: (next: ContactFormData, changes: Partial<ContactFormData>) => Promise<void>;
  /** Τρέχει αποθήκευση της καρτέλας — τα κουμπιά καταχώρισης κλειδώνουν (`disabled` + `aria-busy`). */
  readonly isRegistering?: boolean;
  /**
   * ADR-950 §11 — βάζει την καρτέλα σε **επεξεργασία** από την προβολή, ώστε η «Πρόταση διεύθυνσης» να φτάνει στον editor
   * έδρας με **ένα** πάτημα. `undefined` ⇒ δεν προσφέρεται (ήδη επεξεργασία · αποσυρμένη επαφή · φόρμα δημιουργίας).
   */
  readonly onStartEdit?: () => void;
}

/** Εκκρεμείς αποφάσεις ανά αρχείο και γραμμή: `null` = «αναιρέθηκε» · τιμή = «ισχύει» · απουσία = καμία εκκρεμής. */
type PendingForFile<T> = Readonly<Partial<Record<EvidenceRowKey, T | null>>>;
type PendingDecisions<T> = Readonly<Record<string, PendingForFile<T>>>;
type SetPending<T> = (fileId: string, row: EvidenceRowKey, value: T | null | undefined) => void;

interface ContactEvidenceContextValue extends ContactEvidenceHost {
  readonly pending: PendingDecisions<EvidenceDismissal>;
  readonly setPending: SetPending<EvidenceDismissal>;
  /** ADR-950 §10 — εκκρεμείς διορθώσεις ανάγνωσης (ίδια μηχανή με τις «Αγνοήσεις»). */
  readonly pendingCorrections: PendingDecisions<EvidenceCorrection>;
  readonly setPendingCorrection: SetPending<EvidenceCorrection>;
}

function usePendingDecisions<T>(): readonly [PendingDecisions<T>, SetPending<T>] {
  const [pending, setPendingState] = useState<PendingDecisions<T>>({});
  const setPending = useCallback<SetPending<T>>((fileId, row, value) => {
    setPendingState((current) => {
      const forFile = { ...(current[fileId] ?? {}) };
      if (value === undefined) delete forFile[row];
      else forFile[row] = value;
      return { ...current, [fileId]: forFile };
    });
  }, []);
  return [pending, setPending];
}

const ContactEvidenceContext = createContext<ContactEvidenceContextValue | null>(null);

export function ContactEvidenceProvider({
  children,
  contactId,
  contactType,
  storedVatNumber,
  formData,
  setFormData,
  canEdit,
  onOpenAddresses,
  onRegister,
  isRegistering,
  onStartEdit,
}: ContactEvidenceHost & { readonly children: React.ReactNode }) {
  const [pending, setPending] = usePendingDecisions<EvidenceDismissal>();
  const [pendingCorrections, setPendingCorrection] = usePendingDecisions<EvidenceCorrection>();
  const value = useMemo(
    () => ({
      contactId, contactType, storedVatNumber, formData, setFormData, canEdit, onOpenAddresses, onRegister, isRegistering,
      onStartEdit, pending, setPending, pendingCorrections, setPendingCorrection,
    }),
    [contactId, contactType, storedVatNumber, formData, setFormData, canEdit, onOpenAddresses, onRegister, isRegistering, onStartEdit,
      pending, setPending, pendingCorrections, setPendingCorrection],
  );
  return <ContactEvidenceContext.Provider value={value}>{children}</ContactEvidenceContext.Provider>;
}

/** Το context — `null` έξω από φόρμα επαφής. */
export function useContactEvidenceHost(): ContactEvidenceContextValue | null {
  return useContext(ContactEvidenceContext);
}

/** Ο δίσκος + οι εκκρεμείς αποφάσεις αυτού του αρχείου — οι εκκρεμείς κερδίζουν. */
function mergePending<T extends { readonly row: EvidenceRowKey }>(stored: readonly T[], pending: PendingForFile<T> | undefined): readonly T[] {
  if (pending === undefined) return stored;
  const overridden = new Set(Object.keys(pending));
  const kept = stored.filter((d) => !overridden.has(d.row));
  const added = Object.values(pending).filter((d): d is T => d !== null && d !== undefined);
  return [...kept, ...added];
}

/** Επιβεβαίωσε ο δίσκος την εκκρεμή «Αγνόηση»; (ίδια γραμμή, ίδια τιμή — ή απουσία για την αναίρεση) */
function dismissalSettled(onDisk: EvidenceDismissal | null, value: EvidenceDismissal | null): boolean {
  if (value === null) return onDisk === null;
  return onDisk !== null && onDisk.documentValueAtDecision === value.documentValueAtDecision && onDisk.reason === value.reason;
}

/** Επιβεβαίωσε ο δίσκος την εκκρεμή διόρθωση; (ίδιες τιμές ανά πεδίο — ή απουσία για την αναίρεση) */
function correctionSettled(onDisk: EvidenceCorrection | null, value: EvidenceCorrection | null): boolean {
  if (value === null) return onDisk === null;
  if (onDisk === null) return false;
  const disk = Object.entries(onDisk.values);
  const wanted = new Map(Object.entries(value.values));
  return disk.length === wanted.size && disk.every(([key, text]) => wanted.get(key) === text);
}

/** Σβήνει κάθε εκκρεμή απόφαση που ο δίσκος δείχνει πλέον — καμία δεύτερη αλήθεια που μένει για πάντα. */
function useSettlePending<T extends { readonly row: EvidenceRowKey }>(
  fileId: string,
  stored: readonly T[],
  pending: PendingForFile<T> | undefined,
  setPending: SetPending<T> | undefined,
  settled: (onDisk: T | null, value: T | null) => boolean,
): void {
  useEffect(() => {
    if (setPending === undefined || pending === undefined) return;
    for (const row of Object.keys(pending)) {
      if (!isEvidenceRowKey(row)) continue;
      const value = pending[row];
      if (value !== undefined && settled(stored.find((d) => d.row === row) ?? null, value)) setPending(fileId, row, undefined);
    }
  }, [fileId, stored, pending, setPending, settled]);
}

/** Η ανάγνωση της **μηχανής** ενός αρχείου, με τα τεκμήρια διακομιστή (ADR-950 §8) — `null` = καμία ανάγνωση. */
export function machineReadingOfFile(file: FileRecord): MachineReading | null {
  return machineReadingOf(file.ingestion?.analysis);
}

interface MachineReading {
  readonly reading: EvidenceReading;
  readonly purpose: string;
}

function machineReadingOf(analysis: NonNullable<FileRecord['ingestion']>['analysis']): MachineReading | null {
  if (analysis?.fields === undefined || analysis.evidencePurpose === undefined) return null;
  return {
    reading: {
      fields: analysis.fields,
      fieldConsensus: analysis.fieldConsensus,
      addressVerification: analysis.addressVerification,
      phoneLineType: analysis.phoneLineType,
    },
    purpose: analysis.evidencePurpose,
  };
}

/** Οι διορθώσεις ανάγνωσης ενός αρχείου — δίσκος + εκκρεμείς (ADR-950 §10). `[]` έξω από φόρμα επαφής. */
export function useContactEvidenceCorrections(file: FileRecord): readonly EvidenceCorrection[] {
  const host = useContactEvidenceHost();
  const stored = useMemo(() => readEvidenceCorrections(file.evidenceCorrections), [file.evidenceCorrections]);
  const pendingForFile = host?.pendingCorrections[file.id];
  useSettlePending(file.id, stored, pendingForFile, host?.setPendingCorrection, correctionSettled);
  return useMemo(() => mergePending(stored, pendingForFile), [stored, pendingForFile]);
}

type CorrectedComparisonInput = EvidenceComparisonInput & { readonly corrections: readonly EvidenceCorrection[] };

/**
 * **Η ΜΙΑ είσοδος της σύγκρισης για ένα αρχείο** — ανάγνωση της μηχανής · φόρμα · «Αγνοήσεις» · διορθώσεις (δίσκος +
 * εκκρεμείς). `null` όταν δεν υπάρχει context ή ανάγνωση. Την τρώνε ο πίνακας **και** η προεπισκόπηση της διόρθωσης,
 * ώστε να κρίνουν με τα ίδια δεδομένα.
 */
function useEvidenceComparisonInput(file: FileRecord): CorrectedComparisonInput | null {
  const host = useContactEvidenceHost();
  const analysis = file.ingestion?.analysis;
  const machine = useMemo(() => machineReadingOf(analysis), [analysis]);
  const stored = useMemo(() => readEvidenceDismissals(file.evidenceDismissals), [file.evidenceDismissals]);
  const pendingForFile = host?.pending[file.id];
  const corrections = useContactEvidenceCorrections(file);
  useSettlePending(file.id, stored, pendingForFile, host?.setPending, dismissalSettled);
  const formData = host?.formData;
  const contactType = host?.contactType;

  return useMemo(() => {
    if (formData === undefined || contactType === undefined || machine === null) return null;
    return {
      reading: machine.reading,
      purpose: machine.purpose,
      formData,
      contactType,
      dismissals: mergePending(stored, pendingForFile),
      corrections,
    };
  }, [formData, contactType, machine, stored, pendingForFile, corrections]);
}

/** Η γραμμή όπως **θα** είναι με αυτές τις τιμές — `null` όταν δεν κρίνεται (ADR-950 §11). */
export type EvidenceCorrectionPreview = (row: EvidenceRowKey, values: EvidenceCorrectionValues) => EvidenceRow | null;

export interface ContactEvidenceComparison {
  readonly rows: readonly EvidenceRow[];
  readonly preview: EvidenceCorrectionPreview;
}

/**
 * **Οι γραμμές του πίνακα για ένα αρχείο, και η προεπισκόπηση μιας διόρθωσης** — `null` όταν δεν υπάρχει context,
 * ανάγνωση ή χάρτης πεδίων. Ζωντανή πάνω στη φόρμα: αλλάζει η φόρμα ⇒ αλλάζει η κρίση. Οι διορθώσεις του ανθρώπου
 * μπαίνουν **πάνω** από τη μηχανή.
 */
export function useContactEvidenceComparison(file: FileRecord): ContactEvidenceComparison | null {
  const input = useEvidenceComparisonInput(file);
  return useMemo(() => {
    if (input === null) return null;
    return {
      rows: compareEvidenceWithCorrections(input),
      preview: (row, values) => previewEvidenceCorrection(input, row, values),
    };
  }, [input]);
}

/** Μόνο οι γραμμές — για το σήμα της λίστας, που δεν διορθώνει τίποτα. */
export function useContactEvidenceRows(file: FileRecord): readonly EvidenceRow[] | null {
  return useContactEvidenceComparison(file)?.rows ?? null;
}
