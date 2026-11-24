'use client';

/**
 * @fileoverview Οι πράξεις μιας γραμμής «Το έγγραφο λέει / Η επαφή λέει» (ADR-950 §4.5 · §9).
 * @module components/contacts/document-evidence/use-contact-evidence-actions
 *
 * - **Αποδοχή** (επεξεργασία) — μόνο η φόρμα (`acceptEvidence`)· η εγγραφή περνά από την υπάρχουσα αποθήκευση και τους 4 φρουρούς.
 * - **Καταχώριση** (προβολή) — η ίδια αλλαγή, σταλμένη **αμέσως** στην ίδια φυλαγμένη αποθήκευση (`host.onRegister`).
 * - **Πρόταση διεύθυνσης** — στον ιδιοκτήτη της έδρας (`proposeHqAddress`), ποτέ απευθείας εγγραφή. Από την προβολή
 *   η ίδια πράξη **ανοίγει πρώτα την επεξεργασία** (`host.onStartEdit`, ADR-950 §11) — ένα πάτημα, ο ίδιος editor.
 * - **Αγνόηση / Αναίρεση** — διακομιστής (ο ΕΝΑΣ γραφέας), **αισιόδοξα**: φαίνεται αμέσως, επαναφορά σε αποτυχία.
 */

import { useCallback } from 'react';

