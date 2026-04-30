'use client';

/**
 * PropertyDeletionGuardDialog — Restrict-or-archive modal (ADR-329 §3.9)
 *
 * Shown when the user attempts to delete a property that is referenced by
 * BOQ items. Displays a status-grouped breakdown and offers a soft-archive
 * action. Hard-delete is blocked at this layer; the service layer enforces
 * the same rule as defense-in-depth.
 *
 * @module components/properties/dialogs/PropertyDeletionGuardDialog
 * @see ADR-329 §3.9
 */

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyDeletionReport } from '@/services/property/property-deletion-guard';

interface PropertyDeletionGuardDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  propertyName: string;
  report: PropertyDeletionReport;
  onArchive: () => Promise<void>;
  onViewTasks?: () => void;
}

export function PropertyDeletionGuardDialog({
  open, onOpenChange, propertyName, report, onArchive, onViewTasks,
}: PropertyDeletionGuardDialogProps) {
  const { t } = useTranslation(['properties']);
  const [archiving, setArchiving] = useState(false);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await onArchive();
      onOpenChange(false);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deletion.blockedTitle', { propertyName })}</DialogTitle>
          <DialogDescription>
            {t('deletion.blockedBody', { count: report.totalRefs })}
          </DialogDescription>
        </DialogHeader>

        <ul className="my-2 list-disc pl-5 text-sm text-muted-foreground">
          {report.draftRefs > 0 && <li>{t('deletion.draftRefs', { count: report.draftRefs })}</li>}
          {report.submittedRefs > 0 && <li>{t('deletion.submittedRefs', { count: report.submittedRefs })}</li>}
          {report.lockedRefs > 0 && <li>{t('deletion.lockedRefs', { count: report.lockedRefs })}</li>}
        </ul>

        {onViewTasks && (
          <Button variant="link" size="sm" className="self-start px-0" onClick={onViewTasks}>
            {t('deletion.viewTasksLink')}
          </Button>
        )}

        <p className="text-sm text-muted-foreground">{t('deletion.archiveOption')}</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={archiving}>
            {t('deletion.cancel')}
          </Button>
          <Button onClick={() => void handleArchive()} disabled={archiving}>
            {t('deletion.archiveButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
