/**
 * =============================================================================
 * NOTIFICATION SETTINGS — CONFIG & TYPES
 * =============================================================================
 *
 * Extracted from NotificationSettings.tsx to comply with the 500-line limit.
 * Contains: props interface, category config interface, and CATEGORY_CONFIGS.
 *
 * 🔗 **ADR-849 Α2 — οι γραμμές ΔΕΝ ζουν πια εδώ.** Το `CATEGORY_CONFIGS` **παράγεται** από
 * το κοινό μητρώο `config/notification-preference-rows.ts`, που διαβάζει και η σελίδα
 * προτιμήσεων email. Εδώ μένει μόνο ό,τι ανήκει στην οθόνη: τα εικονίδια.
 *
 * @module components/account/notification-settings-config
 * @see ADR-849 — το μοντέλο προτιμήσεων (το «ADR-025» που έγραφε εδώ ήταν φάντασμα)
 */

import React from 'react';
import { Building2, CheckSquare, Package, Shield, Users } from 'lucide-react';

import {
  NOTIFICATION_PREFERENCE_GROUPS,
  type NotificationPreferenceRow,
} from '@/config/notification-preference-rows';
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
  readonly id: NotificationCategory;
  readonly icon: React.ElementType;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly settings: readonly NotificationPreferenceRow[];
}

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

/**
 * Το εικονίδιο κάθε κατηγορίας. ⚠️ `Record`, όχι `Partial`: νέα κατηγορία στο μοντέλο
 * χωρίς εικονίδιο **δεν μεταγλωττίζεται** — αντί να εμφανιστεί κενή στην οθόνη.
 */
const CATEGORY_ICONS: Readonly<Record<NotificationCategory, React.ElementType>> = {
  crm: Users,
  properties: Building2,
  tasks: CheckSquare,
  procurement: Package,
  security: Shield,
};

export const CATEGORY_CONFIGS: readonly CategoryConfig[] = NOTIFICATION_PREFERENCE_GROUPS.map((group) => ({
  id: group.category,
  icon: CATEGORY_ICONS[group.category],
  titleKey: group.titleKey,
  descriptionKey: group.descriptionKey,
  settings: group.settings,
}));