import type { EvidenceDismissReason } from '@/config/contact-document-evidence';
import { proposeHqAddress } from '@/components/contacts/dynamic/hq-address-proposal-store';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  acceptEvidence,
  acceptEvidenceBatch,
  canRegisterEvidence,
  evidenceSeatProposal,
  formDataChanges,
} from '@/lib/contacts/contact-evidence-acceptance';
import type { EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import { nowISO } from '@/lib/date-local';
import { checkVatUniqueness } from '@/lib/validation/vat-validation';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import { dismissEvidenceWithPolicy, restoreEvidenceWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileRecord } from '@/types/file-record';

import { useContactEvidenceHost } from './ContactEvidenceContext';
import { CONTACT_EVIDENCE_KEYS as KEYS } from './contact-evidence-labels';

const logger = createModuleLogger('ContactEvidenceActions');

export interface ContactEvidenceActions {
  readonly accept: (row: EvidenceRow) => void;
  readonly proposeAddress: (row: EvidenceRow) => void;
  /** Φτάνει η «Πρόταση διεύθυνσης» στον editor έδρας από εδώ; (επεξεργασία, ή προβολή που μπορεί να την ανοίξει) */
  readonly canProposeAddress: boolean;
  readonly fillEmpty: (rows: readonly EvidenceRow[], seat: EvidenceRow | null) => void;
  /** ADR-950 §9 — «Καταχώριση» μίας γραμμής από την προβολή (φυλαγμένη αποθήκευση, ένα πάτημα). */
  readonly register: (row: EvidenceRow) => void;
  /** Υπάρχει καταχώριση από την προβολή; (όχι σε επεξεργασία — εκεί ισχύει η «Αποδοχή») */
  readonly canRegister: boolean;
  readonly isRegistering: boolean;
  readonly dismiss: (row: EvidenceRow, reason: EvidenceDismissReason) => void;
  readonly restore: (row: EvidenceRow) => void;
}

/** «Αγνόηση» / «Αναίρεση» — διακομιστής (ο ΕΝΑΣ γραφέας), **αισιόδοξα**: φαίνεται αμέσως, επαναφορά σε αποτυχία. */
function useEvidenceDecisions(fileId: string): Pick<ContactEvidenceActions, 'dismiss' | 'restore'> {
  const host = useContactEvidenceHost();
  const { t } = useTranslation('contacts-form');
  const { error } = useNotifications();

  const dismiss = useCallback((row: EvidenceRow, reason: EvidenceDismissReason) => {
    if (host === null || row.documentKey === null) return;
    // Αισιόδοξα: η τιμή-κλειδί είναι η ίδια που θα υπολογίσει ο διακομιστής (`evidenceDocumentKey`). Το `decidedBy`
    // μένει κενό **μόνο** στην εκκρεμή τιμή — την αυθεντική τη γράφει ο διακομιστής από την ταυτότητα του αιτήματος.
    host.setPending(fileId, row.key, { row: row.key, documentValueAtDecision: row.documentKey, reason, decidedBy: '', decidedAt: nowISO() });
    dismissEvidenceWithPolicy(fileId, row.key, reason).catch((cause: unknown) => {
      logger.error('Evidence dismissal failed', { fileId, row: row.key, cause });
      host.setPending(fileId, row.key, undefined);
      error(t(KEYS.dismissFailed));
    });
  }, [host, fileId, error, t]);

  const restore = useCallback((row: EvidenceRow) => {
    if (host === null) return;
    host.setPending(fileId, row.key, null);
    restoreEvidenceWithPolicy(fileId, row.key).catch((cause: unknown) => {
      logger.error('Evidence restore failed', { fileId, row: row.key, cause });
      host.setPending(fileId, row.key, undefined);
      error(t(KEYS.restoreFailed));
    });
  }, [host, fileId, error, t]);

  return { dismiss, restore };
}

/** Το ΑΦΜ που πάει να γραφτεί — σε όποιο πεδίο φόρμας το κρατά ο τύπος της επαφής. */
function writtenVat(changes: Partial<ContactFormData>): string | undefined {
  return changes.vatNumber ?? changes.companyVatNumber ?? changes.serviceVatNumber;
}

export function useContactEvidenceActions(file: FileRecord, fileName: string): ContactEvidenceActions | null {
  const host = useContactEvidenceHost();
  const companyId = useCompanyId()?.companyId;
  const { t } = useTranslation('contacts-form');
  const { error } = useNotifications();
  const { dismiss, restore } = useEvidenceDecisions(file.id);

  const accept = useCallback((row: EvidenceRow) => {
    if (host?.setFormData && host.canEdit) host.setFormData(acceptEvidence(host.formData, row, host.contactType));
  }, [host]);

  // ADR-950 §8.1 — «ανάγνωση <ημερομηνία>» = η ώρα που ΣΦΡΑΓΙΣΕ ο διακομιστής (`stateChangedAt`), όχι ό,τι επινοούσε η AI
  // στο `analysisTimestamp` («01/10/2023» στον ζωντανό έλεγχο της 2026-11-23).
  const observedAt = readingTimeOf(file);

  const proposeAddress = useCallback((row: EvidenceRow) => {
    const proposal = evidenceSeatProposal(row);
    if (host === null || proposal === null) return;
    if (!host.canEdit && host.onStartEdit === undefined) return;
    // Προβολή ⇒ πρώτα επεξεργασία: ο editor έδρας παραλαμβάνει πρόταση **μόνο** όταν μπορεί να γράψει (ADR-948).
    if (!host.canEdit) host.onStartEdit?.();
    proposeHqAddress({ contactId: host.contactId, origin: { kind: 'document', fileId: file.id, fileName }, observedAt, ...proposal });
    host.onOpenAddresses?.();
  }, [host, file.id, observedAt, fileName]);

  const canRegister = host !== null && !host.canEdit && host.onRegister !== undefined;
  const canProposeAddress = host !== null && (host.canEdit || host.onStartEdit !== undefined);

  /** Από την προβολή: η **ίδια** `acceptEvidenceBatch`, και στην αποθήκευση φεύγει μόνο ό,τι άλλαξε (ADR-950 §9). */
  const registerRows = useCallback(async (rows: readonly EvidenceRow[]): Promise<void> => {
    if (host === null || !canRegister || host.onRegister === undefined) return;
    const next = acceptEvidenceBatch(host.formData, rows.filter(canRegisterEvidence), host.contactType);
    const changes = formDataChanges(host.formData, next);
    // ADR-950 §12 — ένα πάτημα ΔΕΝ γράφει ποτέ σιωπηλά ΑΦΜ που έχει ήδη άλλη επαφή· ο ίδιος έλεγχος με τη φόρμα
    // (`checkVatUniqueness`), τη στιγμή της πράξης. Σκόπιμο διπλό ΑΦΜ γράφεται από την επεξεργασία, όπου φαίνεται.
    const vat = writtenVat(changes);
    if (vat !== undefined && vat !== '' && companyId !== undefined) {
      const taken = (await checkVatUniqueness(vat, companyId, host.contactId)).existingContact;
      if (taken !== null) {
        error(t(KEYS.vatTaken, { vatNumber: vat, contactName: taken.name }));
        return;
      }
    }
    await host.onRegister(next, changes);
  }, [host, canRegister, companyId, error, t]);

  const register = useCallback((row: EvidenceRow) => void registerRows([row]), [registerRows]);

  /**
   * «Συμπλήρωση κενών»: όλα τα επιλεγμένα σε **μία** αλλαγή φόρμας, και η διεύθυνση ως πρόταση (ADR-950 §8.6). Από την
   * προβολή ⇒ **μία** καταχώριση· η διεύθυνση μένει στην επεξεργασία (ιδιοκτήτης της είναι ο editor έδρας).
   */
  const fillEmpty = useCallback((rows: readonly EvidenceRow[], seat: EvidenceRow | null) => {
    if (host === null) return;
    if (!host.canEdit) {
      void registerRows(rows);
      return;
    }
    if (host.setFormData === undefined) return;
    if (rows.length > 0) host.setFormData(acceptEvidenceBatch(host.formData, rows, host.contactType));
    if (seat !== null) proposeAddress(seat);
  }, [host, proposeAddress, registerRows]);

  if (host === null) return null;
  return { accept, proposeAddress, canProposeAddress, fillEmpty, register, canRegister, isRegistering: host.isRegistering ?? false, dismiss, restore };
}

/** Πότε διαβάστηκε — η σφραγίδα του διακομιστή· χωρίς αυτήν, «τώρα» (ποτέ ημερομηνία από το LLM). */
function readingTimeOf(file: FileRecord): string {
  const at = file.ingestion?.stateChangedAt;
  if (typeof at === 'string') return at;
  return at instanceof Date ? at.toISOString() : nowISO();
}
