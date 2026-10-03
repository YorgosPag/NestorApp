'use client';

/**
 * ADR-901 Φ4 · Φ4.4 — **άνοιγμα τεκμηρίου από τον κατάλογο**, για **τις δύο** όψεις: τον επαγγελματία (μέσω της
 * συμμετοχής του) και τον οικοδεσπότη (μέσω της υπόθεσής του — και ό,τι του στάλθηκε). Μία συμπεριφορά: προβολή σε
 * διάλογο · λήψη με το ανθρώπινο όνομα · μήνυμα όταν το αρχείο δεν είναι διαθέσιμο.
 *
 * @module components/conveyance/shared/CaseFileOpening
 */

import React, { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCaseFileOpener, type CaseFileTarget } from '@/hooks/useCaseFileOpener';
import type { CaseFileMode } from '@/lib/conveyance/case-activity';
import { useNotifications } from '@/providers/NotificationProvider';
import type { EvidenceFile } from '@/types/conveyance-case';

/** Ο προεπισκοπητής φορτώνεται **μόνο** στο κλικ: είναι βαρύς και δεν ανήκει στο πρώτο καρέ (ADR-744). */
const CaseFilePreviewDialog = dynamic(() => import('@/components/conveyance/my-cases/CaseFilePreviewDialog'), { ssr: false });

export interface CaseFileOpening {
  readonly openFile: (file: EvidenceFile, mode: CaseFileMode) => void;
  /** Ο διάλογος προεπισκόπησης — τοποθετείται μία φορά από την όψη. */
  readonly previewDialog: React.ReactElement;
}

export function useCaseFileOpening(target: CaseFileTarget): CaseFileOpening {
  const { t } = useTranslation(['conveyance']);
  const { error: notifyError } = useNotifications();
  const opener = useCaseFileOpener(target);
  const openFile = useCallback((file: EvidenceFile, mode: CaseFileMode) => {
    void opener.open(file, mode).then((outcome) => { if (outcome === 'unavailable') notifyError(t('files.unavailable')); });
  }, [notifyError, opener, t]);
  const downloadPreviewed = useCallback(() => {
    if (opener.preview) openFile(opener.preview.file, 'download');
  }, [openFile, opener.preview]);
  const previewDialog = useMemo(
    () => <CaseFilePreviewDialog preview={opener.preview?.link ?? null} onClose={opener.closePreview} onDownload={downloadPreviewed} />,
    [downloadPreviewed, opener.closePreview, opener.preview],
  );
  return { openFile, previewDialog };
}
