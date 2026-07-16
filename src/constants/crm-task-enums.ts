/**
 * =============================================================================
 * 🏢 ENTERPRISE: CRM Task Enum Constants (Isomorphic)
 * =============================================================================
 *
 * Server-safe constants που μπορούν να χρησιμοποιηθούν:
 * - Client-side (React components)
 * - Server-side (API routes, AI pipeline modules)
 *
 * Pattern: Google Cloud, AWS, Microsoft Azure - Shared constants
 *
 * SSoT για τα enum πεδία του `CrmTask` (type / status / priority). Πριν από αυτό
 * το αρχείο, οι τρεις editors (CalendarCreateDialog, TaskEditDialog,
 * TaskDetailPanel) δήλωναν ο καθένας δικούς του πίνακες — και είχαν ήδη αποκλίνει
 * από το union: το `'complaint'` (που παράγεται στην παραγωγή από το AI pipeline)
 * έλειπε και από τους τρεις. Το `CrmTask['type']` παράγεται πλέον ΑΠΟ αυτούς τους
 * πίνακες, οπότε η απόκλιση γίνεται αδύνατη — όχι απλώς απίθανη.
 *
 * @file crm-task-enums.ts
 * @created 2026-07-16
 * @enterprise Single Source of Truth
 * @see ADR-584 (token-based clone ratchet — cluster 5)
 */

// ============================================================================
// TYPE
// ============================================================================

/**
 * 🏢 ENTERPRISE: CRM Task Type Values
 *
 * `complaint` παράγεται από το AI pipeline (uc-004-complaint module,
 * customer-handler) — δεν το δημιουργεί χρήστη χειροκίνητα.
 */
export const CRM_TASK_TYPES = {
  CALL: 'call',
  EMAIL: 'email',
  MEETING: 'meeting',
  VIEWING: 'viewing',
  DOCUMENT: 'document',
  FOLLOW_UP: 'follow_up',
  COMPLAINT: 'complaint',
  OTHER: 'other',
} as const;

export type CrmTaskType = typeof CRM_TASK_TYPES[keyof typeof CRM_TASK_TYPES];

/**
 * Όλοι οι τύποι, σε **σειρά εμφάνισης** (όχι σε σειρά δήλωσης του union).
 *
 * Το χρησιμοποιούν οι editors που ανοίγουν **υπάρχον** task: πρέπει να μπορούν να
 * αποδώσουν κάθε τιμή που υπάρχει στη Firestore — αλλιώς ένα task τύπου
 * `complaint` ανοίγει με κενό dropdown και μια αθώα αποθήκευση το ανακατατάσσει
 * σιωπηλά.
 */
export const CRM_TASK_TYPE_VALUES: readonly CrmTaskType[] = [
  CRM_TASK_TYPES.MEETING,
  CRM_TASK_TYPES.CALL,
  CRM_TASK_TYPES.VIEWING,
  CRM_TASK_TYPES.FOLLOW_UP,
  CRM_TASK_TYPES.EMAIL,
  CRM_TASK_TYPES.DOCUMENT,
  CRM_TASK_TYPES.COMPLAINT,
  CRM_TASK_TYPES.OTHER,
];

/**
 * Οι τύποι που επιτρέπεται να **δημιουργήσει** χρήστης, σε σειρά εμφάνισης.
 *
 * Αποκλείει τους system-owned τύπους: ορατοί/επεξεργάσιμοι όταν υπάρχουν, αλλά όχι
 * προσφερόμενοι σε create. Ίδια πρακτική με Revit/ArchiCAD για system-owned
 * κατηγορίες.
 */
export const CRM_TASK_TYPE_CREATABLE_VALUES: readonly CrmTaskType[] =
  CRM_TASK_TYPE_VALUES.filter((t) => t !== CRM_TASK_TYPES.COMPLAINT);

// ============================================================================
// STATUS
// ============================================================================

export const CRM_TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type CrmTaskStatus = typeof CRM_TASK_STATUSES[keyof typeof CRM_TASK_STATUSES];

export const CRM_TASK_STATUS_VALUES: readonly CrmTaskStatus[] =
  Object.values(CRM_TASK_STATUSES);

// ============================================================================
// PRIORITY
// ============================================================================

export const CRM_TASK_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type CrmTaskPriority = typeof CRM_TASK_PRIORITIES[keyof typeof CRM_TASK_PRIORITIES];

export const CRM_TASK_PRIORITY_VALUES: readonly CrmTaskPriority[] =
  Object.values(CRM_TASK_PRIORITIES);
