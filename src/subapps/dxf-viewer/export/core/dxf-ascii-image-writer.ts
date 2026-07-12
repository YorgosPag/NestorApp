/**
 * DXF ASCII — native `IMAGE` entity + `IMAGEDEF` (OBJECTS section) writer.
 *
 * ADR-643 Φ5b — **πιστή** DXF εξαγωγή ενός image-fill hatch (image mode). Το native DXF `HATCH`
 * δεν έχει image fill, οπότε το raster πλακίδιο εξάγεται ως tiled `IMAGE` entities (ένα ανά tile,
 * σε πραγματική διάσταση) που δείχνουν σε ΕΝΑ κοινό `IMAGEDEF` object (κοντά στο AutoCAD «Super
 * Hatch»). Η γεωμετρία τοποθέτησης (inserts + πραγματική διάσταση tile + γωνία) προ-υπολογίζεται
 * client-side από τον `image-fill-export.ts` pre-pass (`dxfImageExport` marker) — εδώ γίνεται pure
 * σειριοποίηση, ίδιο idiom με το `dxf-ascii-mline-writer` (entity + OBJECTS dictionary + handles).
 *
 * ⚠️ Fidelity boundary (documented, ADR-643 §6): το raster αναφέρεται ως **εξωτερικό αρχείο**
 * (relative path, bundled σε `.zip` — AutoCAD eTransmit standard· το DXF δεν ενσωματώνει pixels).
 * Δεν εκπέμπουμε `RASTERVARIABLES`/`IMAGEDEF_REACTOR` (AutoCAD εφαρμόζει defaults / regen)· η
 * περικοπή στο boundary γίνεται σε επίπεδο tile (even-odd PIP culling) αντί per-image clip polygon.
 * Real-AutoCAD οπτική επικύρωση: pending (κανένας IMAGE import reader για round-trip).
 *
 * Split out (N.7.1 file-size SRP) — mirror των tables/hatch/mline/text writers.
 *
 * @module export/core/dxf-ascii-image-writer
 * @see export/core/image-fill-export — ο client pre-pass που παράγει το `dxfImageExport` marker
 */

import type { Entity, HatchEntity, DxfImageExportMarker } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { Pair } from './dxf-ascii-hatch-writer';
import type { HandleAllocator } from './dxf-ascii-handle-allocator';

/** Legacy reserved OBJECTS-section handles (μόνο όταν δεν δίνεται allocator — bare/round-trip
 *  callers): `4A` = το ACAD_IMAGE_DICT dictionary, `4B…` = τα IMAGEDEF objects. Διακριτά από τα
 *  MLINE (`2A`/`2B…`) ώστε να μη συγκρούονται σε co-occurrence. ADR-644 (#5): ο professional
 *  (AutoCAD) path περνά τον κοινό allocator → όλα από το ΕΝΑ `$HANDSEED`-covered pool. */
const IMAGE_DICT_HANDLE = '4A';
const IMAGE_DEF_HANDLE_BASE = 0x4b;

/** Ένα deduped IMAGEDEF: filename (= relative path) + intrinsic pixel size + handle. */
interface ImageDefEntry {
  readonly filename: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly handle: string;
}

/** A deduped IMAGEDEF registry (ένα object ανά distinct raster filename). */
export interface ImageDefRegistry {
  readonly defs: readonly ImageDefEntry[];
  /** True όταν κανένα hatch δεν έφερε `dxfImageExport` → η OBJECTS συνεισφορά παραλείπεται. */
  readonly isEmpty: boolean;
  /** Handle του ACAD_IMAGE_DICT dictionary (owner `330` κάθε IMAGEDEF). */
  readonly dictHandle: string;
  /** Handle που ένα δοσμένο raster filename resolve-άρει (για το IMAGE group 340). */
  handleFor(filename: string): string;
}

/**
 * Σάρωσε τα entities για `dxfImageExport` markers (image-mode hatches) και χτίσε name-deduped
 * IMAGEDEF registry — δύο hatch ίδιου raster μοιράζονται ΕΝΑ IMAGEDEF (AutoCAD image defs
 * dedup ανά path). Με `allocator` (professional path) κάθε handle βγαίνει από το κοινό pool
 * ώστε το `$HANDSEED` να τα καλύπτει· χωρίς αυτόν χρησιμοποιείται το reserved block (byte-identical).
 */
export function buildImageDefRegistry(
  entities: readonly Entity[], allocator?: HandleAllocator,
): ImageDefRegistry {
  const byName = new Map<string, ImageDefEntry>();
  for (const e of entities) {
    if (e.type !== 'hatch') continue;
    const marker = (e as HatchEntity).dxfImageExport;
    if (!marker || byName.has(marker.filename)) continue;
    const handle = allocator
      ? allocator.next()
      : (IMAGE_DEF_HANDLE_BASE + byName.size).toString(16).toUpperCase();
    byName.set(marker.filename, {
      filename: marker.filename, pixelWidth: marker.pixelWidth, pixelHeight: marker.pixelHeight, handle,
    });
  }
  const defs = [...byName.values()];
  const dictHandle = defs.length > 0 && allocator ? allocator.next() : IMAGE_DICT_HANDLE;
  return {
    defs,
    isEmpty: defs.length === 0,
    dictHandle,
    handleFor: (filename) => byName.get(filename)?.handle ?? dictHandle,
  };
}

