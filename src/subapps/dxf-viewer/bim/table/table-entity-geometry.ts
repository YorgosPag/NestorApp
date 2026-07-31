/**
 * ADR-739 Φάση Γ — **η παράγωγη γεωμετρία του `TableEntity`** (SSoT μονάδων + πλαισίου).
 *
 * Εδώ ζουν, από **μία** φορά η καθεμιά, οι τρεις μετατροπές που όλοι οι καταναλωτές
 * (ζωγράφος, hit-test, λαβές, όρια, inline editor) πρέπει να συμφωνούν:
 *
 * 1. **sheet-mm → μονάδες σκηνής** — `paperHeightToModel(1, drawingScale, sceneUnits)`,
 *    το ΙΔΙΟ SSoT που διπλώνει το πάχος του scale-bar και το ύψος κάθε διαστασιολόγησης
 *    (`utils/annotation-scale.ts`). Ο πίνακας είναι **annotative**, όπως κάθε σημείωση.
 * 2. **αναστροφή y** — η διάταξη μετρά `+v` προς τα **κάτω** (jsPDF / `DetailPrimitive`),
 *    η σκηνή `+y` προς τα **πάνω**. Η αναστροφή γίνεται **μόνο** στο
 *    {@link tableFrameToWorld}. Δεύτερο αντίγραφό της = μισή εφαρμογή ζωγραφίζει ανάποδα.
 * 3. **περιστροφή** γύρω από την άγκυρα — `tableFrameToWorld` / `tableWorldToFrame`,
 *    αυστηρά αντίστροφες μεταξύ τους (καρφωμένο με round-trip test).
 *
 * ## Γιατί η διάταξη είναι απομνημονευμένη σε WeakMap
 * Ο §6 απαιτεί «διάταξη **ποτέ** ανά καρέ». Το κλειδί είναι η **ταυτότητα** του
 * `TableModel`: το μοντέλο είναι `readonly` παντού, άρα αλλαγή περιεχομένου ⇒ νέο
 * αντικείμενο ⇒ φυσική ακύρωση, χωρίς χειροκίνητο `invalidate()` που κάποιος θα ξεχνούσε
 * να καλέσει. `WeakMap` ⇒ ο πίνακας που σβήστηκε από τη σκηνή δεν κρατά τη διάταξή του
 * ζωντανή.
 *
 * ⚠️ Η λανθάνουσα μνήμη **δεν** κλειδώνεται στο `drawingScale`: η διάταξη είναι σε
 * sheet-mm και είναι **αναλλοίωτη** ως προς την κλίμακα σχεδίασης — η κλίμακα μπαίνει
 * μόνο ως πολλαπλασιαστής `mmToWorld` στο τέλος. Αυτό είναι και ο λόγος που ένα zoom ή
 * μια αλλαγή 1:100→1:50 δεν ξαναϋπολογίζει τίποτα.
 *
 * @module subapps/dxf-viewer/bim/table/table-entity-geometry
 * @see types/table-entity.ts — το συμβόλαιο της οντότητας
 * @see bim/table/table-layout.ts — η ΜΟΝΗ μηχανή διάταξης (δεν ξαναγράφεται εδώ, N.18)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §4.1, §6
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { paperHeightToModel } from '../../utils/annotation-scale';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import type { TableModel } from '../../types/table';
import type {
  TableBBox,
  TableCellHit,
  TableEntity,
  TableEntityGeometry,
  TableFramePoint,
} from '../../types/table-entity';
import type { TableLayout } from './table-layout-types';
import { layoutTable } from './table-layout';
import type { TableStyle } from './table-style';
import { getTableStyleRegistry } from './table-style-registry';

// ──────────────────────────────────────────────────────────────────────────────
// 1. Η ΜΙΑ γέφυρα μονάδων
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Μονάδες σκηνής ανά **ένα** sheet-mm, στην κλίμακα σχεδίασης `drawingScale`. Καθαρή —
 * καμία ανάγνωση store, ώστε να είναι δοκιμάσιμη και να μπορεί να την καλέσει ο
 * ζωγράφος με τη δική του ενεθειμένη μονάδα.
 */
