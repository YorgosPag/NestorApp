/**
 * Centralized notification system types
 * Supports multiple notification types with i18n integration
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type NotificationPosition = 
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline';
}

export interface NotificationOptions {
  /** Notification type affecting styling and icon */
  type?: NotificationType;
  
  /** Auto-dismiss duration in milliseconds. Set to 0 for persistent */
  duration?: number;
  
  /** Screen position for the notification */
  position?: NotificationPosition;
  
  /** Additional actions (buttons) */
  actions?: NotificationAction[];
  
  /** Custom icon override */
  icon?: React.ReactNode;
  
  /** Prevent duplicate notifications with same ID */
  id?: string;
  
  /** Rich content support */
  content?: React.ReactNode;
  
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  
  /** Close button visibility */
  dismissible?: boolean;
  
  /** Progress bar for loading states */
  showProgress?: boolean;
  
  /** Custom cancel button configuration */
  cancel?: {
    label: string;
    onClick: () => void;
  };
  
  /** Callback when notification is dismissed/canceled */
  onCancel?: () => void;
}

export interface NotificationData {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  options: NotificationOptions;
  dismissed?: boolean;
}

export interface NotificationContextValue {
  /** Show a notification with i18n support */
  notify: (message: string, options?: NotificationOptions) => string;
  
  /** Show success notification */
  success: (message: string, options?: Omit<NotificationOptions, 'type'>) => string;
  
  /** Show error notification */
  error: (message: string, options?: Omit<NotificationOptions, 'type'>) => string;
  
  /** Show warning notification */
  warning: (message: string, options?: Omit<NotificationOptions, 'type'>) => string;
  
  /** Show info notification */
  info: (message: string, options?: Omit<NotificationOptions, 'type'>) => string;
  
  /** Show loading notification */
  loading: (message: string, options?: Omit<NotificationOptions, 'type'>) => string;
  
  /** Dismiss specific notification */
  dismiss: (id: string) => void;
  
  /** Dismiss all notifications */
  dismissAll: () => void;
  
  /** Get current notifications */
  notifications: NotificationData[];
  
  /** Global settings */
  settings: {
    defaultDuration: number;
    defaultPosition: NotificationPosition;
    maxNotifications: number;
    enableSounds: boolean;
  };
  
  /** Update global settings */
  updateSettings: (settings: Partial<NotificationContextValue['settings']>) => void;
}

/**
 * Error code mapping for domain-specific errors
 */
export interface ErrorCodeMapping {
  [errorCode: string]: {
    i18nKey: string;
    type: NotificationType;
    namespace?: string;
  };
}

/**
 * Notification queue management
 */
export interface NotificationQueue {
  /** Add notification to queue */
  enqueue: (notification: NotificationData) => void;
  
  /** Remove notification from queue */
  dequeue: (id: string) => void;
  
  /** Check if notification with ID exists */
  exists: (id: string) => boolean;
  
  /** Rate limiting check */
  canShow: (message: string, timeWindow?: number) => boolean;
  
  /** Clear queue */
  clear: () => void;
  
  /** Get queue size */
  size: () => number;
}

/**
 * Accessibility features
 */
export interface NotificationA11y {
  /** Announce notification to screen readers */
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  
  /** Focus management for important notifications */
  focusNotification: (id: string) => void;
  
  /** Keyboard navigation support */
  enableKeyboardNavigation: boolean;
  
  /** High contrast mode support */
  highContrastMode: boolean;
  
  /** Reduced motion support */
  respectReducedMotion: boolean;
}