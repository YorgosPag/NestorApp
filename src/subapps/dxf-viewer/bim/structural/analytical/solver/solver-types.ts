/**
 * Static FEM solver — result types SSoT (ADR-481, T3 / S6).
 *
 * Καθαροί τύποι αποτελεσμάτων της στατικής γραμμικής ανάλυσης (κομβικές
 * μετακινήσεις + τοπικά εντατικά μεγέθη μέλους + διαγράμματα + envelope ανά
 * συνδυασμό). DERIVED — ΠΟΤΕ persisted. Μονάδες: μετακινήσεις m, στροφές rad,
 * δυνάμεις kN, ροπές kNm.
 *
 * Σύμβαση τοπικών αξόνων: x = άξονας μέλους (αξονικό N, στρέψη T)· y, z =
 * κύριοι άξονες διατομής (τέμνουσες Vy/Vz, ροπές κάμψης My/Mz).
 *
 * Pure types — zero runtime logic.
 *
 * @see ./frame-solver.ts — ο παραγωγός
 * @see ./analysis-results-store.ts — ο store που τα κρατά
 * @see docs/centralized-systems/reference/adrs/ADR-481-static-fem-solver.md
 */

/** Κομβική μετακίνηση (6 DOF) — m / rad. */
export interface NodeDisplacement {
  readonly nodeId: string;
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
}

/** Τιμές εντατικού μεγέθους σε μία διατομή κατά μήκος του μέλους. */
export interface DiagramStation {
  /** Απόσταση από το άκρο i (m). */
  readonly xM: number;
  /** Αξονική δύναμη N (kN· θλίψη/εφελκυσμός κατά σύμβαση solver). */
  readonly axialN: number;
  /** Τέμνουσα κατά τοπικό y (kN). */
  readonly shearY: number;
  /** Τέμνουσα κατά τοπικό z (kN). */
  readonly shearZ: number;
  /** Στρεπτική ροπή T (kNm). */
  readonly torsion: number;
  /** Ροπή κάμψης περί τοπικό y (kNm). */
  readonly momentY: number;
  /** Ροπή κάμψης περί τοπικό z (kNm). */
  readonly momentZ: number;
}

/** Ακραίες (max-abs) τιμές εντατικών μεγεθών ενός μέλους — headline για ελέγχους. */
export interface MemberForceExtrema {
  readonly maxAbsAxialN: number;
  readonly maxAbsShear: number;
  readonly maxAbsMoment: number;
  readonly maxAbsTorsion: number;
}

/** Τα εντατικά μεγέθη ενός μέλους σε έναν συνδυασμό: τοπικά άκρα + διάγραμμα + extrema. */
export interface MemberForceResult {
  readonly memberId: string;
  /** 12 τοπικές δυνάμεις/ροπές άκρων [i: N,Vy,Vz,T,My,Mz | j: …]. */
  readonly endForcesLocal: readonly number[];
  readonly diagram: readonly DiagramStation[];
  readonly extrema: MemberForceExtrema;
}

/** Αποτέλεσμα ενός συνδυασμού φόρτισης. */
export interface CombinationResult {
  readonly combinationId: string;
  readonly combinationKind: string;
  /** True όταν το K είναι μηχανισμός για αυτόν τον φορέα → οι τιμές δεν είναι έγκυρες. */
  readonly singular: boolean;
  readonly displacements: readonly NodeDisplacement[];
  readonly memberForces: readonly MemberForceResult[];
}

/** Συνολικό αποτέλεσμα ανάλυσης (όλοι οι συνδυασμοί + envelope ανά μέλος). */
export interface AnalysisResult {
  readonly combinations: readonly CombinationResult[];
  /** Envelope (max-abs over combinations) ανά μέλος — για διαστασιολόγηση/ελέγχους. */
  readonly envelopeByMember: ReadonlyMap<string, MemberForceExtrema>;
  /** Μέλη χωρίς διατομή/γεωμετρία που παραλείφθηκαν. */
  readonly skippedMemberIds: readonly string[];
  /** True αν οποιοσδήποτε συνδυασμός βρήκε μηχανισμό (singular K). */
  readonly unstable: boolean;
}

/** Κενό αποτέλεσμα (no-op — κανένα φέρον μέλος / άδειο μοντέλο). */
export const EMPTY_ANALYSIS_RESULT: AnalysisResult = {
  combinations: [],
  envelopeByMember: new Map(),
  skippedMemberIds: [],
  unstable: false,
};
