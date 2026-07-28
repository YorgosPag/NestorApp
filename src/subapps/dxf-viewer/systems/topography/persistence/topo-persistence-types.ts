'use client';

/**
 * ADR-650 — Topographic persistence types + (de)serialization.
 *
 * The surveyed DEFINITION of a floor's topography persists as **one document per
 * floor** (`floorplan_topo_surfaces/{topo_*}`), mirroring the grid-guide single-doc
 * model (ADR-441) rather than per-entity collections. Big-player model (Civil 3D
 * «Surface Definition» / Revit Toposurface): the SSoT is the raw survey + settings;
 * the TIN, contours and 3D mesh are DERIVED products regenerated on load — never
 * stored as baked geometry.
 *
 * Scale: a typed/CSV survey serializes small (inline in the doc). A point cloud
 * (M8) can be tens of MB — over the 1MB Firestore doc limit — so when the survey
 * payload exceeds {@link TOPO_INLINE_MAX_BYTES} the points/breaklines are offloaded
 * to a Storage blob and the doc keeps only `pointsStoragePath` (see the service).
 *
 * @see ./topo-firestore-service.ts
 * @see ../../../bim/persistence/bim-floor-scope.ts
 */

import type { Timestamp } from 'firebase/firestore';
import type {
  TopoDefinition, TopoBoundary, TopoSurfaceId, CutFillReferenceMode, TerrainSurfaceStyle,
  TopoCropPrefs,
} from '../topo-types';
import { TOPO_CROP_OFF } from '../topo-types';
import type { ContourConfig, ContourDisplayStyle } from '../contour-config';
import { DEFAULT_CONTOUR_CONFIG, DEFAULT_CONTOUR_DISPLAY_STYLE } from '../contour-config';
import type { TopoBakedFrames } from '../topo-baked-frame-store';

/** The two named surfaces a floor owns (Civil 3D collection): surveyed vs designed ground. */
export type TopoSurfacesDefinition = Readonly<Record<TopoSurfaceId, TopoDefinition>>;

/** Persisted 3D display prefs (mirror of `Terrain3DState`). */
export interface TopoTerrain3DPrefs {
  readonly visible: boolean;
  readonly style: TerrainSurfaceStyle;
}

/** Persisted earthworks QUESTION (never the derived answer). */
export interface TopoCutFillPrefs {
  readonly mode: CutFillReferenceMode;
  readonly datumZMm: number;
}

/**
 * The full, in-memory topographic state of a floor gathered from every topo store —
 * the payload the persistence layer round-trips. Definition (SSoT) + all view settings.
 */
export interface TopoPersistedState {
  readonly surfaces: TopoSurfacesDefinition;
  readonly boundary: TopoBoundary | null;
  /** ADR-718 — whether the boundary also crops the surface. Always present in memory. */
  readonly crop: TopoCropPrefs;
  readonly contourConfig: ContourConfig;
  readonly contourDisplayStyle: ContourDisplayStyle;
  readonly terrain3d: TopoTerrain3DPrefs;
  readonly cutFill: TopoCutFillPrefs;
  /**
   * ADR-650 §M10g — σε ποιο πλαίσιο συντεταγμένων ψήθηκε κάθε ομάδα ψημένων προϊόντων
   * (κάναβος / ετικέτες / βορράς), ανά επίπεδο. **Απούσα ή άδεια ⇒ legacy**: ο reconciler
   * δεν μαντεύει πλαίσιο, δεν μετακινεί, και σημαδεύει την ομάδα για ξανα-ψήσιμο.
   */
  readonly bakedFrames: TopoBakedFrames;
}

/**
 * Canonical Firestore document — one floor's topographic definition + settings.
 * `surfaces` is inline for small surveys; when offloaded, `surfaces` is absent and
 * `pointsStoragePath` points at the Storage blob holding {@link TopoSurfacesDefinition}.
 */
export interface TopoSurfaceDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly floorId?: string;
  /** Inline survey definition (small surveys). Absent when offloaded to Storage. */
  readonly surfaces?: TopoSurfacesDefinition;
  /** Storage path of the offloaded {@link TopoSurfacesDefinition} blob (large clouds). */
  readonly pointsStoragePath?: string;
  readonly boundary: TopoBoundary | null;
  /**
   * ADR-718 — η κοπή στο όριο. **Απούσα σε legacy έγγραφα ⇒ `TOPO_CROP_OFF`**: ένα έργο που
   * αποθηκεύτηκε πριν το χαρακτηριστικό δεν επιτρέπεται να αποκτήσει κοπή σιωπηλά — θα μίκραινε
   * η επιφάνεια, θα άλλαζαν οι όγκοι εκσκαφής, και μαζί τους μια τιμή.
   */
  readonly crop?: TopoCropPrefs;
  readonly contourConfig: ContourConfig;
  readonly contourDisplayStyle: ContourDisplayStyle;
  readonly terrain3d: TopoTerrain3DPrefs;
  readonly cutFill: TopoCutFillPrefs;
  /** ADR-650 §M10g — σφραγίδες πλαισίου ανά επίπεδο/ομάδα. Απούσα σε legacy έγγραφα. */
  readonly bakedFrames?: TopoBakedFrames;
  /** Monotonic counter — informational (last-write-wins v1). */
  readonly version: number;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

/** Payload size above which the survey definition is offloaded to a Storage blob. */
export const TOPO_INLINE_MAX_BYTES = 700_000;

