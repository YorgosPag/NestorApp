/**
 * @fileoverview Toolbar Configurations Module
 * @description Extracted from modal-select.ts - TOOLBAR CONFIGURATIONS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// TOOLBAR CONFIGURATIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Action Buttons Labels - Centralized για ActionButtons.tsx
 * ✅ ENTERPRISE: Single source of truth για όλα τα action button labels
 */
export const MODAL_SELECT_ACTION_BUTTONS_LABELS = {
  // Primary Actions
  save: 'Αποθήκευση',
  create: 'Δημιουργία',
  add: 'Προσθήκη',
  submit: 'Υποβολή',

  // Secondary Actions
  edit: 'Επεξεργασία',
  update: 'Ενημέρωση',
  cancel: 'Ακύρωση',
  close: 'Κλείσιμο',

  // Destructive Actions
  delete: 'Διαγραφή',
  remove: 'Αφαίρεση',
  archive: 'Αρχειοθέτηση',
  restore: 'Επαναφορά',

  // Loading States για Actions
  save_loading: 'Αποθήκευση...',
  delete_loading: 'Διαγραφή...',
  archive_loading: 'Αρχειοθέτηση...',
  restore_loading: 'Επαναφορά...',

  // Utility Actions
  refresh: 'Ανανέωση',
  reset: 'Επαναφορά',
  download: 'Λήψη',
  upload: 'Μεταφόρτωση',
  export: 'Εξαγωγή',
  import: 'Εισαγωγή',

  // Communication Actions
  call: 'Κλήση',
  email: 'Email',
  message: 'Μήνυμα',
  sms: 'SMS',

  // Navigation Actions
  back: 'Πίσω',
  next: 'Επόμενο',
  previous: 'Προηγούμενο',

  // State Actions
  enable: 'Ενεργοποίηση',
  disable: 'Απενεργοποίηση',
  favorite: 'Αγαπημένο',

  // Sorting Actions
  sort_asc: 'Αύξουσα Ταξινόμηση',
  sort_desc: 'Φθίνουσα Ταξινόμηση',
  sort: 'Ταξινόμηση',

  // Filter Actions
  favorites: 'Αγαπημένα',
  archived: 'Αρχειοθετημένα',

  // Help Actions
  help: 'Βοήθεια',
  info: 'Πληροφορίες'
} as const;

// ====================================================================
// DESKTOP NAVIGATION CONFIGURATIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Desktop Connection Modals Configuration Type
 * ✅ ENTERPRISE: Type-safe modal configuration structure
 */
export interface DesktopConnectionModalConfig {
  readonly title: string;
  readonly placeholder: string;
  readonly emptyMessage: string;
}

/**
 * Desktop Connection Modals Collection Type
 * ✅ ENTERPRISE: Complete modal configuration map
 */
export interface DesktopConnectionModalsConfig {
  readonly company: DesktopConnectionModalConfig;
  readonly project: DesktopConnectionModalConfig;
  readonly building: DesktopConnectionModalConfig;
  readonly floor: DesktopConnectionModalConfig;
  readonly unit: DesktopConnectionModalConfig;
}

/**
 * Desktop Navigation Headers Configuration Type
 * ✅ ENTERPRISE: Type-safe navigation headers
 */
export interface DesktopNavigationHeadersConfig {
  readonly companies: string;
  readonly projects: string;
  readonly buildings: string;
  readonly floors: string;
  readonly units: string;
}

/**
 * Desktop Counters Configuration Type
 * ✅ ENTERPRISE: Type-safe counter labels
 */
export interface DesktopCountersConfig {
  readonly total: string;
  readonly selected: string;
  readonly filtered: string;
}

/**
 * Desktop Navigation Actions Configuration Type
 * ✅ ENTERPRISE: Type-safe navigation actions
 */
export interface DesktopNavigationActionsConfig {
  readonly connect: string;
  readonly disconnect: string;
  readonly edit: string;
  readonly delete: string;
  readonly view_details: string;
}

/**
 * Desktop Status Messages Configuration Type
 * ✅ ENTERPRISE: Type-safe status messages
 */
export interface DesktopStatusMessagesConfig {
  readonly loading: string;
  readonly empty: string;
  readonly error: string;
  readonly success: string;
}

/**
 * Desktop Confirmation Dialog Configuration Type
 * ✅ ENTERPRISE: Type-safe confirmation dialog
 */
export interface DesktopConfirmationDialogConfig {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

// ====================================================================
// DESKTOP CONFIGURATION FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Desktop Connection Modals Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn connection modals
 */
export function getDesktopConnectionModals(): DesktopConnectionModalsConfig {
  return {
    company: {
      title: 'Επιλογή Εταιρείας',
      placeholder: 'Αναζήτηση εταιρείας...',
      emptyMessage: 'Δεν βρέθηκαν εταιρείες'
    },
    project: {
      title: 'Επιλογή Έργου',
      placeholder: 'Αναζήτηση έργου...',
      emptyMessage: 'Δεν βρέθηκαν έργα'
    },
    building: {
      title: 'Επιλογή Κτιρίου',
      placeholder: 'Αναζήτηση κτιρίου...',
      emptyMessage: 'Δεν βρέθηκαν κτίρια'
    },
    floor: {
      title: 'Επιλογή Ορόφου',
      placeholder: 'Αναζήτηση ορόφου...',
      emptyMessage: 'Δεν βρέθηκαν όροφοι'
    },
    unit: {
      title: 'Επιλογή Μονάδας',
      placeholder: 'Αναζήτηση μονάδας...',
      emptyMessage: 'Δεν βρέθηκαν μονάδες'
    }
  };
}

/**
 * Desktop Navigation Headers Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn headers
 */
export function getDesktopNavigationHeaders(): DesktopNavigationHeadersConfig {
  return {
    companies: 'Εταιρείες',
    projects: 'Έργα',
    buildings: 'Κτίρια',
    floors: 'Όροφοι',
    units: 'Μονάδες'
  };
}

/**
 * Desktop Counters Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn counters
 */
export function getDesktopCounters(): DesktopCountersConfig {
  return {
    total: 'Σύνολο',
    selected: 'Επιλεγμένα',
    filtered: 'Φιλτραρισμένα'
  };
}

/**
 * Desktop Navigation Actions Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn actions
 */
export function getDesktopNavigationActions(): DesktopNavigationActionsConfig {
  return {
    connect: 'Σύνδεση',
    disconnect: 'Αποσύνδεση',
    edit: 'Επεξεργασία',
    delete: 'Διαγραφή',
    view_details: 'Προβολή Λεπτομερειών'
  };
}

/**
 * Desktop Status Messages Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn status messages
 */
export function getDesktopStatusMessages(): DesktopStatusMessagesConfig {
  return {
    loading: 'Φόρτωση...',
    empty: 'Δεν υπάρχουν δεδομένα',
    error: 'Σφάλμα φόρτωσης',
    success: 'Επιτυχής ολοκλήρωση'
  };
}

/**
 * Desktop Confirmation Dialog Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn confirmation dialogs
 */
export function getDesktopConfirmationDialog(): DesktopConfirmationDialogConfig {
  return {
    title: 'Επιβεβαίωση Ενέργειας',
    message: 'Είστε βέβαιοι ότι θέλετε να προχωρήσετε;',
    confirmLabel: 'Επιβεβαίωση',
    cancelLabel: 'Ακύρωση'
  };
}

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get action buttons labels
 * ✅ CENTRALIZED: Getter function για action button labels
 */
export function getActionButtons() {
  return MODAL_SELECT_ACTION_BUTTONS_LABELS;
}