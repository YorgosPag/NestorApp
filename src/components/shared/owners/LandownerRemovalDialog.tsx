/**
 * 🛡️ Landowner Removal Dialog — 3-variant safety dialog
 *
 * - confirm: Simple confirmation, no dependencies
 * - warning: Non-blocking dependencies (ownership table), user can proceed
 * - blocked: Blocking dependencies (properties, parking, storage), user must fix first
 *
 * Uses AlertDialog primitives (same pattern as DeletionBlockedDialog).
 *
 * @module components/shared/owners/LandownerRemovalDialog
 * @enterprise ADR-244 — Landowner Safety Guard
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
import { ShieldAlert, AlertTriangle, UserMinus } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { UnlinkDependency } from '@/lib/firestore/landowner-unlink-guard.types';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface LandownerRemovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'confirm' | 'warning' | 'blocked';
  contactName: string;
  blockingDeps: UnlinkDependency[];
  warningDeps: UnlinkDependency[];
  onConfirm: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LandownerRemovalDialog({
  open,
  onOpenChange,
  variant,
  contactName,
  blockingDeps,
  warningDeps,
  onConfirm,
}: LandownerRemovalDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const rg = (key: string, params?: Record<string, string | number>) =>
    t(`ownership.landownersTab.removalGuard.${key}`, params);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={getTitleClasses(variant)}>
            {getIcon(variant, iconSizes.md)}
            {getTitle(variant, rg)}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-3">
              <p>{getBodyText(variant, contactName, rg)}</p>

              {/* Dependencies list */}
              {(variant === 'warning' || variant === 'blocked') && (
                <DependencyList
                  deps={variant === 'blocked' ? blockingDeps : warningDeps}
                  colors={colors}
                  rg={rg}
                />
              )}

              {/* Warning note about ownership table */}
              {variant === 'warning' && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {rg('warningNote')}
                </p>
              )}
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {variant === 'blocked' ? (
            <AlertDialogAction>{rg('understood')}</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel>{rg('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                className={variant === 'warning'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                }
              >
                {variant === 'warning' ? rg('confirmRemoveAnyway') : rg('confirmRemove')}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

function getTitleClasses(variant: string): string {
  switch (variant) {
    case 'blocked': return 'flex items-center gap-2 text-destructive';
    case 'warning': return 'flex items-center gap-2 text-amber-600 dark:text-amber-400';
    default: return 'flex items-center gap-2';
  }
}

function getIcon(variant: string, sizeClass: string): React.ReactNode {
  switch (variant) {
    case 'blocked': return <ShieldAlert className={sizeClass} />;
    case 'warning': return <AlertTriangle className={sizeClass} />;
    default: return <UserMinus className={sizeClass} />;
  }
}

function getTitle(
  variant: string,
  rg: (key: string) => string
): string {
  switch (variant) {
    case 'blocked': return rg('blockedTitle');
    case 'warning': return rg('warningTitle');
    default: return rg('confirmTitle');
  }
}

function getBodyText(
  variant: string,
  contactName: string,
  rg: (key: string, params?: Record<string, string | number>) => string
): string {
  switch (variant) {
    case 'blocked': return rg('blockedBody', { name: contactName });
    case 'warning': return rg('warningBody', { name: contactName });
    default: return rg('confirmBody', { name: contactName });
  }
}

/** Renders the dependency list (shared between warning and blocked) */
function DependencyList({
  deps,
  colors,
  rg,
}: {
  deps: UnlinkDependency[];
  colors: ReturnType<typeof useSemanticColors>;
  rg: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (deps.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {deps.map((dep) => (
        <li
          key={dep.collection}
          className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
        >
          <span className="font-medium text-foreground">{dep.label}</span>
          <span className={colors.text.muted}>
            {rg('count', { count: dep.count })}
          </span>
        </li>
      ))}
    </ul>
  );
}
