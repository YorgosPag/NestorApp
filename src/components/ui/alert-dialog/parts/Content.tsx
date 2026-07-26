'use client';
import * as React from "react";
import { cn } from "@/lib/utils";
// ADR-711 — modal keyboard ownership + focus restore (κοινό με το dialog.tsx).
import { ModalKeyboardScope } from '@/lib/a11y/use-modal-keyboard-scope';
import { useDialogFocusRestore } from '@/lib/a11y/use-dialog-focus-restore';
import { contentBase } from "../constants";
import { AlertDialogPortal } from "../primitives";
import { PrimitiveContent } from "../primitives";
import { AlertDialogOverlay } from "./Overlay";
import '@/lib/design-system';

export const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof PrimitiveContent>,
  React.ComponentPropsWithoutRef<typeof PrimitiveContent>
>(({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const autoFocusHandlers = useDialogFocusRestore({ onOpenAutoFocus, onCloseAutoFocus });

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <PrimitiveContent
        ref={ref}
        className={cn(contentBase, className)}
        {...props}
        {...autoFocusHandlers}
      >
        <ModalKeyboardScope />
        {children}
      </PrimitiveContent>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = PrimitiveContent.displayName;
