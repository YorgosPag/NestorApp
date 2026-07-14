'use client';

/**
 * ADR-651 Φάση Θ — lifecycle owner του διαλόγου **«Βιβλιοθήκη Προτύπων Πινακίδας»**.
 *
 * Mirror του `RevisionsHost` (Φάση Η): thin gate που ακούει το ribbon EventBus signal
 * (`dxf:title-block-library-dialog-requested`, από το κουμπί «Βιβλιοθήκη…» του contextual tab
 * «Πινακίδα Σχεδίου») και mount-άρει τον διάλογο ΜΟΝΟ όσο είναι ανοιχτός.
 *
 * ⚠️ Να μη συγχέεται με τον {@link TitleBlockLibraryHost}: εκείνος είναι ο **always-on**
 * feeder του store (ζωντανή συνδρομή στο master) — αυτός είναι μόνο το παράθυρο.
 *
 * @see ../ui/components/title-block/TitleBlockLibraryDialog.tsx — το σώμα του διαλόγου
 */

import * as React from 'react';

import { useEventGatedDialog } from './dialog-hosts/useEventGatedDialog';
import { TitleBlockLibraryDialog } from '../ui/components/title-block/TitleBlockLibraryDialog';

export interface TitleBlockLibraryDialogHostProps {
  /** Ενεργό έργο — χρειάζεται για τις παραλλαγές **έργου** (απόσπαση, project scope). */
  readonly projectId?: string;
}

export function TitleBlockLibraryDialogHost({
  projectId,
}: TitleBlockLibraryDialogHostProps): React.ReactElement | null {
  const { open, close } = useEventGatedDialog('dxf:title-block-library-dialog-requested');
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) close();
    },
    [close],
  );
  if (!open) return null;
  return <TitleBlockLibraryDialog open onOpenChange={handleOpenChange} projectId={projectId} />;
}
