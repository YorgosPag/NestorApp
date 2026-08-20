/**
 * =============================================================================
 * USER NOTIFICATION SETTINGS - TYPES
 * =============================================================================
 *
 * Enterprise Pattern: User notification preferences management
 * Defines types for user-controlled notification settings
 *
 * @module services/user-notification-settings/types
 * @enterprise ADR-025 - Notification Settings Centralization
 */

import { DEFAULT_LANGUAGE, type HumanLanguage } from '@/i18n/languages';

// ============================================================================
// NOTIFICATION CATEGORY TYPES
// ============================================================================

/**
 * Available notification categories
 */
export type NotificationCategory = 'crm' | 'properties' | 'tasks' | 'security' | 'procurement';

/**
 * Email frequency preferences
 */
export type EmailFrequency = 'realtime' | 'daily' | 'weekly' | 'disabled';

/**
 * Η ζώνη ώρας όταν ο χρήστης δεν έχει δηλώσει δική του.
 *
 * ⚠️ **ΕΙΝΑΙ ΤΟ SSoT ΤΗΣ ΠΡΟΕΠΙΛΟΓΗΣ** — το `email-delivery-window.ts` το
 * **εισάγει** αντί να έχει δικό του αντίγραφο. Μέχρι το §8.28 η τιμή ζούσε **μόνο**
 * εκεί, ως `NOTIFICATION_TIMEZONE`, και ήταν καθολική: το «22:00» **κάθε** χρήστη
 * σήμαινε 22:00 Ελλάδας.
 *
 * 🔑 **Γιατί εδώ και όχι στην πολιτική**: η προεπιλογή είναι ιδιότητα του
 * **χρήστη** (τι υποθέτουμε γι' αυτόν όταν δεν έχει πει), όχι της παράδοσης. Αν
 * ζούσε στην πολιτική, το `getDefaultNotificationSettings` θα έπρεπε να εισάγει από
 * server-only module — και οι ρυθμίσεις διαβάζονται και στον browser.
 */
export const DEFAULT_NOTIFICATION_TIMEZONE = 'Europe/Athens';

/**
 * ⚠️ **ΔΕΝ υπάρχει `DEFAULT_NOTIFICATION_LANGUAGE`, και η απουσία είναι απόφαση.**
 *
 * Η ζώνη ώρας χρειάστηκε δική της προεπιλογή επειδή η εφαρμογή **δεν έχει**
 * καθολική ζώνη — το `CRON_TIMEZONE` απαντά άλλο ερώτημα («πότε τρέχει ο σαρωτής»).
 * Η γλώσσα **έχει**: το {@link DEFAULT_LANGUAGE} του `@/i18n/languages` είναι η ίδια
 * τιμή που φορτώνει το i18next στο πρώτο καρέ.
 *
 * Μια δεύτερη σταθερά εδώ θα ήταν **δεύτερο όνομα για το ίδιο πράγμα**, ελεύθερο να
 * αποκλίνει: η οθόνη θα άνοιγε στα ελληνικά και το email θα έφευγε στα αγγλικά, με
 * **δύο πράσινες** πύλες. Συμμετρία στην όψη, απόκλιση στην ουσία.
 *
 * ⚠️ **Και δεν επανεξάγεται από εδώ.** Ο καταναλωτής εισάγει από `@/i18n/languages`
 * — μια επανεξαγωγή θα έδινε **δεύτερο μονοπάτι** προς την ίδια τιμή, και το
 * επόμενο βήμα αυτού είναι πάντα δεύτερος ορισμός.
 */

// ============================================================================
// CATEGORY-SPECIFIC SETTINGS
// ============================================================================

/**
 * CRM notification settings
 */
export interface CrmNotificationSettings {
  /** Notify when new lead is created */
  newLead: boolean;
  /** Notify when lead status changes */
  leadStatusChange: boolean;
  /** Notify when task is assigned */
  taskAssigned: boolean;
  /** Notify when communication is received */
  newCommunication: boolean;
  /** Notify when a contact is moved to trash */
  contactTrashed: boolean;
  /** Notify when a contact is permanently deleted */
  contactPermanentlyDeleted: boolean;
}

