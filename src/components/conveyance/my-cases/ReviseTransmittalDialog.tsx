'use client';

/**
 * =============================================================================
 * «Νέα έκδοση» — ο δρόμος που ΓΕΝΝΑ τη v2 ενός σταλμένου εγγράφου (ADR-901 Φ4.5 · §14.6)
 * =============================================================================
 *
 * Ένα βήμα για τον άνθρωπο, τρία για το σύστημα, **με σειρά και await**:
 *   1. ανέβασμα στον δικό του χώρο, από το entry point **με τον σκοπό του σταλμένου** (`revisionEntryPoint`) — ίδια θέση
 *   2. διαδοχή μέσω της **ΜΙΑΣ** πόρτας (`supersedeFileRecord` → `transitionContainer`) — ο server αποδεικνύει
 *   3. «Στείλε στους ίδιους» (`reissue`) — ο server διαλέγει την κεφαλή της στοίβας, CAS στην προηγούμενη
 *
 * 🌐 Autodesk Docs: «Upload new version» και μετά νέο transmittal· Aconex: «Supersede» και μετά «Transmit». Δύο ροές,
 *    δύο φορές η επιλογή παραληπτών. 🏆 Εδώ: **μία**, χωρίς πεδίο παραληπτών — τους ορίζει η προηγούμενη αποστολή.
 *
 * 🛡️ Belt-and-suspenders: αν το 3 αποτύχει, η στοίβα έχει ήδη νεότερη ⇒ η γραμμή δείχνει μόνη της «Στείλε τη νέα
 *    έκδοση» (το υπάρχον κουμπί) — καμία κατάσταση δεν χάνεται. Αν ο κριτής αρνηθεί το 2, το αρχείο μένει πρόχειρο και
 *    η άρνηση λέγεται **με όνομα** (`useSupersessionNotice`) — **δεν** στέλνεται τίποτα.
 *
 * Φορτώνεται **δυναμικά** (όπως το `TransmitDocumentDialog`): φέρνει τη ροή ανεβάσματος — όριο κλειστότητας (ADR-744).
 *
 * @module components/conveyance/my-cases/ReviseTransmittalDialog
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { useAuth } from '@/auth/hooks/useAuth';
import type { UploadEntryPoint } from '@/config/upload-entry-points/types';
import { useSupersessionNotice } from '@/hooks/files/useSupersessionNotice';
import { useCaseDraftUpload } from '@/hooks/useCaseDrafts';
import { revisionEntryPoint } from '@/lib/conveyance/contribution-revision';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { RevisionTarget } from '@/components/sales/conveyance/ConveyanceRowTransmittal';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

interface ReviseTransmittalDialogProps {
  /** `null` ⇒ κλειστός διάλογος. */
  readonly target: RevisionTarget | null;
  readonly caseId: string;
  readonly role: LegalProfessionalRole;
  readonly onCancel: () => void;
  /** Η διαδοχή γράφτηκε — στείλε στους ίδιους (η υπάρχουσα `reissue`, με τα δικά της μηνύματα). */
  readonly onRevised: (contributionId: string) => Promise<void>;
}

interface ReviseFormProps extends Omit<ReviseTransmittalDialogProps, 'target' | 'role'> {
  readonly contributionId: string;
  readonly predecessorFileId: string;
  readonly uid: string;
  readonly entryPoint: UploadEntryPoint;
}

/** Η επιλογή αρχείου — το ΕΝΑ κουμπί ανεβάσματος (ADR-054, με κεντρικό έλεγχο αρχείου) + τι διαλέχτηκε. */
function FilePick({ picked, disabled, onPick }: { readonly picked: File | null; readonly disabled: boolean; readonly onPick: (file: File) => void }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <section className="space-y-2" aria-live="polite">
      <FileUploadButton onFileSelect={onPick} disabled={disabled} buttonText={t('transmittal.revise.pick')} />
      {picked && <p className={cn('m-0 truncate text-sm', colors.text.secondary)}>{t('transmittal.revise.picked', { name: picked.name })}</p>}
    </section>
  );
}

function ReviseForm({ caseId, contributionId, predecessorFileId, uid, entryPoint, onCancel, onRevised }: ReviseFormProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const noticeSupersession = useSupersessionNotice();
  const { upload, uploadVersion } = useCaseDraftUpload(caseId, uid, entryPoint);
  const [picked, setPicked] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!picked) return;
    setBusy(true);
    const outcome = await uploadVersion(picked, predecessorFileId);
    // Αποτυχία ανεβάσματος ⇒ ο διάλογος μένει ανοιχτός με το μήνυμα, για νέα δοκιμή.
    if (outcome.kind === 'upload-failed') { setBusy(false); return; }
    noticeSupersession(outcome.succession);
    const linked = outcome.succession.kind === 'superseded' || outcome.succession.kind === 'noop';
    if (linked) await onRevised(contributionId);
    onCancel();
  };

  return (
    <>
      <FilePick picked={picked} disabled={busy} onPick={setPicked} />
      {upload.state === 'failed' && <p className={cn('m-0 text-xs', colors.text.error)} role="alert">{t('transmittal.dialog.uploadFailed', { name: upload.fileName })}</p>}
      <DialogActionFooter
        cancelLabel={t('transmittal.dialog.cancel')}
        confirmLabel={t('transmittal.revise.confirm')}
        busyLabel={t('transmittal.revise.busy')}
        onCancel={onCancel}
        onConfirm={() => { void confirm(); }}
        isSubmitting={busy}
        canSubmit={picked !== null && !busy}
      />
    </>
  );
}

export default function ReviseTransmittalDialog({ target, caseId, role, onCancel, onRevised }: ReviseTransmittalDialogProps) {
  const { t } = useTranslation(['conveyance']);
  const { user } = useAuth();
  if (target === null || target.file.source.kind !== 'transmittal' || !user?.uid) return null;
  const entryPoint = revisionEntryPoint(target.row.item, target.file.purpose);
  if (!entryPoint) return null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('transmittal.revise.title', { name: target.file.displayName })}</DialogTitle>
          <DialogDescription>{t('transmittal.revise.description')} {t(`transmittal.audience.${role}`)}</DialogDescription>
        </DialogHeader>
        {/* `key` ⇒ άλλο σταλμένο = καθαρή επιλογή, ποτέ το προηγούμενο αρχείο. */}
        <ReviseForm
          key={target.file.source.contributionId}
          caseId={caseId}
          contributionId={target.file.source.contributionId}
          predecessorFileId={target.file.fileId}
          uid={user.uid}
          entryPoint={entryPoint}
          onCancel={onCancel}
          onRevised={onRevised}
        />
      </DialogContent>
    </Dialog>
  );
}
