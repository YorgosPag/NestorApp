/**
 * Analytical Model — types SSoT (ADR-480, T2).
 *
 * Καθαρή **αναλυτική** αναπαράσταση του φορέα (κόμβοι / ράβδοι / στηρίξεις /
 * διάφραγμα / στάθμες) — το αντίστοιχο του Revit *Analytical Model*, ξεχωριστό
 * από το physical BIM. Παράγεται (DERIVED, ΠΟΤΕ persisted) από τον στατικό
 * οργανισμό (ADR-459 `StructuralGraph`) μέσω του `analytical-model-builder`.
 *
 * **Φιλοσοφία (Revit physical↔analytical split):** ο organism graph κρατά «τι
 * στηρίζει τι» (load-path connectivity)· το analytical model κρατά «κόμβοι /
 * βαθμοί ελευθερίας / μέλη / διάφραγμα» — δηλαδή τη δομή δεδομένων που θα
 * τραφεί στον FEM solver (T3), στη φασματική σεισμική ανάλυση (T4) και στους
 * ελέγχους EC8 (T5). Το T2 ΔΕΝ επιλύει — είναι αμιγώς data layer + diagnostics.
 *
 * **Section/material ref = το `entityId`:** το αναλυτικό μέλος ΔΕΝ αντιγράφει
 * τις ιδιότητες διατομής/υλικού· τις αναφέρει μέσω του physical entity (SSoT).
 *
 * Μονάδες: **όλες οι θέσεις σε μέτρα (m)** — ένα ενιαίο σύστημα (ο solver/φάσμα
 * δουλεύουν σε m/kN). Pure type module — zero runtime logic, zero React/Firestore.
 *
 * @see ./analytical-model-builder.ts — ο builder
 * @see ../organism/structural-organism-types.ts — η πηγή connectivity (ADR-459)
 * @see docs/centralized-systems/reference/adrs/ADR-480-analytical-model-ssot.md
 */

/** Αναλυτικό σημείο 3D (μέτρα). x/y = plan, z = υψόμετρο (απόλυτο, datum-relative). */
export interface AnalyticalPoint3D {
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
}

/**
 * Δέσμευση βαθμών ελευθερίας ενός κόμβου (6 DOF — 3 μεταφορικοί, 3 στροφικοί).
 * `true` = δεσμευμένος (restrained). Ελεύθερος κόμβος = όλα `false`.
 */
export interface RestraintDof {
  readonly dx: boolean;
  readonly dy: boolean;
  readonly dz: boolean;
  readonly rx: boolean;
  readonly ry: boolean;
  readonly rz: boolean;
}

/** Πλήρως ελεύθερος κόμβος (κανένας δεσμευμένος βαθμός). */
export const FREE_DOF: RestraintDof = {
  dx: false, dy: false, dz: false, rx: false, ry: false, rz: false,
};

/** Πάκτωση — όλοι οι 6 βαθμοί δεσμευμένοι (θεμελίωση πεδίλου). */
export const FIXED_DOF: RestraintDof = {
  dx: true, dy: true, dz: true, rx: true, ry: true, rz: true,
};

/** Άρθρωση — μεταφορικοί δεσμευμένοι, στροφικοί ελεύθεροι. */
export const PINNED_DOF: RestraintDof = {
  dx: true, dy: true, dz: true, rx: false, ry: false, rz: false,
};

/**
 * Αναλυτικός κόμβος = σημείο σύνδεσης μελών. `id` = σταθερό ανά build (`an-<n>`),
 * ΟΧΙ entity id (πολλά μέλη μοιράζονται έναν κόμβο μετά το merge). `levelId` =
 * η στάθμη (cluster υψομέτρου) στην οποία ανήκει — οδηγεί το διάφραγμα.
 */
export interface AnalyticalNode {
  readonly id: string;
  readonly position: AnalyticalPoint3D;
  readonly restraint: RestraintDof;
  readonly levelId: string;
}

/** Είδος αναλυτικού μέλους (Phase 0 — κατακόρυφο / οριζόντιο φέρον). */
export type AnalyticalMemberType = 'column' | 'beam';

/**
 * Αναλυτικό μέλος = ράβδος μεταξύ δύο κόμβων (i → j). `id` = το `entityId` του
 * physical μέλους (1:1)· οι ιδιότητες διατομής/υλικού αναφέρονται μέσω αυτού
 * (SSoT — μηδέν αντιγραφή). `lengthM` = αναλυτικό μήκος (m) για diagnostics.
 */
export interface AnalyticalMember {
  readonly id: string;
  readonly entityId: string;
  readonly memberType: AnalyticalMemberType;
  readonly iNodeId: string;
  readonly jNodeId: string;
  readonly lengthM: number;
}

/** Είδος στήριξης (πάκτωση / άρθρωση). */
export type AnalyticalSupportType = 'fixed' | 'pinned';

/**
 * Στήριξη σε κόμβο. `entityId` = το πέδιλο/θεμελίωση που την παρέχει (FK προς το
 * physical, προαιρετικό). Default πεδίλου = πάκτωση (`fixed`).
 */
export interface AnalyticalSupport {
  readonly nodeId: string;
  readonly supportType: AnalyticalSupportType;
  readonly entityId?: string;
}

/**
 * Άκαμπτο διάφραγμα ανά στάθμη (rigid diaphragm) — οι κόμβοι μιας στάθμης
 * συνδέονται κινηματικά (in-plane). `masterNodeId` = ο κόμβος ελέγχου (κέντρο
 * μάζας θα οριστεί στο T4· εδώ = αντιπροσωπευτικός κόμβος).
 */
export interface RigidDiaphragm {
  readonly levelId: string;
  readonly nodeIds: readonly string[];
  readonly masterNodeId: string;
}

/** Στάθμη (cluster υψομέτρου) — `id` σταθερό ανά build (`lvl-<n>`). */
export interface AnalyticalLevel {
  readonly id: string;
  readonly elevationM: number;
}

/** Ο πλήρης αναλυτικός φορέας ενός κτιρίου (DERIVED). */
export interface AnalyticalModel {
  readonly nodes: readonly AnalyticalNode[];
  readonly members: readonly AnalyticalMember[];
  readonly supports: readonly AnalyticalSupport[];
  readonly diaphragms: readonly RigidDiaphragm[];
  readonly levels: readonly AnalyticalLevel[];
}

/** Κενό μοντέλο (no-op / advisory — δεν υπάρχουν φέροντα μέλη). */
export const EMPTY_ANALYTICAL_MODEL: AnalyticalModel = {
  nodes: [],
  members: [],
  supports: [],
  diaphragms: [],
  levels: [],
};
