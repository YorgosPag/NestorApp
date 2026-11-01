/**
 * Η ΔΗΛΩΣΗ ΠΟΛΙΤΙΚΗΣ για κτίρια και ορόφους: ποιος ρόλος κάνει τι (ADR-829 §7.1).
 *
 * ⚠️ Το αναμενόμενο γράφεται εδώ με το χέρι, ΕΠΙΤΗΔΕΣ. Το αποτέλεσμα βγαίνει ζωντανά από τον κατάλογο ρόλων μέσω του
 * πραγματικού `withAuth`. Αν και το αναμενόμενο παραγόταν από τον κατάλογο, μια λάθος παραχώρηση θα μετακινούσε και τα
 * δύο και το test θα έμενε πράσινο (το σχήμα του ADR-790 §9.1). Κάθε αλλαγή εδώ είναι αλλαγή πολιτικής και φαίνεται στο diff.
 *
 * @see src/app/api/buildings/__tests__/building-floor-role-matrix.route.test.ts — ο διακομιστής
 * @see src/hooks/__tests__/building-capabilities-matrix.test.ts — τα κουμπιά
 */

import type { GlobalRole, PermissionId } from '@/lib/auth/types';
import type { BuildingCapabilities } from '@/hooks/useBuildingCapabilities';

export type RoleVerdict = 'allow' | 'deny';
export type RouteFile =
  | 'src/app/api/buildings/route.ts'
  | 'src/app/api/buildings/[buildingId]/route.ts'
  | 'src/app/api/buildings/[buildingId]/link-project/route.ts'
  | 'src/app/api/floors/route.ts';

export interface RolePolicyRow {
  readonly routeFile: RouteFile;
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Μόνο για την ρητή παραχώρηση στο claim. Η απάντηση του ρόλου δεν βγαίνει από εδώ. */
  readonly permission: PermissionId;
  readonly writes: boolean;
  /** Το κουμπί που δείχνει αυτή την πράξη. `null`: ανάγνωση χωρίς κουμπί. */
  readonly capability: keyof BuildingCapabilities | null;
  readonly verdicts: Readonly<Record<GlobalRole, RoleVerdict>>;
}

const READ_FOR_STAFF: RolePolicyRow['verdicts'] = {
  super_admin: 'allow', company_admin: 'allow', internal_user: 'allow', external_user: 'deny',
};

const WRITE_FOR_ADMIN: RolePolicyRow['verdicts'] = {
  super_admin: 'allow', company_admin: 'allow', internal_user: 'deny', external_user: 'deny',
};

const BUILDINGS = 'src/app/api/buildings/route.ts';
const BUILDING = 'src/app/api/buildings/[buildingId]/route.ts';
const LINK_PROJECT = 'src/app/api/buildings/[buildingId]/link-project/route.ts';
const FLOORS = 'src/app/api/floors/route.ts';

export const ROLE_POLICY = {
  listBuildings: { routeFile: BUILDINGS, method: 'GET', permission: 'buildings:buildings:view', writes: false, capability: null, verdicts: READ_FOR_STAFF },
  createBuilding: { routeFile: BUILDINGS, method: 'POST', permission: 'buildings:buildings:create', writes: true, capability: 'canCreateBuilding', verdicts: WRITE_FOR_ADMIN },
  updateBuilding: { routeFile: BUILDINGS, method: 'PATCH', permission: 'buildings:buildings:update', writes: true, capability: 'canUpdateBuilding', verdicts: WRITE_FOR_ADMIN },
  readBuilding: { routeFile: BUILDING, method: 'GET', permission: 'buildings:buildings:view', writes: false, capability: null, verdicts: READ_FOR_STAFF },
  deleteBuilding: { routeFile: BUILDING, method: 'DELETE', permission: 'buildings:buildings:delete', writes: true, capability: 'canDeleteBuilding', verdicts: WRITE_FOR_ADMIN },
  linkProject: { routeFile: LINK_PROJECT, method: 'POST', permission: 'buildings:buildings:update', writes: true, capability: 'canUpdateBuilding', verdicts: WRITE_FOR_ADMIN },
  listFloors: { routeFile: FLOORS, method: 'GET', permission: 'projects:floors:view', writes: false, capability: null, verdicts: READ_FOR_STAFF },
  createFloor: { routeFile: FLOORS, method: 'POST', permission: 'projects:floors:create', writes: true, capability: 'canCreateFloor', verdicts: WRITE_FOR_ADMIN },
  updateFloor: { routeFile: FLOORS, method: 'PATCH', permission: 'projects:floors:update', writes: true, capability: 'canUpdateFloor', verdicts: WRITE_FOR_ADMIN },
  deleteFloor: { routeFile: FLOORS, method: 'DELETE', permission: 'projects:floors:delete', writes: true, capability: 'canDeleteFloor', verdicts: WRITE_FOR_ADMIN },
} as const satisfies Record<string, RolePolicyRow>;

