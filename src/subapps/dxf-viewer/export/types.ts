/**
 * ============================================================================
 * UNIFIED EXPORT SYSTEM — Core Types (SSoT)
 * ============================================================================
 *
 * Type contract for the DXF Viewer unified export pipeline (DXF / IFC4 / PDF).
 * Mirrors the `print/` engine layering (ADR-453): pure core → format adapters →
 * service facade → UI. These types are pure data (no React, no I/O).
 *
 * ADR-505 — Unified Export System.
 */

import type { Entity, SceneModel } from '../types/entities';
import type { DxfVersion, DxfUnit } from '../types/dxf-export.types';
import type { Level } from '../systems/levels/config';
import type { BuildingRef, FloorRef } from '../bim/utils/bim-floor-utils';

// ============================================================================
// SCOPE ENUMS (the three user-facing axes)
// ============================================================================

/** Target file format. */
export type ExportFormat = 'dxf' | 'ifc' | 'pdf' | 'tek' | 'obj' | 'gltf' | 'dae';

/**
 * ADR-668/678 — τα τρία 3Δ mesh formats. Ένας adapter, τρεις serialisers.
 *   'obj'  → Wavefront OBJ (+ συνοδό `.mtl`) — ανοίγει σε Cinema 4D **R15**, αλλά **άχρωμο**
 *            (ο R15 OBJ importer δεν διαβάζει υλικά — ground-truth ADR-678).
 *   'gltf' → glTF 2.0 binary (.glb) — Blender / C4D 2024+ / κάθε σύγχρονο DCC.
 *   'dae'  → COLLADA 1.4.1 (XML) — το ΜΟΝΟ εγγράψιμο format που το **R15 διαβάζει ΜΕ χρώματα**
 *            (per-face). Ίδια σκηνή/υλικά με τα άλλα δύο, serialiser XML.
 */
export type Mesh3dFormat = Extract<ExportFormat, 'obj' | 'gltf' | 'dae'>;

export function isMesh3dFormat(format: ExportFormat): format is Mesh3dFormat {
  return format === 'obj' || format === 'gltf' || format === 'dae';
}

/**
 * ADR-668 — μονάδα μήκους εξαγωγής. **Επαναχρησιμοποιεί** την υπάρχουσα ένωση του DXF
 * (N.12 — ένα SSoT, ίδια `export.units.*` i18n keys) αντί για δεύτερο, πανομοιότυπο union.
 *
 * Γιατί υπάρχει καθόλου για mesh: το OBJ **δεν αποθηκεύει μονάδα** — είναι καθαροί
 * αριθμοί. Ο three κόσμος είναι σε μέτρα (ADR-462), το C4D διαβάζει OBJ ως εκατοστά →
 * 100× μικρό μοντέλο. Οι μεγάλοι (Revit/ArchiCAD) δεν το ψήνουν σιωπηλά ούτε το πετούν
 * στον χρήστη: το κάνουν ρητή επιλογή με σωστό default. Το glTF **επιβάλλει μέτρα** στο
 * spec → εκεί δεν προσφέρεται επιλογή.
 */
export type ExportLengthUnit = DxfUnit;

/**
 * Content filter — which kinds of entities go into the file.
 * `dxf-only`  → only native DXF entities (line/arc/text/…); BIM excluded.
 * `bim-only`  → only BIM entities (wall/column/beam/slab/…).
 * `both`      → everything.
 * SSoT predicate: `isBimEntity()` (see `core/export-entity-scope.ts`).
 */
export type ExportEntityScope = 'dxf-only' | 'bim-only' | 'both';

/**
 * Floor coverage.
 * `active`      → only the currently active level → one file.
 * `all-zip`     → every occupied level → one file each, packaged in a `.zip`.
 * `all-single`  → every occupied level merged into one file, separated by a
 *                 per-floor layer prefix (e.g. `FL01_`).
 */
export type ExportFloorScope = 'active' | 'all-zip' | 'all-single';