/**
 * Deterministic JSON with recursively SORTED object keys — so a doc echoed back from
 * Firestore (whose map fields may deserialize in a different key order) produces the
 * SAME signature as the in-memory state that wrote it. Without this the anti-echo guard
 * could mis-compare and re-save in a loop.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',');
  return `{${body}}`;
}

/**
 * Stable string signature for no-op / anti-echo comparison (key-order independent).
 *
 * ⚠️ **Κάθε πεδίο που γράφεται στο έγγραφο ΠΡΕΠΕΙ να είναι εδώ.** Η υπογραφή είναι το κριτήριο
 * δύο αποφάσεων και στις δύο κατευθύνσεις: το debounced save κάνει early-return όταν η υπογραφή
 * δεν άλλαξε, και το `hydrate` απορρίπτει ως «δικό μας ηχώ» ένα εισερχόμενο έγγραφο με ίδια
 * υπογραφή. Πεδίο που περσιστάρεται αλλά λείπει από εδώ **δεν αποθηκεύεται ποτέ** (καμία άλλη
 * αλλαγή δεν το συνοδεύει) ΚΑΙ **δεν φορτώνεται ποτέ** από απομακρυσμένη αλλαγή — σιωπηλά, χωρίς
 * σφάλμα. Το `crop` έλειπε ακριβώς έτσι μέχρι το ADR-718: ο χρήστης άναβε την κοπή, το save
 * θεωρούσε ότι δεν άλλαξε τίποτα, και το reload επανέφερε ακομμάτιαστη επιφάνεια — δηλαδή
 * άλλους όγκους εκσκαφής από αυτούς που είδε στην οθόνη.
 *
 * `boundaryLink` **δεν** ανήκει εδώ: είναι εφήμερη παρατήρηση για τη σκηνή, δεν περσιστάρεται.
 */
export function topoStateSignature(state: TopoPersistedState): string {
  return stableStringify({
    surfaces: state.surfaces,
    boundary: state.boundary,
    crop: state.crop ?? TOPO_CROP_OFF,
    contourConfig: state.contourConfig,
    contourDisplayStyle: state.contourDisplayStyle,
    terrain3d: state.terrain3d,
    cutFill: state.cutFill,
    bakedFrames: state.bakedFrames,
  });
}

/** Serialized byte size of the survey definition (drives the inline↔Storage decision). */
export function topoDefinitionByteSize(surfaces: TopoSurfacesDefinition): number {
  return JSON.stringify(surfaces).length;
}

/**
 * Is there nothing worth persisting yet? Both surfaces empty AND no boundary means the
 * floor has no survey — never create a doc for it (mirror of the grid-guide empty guard).
 * Settings alone (an unused default interval) do not justify a document.
 */
export function isEmptyTopoState(state: TopoPersistedState): boolean {
  const noPoints =
    state.surfaces.existing.points.length === 0 &&
    state.surfaces.proposed.points.length === 0;
  return noPoints && state.boundary === null;
}

/** The settings half of the document (everything except the survey definition). */
export function topoSettingsDocFields(state: TopoPersistedState): {
  boundary: TopoBoundary | null;
  crop: TopoCropPrefs;
  contourConfig: ContourConfig;
  contourDisplayStyle: ContourDisplayStyle;
  terrain3d: TopoTerrain3DPrefs;
  cutFill: TopoCutFillPrefs;
  bakedFrames: TopoBakedFrames;
} {
  return {
    boundary: state.boundary,
    crop: state.crop ?? TOPO_CROP_OFF,
    contourConfig: state.contourConfig,
    contourDisplayStyle: state.contourDisplayStyle,
    terrain3d: state.terrain3d,
    cutFill: state.cutFill,
    // ADR-650 §M10g — γράφεται από την ΙΔΙΑ συνάρτηση με τα υπόλοιπα settings, ώστε create και
    // update να μη μπορούν να αποκλίνουν (ένα σπίτι για το «τι πάει στο έγγραφο»).
    bakedFrames: state.bakedFrames,
  };
}

/**
 * `TopoSurfaceDoc` → in-memory `TopoPersistedState`, defaulting any absent field so an
 * older/partial doc still hydrates. `surfaces` come either inline (this function) or, when
 * offloaded, from the Storage blob the caller merges in via {@link withSurfaces}.
 */
export function docToTopoState(doc: TopoSurfaceDoc): TopoPersistedState {
  const emptyDef: TopoDefinition = { points: [], breaklines: [] };
  return {
    surfaces: doc.surfaces ?? { existing: emptyDef, proposed: emptyDef },
    boundary: doc.boundary ?? null,
    // ADR-718 — legacy έγγραφο: **καμία** κοπή. Το default δεν είναι διακοσμητικό: αν ένα παλιό
    // έργο ξυπνούσε κομμένο, θα μίκραιναν σιωπηλά οι όγκοι εκσκαφής του.
    crop: doc.crop ?? TOPO_CROP_OFF,
    contourConfig: doc.contourConfig ?? DEFAULT_CONTOUR_CONFIG,
    contourDisplayStyle: doc.contourDisplayStyle ?? DEFAULT_CONTOUR_DISPLAY_STYLE,
    terrain3d: doc.terrain3d ?? { visible: false, style: 'shaded' },
    cutFill: doc.cutFill ?? { mode: 'datum', datumZMm: 0 },
    // ADR-650 §M10g — legacy έγγραφο: **καμία** σφραγίδα. Το `{}` δεν είναι «όλα εντάξει»,
    // είναι «δεν ξέρω» — και ο reconciler το διαβάζει έτσι (fail-closed).
    bakedFrames: doc.bakedFrames ?? {},
  };
}

/** Replace the surfaces of a state (used after reading an offloaded Storage blob). */
export function withSurfaces(
  state: TopoPersistedState,
  surfaces: TopoSurfacesDefinition,
): TopoPersistedState {
  return { ...state, surfaces };
}
