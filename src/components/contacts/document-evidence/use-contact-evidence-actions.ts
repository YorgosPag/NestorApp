'use client';

/**
 * @fileoverview Οι **τέσσερις** πράξεις μιας γραμμής «Το έγγραφο λέει / Η επαφή λέει» (ADR-950 §4.5).
 * @module components/contacts/document-evidence/use-contact-evidence-actions
 *
 * - **Αποδοχή** — μόνο η φόρμα (`acceptEvidence`)· η εγγραφή περνά από την υπάρχουσα αποθήκευση και τους 4 φρουρούς.
 * - **Πρόταση διεύθυνσης** — στον ιδιοκτήτη της έδρας (`proposeHqAddress`), ποτέ απευθείας εγγραφή.
 * - **Αγνόηση / Αναίρεση** — διακομιστής (ο ΕΝΑΣ γραφέας), **αισιόδοξα**: φαίνεται αμέσως, επαναφορά σε αποτυχία.
 */

import { useCallback } from 'react';

import type { EvidenceDismissReason } from '@/config/contact-document-evidence';
import { proposeHqAddress } from '@/components/contacts/dynamic/hq-address-proposal-store';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { acceptEvidence, evidenceSeatProposal } from '@/lib/contacts/contact-evidence-acceptance';
import type { EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import { dismissEvidenceWithPolicy, restoreEvidenceWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import type { FileRecord } from '@/types/file-record';

import { useContactEvidenceHost } from './ContactEvidenceContext';
import { CONTACT_EVIDENCE_KEYS as KEYS } from './contact-evidence-labels';

const logger = createModuleLogger('ContactEvidenceActions');

export interface ContactEvidenceActions {
  readonly accept: (row: EvidenceRow) => void;
  readonly proposeAddress: (row: EvidenceRow) => void;
  readonly dismiss: (row: EvidenceRow, reason: EvidenceDismissReason) => void;
  readonly restore: (row: EvidenceRow) => void;
}

export function useContactEvidenceActions(file: FileRecord, fileName: string): ContactEvidenceActions | null {
  const host = useContactEvidenceHost();
  const { t } = useTranslation('contacts-form');
  const { error } = useNotifications();

  const accept = useCallback((row: EvidenceRow) => {
    if (host?.setFormData && host.canEdit) host.setFormData(acceptEvidence(host.formData, row, host.contactType));
  }, [host]);

  const proposeAddress = useCallback((row: EvidenceRow) => {
    const proposal = evidenceSeatProposal(row);
    if (host === null || proposal === null) return;
    const observedAt = file.ingestion?.analysis?.analysisTimestamp ?? nowISO();
    proposeHqAddress({ contactId: host.contactId, origin: { kind: 'document', fileId: file.id, fileName }, observedAt, ...proposal });
    host.onOpenAddresses?.();
  }, [host, file.id, file.ingestion?.analysis?.analysisTimestamp, fileName]);

  const dismiss = useCallback((row: EvidenceRow, reason: EvidenceDismissReason) => {
    if (host === null || row.documentKey === null) return;
    // Αισιόδοξα: η τιμή-κλειδί είναι η ίδια που θα υπολογίσει ο διακομιστής (`evidenceDocumentKey`). Το `decidedBy`
    // μένει κενό **μόνο** στην εκκρεμή τιμή — την αυθεντική τη γράφει ο διακομιστής από την ταυτότητα του αιτήματος.
    host.setPending(file.id, row.key, { row: row.key, documentValueAtDecision: row.documentKey, reason, decidedBy: '', decidedAt: nowISO() });
    dismissEvidenceWithPolicy(file.id, row.key, reason).catch((cause: unknown) => {
      logger.error('Evidence dismissal failed', { fileId: file.id, row: row.key, cause });
      host.setPending(file.id, row.key, undefined);
      error(t(KEYS.dismissFailed));
    });
  }, [host, file.id, error, t]);

  const restore = useCallback((row: EvidenceRow) => {
    if (host === null) return;
    host.setPending(file.id, row.key, null);
    restoreEvidenceWithPolicy(file.id, row.key).catch((cause: unknown) => {
      logger.error('Evidence restore failed', { fileId: file.id, row: row.key, cause });
      host.setPending(file.id, row.key, undefined);
      error(t(KEYS.restoreFailed));
    });
  }, [host, file.id, error, t]);

  return host === null ? null : { accept, proposeAddress, dismiss, restore };
}
