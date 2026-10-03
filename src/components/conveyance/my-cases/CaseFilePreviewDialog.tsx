'use client';

/**
 * ADR-901 Φ4 — η **προεπισκόπηση** ενός τεκμηρίου της υπόθεσης, πάνω στον ΕΝΑΝ renderer προεπισκόπησης
 * (`FilePreviewRenderer`, ίδιος με τη διαχείριση αρχείων και τη σελίδα κοινόχρηστου αρχείου).
 *
 * ⚠️ **Χωρίς `fileId` στον renderer**: η προεπισκόπηση Excel ζητά `/api/files/[id]/excel-preview`, που φυλάει
 *    **μισθωτή**, και ο επαγγελματίας δεν είναι μέλος. Ο υπογεγραμμένος σύνδεσμος αρκεί για PDF/εικόνα/κείμενο·
 *    τα υπόλοιπα δείχνουν «Λήψη».
 * Φορτώνεται **δυναμικά** από τη σελίδα υπόθεσης: ο renderer είναι βαρύς και χρειάζεται μόνο στο κλικ.
 *
 * @module components/conveyance/my-cases/CaseFilePreviewDialog
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FilePreviewRenderer } from '@/components/shared/files/preview/FilePreviewRenderer';
import type { CaseFileLink } from '@/services/conveyance/conveyance-engagement-gateway';

interface CaseFilePreviewDialogProps {
  readonly preview: CaseFileLink | null;
  readonly onClose: () => void;
  readonly onDownload: () => void;
}

export default function CaseFilePreviewDialog({ preview, onClose, onDownload }: CaseFilePreviewDialogProps) {
  const { t } = useTranslation(['conveyance']);
  if (preview === null) return null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{preview.fileName}</DialogTitle>
          <DialogDescription>{t('files.previewNotice')}</DialogDescription>
        </DialogHeader>
        <figure className="m-0 flex max-h-[75vh] min-h-[400px] flex-col overflow-hidden rounded-md border">
          <FilePreviewRenderer
            url={preview.url}
            contentType={preview.contentType}
            fileName={preview.fileName}
            displayName={preview.fileName}
            onDownload={onDownload}
          />
        </figure>
      </DialogContent>
    </Dialog>
  );
}
