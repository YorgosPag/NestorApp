import React, { useState, useCallback } from 'react';
import type { ConfirmDialogVariant, ConfirmDialogProps } from '@/components/ui/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  description: string | React.ReactNode;
  variant?: ConfirmDialogVariant;
  confirmText?: string;
  cancelText?: string;
  hideCancelButton?: boolean;
}

interface UseConfirmDialogReturn {
  /** Call to open the dialog and await user decision. Resolves true on confirm, false on cancel. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Spread these onto <ConfirmDialog {...dialogProps} /> in your JSX */
  dialogProps: Pick<
    ConfirmDialogProps,
    'open' | 'onOpenChange' | 'title' | 'description' | 'variant' | 'confirmText' | 'cancelText' | 'hideCancelButton' | 'onConfirm'
  >;
}

/**
 * Centralized hook that replaces window.confirm() with the enterprise ConfirmDialog.
 * Returns a promise-based `confirm()` and `dialogProps` to spread on <ConfirmDialog />.
 *
 * @example
 * ```tsx
 * const { confirm, dialogProps } = useConfirmDialog();
 *
 * const handleDelete = async () => {
 *   const ok = await confirm({
 *     title: t('delete.title'),
 *     description: t('delete.description'),
 *     variant: 'destructive',
 *   });
 *   if (ok) { // proceed with delete }
 * };
 *
 * return <><ConfirmDialog {...dialogProps} /></>;
 * ```
 */
export function useConfirmDialog(): UseConfirmDialogReturn {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    description: '',
  });
  const [resolveRef, setResolveRef] = useState<{
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);

    return new Promise<boolean>((resolve) => {
      setResolveRef({ resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolveRef?.resolve(true);
    setResolveRef(null);
  }, [resolveRef]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        resolveRef?.resolve(false);
        setResolveRef(null);
      }
    },
    [resolveRef]
  );

  const dialogProps: UseConfirmDialogReturn['dialogProps'] = {
    open,
    onOpenChange: handleOpenChange,
    title: options.title,
    description: options.description,
    variant: options.variant,
    confirmText: options.confirmText,
    cancelText: options.cancelText,
    hideCancelButton: options.hideCancelButton,
    onConfirm: handleConfirm,
  };

  return { confirm, dialogProps };
}
