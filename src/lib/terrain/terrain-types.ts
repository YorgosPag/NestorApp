/**
 * ADR-650 / ADR-920 — Terrain domain types (points → TIN → contours), the SSoT shared by the
 * DXF Viewer and the public plot listing.
 *
 *   TopoPoint[] + Breakline[]  →  TinSurface  →  ContourLine[]
 *
 * Coordinate frames (ADR-462 canonical mm, ADR-635 culling ±1e6):
 *   - `TopoPoint` / `Breakline` / `ContourLine` carry WORLD coordinates (canonical mm,
 *     e.g. ΕΓΣΑ'87 ~1e5..1e6).
 *   - `TinSurface` carries LOCAL coordinates (world − origin) so the CDT / marching math
 *     runs on small floats near 0,0 for robustness. The `origin` re-projects back to world.
 *
 * Moved here from `subapps/dxf-viewer/systems/topography/topo-types.ts` (ADR-920 Β1): the public
 * listing needs the same types and may not import from the subapp (CHECK 3.62). The editor-only
 * types (surface ids, boundary link, crop prefs, cut/fill result, shading style) stay there and
 * that file re-exports these.
 *
 * There is NO logic in this file (types only).
 *
 * @module lib/terrain/terrain-types
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

/** A survey point in WORLD canonical mm. `code` = optional feature/figure code (field-to-finish). */
export interface TopoPoint {
  readonly x: number;
  readonly y: number;
  /**
   * ADR-720 — the measured elevation, **or `undefined` when the surveyor measured position only**.
   *
   * A point without Z is NOT broken data and is NOT an import error. It is the ordinary way a
   * property corner, a fence post or a manhole rim is recorded, and every reference model in the
   * field says so: LandXML 1.2 defines `CgPoint` as «a 2D **or** 3D Point»; OGC Simple Features /
   * ISO 19125 make `Point` and `PointZ` two equally valid types; Civil 3D treats the COGO point's
   * elevation as an OPTIONAL property (`*PROPERTY NOT SET*`) and its Point File Format has an
   * `<unused>` column value for exactly «this file carries no elevations»; Carlson marks such
   * shots «Non-Surface» — its own manual's examples are *fire hydrants, **property corners**,
   * manhole inverts*.
   *
   * 🔴 **Why this is optional and not `0`.** In the survey that forced this change, **7 of the 9
   * parcel corners were CSV points and NOT ONE carried an elevation**. Defaulting them to `0` (or
   * interpolating one from the surface) would invent a measurement — and that invented number
   * flows straight into the cut/fill volumes, i.e. into a **price**. Absent elevation must stay
   * absent all the way to the label, which prints «—» rather than a digit nobody measured.
   *
   * ⚠️ Anything that FEEDS THE SURFACE must narrow to {@link TopoPoint3D} first — never read `z`
   * with a `?? 0`. The one filter is `surfacePointsOf` in `topo-point-elevation.ts`.
   */
  readonly z?: number;
  /**
   * ADR-731 — **ποιος όρισε το `z`**. Απουσία = **μετρήθηκε στο πεδίο** (η συντριπτικά συνήθης
   * περίπτωση, και η μόνη που υπήρχε πριν το ADR-731). `'derived'` = **αποδόθηκε από την
   * επιφάνεια** με την εντολή «Απόδοση υψομέτρου», δηλαδή είναι **παρεμβολή, όχι μέτρηση**.
   *
   * 🔴 **Δεν είναι μεταδεδομένο ιχνηλασιμότητας — είναι ΠΡΟΫΠΟΘΕΣΗ ΟΡΘΟΤΗΤΑΣ.** Χωρίς αυτό, ένα
   * σημείο που πήρε υψόμετρο **από** το TIN γίνεται στο επόμενο build **κορυφή** του ίδιου TIN:
   * η επιφάνεια τρέφεται από τον εαυτό της, φαίνεται τριπλάσια πυκνή χωρίς μία νέα μέτρηση, και
   * ο έλεγχος κάλυψης του ADR-725 μετράει τις εικασίες ως μετρήσεις και **σιωπά για πάντα**.
   * Το `surfacePointsOf` το αποκλείει, άρα η αυτοτροφοδότηση είναι **δομικά αδύνατη**.
   *
   * ⚠️ **Γιατί αυτό ΔΕΝ είναι το αντιπρότυπο του ADR-720 §3.1.** Εκεί απορρίπτεται σημαία που
   * απαντά «**υπάρχει** υψόμετρο;» — ερώτηση που την απαντά ήδη ο τύπος (`z?`), οπότε η σημαία
   * γίνεται δεύτερη πηγή αλήθειας που αποκλίνει («ελέγχεται σε τέσσερα σημεία από τα πέντε»).
   * Αυτό εδώ απαντά «**ποιος όρισε** το υψόμετρο;» — ερώτηση που **κανείς άλλος δεν απαντά**.
   * Και οι κλάσεις αστοχίας διαφέρουν δομικά: ξεχνώντας τη σημαία του §3.1 διαβάζεις
   * **κατασκευασμένο 0**· ξεχνώντας αυτήν διαβάζεις **αληθινό αριθμό αγνώστου γονέα**.
   *
   * **Γιατί μόνο η μη-προεπιλεγμένη τιμή**: μια ένωση `'measured' | 'derived'` θα έδινε δύο
   * αναπαραστάσεις του «μετρημένο» (ρητό `'measured'` και απουσία) που θα απέκλιναν. Έτσι το
   * `stripUndefinedDeep` του Firestore το καθαρίζει δωρεάν, και τα υπάρχοντα δεδομένα είναι
   * ήδη σωστά χωρίς μετάπτωση.
   *
   * **Πρακτική των μεγάλων** (έρευνα 2026-07-29): ο **Carlson** έχει ακριβώς αυτή την έννοια ως
   * «**Non-Surface**» σημαία ανά σημείο — και τη συνιστά ρητά για **γωνίες οικοπέδου στην
   * περίμετρο** — αλλά είναι **χειροκίνητο checkbox** που πρέπει να θυμηθείς. Ο **Civil 3D**
   * επιτρέπει `Elevations from Surface` σε COGO points και μετά **τίποτα** δεν σε εμποδίζει να
   * τα προσθέσεις στην επιφάνεια. Εδώ ο τύπος το κάνει **αυτόματο και αδύνατο να ξεχαστεί**.
   */
  readonly zSource?: 'derived';
  /** Optional feature code (e.g. `EDGE`, `TREE`) — carried through, unused in Milestone 1. */
  readonly code?: string;
  /**
   * ADR-656 M10 — the surveyor's point number/name, VERBATIM (e.g. `101`, `S12`, `ΣΤ3`).
   * Kept as a string for zero-loss (Civil 3D «Point Number» is integer, «Point Name» is
   * alphanumeric — the raw column carries either). Populated only from the wizard/CSV road
   * where a `pointId` column genuinely exists; DXF POINT/TEXT carry no such group code, so
   * that road leaves it undefined rather than inventing one.
   */
  readonly pointNumber?: string;
}

