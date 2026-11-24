'use client';

/**
 * @fileoverview Οι πράξεις της **«Διόρθωσης ανάγνωσης»** μιας γραμμής (ADR-950 §10).
 * @module components/contacts/document-evidence/use-evidence-correction-actions
 *
 * - **Διόρθωση / Αναίρεση** — διακομιστής (ο ΕΝΑΣ γραφέας), **αισιόδοξα**: η γραμμή αλλάζει αμέσως, επαναφορά σε αποτυχία.
 *   Ίδια μηχανή εκκρεμών με την «Αγνόηση» (`ContactEvidenceContext`).
 * - 🔑 Γράφει στο **αρχείο**, ποτέ στην επαφή. Η επαφή αλλάζει μετά, με τα υπάρχοντα «Καταχώριση» / «Αποδοχή».
 */

import { useCallback, useMemo } from 'react';

import type { EvidenceRowKey } from '@/config/contact-document-evidence';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  evidenceCorrectionFields,
  evidenceRowFieldSpecs,
  machineReadingSignature,
  type EvidenceCorrectionField,
  type EvidenceCorrectionValues,
} from '@/lib/contacts/contact-evidence-corrections';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import { correctEvidenceWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import type { FileRecord } from '@/types/file-record';

import { machineReadingOfFile, useContactEvidenceCorrections, useContactEvidenceHost } from './ContactEvidenceContext';
import { CONTACT_EVIDENCE_CORRECTION_KEYS as KEYS } from './contact-evidence-labels';

const logger = createModuleLogger('ContactEvidenceCorrections');

export interface EvidenceCorrectionActions {
  /** Το είδος εγγράφου της ανάγνωσης — ο διάλογος κρίνει ζωντανά με τον ίδιο κανόνα που θα κρίνει ο διακομιστής. */
  readonly purpose: string;
  /** Τα πεδία του διαλόγου για μια γραμμή — με ό,τι είπε η μηχανή, η δεύτερη ανάγνωση και η τυχόν διόρθωση. */
  readonly fieldsOf: (row: EvidenceRowKey) => readonly EvidenceCorrectionField[];
  readonly correct: (row: EvidenceRowKey, values: EvidenceCorrectionValues) => void;
  readonly clear: (row: EvidenceRowKey) => void;
}

/** `null` έξω από φόρμα επαφής ή χωρίς ανάγνωση — τότε δεν υπάρχει τίποτα να διορθωθεί. */
export function useEvidenceCorrectionActions(file: FileRecord): EvidenceCorrectionActions | null {
  const host = useContactEvidenceHost();
  const { t } = useTranslation('contacts-form');
  const { error } = useNotifications();
  const corrections = useContactEvidenceCorrections(file);
  const machine = useMemo(() => machineReadingOfFile(file), [file]);
  const fileId = file.id;
  const setPending = host?.setPendingCorrection;

  const fieldsOf = useCallback((row: EvidenceRowKey) => {
    if (machine === null) return [];
    return evidenceCorrectionFields(machine.reading, machine.purpose, row, corrections.find((c) => c.row === row) ?? null);
  }, [machine, corrections]);

  const correct = useCallback((row: EvidenceRowKey, values: EvidenceCorrectionValues) => {
    if (setPending === undefined || machine === null) return;
    // Αισιόδοξα: ίδιο αποτύπωμα μηχανής με αυτό που θα υπολογίσει ο διακομιστής. Το `correctedBy` μένει κενό **μόνο**
    // στην εκκρεμή τιμή — την αυθεντική τη γράφει ο διακομιστής από την ταυτότητα του αιτήματος.
    const machineReadingAtCorrection = machineReadingSignature(machine.reading, evidenceRowFieldSpecs(machine.purpose, row));
    setPending(fileId, row, { row, values, machineReadingAtCorrection, correctedBy: '', correctedAt: nowISO() });
    correctEvidenceWithPolicy(fileId, row, values).catch((cause: unknown) => {
      logger.error('Evidence correction failed', { fileId, row, cause });
      setPending(fileId, row, undefined);
      error(t(KEYS.saveFailed));
    });
  }, [setPending, machine, fileId, error, t]);

  const clear = useCallback((row: EvidenceRowKey) => {
    if (setPending === undefined) return;
    setPending(fileId, row, null);
    correctEvidenceWithPolicy(fileId, row, null).catch((cause: unknown) => {
      logger.error('Evidence correction clear failed', { fileId, row, cause });
      setPending(fileId, row, undefined);
      error(t(KEYS.clearFailed));
    });
  }, [setPending, fileId, error, t]);

  return useMemo(
    () => (host === null || machine === null ? null : { purpose: machine.purpose, fieldsOf, correct, clear }),
    [host, machine, fieldsOf, correct, clear],
  );
}
