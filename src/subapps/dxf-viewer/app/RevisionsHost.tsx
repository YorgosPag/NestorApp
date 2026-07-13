'use client';

/**
 * ADR-651 Φάση Η — lifecycle owner του διαλόγου **«Αναθεωρήσεις»**.
 *
 * Mirror του `AiTitleBlockHost`/`StampHost`: thin gate που ακούει το ribbon EventBus signal
 * (`dxf:revisions-dialog-requested`, από το κουμπί «Αναθεωρήσεις…» του contextual tab
 * «Πινακίδα Σχεδίου») και mount-άρει τον διάλογο ΜΟΝΟ όσο είναι ανοιχτός.
 *
 * Mounted ως `React.Suspense` leaf στο `DxfViewerDialogs`. ADR-040: μηδέν canvas
 * subscriptions, μηδέν `useSyncExternalStore`.
 *
 * @see ../ui/components/title-block/RevisionsDialog.tsx — το σώμα του διαλόγου
 */

import * as React from 'react';

import { useEventGatedDialog } from './dialog-hosts/useEventGatedDialog';
import { RevisionsDialog } from '../ui/components/title-block/RevisionsDialog';

export interface RevisionsHostProps {
  /** Ενεργό έργο — η ιστορία αναθεωρήσεων είναι **ανά έργο** (Revit Sheet Issues/Revisions). */
  readonly projectId?: string;
}

export function RevisionsHost({ projectId }: RevisionsHostProps): React.ReactElement | null {
  const { open, close } = useEventGatedDialog('dxf:revisions-dialog-requested');
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) close();
    },
    [close],
  );
  if (!open) return null;
  return <RevisionsDialog open onOpenChange={handleOpenChange} projectId={projectId} />;
}
