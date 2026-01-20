/**
 * =============================================================================
 * 🏢 ENTERPRISE: Centralized Confirm Dialog Component
 * =============================================================================
 *
 * Single Source of Truth for confirmation dialogs across the application.
 * Eliminates code duplication (6 instances → 1 component).
 *
 * @module components/ui/ConfirmDialog
 * @enterprise ADR-003 - Centralized Confirmation Dialogs
 *
 * Features:
 * - i18n support (Ελληνικά/Αγγλικά)
 * - Centralized design tokens (no inline styles)
 * - Semantic HTML structure
 * - Accessible (WAI-ARIA via Radix)
 * - Destructive action styling
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   title={t('delete.title')}
 *   description={t('delete.description')}
 *   onConfirm={handleDelete}
 *   variant="destructive"
 * />
 * ```
 */

'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// TYPES
// ============================================================================

export type ConfirmDialogVariant = 'default' | 'destructive' | 'warning';

export interface ConfirmDialogProps {
  /** Dialog open state */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description/message */
  description: string | React.ReactNode;
  /** Callback when user confirms */
  onConfirm: () => void | Promise<void>;
  /** Callback when user cancels (optional) */
  onCancel?: () => void;
  /** Confirm button text (defaults to i18n 'buttons.confirm') */
  confirmText?: string;
  /** Cancel button text (defaults to i18n 'buttons.cancel') */
  cancelText?: string;
  /** Visual variant affecting confirm button styling */
  variant?: ConfirmDialogVariant;
  /** Show loading state on confirm button */
  loading?: boolean;
  /** Disable confirm button */
  disabled?: boolean;
  /** Custom icon for title (optional) */
  icon?: React.ReactNode;
  /** Additional content between description and footer (optional) */
  children?: React.ReactNode;
}

// ============================================================================
// VARIANT STYLES (Centralized - no inline styles)
// ============================================================================

const VARIANT_STYLES: Record<ConfirmDialogVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  warning: 'bg-yellow-600 text-white hover:bg-yellow-600/90',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized Confirmation Dialog
 *
 * Replaces all ad-hoc AlertDialog implementations with a single,
 * reusable, enterprise-grade component.
 *
 * Patterns from: SAP Fiori, Salesforce Lightning, Microsoft Fluent UI
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  variant = 'default',
  loading = false,
  disabled = false,
  icon,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  // Default button texts from i18n
  const resolvedConfirmText = confirmText || t('buttons.confirm', 'Confirm');
  const resolvedCancelText = cancelText || t('buttons.cancel', 'Cancel');

  // Handle confirm with loading support
  const handleConfirm = async () => {
    await onConfirm();
  };

  // Handle cancel
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {icon}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild={typeof description !== 'string'}>
            {typeof description === 'string' ? (
              description
            ) : (
              <div className="text-sm text-muted-foreground">
                {description}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Optional additional content */}
        {children}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {resolvedCancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={disabled || loading}
            className={cn(VARIANT_STYLES[variant])}
          >
            {loading ? (
              <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
            ) : (
              resolvedConfirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// SPECIALIZED VARIANTS (Enterprise Convenience Functions)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Delete Confirmation Dialog
 *
 * Pre-configured for destructive delete actions.
 * Uses red destructive styling by default.
 */
export function DeleteConfirmDialog(
  props: Omit<ConfirmDialogProps, 'variant'> & { variant?: ConfirmDialogVariant }
) {
  const { t } = useTranslation('common');

  return (
    <ConfirmDialog
      {...props}
      variant={props.variant || 'destructive'}
      confirmText={props.confirmText || t('buttons.delete', 'Delete')}
    />
  );
}

/**
 * 🏢 ENTERPRISE: Warning Confirmation Dialog
 *
 * Pre-configured for warning actions (unlink, archive, etc.)
 * Uses yellow warning styling by default.
 */
export function WarningConfirmDialog(
  props: Omit<ConfirmDialogProps, 'variant'> & { variant?: ConfirmDialogVariant }
) {
  return (
    <ConfirmDialog
      {...props}
      variant={props.variant || 'warning'}
    />
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ConfirmDialog;
