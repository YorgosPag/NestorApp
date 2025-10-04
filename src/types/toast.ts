export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading'
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
  position?: ToastPosition
  action?: {
    label: string
    onClick: () => void
  }
}

export interface Toast extends ToastOptions {
  id: string
  createdAt: Date
  open: boolean
  onOpenChange: (open: boolean) => void
}
