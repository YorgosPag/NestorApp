import type { ToastOptions } from "@/types/toast"
// 🏢 ENTERPRISE: i18n support for toast titles
import i18n from '@/i18n/config';

/**
 * 🏢 ENTERPRISE: Get translated toast title
 * Uses i18n for internationalization support
 */
const getToastTitle = (key: 'success' | 'error' | 'warning' | 'info' | 'loading'): string => {
  return i18n.t(`toast.${key}`, { ns: 'common' });
};

export const toastPresets = {
  success: (message: string): ToastOptions => ({
    title: getToastTitle('success'),
    description: message,
    variant: "success",
  }),
  error: (message: string): ToastOptions => ({
    title: getToastTitle('error'),
    description: message,
    variant: "error",
  }),
  warning: (message: string): ToastOptions => ({
    title: getToastTitle('warning'),
    description: message,
    variant: "warning",
  }),
  info: (message: string): ToastOptions => ({
    title: getToastTitle('info'),
    description: message,
    variant: "info",
  }),
  loading: (message: string): ToastOptions => ({
    title: getToastTitle('loading'),
    description: message,
    variant: "loading"
  })
}
