/**
 * =============================================================================
 * ΟΙ ΓΡΑΜΜΕΣ ΤΩΝ ΠΡΟΤΙΜΗΣΕΩΝ ΕΙΔΟΠΟΙΗΣΕΩΝ — ΕΝΑ ΜΗΤΡΩΟ (ADR-849 Α2)
 * =============================================================================
 *
 * Ποιοι διακόπτες φαίνονται σε άνθρωπο, με ποια ετικέτα, σε ποια ομάδα. Το διαβάζουν
 * **δύο** επιφάνειες: η οθόνη ρυθμίσεων (`components/account/NotificationSettings`) και η
 * σελίδα προτιμήσεων email με token (`/email/preferences/<token>`). Ζούσε ως
 * `CATEGORY_CONFIGS` μέσα στο component της οθόνης· δεύτερη λίστα για τη σελίδα θα
 * απέκλινε την πρώτη φορά που προστίθεται τύπος.
 *
 * 🔴 **ΠΛΗΡΕΣ, ΚΑΙ ΤΟ ΕΛΕΓΧΕΙ ΑΓΚΥΡΑ**: κάθε διακόπτης του μοντέλου (`getDefaultNotificationSettings`)
 * εμφανίζεται εδώ **ακριβώς μία φορά**. Πριν το ADR-849 έλειπαν **ολόκληρη η κατηγορία
 * procurement** (5 τύποι με ζωντανό παραγωγό) και τρεις γραμμές — διακόπτες που κανείς δεν
 * μπορούσε να γυρίσει (ADR-749 §5). Με το email ανά τύπο αυτό έγινε και **σπασμένη υπόσχεση**:
 * ο σύνδεσμος «Να μη λαμβάνω τέτοια email» θα άνοιγε σελίδα που **δεν έχει** τη γραμμή του.
 *
 * ⚠️ **Πλήρη κλειδιά i18n ΜΕ namespace, ΠΟΤΕ πρότυπα**: ο γεννήτορας του route slice
 * (ADR-744) λύνει τα `t(row.labelKey)` μαζεύοντας **literals**· ένα `` `…${key}` `` θα ήταν
 * ανεπίλυτη δυναμική κλήση και θα αρνιόταν να εκπέμψει τη σελίδα.
 *
 * @module config/notification-preference-rows
 * @see ADR-849
 */

import type { NotificationCategory } from '@/services/user-notification-settings/user-notification-settings.types';

/** Μία γραμμή: ο διακόπτης (`key` της κατηγορίας) και η ετικέτα του. */
export interface NotificationPreferenceRow {
  readonly key: string;
  readonly labelKey: string;
}

/** Μία ομάδα: η κατηγορία, ο τίτλος, η περιγραφή και οι γραμμές της. */
export interface NotificationPreferenceGroup {
  readonly category: NotificationCategory;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly settings: readonly NotificationPreferenceRow[];
}