/**
 * ADR-720 — a survey point whose elevation **was measured**: the only kind that may define a
 * surface, be sampled, be compared vertically, or be written into a Ζ column.
 *
 * This exists so the distinction is enforced by the COMPILER rather than by everyone remembering.
 * `TopoPoint.z` is `number | undefined`, so arithmetic on it does not type-check; the only way
 * through is to narrow — `hasElevation(p)` for one, `surfacePointsOf(points)` for many, both in
 * `topo-point-elevation.ts`. A new consumer therefore cannot *silently* inherit the 2D case: it
 * is made to answer «what do I do when the elevation is missing?» before it compiles.
 *
 * The alternative — a boolean flag beside a `z: number` that is 0 when absent — is what Carlson's
 * manual «Non-Surface» tagging really is, and it fails the same way every time: the flag is
 * checked in four places out of five, and the fifth silently reads the 0.
 */
export interface TopoPoint3D extends TopoPoint {
  readonly z: number;
}

/**
 * A constraint polyline (breakline) in WORLD canonical mm — road edge, ridge, ditch,
 * retaining wall. Q6: breakline-aware from the start. Its vertices become constrained
 * edges in the CDT so the TIN keeps the hard break instead of smoothing across it.
 *
 * ⚠️ ADR-720 — vertices are {@link TopoPoint3D}, **not** `TopoPoint`: a breakline is a statement
 * about where the ground BREAKS, so a vertex without an elevation is not a weaker breakline — it
 * is a meaningless one. Both builders already guarantee it (`buildBreaklineFromEntity`: explicit
 * `lwpolyline.elevation`, else borrowed from the nearest **measured** point; `chain-feature-edges`:
 * straight off the TIN), so the type is documenting a property the code already has — and pinning
 * it, so the third builder cannot quietly arrive without one.
 */
export interface Breakline {
  readonly id: string;
  readonly vertices: readonly TopoPoint3D[];
  /** When true, the first and last vertices are also joined by a constrained edge. */
  readonly closed?: boolean;
  /**
   * ADR-650 M2-Β: the scene entity this breakline was picked from (`'topo-breakline'` tool).
   * Absent for breaklines that did not come from a drawing entity (e.g. a future file import).
   */
  readonly sourceEntityId?: string;
  /**
   * ADR-920 Β4.8 Β1 — where the vertices' z came from. Shown (line pattern in the plan, list in the panel), never
   * guessed: absent on breaklines saved before this field existed ⇒ «unknown», not silently «elevation».
   */
  readonly elevationSource?: BreaklineElevationSource;
}

