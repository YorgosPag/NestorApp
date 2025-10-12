"use client"

import * as React from "react"
import { useToast } from "@/hooks/useToast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastAction,
} from "@/components/ui/toast"
import type { ToastVariant } from "@/types/toast"

export function Toaster() {
  // ✅ ENTERPRISE: useToast doesn't provide toasts array, this component needs redesign
  // const toastHook = useToast();
  const toasts: Array<{
    id: string;
    title?: string;
    description?: string;
    action?: { label: string; onClick: () => void };
    variant?: ToastVariant;
    duration?: number;
  }> = []; // Empty for now - needs proper toast state management

  const getVariant = (variant?: ToastVariant): "default" | "destructive" => {
      if(variant === "error") return "destructive"
      return "default"
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} {...props} variant={getVariant(variant)} duration={props.duration}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action && <ToastAction altText={action.label} onClick={action.onClick}>{action.label}</ToastAction>}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