/**
 * DXF geometry granularity per target CAD:
 *   'polyline' → polylines/footprints stay single POLYLINE objects (AutoCAD).
 *   'lines'    → exploded to LINE segments (Τέκτονας/FESPA basic parser).
 */
export type DxfLineMode = 'polyline' | 'lines';

/**
 * ADR-643 Φ5b — πώς εξάγεται ένα image-fill hatch στο DXF (το native DXF `HATCH` δεν
 * έχει image fill· απόφαση Giorgio Q3 = ΚΑΙ ΤΑ ΔΥΟ, επιλογή χρήστη):
 *   'solid' → **Ελαφρύ (default)**: υποβάθμιση σε `SOLID` με το μέσο χρώμα της εικόνας
 *             (ασφαλές, πάντα ανοίγει, ελαφρύ single-file `.dxf`).
 *   'image' → **Πιστό**: το raster ταξιδεύει bundled σε `.zip` (relative path,
 *             AutoCAD eTransmit standard)· εξάγεται ως tiled `IMAGE`+`IMAGEDEF`
 *             σε πραγματική διάσταση tile (κοντά στο AutoCAD «Super Hatch»).
 */
export type DxfImageFillMode = 'solid' | 'image';

/**
 * ADR-608 — πώς μεταφέρονται τα annotation symbols στο `.tek`:
 *   'native'   → σύμβολα με built-in Tekton equivalent γίνονται ΕΝΑ type-7 `<object>`
 *                (ενιαίο επιλέξιμο πακέτο, native εμφάνιση Τέκτονα, portable).
 *   'geometry' → η ακριβής δική μας γεωμετρία, αποδομημένη σε γραμμές/τόξα και
 *                ομαδοποιημένη με tags (ίδιο σχέδιο με την οθόνη, ανά-γραμμή οντότητες).
 * Σύμβολα χωρίς equivalent (scale-bar κ.λπ.) μένουν πάντα ως γεωμετρία.
 */
export type TekSymbolMode = 'native' | 'geometry';

/**
 * ADR-648 Στάδιο Ε — πώς μεταφέρονται οι ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ στο `.tek`:
 *   'native'   → native `<hatch>` record με το πλησιέστερο μοτίβο της βιβλιοθήκης του Τέκτονα
 *                (`pattern.inf`). **Ελαφρύ** αρχείο, **επεξεργάσιμο** αντικείμενο στον Τέκτονα,
 *                αλλά **ΚΑΤΑ ΠΡΟΣΕΓΓΙΣΗ** — άλλη βιβλιοθήκη από την `acad.pat`.
 *   'exploded' → οι ΑΚΡΙΒΕΙΣ γραμμές γεμίσματος ως `<line>` records (ίδιες με τον καμβά και το
 *                DXF lines-mode). **Πλήρης ταύτιση** με το AutoCAD, αλλά **ΒΑΡΥ** αρχείο και
 *                μη-επεξεργάσιμο ως ενιαίο hatch.
 *
 * Μετρημένο (ground-truth 2026-07-13): ένα AutoCAD `SQUARE` = 15.318 γραμμές· ως native `<hatch>`
 * ο Τέκτων το ζωγράφισε με 43 διαγώνιες. Το `exploded` έδωσε 15.346 (~0,1% απόκλιση) αλλά ένα
 * πραγματικό σχέδιο βγήκε **107 MB** → γι' αυτό το `native` παραμένει το default.
 *
 * Solid/gradient γεμίσματα μένουν ΠΑΝΤΑ native (δεν έχουν γραμμές μοτίβου να εξαχθούν).
 */
export type TekHatchMode = 'native' | 'exploded';

// ============================================================================
// REQUEST (built by the dialog, consumed by the service facade)
// ============================================================================

export interface ExportRequest {
  readonly format: ExportFormat;
  readonly entityScope: ExportEntityScope;
  readonly floorScope: ExportFloorScope;

