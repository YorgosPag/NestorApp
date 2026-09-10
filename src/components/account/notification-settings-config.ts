/**
 * =============================================================================
 * NOTIFICATION SETTINGS — CONFIG & TYPES
 * =============================================================================
 *
 * Ό,τι ανήκει **μόνο** στην οθόνη ρυθμίσεων: εικονίδια κατηγοριών, ετικέτες συχνότητας,
 * ids των ελέγχων παράδοσης.
 *
 * 🔗 **ADR-849 — οι γραμμές ΔΕΝ ζουν εδώ.** Ποιοι διακόπτες φαίνονται, με ποια ετικέτα και αν είναι
 * υποχρεωτικοί το λέει ο κοινός πίνακας `services/user-notification-settings/notification-preference-table`,
 * που διαβάζει και η σελίδα προτιμήσεων email. Το παλιό `CATEGORY_CONFIGS` (γραμμές + εικονίδια)
 * διαγράφηκε στην Α3: ο μόνος αναγνώστης του ήταν η οθόνη, που διαβάζει πλέον τον πίνακα.
 *
 * @module components/account/notification-settings-config
 * @see ADR-849 — το μοντέλο προτιμήσεων (το «ADR-025» που έγραφε εδώ ήταν φάντασμα)
 */

import React from 'react';
import { Building2, CheckSquare, Package, Shield, Users } from 'lucide-react';

import {
  isEmailFrequency,
  type EmailFrequency,
  type NotificationCategory,
  type UserNotificationSettings,
} from '@/services/user-notification-settings';

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationSettingsProps {
  userId: string;
  onSettingsChange?: (settings: UserNotificationSettings) => void;
}

// ============================================================================
// CATEGORY ICONS
// ============================================================================

/**
 * Το εικονίδιο κάθε κατηγορίας. ⚠️ `Record`, όχι `Partial`: νέα κατηγορία στο μοντέλο
 * χωρίς εικονίδιο **δεν μεταγλωττίζεται** — αντί να εμφανιστεί κενή στην οθόνη.
 */
export const CATEGORY_ICONS: Readonly<Record<NotificationCategory, React.ElementType>> = {
  crm: Users,
  properties: Building2,
  tasks: CheckSquare,
  procurement: Package,
  security: Shield,
};

// ============================================================================
// EMAIL FREQUENCY — ΕΝΑΣ πίνακας ετικετών (ADR-849 Α3)
// ============================================================================

/**
 * Η ετικέτα κάθε συχνότητας. Τη διαβάζουν ο επιλογέας του τμήματος παράδοσης **και** ο
 * υπότιτλος της στήλης email της μήτρας («Και με email · Ημερήσια σύνοψη»).
 *
 * ⚠️ **Πλήρη κλειδιά με namespace σε πίνακα**: ο γεννήτορας των slices (ADR-744) λύνει το
 * `t(FREQUENCY_LABEL_KEYS[f])`· ένα `t(key)` από τοπική μεταβλητή θα ήταν ανεπίλυτο.
 */
export const FREQUENCY_LABEL_KEYS: Readonly<Record<EmailFrequency, string>> = {
  realtime: 'common-account:account.notificationSettings.frequency.realtime',
  daily: 'common-account:account.notificationSettings.frequency.daily',
  weekly: 'common-account:account.notificationSettings.frequency.weekly',
  disabled: 'common-account:account.notificationSettings.frequency.disabled',
};

/** Οι επιλογές του επιλογέα, με τη σειρά του πίνακα — χωρίς δεύτερη λίστα με το χέρι. */
export const EMAIL_FREQUENCY_OPTIONS: readonly EmailFrequency[] =
  Object.keys(FREQUENCY_LABEL_KEYS).filter(isEmailFrequency);

// ============================================================================
// DELIVERY CONTROL IDS
// ============================================================================

/**
 * Τα ids των ελέγχων του τμήματος παράδοσης — ο στόχος του «Μετάβαση στη ρύθμιση email» της
 * μήτρας (ADR-849 Δ8: μεταφέρει εστίαση, **δεν** γράφει). Ένα σημείο, ώστε μετονομασία στο
 * τμήμα να μη σπάει σιωπηλά τον σύνδεσμο.
 */
export const DELIVERY_CONTROL_IDS = {
  inApp: 'in-app',
  email: 'email',
  emailFrequency: 'email-frequency',
  timezone: 'notification-timezone',
} as const;