// ─── IMAGE entity ─────────────────────────────────────────────────────────────

/**
 * Εκπέμπει όλα τα tiled `IMAGE` entities ενός image-mode hatch — ένα ανά `insert` (κάτω-αριστερή
 * γωνία tile), όλα δείχνοντας στο κοινό `imageDefHandle`. Το U/V vector δίνει τη διάσταση ΕΝΟΣ
 * pixel σε WCS ώστε το πλακίδιο να καλύπτει ακριβώς `tileWorld{Width,Height}` (× coordinate scale)
 * περιστραμμένο κατά `angleDeg` — άρα το εξαγόμενο raster έχει την ΠΡΑΓΜΑΤΙΚΗ διάσταση σε κάθε zoom.
 */
export function emitImageTiles(
  pair: Pair, marker: DxfImageExportMarker, imageDefHandle: string,
  layer: string, aci: number, s: number,
): void {
  if (marker.pixelWidth <= 0 || marker.pixelHeight <= 0) return;
  const rad = (marker.angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const uLen = (marker.tileWorldWidth * s) / marker.pixelWidth;   // ένα pixel πλάτους σε WCS
  const vLen = (marker.tileWorldHeight * s) / marker.pixelHeight; // ένα pixel ύψους σε WCS
  const u: Point2D = { x: uLen * cos, y: uLen * sin };
  const v: Point2D = { x: -vLen * sin, y: vLen * cos };           // «πάνω» άξονας εικόνας
  for (const insert of marker.inserts) {
    emitImage(pair, insert, u, v, marker.pixelWidth, marker.pixelHeight, imageDefHandle, layer, aci, s);
  }
}

/** Ένα `IMAGE` (AcDbRasterImage): insertion (lower-left) + U/V pixel vectors + pixel size + 340→IMAGEDEF. */
function emitImage(
  pair: Pair, insert: Point2D, u: Point2D, v: Point2D, pixelW: number, pixelH: number,
  imageDefHandle: string, layer: string, aci: number, s: number,
): void {
  pair(0, 'IMAGE');
  pair(100, 'AcDbEntity');
  pair(8, layer);
  pair(62, aci);
  pair(100, 'AcDbRasterImage');
  pair(90, 0);                                    // class version
  pair(10, insert.x * s); pair(20, insert.y * s); pair(30, 0); // insertion (WCS lower-left)
  pair(11, u.x); pair(21, u.y); pair(31, 0);      // U-vector (one pixel width, already ×s)
  pair(12, v.x); pair(22, v.y); pair(32, 0);      // V-vector (one pixel height, already ×s)
  pair(13, pixelW); pair(23, pixelH);             // image size in pixels
  pair(340, imageDefHandle);                      // hard reference → IMAGEDEF
  pair(70, 7);                                    // display flags: show + show-unaligned + transparency
  pair(280, 0);                                   // clipping off (culled at tile granularity)
  pair(281, 50); pair(282, 50); pair(283, 0);     // brightness / contrast / fade
  pair(71, 1);                                    // clip boundary type = rectangular
  pair(91, 2);                                    // clip vertex count
  pair(14, -0.5); pair(24, -0.5);                 // clip rect (pixel coords) lower-left
  pair(14, pixelW - 0.5); pair(24, pixelH - 0.5); // clip rect upper-right
}

// ─── OBJECTS section (IMAGEDEF) ───────────────────────────────────────────────

/**
 * Εκπέμπει τα IMAGE OBJECTS blocks (ACAD_IMAGE_DICT dictionary + ένα `IMAGEDEF` ανά distinct
 * raster) **χωρίς** το `SECTION`/`ENDSEC` wrapper — ο κύριος writer τα βάζει στην ΕΝΑ κοινή
 * `OBJECTS` section μαζί με τα MLINESTYLE blocks (το DXF επιτρέπει μία μόνο OBJECTS section).
 * No-op όταν κανένα image δεν εξήχθη.
 */
export function emitImageDefBlocks(pair: Pair, registry: ImageDefRegistry): void {
  if (registry.isEmpty) return;
  // ACAD_IMAGE_DICT dictionary (owner κάθε IMAGEDEF· entries keyed by filename).
  pair(0, 'DICTIONARY');
  pair(5, registry.dictHandle);
  pair(330, '0');
  pair(100, 'AcDbDictionary');
  for (const d of registry.defs) {
    pair(3, d.filename);
    pair(350, d.handle);
  }
  for (const d of registry.defs) emitImageDef(pair, d, registry.dictHandle);
}

/** Ένα `IMAGEDEF` (AcDbRasterImageDef): relative filename (group 1) + pixel size + loaded flag. */
function emitImageDef(pair: Pair, d: ImageDefEntry, dictHandle: string): void {
  pair(0, 'IMAGEDEF');
  pair(5, d.handle);
  pair(330, dictHandle);
  pair(100, 'AcDbRasterImageDef');
  pair(90, 0);                          // class version
  pair(1, d.filename);                  // relative path (bundled στο zip)
  pair(10, d.pixelWidth);               // image size in pixels (U)
  pair(20, d.pixelHeight);              // image size in pixels (V)
  pair(11, 1); pair(21, 1);             // default size of one pixel (AutoCAD units) — μέγεθος από το IMAGE U/V
  pair(280, 1);                         // image is loaded = 1
  pair(281, 0);                         // resolution units = none
}
