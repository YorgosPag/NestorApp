/**
 * =============================================================================
 * NOTIFICATION SETTINGS — CONFIG & TYPES
 * =============================================================================
 *
 * Extracted from NotificationSettings.tsx to comply with the 500-line limit.
 * Contains: props interface, category config interface, and CATEGORY_CONFIGS.
 *
 * @module components/account/notification-settings-config
 * @enterprise ADR-025 - Notification Settings Centralization
 */

import React from 'react';
import { Users, Building2, CheckSquare, Shield } from 'lucide-react';
import {
  UserNotificationSettings,
  NotificationCategory,
} from '@/services/user-notification-settings';

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationSettingsProps {
  userId: string;
  onSettingsChange?: (settings: UserNotificationSettings) => void;
}

export interface CategoryConfig {
  id: NotificationCategory;
  icon: React.ElementType;
  titleKey: string;
  descriptionKey: string;
  settings: Array<{
    key: string;
    labelKey: string;
  }>;
}

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

export const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: 'crm',
    icon: Users,
    titleKey: 'account.notificationSettings.categories.crm.title',
    descriptionKey: 'account.notificationSettings.categories.crm.description',
    settings: [
      { key: 'newLead', labelKey: 'account.notificationSettings.categories.crm.newLead' },
      { key: 'leadStatusChange', labelKey: 'account.notificationSettings.categories.crm.leadStatusChange' },
      { key: 'taskAssigned', labelKey: 'account.notificationSettings.categories.crm.taskAssigned' },
      { key: 'newCommunication', labelKey: 'account.notificationSettings.categories.crm.newCommunication' },
    ],
  },
  {
    id: 'properties',
    icon: Building2,
    titleKey: 'account.notificationSettings.categories.properties.title',
    descriptionKey: 'account.notificationSettings.categories.properties.description',
    settings: [
      { key: 'statusChange', labelKey: 'account.notificationSettings.categories.properties.statusChange' },
      { key: 'newProperty', labelKey: 'account.notificationSettings.categories.properties.newProperty' },
      { key: 'priceChange', labelKey: 'account.notificationSettings.categories.properties.priceChange' },
      { key: 'viewingScheduled', labelKey: 'account.notificationSettings.categories.properties.viewingScheduled' },
    ],
  },
  {
    id: 'tasks',
    icon: CheckSquare,
    titleKey: 'account.notificationSettings.categories.tasks.title',
    descriptionKey: 'account.notificationSettings.categories.tasks.description',
    settings: [
      { key: 'dueToday', labelKey: 'account.notificationSettings.categories.tasks.dueToday' },
      { key: 'overdue', labelKey: 'account.notificationSettings.categories.tasks.overdue' },
      { key: 'assigned', labelKey: 'account.notificationSettings.categories.tasks.assigned' },
      { key: 'completed', labelKey: 'account.notificationSettings.categories.tasks.completed' },
    ],
  },
  {
    id: 'security',
    icon: Shield,
    titleKey: 'account.notificationSettings.categories.security.title',
    descriptionKey: 'account.notificationSettings.categories.security.description',
    settings: [
      { key: 'newDeviceLogin', labelKey: 'account.notificationSettings.categories.security.newDeviceLogin' },
      { key: 'passwordChange', labelKey: 'account.notificationSettings.categories.security.passwordChange' },
      { key: 'twoFactorChange', labelKey: 'account.notificationSettings.categories.security.twoFactorChange' },
      { key: 'suspiciousActivity', labelKey: 'account.notificationSettings.categories.security.suspiciousActivity' },
    ],
  },
];
