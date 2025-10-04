import type { ToastOptions } from "@/types/toast"

export const toastPresets = {
  success: (message: string): ToastOptions => ({
    title: "Επιτυχία",
    description: message,
    variant: "success",
  }),
  error: (message: string): ToastOptions => ({
    title: "Σφάλμα",
    description: message,
    variant: "error",
  }),
  warning: (message: string): ToastOptions => ({
    title: "Προειδοποίηση",
    description: message,
    variant: "warning",
  }),
  info: (message: string): ToastOptions => ({
    title: "Ενημέρωση",
    description: message,
    variant: "info",
  }),
  loading: (message: string): ToastOptions => ({
      title: "Φόρτωση...",
      description: message,
      variant: "loading"
  })
}
