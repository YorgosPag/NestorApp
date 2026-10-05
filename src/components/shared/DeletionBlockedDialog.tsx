/**
 * 🛡️ DELETION BLOCKED DIALOG — Reusable UI for blocked deletions
 *
 * Shows when an entity cannot be deleted due to existing dependencies.
 * "Κατάλαβα" κλείνει· καμία καταστροφική ενέργεια δεν προσφέρεται.
 *
 * Προαιρετική **έξοδος** (`escape`, ADR-329 §3.9): όταν η οντότητα έχει αρχείο και ο
 * διακομιστής το προσφέρει, ο διάλογος δείχνει «Αρχειοθέτηση αντί για διαγραφή». Ο ίδιος
 * διάλογος, όχι δεύτερος: ο άνθρωπος βλέπει ΤΙ το κρατά και ΠΩΣ φεύγει, στο ίδιο σημείο.
 *
 * @module components/shared/DeletionBlockedDialog
 * @enterprise ADR-226 — Deletion Guard (Phase 3)
 */

'use client';

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Archive, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DependencyCheckResult } from '@/config/deletion-registry';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

/** Η μη καταστροφική έξοδος από ένα μπλοκάρισμα — κείμενα και πράξη τα δίνει ο καλών. */
export interface DeletionBlockedEscape {
  readonly label: string;
  readonly hint: string;
  /** True όσο η πράξη είναι σε πτήση — το κουμπί κλειδώνει, ο διάλογος μένει. */
  readonly pending: boolean;
  readonly onAction: () => void;
}

interface DeletionBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dependencies: DependencyCheckResult['dependencies'];
  message: string;
  /** Optional entity subtype for type-specific messaging (e.g., individual/company/service) */
  entitySubtype?: string;
  /** Απόν ⇒ ο διάλογος είναι όπως πάντα: μόνο «Κατάλαβα». */
  escape?: DeletionBlockedEscape;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DeletionBlockedDialog({
  open,
  onOpenChange,
  dependencies,
  message,
  entitySubtype,
  escape,
}: DeletionBlockedDialogProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

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
              {entitySubtype && (
                <p className="font-medium text-foreground">
                  {t(`deletionGuard.subtypeWarning.${entitySubtype}`, { defaultValue: '' })}
                </p>
              )}
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
                        className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">{dep.label}</span>
                          <span className={colors.text.muted}>
                            {dep.count >= 0
                              ? t('deletionGuard.count', { count: dep.count })
                              : t('deletionGuard.unavailableCount')}
                          </span>
                        </div>
                        {dep.remediation && (
                          <p className={"mt-1 text-xs " + colors.text.muted}>
                            {dep.remediation}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {escape && <p className="text-foreground">{escape.hint}</p>}
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {escape && (
            <Button variant="outline" onClick={escape.onAction} disabled={escape.pending}>
              <Archive className={iconSizes.sm} />
              {escape.label}
            </Button>
          )}
          <AlertDialogAction>{t('deletionGuard.understood')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
