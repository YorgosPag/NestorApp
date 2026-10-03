/**
 * =============================================================================
 * SEED FLOORS — CONFIGURATION (Data / Templates)
 * =============================================================================
 *
 * Hardcoded templates + target building για manual admin seeding.
 * Exempt from file-size limits (config/data file).
 */

// ADR-903 — η ελληνική canonical longName από τα ΙΔΙΑ κλειδιά με την UI (ποτέ χειρόγραφη).
import { canonicalFloorLongName } from '@/lib/floor/floor-label-bundle';

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
    name: canonicalFloorLongName('basement', -1),
    units: 0,
    description: 'Αποθήκες και parking',
  },
  {
    number: 0,
    name: canonicalFloorLongName('ground', 0),
    units: 2,
    description: 'Καταστήματα και είσοδος',
  },
  {
    number: 1,
    name: canonicalFloorLongName('standard', 1),
    units: 2,
    description: 'Διαμερίσματα Α1, Β1',
  },
  {
    number: 2,
    name: canonicalFloorLongName('standard', 2),
    units: 2,
    description: 'Διαμερίσματα Α2, Β2',
  },
  {
    number: 3,
    name: canonicalFloorLongName('standard', 3),
    units: 2,
    description: 'Διαμερίσματα Α3, Β3',
  },
  {
    number: 4,
    name: canonicalFloorLongName('standard', 4),
    units: 1,
    description: 'Ρετιρέ',
  },
];
