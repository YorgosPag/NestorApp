'use client';

/**
 * =============================================================================
 * «Αποστολή εγγράφου» — το transmittal από τη ματιά του επαγγελματία (ADR-901 Φ4.4 §5.8.1)
 * =============================================================================
 *
 * Δύο βήματα σε μία οθόνη: **διάλεξε** ένα από τα πρόχειρά σου για αυτή τη γραμμή (ή ανέβασε νέο — μένει στον
 * δικό σου χώρο) → **στείλε**. Το αρχείο **δεν** αντιγράφεται: στέλνεται η συγκεκριμένη έκδοση, που μένει δική σου.
 *
 * 🏆 Πού ξεπερνάμε το Aconex/ACC: **κανένα** πεδίο παραληπτών. Ο διάλογος **λέει** πριν την αποστολή ποιος θα το δει,
 *    και αυτό το κείμενο το παράγει ο **ρόλος** — ο ίδιος κανόνας που επιβάλλει ο server (Α23). Λάθος αποστολή της
 *    έκθεσης του αγοραστή στον πωλητή είναι δομικά αδύνατη, όχι απλώς απίθανη.
 *
 * Φορτώνεται **δυναμικά** (`next/dynamic`) από τον κατάλογο: χρειάζεται μόνο στο κλικ και φέρνει τη ροή ανεβάσματος —
 * όριο στην κλειστότητα του route slice (ADR-744 · CHECK 3.34), όχι μεγαλύτερο ταβάνι.
 *
 * @module components/conveyance/my-cases/TransmitDocumentDialog
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/auth/hooks/useAuth';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import type { UploadEntryPoint } from '@/config/upload-entry-points/types';
import { useCaseDrafts } from '@/hooks/useCaseDrafts';
import { contributionEntryPointIds } from '@/lib/conveyance/contribution-policy';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type { ContributionRequest } from '@/services/conveyance/conveyance-engagement-gateway';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ChecklistRow } from '@/types/conveyance-case';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

interface TransmitDocumentDialogProps {
  /** Η γραμμή — `null` ⇒ κλειστός διάλογος. */
  readonly row: ChecklistRow | null;
  readonly caseId: string;
  readonly role: LegalProfessionalRole;
  readonly sending: boolean;
  readonly onCancel: () => void;
  readonly onSend: (request: ContributionRequest) => void;
}

interface TransmitFormProps extends Omit<TransmitDocumentDialogProps, 'row'> {
  readonly row: ChecklistRow;
  readonly uid: string;
  readonly entryPoint: UploadEntryPoint;
}

function TransmitForm({ row, caseId, uid, entryPoint, sending, onCancel, onSend }: TransmitFormProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const { drafts, upload, uploadDraft } = useCaseDrafts(caseId, uid, entryPoint);
  const [selected, setSelected] = useState<string | null>(null);

  const pick = (file: File) => { void uploadDraft(file).then((fileId) => { if (fileId) setSelected(fileId); }); };
  const send = () => { if (selected) onSend({ checklistItemId: row.itemId, entryPointId: entryPoint.id, fileId: selected }); };

  return (
    <>
      <section className="space-y-2" aria-labelledby="transmit-drafts">
        <h3 id="transmit-drafts" className="m-0 text-sm font-medium">{t('transmittal.dialog.drafts')}</h3>
        <p className={cn('m-0 text-xs', colors.text.muted)}>{t('transmittal.dialog.draftsHint')}</p>
        {drafts.length === 0
          ? <p className={cn('m-0 text-sm', colors.text.muted)}>{t('transmittal.dialog.noDrafts')}</p>
          : (
            <RadioGroup value={selected ?? ''} onValueChange={setSelected} disabled={sending}>
              {drafts.map((draft) => (
                <Label key={draft.fileId} className="flex items-center gap-2 text-sm font-normal">
                  <RadioGroupItem value={draft.fileId} />
                  <span className="truncate">{draft.displayName}</span>
                  {draft.createdAt && <span className={cn('text-xs', colors.text.muted)}>{formatDate(draft.createdAt)}</span>}
                </Label>
              ))}
            </RadioGroup>
          )}
        <FileUploadButton onFileSelect={pick} loading={upload.state === 'uploading'} buttonText={t('transmittal.dialog.upload')} />
        {upload.state === 'uploading' && <p className={cn('m-0 text-xs', colors.text.muted)} role="status">{t('transmittal.dialog.uploading', { name: upload.fileName })}</p>}
        {upload.state === 'failed' && <p className={cn('m-0 text-xs', colors.text.error)} role="alert">{t('transmittal.dialog.uploadFailed', { name: upload.fileName })}</p>}
      </section>
      <DialogActionFooter
        cancelLabel={t('transmittal.dialog.cancel')}
        confirmLabel={t('transmittal.dialog.send')}
        busyLabel={t('transmittal.dialog.sending')}
        onCancel={onCancel}
        onConfirm={send}
        isSubmitting={sending}
        canSubmit={selected !== null && upload.state !== 'uploading' && !sending}
      />
    </>
  );
}

export default function TransmitDocumentDialog(props: TransmitDocumentDialogProps) {
  const { t } = useTranslation(['conveyance']);
  const { user } = useAuth();
  const { row, onCancel } = props;
  const entryPointId = row ? contributionEntryPointIds(row.item)[0] : undefined;
  const entryPoint = entryPointId ? findEntryPoint(ENTITY_TYPES.CONVEYANCE_CASE, entryPointId) : undefined;
  if (row === null || !entryPoint || !user?.uid) return null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('transmittal.dialog.title', { item: t(row.item.labelKey) })}</DialogTitle>
          <DialogDescription>{t(`transmittal.audience.${props.role}`)}</DialogDescription>
        </DialogHeader>
        {/* `key` ⇒ άλλη γραμμή = νέα επιλογή, ποτέ η προηγούμενη. */}
        <TransmitForm key={row.itemId} {...props} row={row} uid={user.uid} entryPoint={entryPoint} />
      </DialogContent>
    </Dialog>
  );
}