export function tableMmToWorld(drawingScale: number, sceneUnits: SceneUnits = 'mm'): number {
  return paperHeightToModel(1, drawingScale, sceneUnits);
}

/**
 * Το ίδιο, με το **ζωντανό** `drawingScale` SSoT (ανάγνωση getter τη στιγμή της
 * κλήσης — καμία συνδρομή, ADR-040). Το χρησιμοποιούν τα καθαρά μονοπάτια
 * ορίων/hit-test που ξέρουν μόνο sheet-mm, ακριβώς όπως το
 * `scaleBarModelHalfThicknessLive`.
 */
export function tableMmToWorldLive(sceneUnits: SceneUnits = 'mm'): number {
  return tableMmToWorld(useDrawingScaleStore.getState().drawingScale, sceneUnits);
}

// ──────────────────────────────────────────────────────────────────────────────
// 2+3. Πλαίσιο ↔ κόσμος (αναστροφή y + περιστροφή)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Σημείο πλαισίου `(u, v)` σε **sheet-mm από την πάνω-αριστερή γωνία, +v κάτω** →
 * μονάδες σκηνής. Η **μοναδική** αναστροφή y και η **μοναδική** περιστροφή του πίνακα.
 */
export function tableFrameToWorld(
  entity: Pick<TableEntity, 'position' | 'angleRad'>,
  u: number,
  v: number,
  mmToWorld: number,
): Point2D {
  const cos = Math.cos(entity.angleRad);
  const sin = Math.sin(entity.angleRad);
  const su = u * mmToWorld;
  // Η αναστροφή: `+v` κάτω στο χαρτί είναι `−y` στη σκηνή.
  const sv = -v * mmToWorld;
  return {
    x: entity.position.x + su * cos - sv * sin,
    y: entity.position.y + su * sin + sv * cos,
  };
}

/**
 * Το αυστηρό αντίστροφο του {@link tableFrameToWorld}: μονάδες σκηνής → `(u, v)` σε
 * sheet-mm. Το χρησιμοποιούν το hit-test κελιού και το σύρσιμο λαβών ορίου.
 *
 * `mmToWorld ≤ 0` (εκφυλισμένη κλίμακα) ⇒ `(0, 0)`: χωρίς αυτό η διαίρεση θα έδινε
 * `Infinity`/`NaN` και κάθε σύγκριση θα ήταν σιωπηλά ψευδής — δηλαδή ο πίνακας απλώς
 * «δεν θα πιανόταν» χωρίς κανένα ίχνος.
 */