/**
 * Properties notification settings
 */
export interface PropertiesNotificationSettings {
  /** Notify when property status changes (available → reserved → sold) */
  statusChange: boolean;
  /** Notify when new property is added */
  newProperty: boolean;
  /** Notify when property price changes */
  priceChange: boolean;
  /** Notify when property viewing is scheduled */
  viewingScheduled: boolean;
  /** Notify when new building is created */
  newBuilding: boolean;
  /**
   * 🎯 ADR-777 Ε2 (SPEC-777B §12.6) — «**N άνθρωποι ζητούν το ακίνητό σας**».
   *
   * Το **δόλωμα** προς τον ιδιοκτήτη: η αγορά κάνει την πρώτη κίνηση, όχι αυτός.
   *
   * ⚠️ **Προεπιλογή `true`, και είναι απόφαση.** Οι υπόλοιπες προεπιλογές εδώ
   * ακολουθούν τον κανόνα «*ειδοποίησε για ό,τι ο χρήστης δεν μπορεί να δει μόνος
   * του*» — και αυτό είναι το ακραίο παράδειγμά του: ο ιδιοκτήτης **δομικά δεν
   * μπορεί** να μάθει ότι κάποιος τον ψάχνει (ο κανόνας Firestore δίνει `read` στις
   * ζητήσεις **μόνο** στον συγγραφέα τους). Με προεπιλογή `false`, το χαρακτηριστικό
   * θα υπήρχε και **δεν θα έφτανε ποτέ σε άνθρωπο** — ακριβώς η κατάσταση που το Ε2
   * ήρθε να τερματίσει.
   *
   * ⚠️ **Ο χρήστης το κλείνει από τις ρυθμίσεις** (`notification-settings-config.ts`):
   * μια ειδοποίηση που δεν σβήνει είναι ενόχληση, όχι υπηρεσία.
   */
  demandInterest: boolean;
}

/**
 * Tasks notification settings
 */
export interface TasksNotificationSettings {
  /** Notify when task is due today */
  dueToday: boolean;
  /** Notify when task is overdue */
  overdue: boolean;
  /** Notify when task is assigned to me */
  assigned: boolean;
  /** Notify when task is completed */
  completed: boolean;
}

/**
 * Procurement notification settings (ADR-267 Phase B)
 */
export interface ProcurementNotificationSettings {
  /** Notify when PO requires approval */
  approvalNeeded: boolean;
  /** Notify when PO is approved */
  poApproved: boolean;
  /** Notify when PO is overdue (past dateNeeded) */
  poOverdue: boolean;
  /** ADR-327 — Notify when vendor submits a quote */
  quoteReceived: boolean;
  /** ADR-327 — Notify when RFQ deadline is approaching */
  quoteDeadlineApproaching: boolean;
  /** ADR-327 — Notify when vendor declines an invite */
  vendorDeclined: boolean;
  /** ADR-327 — Notify when vendor edits a submitted quote */
  quoteEdited: boolean;
  /** ADR-327 — Notify when AI extraction confidence is low (review needed) */
  aiLowConfidence: boolean;
  /** ADR-327 — Notify when a new vendor contact is auto-created from a quote scan */
  vendorCreated: boolean;
}

/**
 * Security notification settings
 */
export interface SecurityNotificationSettings {
  /** Notify on new device login */
  newDeviceLogin: boolean;
  /** Notify on password change */
  passwordChange: boolean;
  /** Notify on 2FA status change */
  twoFactorChange: boolean;
  /** Notify on suspicious activity */
  suspiciousActivity: boolean;
}

// ============================================================================
// MAIN SETTINGS INTERFACE
// ============================================================================

/**
 * Complete user notification settings
 */
export interface UserNotificationSettings {
  /** User ID (document ID in Firestore) */
  userId: string;

  /** Global notification toggle */
  globalEnabled: boolean;

  /** In-app notifications enabled */
  inAppEnabled: boolean;

  /** Email notifications enabled */
  emailEnabled: boolean;

  /** Email frequency preference */
  emailFrequency: EmailFrequency;

  /** Push notifications enabled (browser) */
  pushEnabled: boolean;

