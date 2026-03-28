/**
 * @file ConflictDialog — Version Conflict Resolution UI
 * @module components/shared/ConflictDialog
 *
 * 🏢 ENTERPRISE: SPEC-256A — Google-level conflict resolution dialog.
 *
 * Shown when a save fails with 409 VERSION_CONFLICT. Offers:
 * 1. "Ανανέωση δεδομένων" — reload page to get latest version
 * 2. "Αντικατάσταση" — force-write, overwriting the other user's changes
 * 3. Close — dismiss dialog (data remains unsaved until conflict is resolved)
 *
 * @see src/hooks/useVersionedSave.ts (triggers this dialog)
 * @see src/types/versioning.ts (ConflictResponseBody)
 */

'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ConflictResponseBody } from '@/types/versioning';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// ============================================
// TYPES
// ============================================

interface ConflictDialogProps {
  open: boolean;
  conflict: ConflictResponseBody | null;
  /** Reload the page/data to get the latest version */
  onReload: () => void;
  /** Force-save, overwriting the other user's changes */
  onForceSave: () => void;
  /** Dismiss the dialog without action */
  onClose: () => void;
}

// ============================================
// HELPERS
// ============================================

/**
 * Format an ISO timestamp as a relative "time ago" string.
 * Handles seconds, minutes, and hours.
 */
function formatTimeAgo(isoString: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return t('versioning.secondsAgo', { count: Math.max(1, seconds) });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('versioning.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  return t('versioning.hoursAgo', { count: hours });
}

// ============================================
// COMPONENT
// ============================================

export function ConflictDialog({
  open,
  conflict,
  onReload,
  onForceSave,
  onClose,
}: ConflictDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  if (!conflict) return null;

  const timeAgo = formatTimeAgo(conflict.updatedAt, t);

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className={iconSizes.md} />
            {t('versioning.conflictTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-3">
              <p>{t('versioning.conflictMessage')}</p>
              <p className={cn("text-sm", colors.text.muted)}>
                {t('versioning.lastChangedBy', {
                  user: conflict.updatedBy,
                  time: timeAgo,
                })}
              </p>
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel onClick={onClose}>
            {t('buttons.cancel')}
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onForceSave}
          >
            {t('versioning.forceSave')}
          </Button>
          <AlertDialogAction onClick={onReload} className="gap-1.5">
            <RefreshCw className={iconSizes.sm} />
            {t('versioning.reload')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
