'use client';

/**
 * ADR-651 Φάση Δ — lifecycle owner του διαλόγου **«AI Πινακίδα»**.
 *
 * Mirror του `StampHost`/`ExportHost`: thin gate που ακούει το ribbon EventBus signal
 * (`dxf:ai-title-block-dialog-requested`, από το κουμπί «AI Πινακίδα…» του contextual tab
 * «Πινακίδα Σχεδίου») και mount-άρει τον διάλογο ΜΟΝΟ όσο είναι ανοιχτός.
 *
 * Mounted ως `React.Suspense` leaf στο `DxfViewerDialogs`. ADR-040: μηδέν canvas
 * subscriptions, μηδέν `useSyncExternalStore`.
 *
 * @see ../ui/components/title-block/AiTitleBlockDialog.tsx — το σώμα του διαλόγου
 */

import * as React from 'react';

import { useEventGatedDialog } from './dialog-hosts/useEventGatedDialog';
import { AiTitleBlockDialog } from '../ui/components/title-block/AiTitleBlockDialog';

export interface AiTitleBlockHostProps {
  /** Ενεργό έργο — τροφοδοτεί το zero-config auto-fill (preview + AI compliance). */
  readonly projectId?: string;
}

export function AiTitleBlockHost({ projectId }: AiTitleBlockHostProps): React.ReactElement | null {
  const { open, close } = useEventGatedDialog('dxf:ai-title-block-dialog-requested');
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) close();
    },
    [close],
  );
  if (!open) return null;
  return <AiTitleBlockDialog open onOpenChange={handleOpenChange} projectId={projectId} />;
}
