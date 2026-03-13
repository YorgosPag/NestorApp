/**
 * 🛡️ DELETION BLOCKED DIALOG — Reusable UI for blocked deletions
 *
 * Shows when an entity cannot be deleted due to existing dependencies.
 * Single "Κατάλαβα" button — no destructive action available.
 *
 * @module components/shared/DeletionBlockedDialog
 * @enterprise ADR-226 — Deletion Guard (Phase 3)
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
} from '@/components/ui/alert-dialog';
import { ShieldAlert } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DependencyCheckResult } from '@/config/deletion-registry';

// ============================================================================
// TYPES
// ============================================================================

interface DeletionBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dependencies: DependencyCheckResult['dependencies'];
  message: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DeletionBlockedDialog({
  open,
  onOpenChange,
  dependencies,
  message,
}: DeletionBlockedDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className={iconSizes.md} />
            {t('deletionGuard.blocked')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-3">
              <p>{message}</p>

              {dependencies.length > 0 && (
                <>
                  <p className="font-medium text-foreground">
                    {t('deletionGuard.deleteFirst')}
                  </p>
                  <ul className="space-y-1.5">
                    {dependencies.map((dep) => (
                      <li
                        key={dep.collection}
                        className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">{dep.label}</span>
                        <span className="text-muted-foreground">
                          {t('deletionGuard.count', { count: dep.count })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>{t('deletionGuard.understood')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