/**
 * ADR-920 Β4.8 Β1 — the ONE vocabulary for a breakline's elevation provenance (Civil 3D keeps this in
 * Breakline Properties; we draw it):
 * - `elevation` — the drawing line carries its own z (2D/3D polyline elevation, LINE start/end z);
 * - `proximity` — a 2D line, z borrowed from the nearest measured point (Civil 3D «proximity breakline»);
 * - `surface`   — an approved automatic candidate, z read straight off the TIN (ADR-650 M8β).
 */
export type BreaklineElevationSource = 'elevation' | 'proximity' | 'surface';

/** LOCAL-origin offset: subtract from world to get local; add to local to get world. */
export interface LocalOrigin {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned bounds in whatever frame the producer documents (world or local). */
export interface TopoBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** A TIN vertex position `[localX, localY]` (LOCAL frame, canonical mm). */
export type TinPosition = readonly [number, number];

/** A TIN triangle `[i, j, k]` — vertex indices, counter-clockwise seen from above. */
export type TinTriangle = readonly [number, number, number];

/**
 * Immutable triangulated irregular network (the derived "surface object").
 *
 * Parallel-array layout (cache-friendly):
 *   - `positions[i]` = `[localX, localY]` of vertex i (LOCAL frame).
 *   - `elevations[i]` = Z of vertex i (WORLD Z — elevation is not offset).
 *   - `triangles[t]` = `[i, j, k]` vertex indices (CCW, constrained edges preserved).
 */
export interface TinSurface {
  readonly positions: ReadonlyArray<TinPosition>;
  readonly elevations: readonly number[];
  readonly triangles: ReadonlyArray<TinTriangle>;
  /** Re-projection back to world coordinates (LOCAL + origin = WORLD). */
  readonly origin: LocalOrigin;
  /** Local-frame planimetric + world-frame vertical bounds. */
  readonly bounds: TopoBounds;
  /**
   * Triangle indices skipped as "false flats" (all three vertices at the same Z).
   * Kept for QA/diagnostics; these produce no contour crossings (ADR-650 §5 trap).
   */
  readonly flatTriangleCount: number;
}

/**
 * ADR-650 / ADR-920 Β4.8 Τ — one place where the breaklines state TWO elevations for ONE position, resolved by the
 * builder and REPORTED (never silently). The rule is the survey points' rule (`surveyFactsOf`): the earlier statement
 * is kept, the later one is overruled and named.
 *
 * - `crossing` — two breaklines cross between their vertices. A TIN node is inserted at the crossing so BOTH survive as
 *   triangle edges (Trimble's breakline rule); its Z is the EARLIER breakline's interpolation (Civil 3D «first»).
 * - `vertex-on-breakline` — a vertex already in the surface (a survey point, or an earlier breakline's vertex) lies ON a
 *   breakline: on one of its segments (the breakline is split there) or on one of its own vertices (the two merge on the
 *   one dedup grid). Either way the vertex keeps ITS elevation.
 *
 * Only DISAGREEMENTS are reported: two streams that join at the same elevation are a junction, not a problem.
 */
export interface BreaklineElevationConflict {
  readonly kind: 'crossing' | 'vertex-on-breakline';
  /** LOCAL frame (same as {@link TinSurface.positions}). */
  readonly x: number;
  readonly y: number;
  /** The elevation the surface carries at this position. */
  readonly keptZ: number;
  /** What the overruled breakline's own interpolation said. */
  readonly overruledZ: number;
  readonly overruledBreaklineId: string;
}

/**
 * Everything the builder decided on the way to a {@link TinSurface} that the surface itself cannot show. `buildTin`
 * returns only the surface (unchanged API); QA and the owner's preview read this through `buildTinWithReport`.
 */
export interface TinBuildReport {
  readonly surface: TinSurface;
  readonly breaklineConflicts: readonly BreaklineElevationConflict[];
  /**
   * Constraint segments the triangulator still REFUSED after resolution (belt and suspenders — expected 0: every
   * crossing and every vertex-on-segment is resolved before the constrainer runs). Counted, never silently dropped.
   */
  readonly refusedSegmentCount: number;
}

/** A single contour crossing segment within ONE triangle (LOCAL frame). */
export interface ContourSegment {
  readonly level: number;
  readonly a: PlanarPoint;
  readonly b: PlanarPoint;
}

/**
 * A finished contour line at one elevation `level`, in WORLD canonical mm.
 * `isMajor` = index contour (every N-th interval) → heavier layer + label.
 */
export interface ContourLine {
  readonly level: number;
  readonly vertices: readonly PlanarPoint[];
  readonly isMajor: boolean;
  readonly closed: boolean;
}