export function tableWorldToFrame(
  entity: Pick<TableEntity, 'position' | 'angleRad'>,
  world: Point2D,
  mmToWorld: number,
): TableFramePoint {
  if (!(mmToWorld > 0)) return { u: 0, v: 0 };
  const cos = Math.cos(entity.angleRad);
  const sin = Math.sin(entity.angleRad);
  const a = (world.x - entity.position.x) / mmToWorld;
  const b = (world.y - entity.position.y) / mmToWorld;
  // Αντίστροφη περιστροφή, μετά αναστροφή του v (γι' αυτό το `-` στο δεύτερο σκέλος).
  return {
    u: a * cos + b * sin,
    v: a * sin - b * cos,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Απομνημονευμένη διάταξη
// ──────────────────────────────────────────────────────────────────────────────

/** `TableModel` → (styleId → διάταξη). Το μοντέλο είναι immutable ⇒ ταυτότητα = έκδοση. */
const LAYOUT_CACHE = new WeakMap<TableModel, Map<string, TableLayout>>();

/**
 * Η διάταξη ενός μοντέλου με δεδομένο στυλ, υπολογισμένη **το πολύ μία φορά**. Ίδιο
 * μοντέλο + ίδιο στυλ ⇒ **η ίδια αναφορά** (προϋπόθεση για να μπορεί ο ζωγράφος να
 * συγκρίνει με `===` χωρίς βαθιά σύγκριση).
 */
export function resolveTableLayout(model: TableModel, style: TableStyle): TableLayout {
  let byStyle = LAYOUT_CACHE.get(model);
  if (!byStyle) {
    byStyle = new Map<string, TableLayout>();
    LAYOUT_CACHE.set(model, byStyle);
  }
  const cached = byStyle.get(style.id);
  if (cached) return cached;
  const layout = layoutTable(model, style);
  byStyle.set(style.id, layout);
  return layout;
}

/**
 * Το στυλ μιας οντότητας από το μητρώο· άγνωστο `styleId` ⇒ το ενεργό στυλ. Ένας
 * πίνακας που δείχνει σε σβησμένο στυλ **πρέπει** να εξακολουθεί να ζωγραφίζεται:
 * αόρατη οντότητα είναι χειρότερη από οντότητα με λάθος μολύβι (και το `styleId`
 * μένει άθικτο, άρα η επαναφορά του στυλ την επαναφέρει αυτούσια).
 */
export function resolveTableStyle(entity: Pick<TableEntity, 'styleId'>): TableStyle {
  const registry = getTableStyleRegistry();
  return registry.getStyle(entity.styleId) ?? registry.getActiveStyle();
}

// ──────────────────────────────────────────────────────────────────────────────
// Η πλήρης παράγωγη γεωμετρία
// ──────────────────────────────────────────────────────────────────────────────

/** Το κουτί τεσσάρων γωνιών. */
function bboxOfCorners(corners: readonly Point2D[]): TableBBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Η πλήρης γεωμετρία ενός πίνακα. Καθαρή + ταυτοδύναμη. `drawingScale` ρητό ώστε τα
 * tests να είναι ντετερμινιστικά· η ζωντανή εκδοχή είναι το
 * {@link computeTableEntityGeometryLive}.
 */
export function computeTableEntityGeometry(
  entity: TableEntity,
  drawingScale: number,
  sceneUnits: SceneUnits = 'mm',
): TableEntityGeometry {
  const style = resolveTableStyle(entity);
  const layout = resolveTableLayout(entity.model, style);
  const mmToWorld = tableMmToWorld(drawingScale, sceneUnits);

  // TL → TR → BR → BL (δεξιόστροφα στο πλαίσιο του χαρτιού· η αναστροφή y τα κάνει
  // αριστερόστροφα στη σκηνή, όπως και στα υπόλοιπα ορθογώνια annotations).
  const worldCorners: Point2D[] = [
    tableFrameToWorld(entity, 0, 0, mmToWorld),
    tableFrameToWorld(entity, layout.widthMm, 0, mmToWorld),
    tableFrameToWorld(entity, layout.widthMm, layout.heightMm, mmToWorld),
    tableFrameToWorld(entity, 0, layout.heightMm, mmToWorld),
  ];

  return {
    layout,
    mmToWorld,
    worldWidth: layout.widthMm * mmToWorld,
    worldHeight: layout.heightMm * mmToWorld,
    worldCorners,
    bbox: bboxOfCorners(worldCorners),
  };
}

/** Με το ζωντανό `drawingScale` SSoT (getter τη στιγμή της κλήσης, ADR-040). */
export function computeTableEntityGeometryLive(
  entity: TableEntity,
  sceneUnits: SceneUnits = 'mm',
): TableEntityGeometry {
  return computeTableEntityGeometry(
    entity,
    useDrawingScaleStore.getState().drawingScale,
    sceneUnits,
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ερωτήματα πάνω στη διάταξη
// ──────────────────────────────────────────────────────────────────────────────

/** Το κελί που περιέχει το σημείο πλαισίου, ή `null` έξω από κάθε κελί. */
export function tableCellAtFrame(layout: TableLayout, frame: TableFramePoint): TableCellHit | null {
  for (const cell of layout.cells) {
    const { x, y, w, h } = cell.rect;
    if (frame.u >= x && frame.u <= x + w && frame.v >= y && frame.v <= y + h) {
      return { rowId: cell.rowId, colId: cell.colId, rectMm: { x, y, w, h } };
    }
  }
  return null;
}

/**
 * Το κελί κάτω από ένα σημείο **σκηνής** — η μοναδική διαδρομή που θα καλέσει ο inline
 * editor της Φ.Δ (world → frame → cell), ώστε να μη γεννηθεί δεύτερο hit-test κελιού.
 */
export function tableCellAtWorld(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
): TableCellHit | null {
  const frame = tableWorldToFrame(entity, world, geometry.mmToWorld);
  return tableCellAtFrame(geometry.layout, frame);
}
