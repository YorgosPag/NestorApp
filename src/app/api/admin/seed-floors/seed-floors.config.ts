/**
 * =============================================================================
 * SEED FLOORS — CONFIGURATION (Data / Templates)
 * =============================================================================
 *
 * Hardcoded templates + target building για manual admin seeding.
 * Exempt from file-size limits (config/data file).
 */

/**
 * Target building για τα νέα floors — ΚΤΙΡΙΟ Α - Παλαιολόγου.
 *
 * 🏢 ENTERPRISE: IDs must match EXACTLY the Firestore document IDs.
 *
 * ⚠️ IMPORTANT: Firestore document IDs do NOT have prefixes.
 * The prefix (building_, project_) is only used for searchDocuments collection.
 */
export const TARGET_BUILDING = {
  id: 'G8kMxQ2pVwN5jR7tE1sA',
  name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
  projectId: 'xL2nV4bC6mZ8kJ9hG1fQ',
  projectName: 'Παλαιολόγου Πολυκατοικία',
} as const;

/**
 * 🏢 Company ID for tenant isolation (preview display only).
 * Real tenant comes from the authenticated user's companyId.
 */
export const TARGET_COMPANY_ID = 'comp_ySl83AUCbGRjn7bDGxn5';

/**
 * 🏢 Enterprise Floor Template
 */
export interface FloorTemplate {
  number: number;
  name: string;
  units: number;
  description?: string;
}

/**
 * 🏢 Floor templates — τυπικό μοντέλο ελληνικής πολυκατοικίας.
 */
export const FLOOR_TEMPLATES: FloorTemplate[] = [
  {
    number: -1,
    name: 'Υπόγειο',
    units: 0,
    description: 'Αποθήκες και parking',
  },
  {
    number: 0,
    name: 'Ισόγειο',
    units: 2,
    description: 'Καταστήματα και είσοδος',
  },
  {
    number: 1,
    name: '1ος Όροφος',
    units: 2,
    description: 'Διαμερίσματα Α1, Β1',
  },
  {
    number: 2,
    name: '2ος Όροφος',
    units: 2,
    description: 'Διαμερίσματα Α2, Β2',
  },
  {
    number: 3,
    name: '3ος Όροφος',
    units: 2,
    description: 'Διαμερίσματα Α3, Β3',
  },
  {
    number: 4,
    name: '4ος Όροφος',
    units: 1,
    description: 'Ρετιρέ',
  },
];