  /** Category-specific settings */
  categories: {
    crm: CrmNotificationSettings;
    properties: PropertiesNotificationSettings;
    tasks: TasksNotificationSettings;
    security: SecurityNotificationSettings;
    procurement: ProcurementNotificationSettings;
  };

  /** Quiet hours settings */
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
  };

  /**
   * 🕐 ADR-777 §8.28 — **Η ζώνη ώρας ΤΟΥ ΧΡΗΣΤΗ**, ως IANA identifier
   * (`'Europe/Athens'`, `'Europe/Berlin'`, …).
   *
   * Ερμηνεύει **και** τις {@link UserNotificationSettings.quietHours} **και** τα
   * παράθυρα `daily`/`weekly`. Μέχρι το §8.28 **δεν υπήρχε**: όλοι ερμηνεύονταν σε
   * Ελλάδα, οπότε η «ησυχία 22:00–08:00» ενός συνεργάτη στο Βερολίνο ίσχυε 21:00–07:00
   * τοπικά — και **διαφορετικά λάθος** όποτε οι δύο χώρες άλλαζαν ώρα σε άλλη ημερομηνία.
   *
   * ⚠️ **Άκυρη τιμή ΔΕΝ ρίχνει τον αγωγό.** Το `Intl.DateTimeFormat` πετά `RangeError`
   * σε άγνωστο identifier· ένα κακογραμμένο πεδίο σε **ένα** έγγραφο θα σταματούσε
   * την παράδοση για **όλους**. Η πολιτική πέφτει σιωπηλά στο
   * {@link DEFAULT_NOTIFICATION_TIMEZONE} — ίδιο σχήμα με τη ρύθμιση ησυχίας που
   * έχει άκυρη μορφή ώρας.
   *
   * @see server/notifications/email-delivery-window
   */
  timezone: string;

  /**
   * 🌐 ADR-777 §8.29 — **Η γλώσσα ΤΟΥ ΧΡΗΣΤΗ**, όπως τη διαβάζει ο διακομιστής.
   *
   * ────────────────────────────────────────────────────────────────────────
   * 🔴 ΤΟ ΚΕΝΟ: Ο ΕΠΙΛΟΓΕΑΣ ΥΠΗΡΧΕ — Η ΕΠΙΛΟΓΗ ΔΕΝ ΕΦΤΑΝΕ ΠΟΥΘΕΝΑ
   * ────────────────────────────────────────────────────────────────────────
   *
   * Η εφαρμογή έχει **δύο** επιλογείς γλώσσας (`PreferencesPageContent` και
   * `language-switcher` της κεφαλίδας) και **κανένας** από τους δύο δεν έγραφε
   * παρά μόνο σε `localStorage`. Δηλαδή η γλώσσα ζούσε **αποκλειστικά στο
   * πρόγραμμα περιήγησης** — και τα αυτόματα email γράφονται από **cron**, χωρίς
   * αίτημα, χωρίς περιήγηση, χωρίς `localStorage`.
   *
   * Το αποτέλεσμα δεν ήταν «ελλιπής μετάφραση»: ήταν ότι ο διακομιστής **δομικά
   * δεν μπορούσε να μάθει** την επιλογή, οπότε τα κείμενα ήταν σταθερά ελληνικά
   * με τον λόγο **γραμμένο** στο docblock του `email-digest.ts` ως δηλωμένο όριο.
   * Αυτό το πεδίο είναι η γέφυρα που έλειπε — **ίδιο σχήμα με τη ζώνη ώρας**
   * (§8.28), και σκόπιμα η **ίδια** απόφαση: η προτίμηση του ανθρώπου ζει με τις
   * υπόλοιπες προτιμήσεις του, όχι σε τρίτο μέρος.
   *
   * ⚠️ **ΠΡΟΣΟΧΗ — υπάρχει ΤΡΙΤΗ αποθήκη γλώσσας, και είναι ΦΑΝΤΑΣΜΑ.** Το
   * `users/{uid}.notificationPreferences` (μέσω `/api/notifications/preferences`)
   * δηλώνει `locale: 'el-GR'` **και** `timezone` — μετρημένο 2026-08-20: το
   * γράφει και το διαβάζει **μόνο η ίδια της η διαδρομή**, και **κανείς δεν την
   * καλεί** (ο μόνος δείκτης προς αυτήν είναι μια σταθερά μονοπατιού στο
   * `domain-constants.ts`). **ΜΗΝ γράψεις εκεί** νομίζοντας ότι είναι το SSoT:
   * θα ήταν τέταρτη αλήθεια, με τον διακομιστή να διαβάζει ακόμη άλλη.
   *
   * ⚠️ **Άκυρη τιμή ΔΕΝ ρίχνει τον αγωγό** — ίδιος κανόνας με το `timezone`. Η
   * ανάγνωση περνά από `resolveHumanLanguage`, που πέφτει σιωπηλά στην
   * προεπιλογή. Και το `pseudo` **δεν είναι** αποδεκτή τιμή: ο επιλογέας της
   * κεφαλίδας το προσφέρει σε περιβάλλον ανάπτυξης, και ένα email τυλιγμένο σε
   * `[[~~ … ~~]]` θα ήταν αχρησιμοποίητο για τον παραλήπτη.
   *
   * @see i18n/languages — το λεξιλόγιο και η αφαίρεση του `pseudo`
   * @see server/comms/email-texts — τα λόγια, ανά γλώσσα
   */
  language: HumanLanguage;

  /** Metadata */
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