  /** DXF-specific — only meaningful when `format === 'dxf'`. */
  readonly dxfVersion?: DxfVersion;
  readonly dxfUnit?: DxfUnit;
  /** DXF geometry mode (POLYLINE vs exploded LINEs). */
  readonly dxfLineMode?: DxfLineMode;
  /** ADR-643 Φ5b — image-fill hatch export mode (solid-downgrade default / faithful IMAGE). */
  readonly dxfImageFillMode?: DxfImageFillMode;

  /** TEK-specific — annotation symbol transfer mode (native objects vs geometry). */
  readonly tekSymbolMode?: TekSymbolMode;

  /** ADR-648 Στάδιο Ε — hatch transfer mode (native pattern = ελαφρύ vs exploded = ταύτιση). */
  readonly tekHatchMode?: TekHatchMode;

  /**
   * ADR-668 — μονάδα του εξαγόμενου OBJ. Meaningful **μόνο** όταν `format === 'obj'`:
   * το glTF είναι spec-locked σε μέτρα. Default `'centimeters'` (ανοίγει σωστά στο C4D
   * χωρίς χειροκίνητο Scale 100).
   */
  readonly mesh3dUnit?: ExportLengthUnit;
}

// ============================================================================
// DEPS (live data gathered by the Host at submit time — never subscribed
// inside the dialog, ADR-040)
// ============================================================================

/** A single level paired with its loaded scene. */
export interface ExportLevelScene {
  readonly level: Level;
  readonly scene: SceneModel;
}

export interface ExportDeps {
  /** Every level that currently has a loaded scene (active + others). */
  readonly levelScenes: readonly ExportLevelScene[];
  /** Id of the active level (used by `floorScope === 'active'`). */
  readonly activeLevelId: string | null;
  /** For filename + IFC/PDF title blocks. */
  readonly projectName: string;
  /** ISO date (YYYY-MM-DD) — for filename + title block. */
  readonly dateStr: string;

  /**
   * ADR-668 — building floors + buildings. Χρειάζονται **μόνο** από τον 3Δ mesh exporter,
   * για να στοιβάξει τους ορόφους στο πραγματικό τους υψόμετρο.
   *
   * Γιατί δεν προκύπτουν από τα `levelScenes`: το `Level` κρατά `order`/`floorId` — **όχι**
   * υψόμετρο. Το FFL βγαίνει από το building floor μέσω `resolveFloorDatumRelativeElevationMm`
   * (ADR-448/ADR-369). Χωρίς αυτά, το «όλοι οι όροφοι σε ένα αρχείο» θα στοίβαζε κάθε όροφο
   * στο Z=0 — δηλαδή ένα κτίριο πατημένο σε ένα επίπεδο.
   *
   * Optional στον τύπο (DXF/TEK δεν τα αγγίζουν), αλλά ο mesh3d **σκάει ρητά** αν λείπουν
   * ενώ στοιβάζει >1 όροφο — fail-closed, ποτέ σιωπηλά λάθος γεωμετρία.
   */
  readonly floors?: readonly FloorRef[];
  readonly buildings?: readonly BuildingRef[];
  /** ADR-668 — active building, για το datum των υψομέτρων. */
  readonly activeBuildingId?: string | null;
}

// ============================================================================
// RESULT
// ============================================================================

export interface ExportResult {
  /** Final filename handed to the browser download (incl. extension). */
  readonly filename: string;
  /** Number of source files packaged (1 for single, N for zip). */
  readonly fileCount: number;
  /** Non-fatal messages (e.g. BIM types with no decomposition yet). */
  readonly warnings: readonly string[];
}

/** A produced file before packaging/download. */
export interface ExportArtifact {
  readonly filename: string;
  readonly blob: Blob;
}

// ============================================================================
// DXF PRIMITIVE DECOMPOSITION (output of `bim-to-dxf-primitives.ts`)
// ============================================================================

/** Native-DXF entities ready for the ezdxf request + any skip warnings. */
export interface DxfFlattenResult {
  readonly entities: Entity[];
  readonly warnings: string[];
}