export const NOTIFICATION_PREFERENCE_GROUPS: readonly NotificationPreferenceGroup[] = [
  {
    category: 'crm',
    titleKey: 'common-account:account.notificationSettings.categories.crm.title',
    descriptionKey: 'common-account:account.notificationSettings.categories.crm.description',
    settings: [
      { key: 'newLead', labelKey: 'common-account:account.notificationSettings.categories.crm.newLead' },
      { key: 'leadStatusChange', labelKey: 'common-account:account.notificationSettings.categories.crm.leadStatusChange' },
      { key: 'taskAssigned', labelKey: 'common-account:account.notificationSettings.categories.crm.taskAssigned' },
      { key: 'newCommunication', labelKey: 'common-account:account.notificationSettings.categories.crm.newCommunication' },
      { key: 'contactTrashed', labelKey: 'common-account:account.notificationSettings.categories.crm.contactTrashed' },
      { key: 'contactPermanentlyDeleted', labelKey: 'common-account:account.notificationSettings.categories.crm.contactPermanentlyDeleted' },
    ],
  },
  {
    category: 'properties',
    titleKey: 'common-account:account.notificationSettings.categories.properties.title',
    descriptionKey: 'common-account:account.notificationSettings.categories.properties.description',
    settings: [
      { key: 'statusChange', labelKey: 'common-account:account.notificationSettings.categories.properties.statusChange' },
      { key: 'newProperty', labelKey: 'common-account:account.notificationSettings.categories.properties.newProperty' },
      { key: 'priceChange', labelKey: 'common-account:account.notificationSettings.categories.properties.priceChange' },
      { key: 'viewingScheduled', labelKey: 'common-account:account.notificationSettings.categories.properties.viewingScheduled' },
      { key: 'newBuilding', labelKey: 'common-account:account.notificationSettings.categories.properties.newBuilding' },
      // ADR-777 Ε2 — «N άνθρωποι ζητούν το ακίνητό σας» (το δόλωμα του §12.6).
      { key: 'demandInterest', labelKey: 'common-account:account.notificationSettings.categories.properties.demandInterest' },
      // ADR-777 — ο καθρέφτης του από πάνω: «βγήκε αυτό που ζητάς».
      { key: 'demandListingMatch', labelKey: 'common-account:account.notificationSettings.categories.properties.demandListingMatch' },
      // ADR-777 §8.34 — «ο πελάτης απάντησε στην εντολή».
      { key: 'mandateDecided', labelKey: 'common-account:account.notificationSettings.categories.properties.mandateDecided' },
      // ADR-827 §9.21 — «το γραφείο απάντησε στο αίτημά σου».
      { key: 'mandateRequestAnswered', labelKey: 'common-account:account.notificationSettings.categories.properties.mandateRequestAnswered' },
    ],
  },
  {
    category: 'tasks',
    titleKey: 'common-account:account.notificationSettings.categories.tasks.title',
    descriptionKey: 'common-account:account.notificationSettings.categories.tasks.description',
    settings: [
      { key: 'dueToday', labelKey: 'common-account:account.notificationSettings.categories.tasks.dueToday' },
      { key: 'overdue', labelKey: 'common-account:account.notificationSettings.categories.tasks.overdue' },
      { key: 'assigned', labelKey: 'common-account:account.notificationSettings.categories.tasks.assigned' },
      { key: 'completed', labelKey: 'common-account:account.notificationSettings.categories.tasks.completed' },
    ],
  },
  {
    category: 'procurement',
    titleKey: 'common-account:account.notificationSettings.categories.procurement.title',
    descriptionKey: 'common-account:account.notificationSettings.categories.procurement.description',
    settings: [
      { key: 'approvalNeeded', labelKey: 'common-account:account.notificationSettings.categories.procurement.approvalNeeded' },
      { key: 'poApproved', labelKey: 'common-account:account.notificationSettings.categories.procurement.poApproved' },
      { key: 'poOverdue', labelKey: 'common-account:account.notificationSettings.categories.procurement.poOverdue' },
      { key: 'quoteReceived', labelKey: 'common-account:account.notificationSettings.categories.procurement.quoteReceived' },
      { key: 'quoteDeadlineApproaching', labelKey: 'common-account:account.notificationSettings.categories.procurement.quoteDeadlineApproaching' },
      { key: 'vendorDeclined', labelKey: 'common-account:account.notificationSettings.categories.procurement.vendorDeclined' },
      { key: 'quoteEdited', labelKey: 'common-account:account.notificationSettings.categories.procurement.quoteEdited' },
      { key: 'aiLowConfidence', labelKey: 'common-account:account.notificationSettings.categories.procurement.aiLowConfidence' },
      { key: 'vendorCreated', labelKey: 'common-account:account.notificationSettings.categories.procurement.vendorCreated' },
    ],
  },
  {
    category: 'security',
    titleKey: 'common-account:account.notificationSettings.categories.security.title',
    descriptionKey: 'common-account:account.notificationSettings.categories.security.description',
    settings: [
      { key: 'newDeviceLogin', labelKey: 'common-account:account.notificationSettings.categories.security.newDeviceLogin' },
      { key: 'passwordChange', labelKey: 'common-account:account.notificationSettings.categories.security.passwordChange' },
      { key: 'twoFactorChange', labelKey: 'common-account:account.notificationSettings.categories.security.twoFactorChange' },
      { key: 'suspiciousActivity', labelKey: 'common-account:account.notificationSettings.categories.security.suspiciousActivity' },
    ],
  },
];
