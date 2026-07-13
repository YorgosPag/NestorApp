'use client';

/**
 * ADR-651 Φάση Ε — lifecycle owner του διαλόγου **σφραγίδας μηχανικού**.
 *
 * Mirror του `ExportHost` (ADR-505): thin gate που ακούει το ribbon EventBus signal
 * (`dxf:stamp-dialog-requested`, εκπέμπεται από το κουμπί «Σφραγίδα…» του contextual tab
 * «Πινακίδα Σχεδίου») και mount-άρει τον διάλογο ΜΟΝΟ όσο είναι ανοιχτός.
 *
 * Mounted ως `React.Suspense` leaf στο `DxfViewerDialogs`. ADR-040: μηδέν canvas
 * subscriptions, μηδέν `useSyncExternalStore`.
 *
 * @see ../ui/components/title-block/EngineerStampDialog.tsx — το σώμα του διαλόγου
 */

import * as React from 'react';

import { useEventGatedDialog } from './dialog-hosts/useEventGatedDialog';
import { EngineerStampDialog } from '../ui/components/title-block/EngineerStampDialog';

export function StampHost(): React.ReactElement | null {
  const { open, close } = useEventGatedDialog('dxf:stamp-dialog-requested');
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) close();
    },
    [close],
  );
  if (!open) return null;
  return <EngineerStampDialog open onOpenChange={handleOpenChange} />;
}