export type PolicyOperation = keyof typeof ROLE_POLICY;

export const POLICY_OPERATIONS = Object.keys(ROLE_POLICY) as readonly PolicyOperation[];

/**
 * Διαδρομές κάτω από `/api/buildings` · `/api/floors` που ΔΕΝ κρίνει ο πίνακας, με λόγο.
 * Νέα διαδρομή χωρίς γραμμή εδώ ή στο {@link ROLE_POLICY} κοκκινίζει: δεν μένει αόρατη.
 */
export const ROUTES_OUTSIDE_POLICY: Readonly<Record<string, string>> = {
  'src/app/api/buildings/[buildingId]/construction-baselines/[baselineId]/route.ts': 'Χρονοδιάγραμμα, όχι πράξη κουμπιού του §7.1.',
  'src/app/api/buildings/[buildingId]/construction-baselines/route.ts': 'Χρονοδιάγραμμα, όχι πράξη κουμπιού του §7.1.',
  'src/app/api/buildings/[buildingId]/construction-phases/route.ts': 'Χρονοδιάγραμμα, όχι πράξη κουμπιού του §7.1.',
  'src/app/api/buildings/[buildingId]/construction-resource-assignments/route.ts': 'Χρονοδιάγραμμα, όχι πράξη κουμπιού του §7.1.',
  'src/app/api/buildings/[buildingId]/customers/route.ts': 'Ανάγνωση πελατών κτιρίου, όχι δομή κτιρίου.',
  'src/app/api/buildings/[buildingId]/milestones/route.ts': 'Χρονοδιάγραμμα, όχι πράξη κουμπιού του §7.1.',
  'src/app/api/buildings/[buildingId]/objective-values/route.ts': 'Αντικειμενικές αξίες (ADR-898), δικό τους πεδίο.',
  'src/app/api/buildings/[buildingId]/showcase/email/route.ts': 'Παρουσίαση κτιρίου, όχι δομή κτιρίου.',
  'src/app/api/buildings/[buildingId]/showcase/pdf/route.ts': 'Παρουσίαση κτιρίου, όχι δομή κτιρίου.',
  'src/app/api/buildings/[buildingId]/space-relations/route.ts': 'Σχέσεις χώρων, όχι δομή κτιρίου.',
  'src/app/api/buildings/populate/route.ts': 'Εργαλείο δεδομένων, όχι πράξη χρήστη.',
  'src/app/api/buildings/seed/route.ts': 'Εργαλείο δεδομένων, όχι πράξη χρήστη.',
  'src/app/api/buildings/trash/route.ts': 'Ο κάδος κρίνεται στον κύκλο ζωής (ADR-281).',
  'src/app/api/floors/[floorId]/floor-plate/route.ts': 'Το περίγραμμα ορόφου έχει δική του σουίτα διαδρομής.',
  'src/app/api/floors/admin/route.ts': 'Εργαλείο διαχείρισης, όχι πράξη κουμπιού του §7.1.',
  'src/app/api/floors/diagnostic/route.ts': 'Εργαλείο διάγνωσης, όχι πράξη κουμπιού του §7.1.',
  'src/app/api/floors/enterprise-audit/route.ts': 'Εργαλείο ελέγχου, όχι πράξη κουμπιού του §7.1.',
  'src/app/api/floors/integrity/route.ts': 'Έλεγχος ακεραιότητας στοίβας (ADR-910), όχι πράξη κουμπιού του §7.1.',
};