/**
 * Default CRM notification settings
 */
export const DEFAULT_CRM_SETTINGS: CrmNotificationSettings = {
  newLead: true,
  leadStatusChange: true,
  taskAssigned: true,
  newCommunication: false,
  contactTrashed: true,
  contactPermanentlyDeleted: true,
};

/**
 * Default Properties notification settings
 */
export const DEFAULT_PROPERTIES_SETTINGS: PropertiesNotificationSettings = {
  statusChange: true,
  newProperty: false,
  priceChange: false,
  viewingScheduled: true,
  newBuilding: true,
  demandInterest: true,
};

/**
 * Default Tasks notification settings
 */
export const DEFAULT_TASKS_SETTINGS: TasksNotificationSettings = {
  dueToday: true,
  overdue: true,
  assigned: true,
  completed: false,
};

/**
 * Default Procurement notification settings (ADR-267 Phase B)
 */
export const DEFAULT_PROCUREMENT_SETTINGS: ProcurementNotificationSettings = {
  approvalNeeded: true,
  poApproved: true,
  poOverdue: true,
  quoteReceived: true,
  quoteDeadlineApproaching: true,
  vendorDeclined: true,
  quoteEdited: false,
  aiLowConfidence: true,
  vendorCreated: true,
};

/**
 * Default Security notification settings
 */
export const DEFAULT_SECURITY_SETTINGS: SecurityNotificationSettings = {
  newDeviceLogin: true,
  passwordChange: true,
  twoFactorChange: true,
  suspiciousActivity: true,
};

/**
 * Get default notification settings for a new user
 */
export function getDefaultNotificationSettings(userId: string): UserNotificationSettings {
  return {
    userId,
    globalEnabled: true,
    inAppEnabled: true,
    emailEnabled: true,
    emailFrequency: 'daily',
    pushEnabled: false,
    categories: {
      crm: { ...DEFAULT_CRM_SETTINGS },
      properties: { ...DEFAULT_PROPERTIES_SETTINGS },
      tasks: { ...DEFAULT_TASKS_SETTINGS },
      security: { ...DEFAULT_SECURITY_SETTINGS },
      procurement: { ...DEFAULT_PROCUREMENT_SETTINGS },
    },
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
    timezone: DEFAULT_NOTIFICATION_TIMEZONE,
    language: DEFAULT_LANGUAGE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ============================================================================
// UPDATE PAYLOAD TYPES
// ============================================================================

/**
 * Partial update payload for notification settings
 */
export type NotificationSettingsUpdate = Partial<Omit<UserNotificationSettings, 'userId' | 'createdAt'>>;

/**
 * Category toggle update
 */
export interface CategoryToggleUpdate {
  category: NotificationCategory;
  setting: string;
  enabled: boolean;
}
