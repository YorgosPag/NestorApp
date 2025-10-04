/**
 * Migration hook for legacy toast usage
 * Provides backward compatibility while migrating to unified notification system
 * @deprecated Use useNotifications instead
 */

'use client';

import { useNotifications } from '../providers/NotificationProvider';
import { notificationService } from '@/services/notification.service';

/**
 * Legacy toast interface for backward compatibility
 * @deprecated Use useNotifications instead
 */
export interface LegacyToast {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  loading: (message: string) => string;
  dismiss: (id?: string) => void;
}

/**
 * Backward compatibility hook
 * @deprecated Use useNotifications instead
 */
export function useToast(): LegacyToast {
  const notifications = useNotifications();

  // Set service handler for non-React contexts
  if (typeof window !== 'undefined') {
    notificationService.setHandler(notifications);
  }

  return {
    success: notifications.success,
    error: notifications.error,
    warning: notifications.warning,
    info: notifications.info,
    loading: notifications.loading,
    dismiss: notifications.dismiss
  };
}

/**
 * Default export for easy migration from react-hot-toast
 * @deprecated Import useNotifications from NotificationProvider instead
 */
const toast = {
  success: (message: string) => {
    console.warn('toast.success is deprecated. Use useNotifications hook instead.');
    // This would need to be called within a React component context
  },
  error: (message: string) => {
    console.warn('toast.error is deprecated. Use useNotifications hook instead.');
  },
  warning: (message: string) => {
    console.warn('toast.warning is deprecated. Use useNotifications hook instead.');
  },
  info: (message: string) => {
    console.warn('toast.info is deprecated. Use useNotifications hook instead.');
  },
  loading: (message: string) => {
    console.warn('toast.loading is deprecated. Use useNotifications hook instead.');
    return '';
  },
  dismiss: (id?: string) => {
    console.warn('toast.dismiss is deprecated. Use useNotifications hook instead.');
  }
};

export default toast;