/**
 * ADR-652 M3 — Η γεωμετρία της ΕΤΟΙΜΗΣ βιβλιοθήκης, ΧΩΡΙΣ νέα γεωμετρία.
 *
 * ΤΟ ΚΡΙΣΙΜΟ SSoT ΕΥΡΗΜΑ: δεν χρειάζεται να σχεδιάσουμε (ούτε να αγοράσουμε) περιεχόμενο —
 * η εφαρμογή έχει ΗΔΗ 16 παραμετρικά 2D σύμβολα κάτοψης, δικής μας συγγραφής (ADR-415:
 * είδη υγιεινής / κουζίνα / έπιπλα). Το M3 τα **παράγει** ως blocks αντί να γράψει δεύτερο
 * κατάλογο σχημάτων — αν αύριο διορθωθεί ο νιπτήρας στο ADR-415, το επόμενο seed run
 * κουβαλά τη διόρθωση αυτόματα.
 *
 * Νομικά: `source: 'parametric (own)'` (ADR-415 Δ1) ⇒ δική μας συγγραφή ⇒ **αναδιανέμεται**
 * (`redistributable: true`) — γι' αυτό αυτό ακριβώς το περιεχόμενο επιτρέπεται να ζήσει σε
 * `scope:'system'`, ενώ ένα ξένο DXF του χρήστη όχι.
 *
 * Μετατροπή: το σύμβολο εκφράζεται σε πολυγραμμές (outline + inner strokes) γύρω από το
 * (0,0) → ΑΚΡΙΒΩΣ το BLOCK-LOCAL συμβόλαιο (`InSessionBlockDef.localMembers`, base στο
 * origin). Καμία νέα αναπαράσταση, κανένας νέος renderer.
 *
 * Pure module (μηδέν Firebase/React) — τρέχει και στο seed script (Node) και στα tests.
 *
 * @see ../floorplan-symbols/floorplan-symbol-symbol.ts — ο drawer SSoT (δεν αντιγράφεται)
 * @see ../data/system-blocks-seed.ts — ποια preset γίνονται blocks + άδεια/κατηγορία
 */

import type { Entity, PolylineEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { FloorplanSymbolPreset } from '../floorplan-symbols/floorplan-symbol-catalog';
import type { FloorplanSymbolParams } from '../types/floorplan-symbol-types';
import { computeFloorplanSymbolGeometry } from '../floorplan-symbols/floorplan-symbol-geometry';
import {
  buildFloorplanSymbol,
  type SymbolStroke,
} from '../floorplan-symbols/floorplan-symbol-symbol';

/**
 * Layer των members ενός seeded block. `'0'` = το default layer του placement
 * (`BlockPlacementParams.layerId`, AutoCAD layer 0) — ίδια σύμβαση με ό,τι φτιάχνει το
 * import, οπότε δεν εισάγεται νέα έννοια layer.
 */
const SEED_MEMBER_LAYER_ID = '0';

/** Point3D του συμβόλου → Point2D του entity (τα σύμβολα είναι επίπεδα, z ≡ 0). */
function toPoint2D(p: { readonly x: number; readonly y: number }): Point2D {
  return { x: p.x, y: p.y };
}

/**
 * Μια πολυγραμμή του συμβόλου → `PolylineEntity`. Τα ids είναι **ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΑ**
 * (`{blockId}_s{index}`): το seed είναι idempotent (ξανατρέξιμο ⇒ ίδιο blob), και κάθε
 * τοποθέτηση ούτως ή άλλως κλωνοποιεί με φρέσκα ids (`buildBlockEntityFromDef`).
 */
function strokeToPolyline(stroke: SymbolStroke, blockId: string, index: number): PolylineEntity {
  const vertices = stroke.map(toPoint2D);
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const closed =
    vertices.length > 2 && first !== undefined && last !== undefined
      ? first.x === last.x && first.y === last.y
      : false;

  return {
    id: `${blockId}_s${index}`,
    type: 'polyline',
    layerId: SEED_MEMBER_LAYER_ID,
    // Κλειστό σχήμα → πετάμε το διπλό τελευταίο σημείο (το `closed` το κλείνει).
    vertices: closed ? vertices.slice(0, -1) : vertices,
    closed,
    visible: true,
  };
}

/**
 * Preset του ADR-415 → BLOCK-LOCAL members. Το σύμβολο χτίζεται στο origin, χωρίς
 * στροφή, σε mm (`sceneUnits: 'mm'` ⇒ scale 1) — δηλαδή ήδη σε BLOCK-LOCAL space:
 * base = κέντρο = (0,0), και το placement transform (θέση/γωνία/κλίμακα) μπαίνει
 * ΜΕΤΑ, από το tool.
 */
export function buildSystemBlockMembers(
  preset: FloorplanSymbolPreset,
  blockId: string,
): readonly Entity[] {
  // ΕΝΑ params object — το ίδιο τροφοδοτεί και τον υπολογισμό του footprint και τον drawer.
  const params: FloorplanSymbolParams = {
    category: preset.category,
    kind: preset.kind,
    assetId: preset.id,
    position: { x: 0, y: 0, z: 0 },
    rotationDeg: 0,
    widthMm: preset.widthMm,
    depthMm: preset.depthMm,
    sceneUnits: 'mm',
  };

  const symbol = buildFloorplanSymbol(params, computeFloorplanSymbolGeometry(params));

  // Το outline είναι ανοιχτό polygon (4 κορυφές) → το κλείνουμε ρητά· τα inner strokes
  // έρχονται από τον drawer (κλειστά ή ανοιχτά, το αναγνωρίζει ο `strokeToPolyline`).
  const outline: PolylineEntity = {
    id: `${blockId}_s0`,
    type: 'polyline',
    layerId: SEED_MEMBER_LAYER_ID,
    vertices: symbol.outline.map(toPoint2D),
    closed: true,
    visible: true,
  };

  const strokes = symbol.strokes.map((stroke, i) => strokeToPolyline(stroke, blockId, i + 1));
  return [outline, ...strokes];
}
