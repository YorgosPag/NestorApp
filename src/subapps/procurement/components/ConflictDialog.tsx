'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/intl-formatting';
import type { ConflictError, ConflictType } from '@/subapps/procurement/services/quote-versioning-service';

interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: ConflictError | null;
  /**
   * Optional context for the AWARD_CONFLICT message. Other conflict types use
   * a generic body that does not reference vendor names.
   */
  awardContext?: {
    attemptedVendorName: string | null;
    actualVendorName: string | null;
  };
  /** Closes the dialog. UI already shows the remote state via onSnapshot. */
  onAcceptRemote: () => void;
  /**
   * Re-runs the original transaction with the **current** version (will succeed
   * because it is no longer stale). The previous winner / state is overwritten.
   */
  onKeepMine: () => Promise<void>;
}

const TITLE_KEY_BY_TYPE: Record<ConflictType, string> = {
  AWARD_CONFLICT: 'rfqs.conflict.award.title',
  PO_CREATE_CONFLICT: 'rfqs.conflict.poCreate.title',
  LINE_EDIT_CONFLICT: 'rfqs.conflict.lineEdit.title',
  STATUS_CHANGE_CONFLICT: 'rfqs.conflict.statusChange.title',
};

export function ConflictDialog({
  open,
  onOpenChange,
  conflict,
  awardContext,
  onAcceptRemote,
  onKeepMine,
}: ConflictDialogProps) {
  const { t } = useTranslation('quotes');
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const conflictType = conflict?.conflictType ?? 'AWARD_CONFLICT';

  const ago = useMemo(() => {
    if (!conflict?.actorTime) return '';
    const ms = conflict.actorTime.toMillis?.();
    return typeof ms === 'number' ? formatRelativeTime(ms) : '';
  }, [conflict]);

  const titleKey = TITLE_KEY_BY_TYPE[conflictType];

  const body = useMemo(() => {
    if (conflictType === 'AWARD_CONFLICT' && awardContext) {
      return t('rfqs.conflict.award.body', {
        defaultValue: '',
        actor: conflict?.actor ?? '—',
        actualVendor: awardContext.actualVendorName ?? '—',
        attemptedVendor: awardContext.attemptedVendorName ?? '—',
        ago,
      });
    }
    return t('rfqs.conflict.generic.body', {
      defaultValue: '',
      actor: conflict?.actor ?? '—',
      ago,
    });
  }, [t, conflictType, awardContext, conflict, ago]);

  const acceptLabel = t('rfqs.conflict.action.acceptRemote', {
    defaultValue: '',
    actor: conflict?.actor ?? '—',
  });
  const keepLabel = t('rfqs.conflict.action.keepMine', { defaultValue: '' });

  const handleAccept = () => {
    onAcceptRemote();
    onOpenChange(false);
  };

  const handleKeep = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await onKeepMine();
      onOpenChange(false);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" aria-hidden="true" />
            {t(titleKey, { defaultValue: '' })}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-line">{body}</DialogDescription>
        </DialogHeader>

        {retryError ? (
          <p role="alert" className="text-sm text-red-600">
            {retryError}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={handleAccept} disabled={retrying}>
            {acceptLabel}
          </Button>
          <Button variant="default" onClick={handleKeep} disabled={retrying}>
            {keepLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
