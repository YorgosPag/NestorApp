/**
 * ADR-739 Φάση Θ — **ο πίνακας στο 3Δ υπόστρωμα DXF**, χωρίς καμία νέα γεωμετρία.
 *
 * ## Γιατί ΔΕΝ γράφτηκε δικό του `TableSceneLayer`
 * Το προηγούμενο σχέδιο προέβλεπε imperative layer + React leaf + mount (πρότυπο
 * `TerrainSceneLayer`). Η αναγνώριση το ανέτρεψε: το `topo-surface` χρειάζεται δικό του layer
 * επειδή ο ορισμός του ζει σε **store** (`TopoPointStore`) και δεν περνά ποτέ από το
 * `dxfScene.entities`. Ο πίνακας είναι το αντίθετο — το `DxfTable` **είναι ήδη μέλος** του
 * `DxfEntityUnion` και **φτάνει ήδη** στο `DxfToThreeConverter.buildLineGroup` μαζί με κάθε
 * άλλη οντότητα. Εκεί έπεφτε στο `default: break` του `appendEntitySegments`.
 *
 * Άρα δεν έλειπε υποδομή· έλειπε **μία διακλάδωση**. Και επειδή ο πίνακας μπαίνει στο υπάρχον
 * μονοπάτι, κληρονομεί **δωρεάν** ό,τι εκείνο έχει ήδη πληρώσει: στοίβαξη ορόφων + υψόμετρο
 * (`floorElevationMm`), κλίμακα μονάδων (`group.scale`), ομαδοποίηση ανά χρώμα, streaming του
 * κειμένου με προτεραιότητα, frustum culling, το `markSceneDirty` του converter, και το
 * post-FX underlay pass. Ένα ξεχωριστό layer θα ξαναέγραφε και τα επτά.
 *
 * ## Η αλυσίδα — ήδη ολόκληρη, εδώ απλώς συνδέεται
 * ```
 *   layoutTable → tableLayoutToPrimitives → tableFrameToWorld → makeLine / makeText
 *                 (η ΙΔΙΑ που τροφοδοτεί PDF / DXF / ΤΕΚ, μέσω `decomposeTable`)
 *     → εδώ: line → `appendEntitySegments` · text → `AtlasTextMeshBuilder`
 * ```
 * Γι' αυτό ο πίνακας του 3Δ **δεν μπορεί** να διαφωνήσει με τον πίνακα του χαρτιού: δεν
 * υπάρχει δεύτερη μηχανή διάταξης να αποκλίνει. Ένα χειρόγραφο `table-to-atlas-text.ts` θα
 * ήταν ακριβώς ο sibling clone που το CHECK 3.28 (N.18) απαγορεύει.
 *
 * @module bim-3d/converters/dxf-table-3d-decompose
 * @see export/core/table-to-primitives.ts — `decomposeTable`, η ΜΙΑ αποδόμηση
 * @see bim/text/project-scene-text.ts — `projectSceneEntityText`, ο ΕΝΑΣ επίπεδος καθρέφτης
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §44
 */

import type { DxfEntityUnion, DxfText, DxfTable } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Entity, SceneLayer } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { TableEntity } from '../../types/table-entity';
import { isTableEntity } from '../../types/table-entity';
import { decomposeTable } from '../../export/core/table-to-primitives';
import { projectSceneEntityText } from '../../bim/text/project-scene-text';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
import { appendEntitySegments } from './dxf-underlay-segments';
import { resolveEntityColor } from './dxf-overlay-entity-color';
// 🏢 ADR-571 — hex → packed 0xRRGGBB SSoT (μηδέν τοπικό parseInt).
import { hexToTrueColor } from '../../utils/dxf-true-color';

/**
 * Ένας αποδομημένος πίνακας, χωρισμένος στα **δύο** μονοπάτια που το 3Δ υπόστρωμα ήδη
 * διαθέτει: γραμμές σε buffer θέσεων ανά χρώμα, κείμενο σε merged atlas mesh.
 */
export interface DxfTable3DParts {
  /** Γραμμές πλέγματος + υπογραμμίσεις — τροφοδοτούν το `appendEntitySegments`. */
  readonly segments: readonly DxfEntityUnion[];
  /** Κείμενο κελιών — τροφοδοτεί τον `AtlasTextMeshBuilder` (μία κλήση draw). */
  readonly texts: readonly DxfText[];
  /**
   * 🔴 **Τα γεμίσματα κελιών — και γιατί ΔΕΝ επιτρέπεται να παραλειφθούν.**
   *
   * Η πρώτη εκδοχή αυτού του αρχείου τα απέρριπτε ρητά, με το επιχείρημα «το υπόστρωμα είναι
   * wireframe, δεν ζωγραφίζει κανένα hatch». Το επιχείρημα ήταν εσωτερικά συνεπές και **λάθος**,
   * γιατί αγνοούσε τη σύζευξη που το `tableCellBackdrop` δηλώνει ρητά:
   *
   * > *«Το γέμισμα του κελιού **νικά** την επιφάνεια»* — `table-ink.ts`
   *
   * Το αυτόματο μελάνι (§38) επιλύεται **στη διάταξη**, με backdrop το γέμισμα όπου υπάρχει.
   * Μια γκρίζα κεφαλίδα (`#EDEDED`) παίρνει λοιπόν **μαύρο** μελάνι — σωστό, όσο το γκρι
   * ζωγραφίζεται. Χωρίς το γέμισμα, το ίδιο μαύρο κάθεται πάνω στο σκούρο φόντο σκηνής
   * (`#1d283a`): αντίθεση **1,27:1**, δηλαδή **αόρατη κεφαλίδα** — ενώ ο πίνακας «εμφανίστηκε»
   * κανονικά και κάθε πύλη έμεινε πράσινη.
   *
   * Άρα δεν υπάρχει επιλογή «παράλειψη»: ή τιμάς την προϋπόθεση του κανόνα, ή ο κανόνας λέει
   * ψέματα. Τα γεμίσματα ζωγραφίζονται. Ο πίνακας γίνεται η **μόνη** γεμισμένη επιφάνεια του
   * υποστρώματος — και αυτό είναι σωστό, γιατί είναι και η μόνη οντότητά του που **κατέχει**
   * τυπογραφία εξαρτημένη από το φόντο της.
   */
  readonly fills: readonly TableFill3D[];
}

/** Ένα γεμισμένο κελί: το τετράπλευρό του σε μονάδες σκηνής + το χρώμα του. */
export interface TableFill3D {
  /** Οι τέσσερις γωνίες στο επίπεδο κάτοψης (η χαρτογράφηση `y → −Z` γίνεται στον χτίστη). */
  readonly ring: readonly { readonly x: number; readonly y: number }[];
  /** Επιλυμένο χρώμα Three.js (0xRRGGBB) — ίδιος καταρράκτης με τις γραμμές. */
  readonly colorInt: number;
}

const EMPTY: DxfTable3DParts = { segments: [], texts: [], fills: [] };

/**
 * 🔴 **Η επιφάνεια κάτω από τον πίνακα, στο 3Δ.**
 *
 * Ο `envmap-generator.ts:52` γράφει `scene.background = new THREE.Color(
 * resolveDxfCanvasBackgroundHex())` — δηλαδή το φόντο της 3Δ σκηνής **είναι**, κυριολεκτικά,
 * η ίδια τιμή που βλέπει ο 2Δ καμβάς. Άρα ο πίνακας κάθεται πάνω στην ίδια επιφάνεια και
 * στις δύο προβολές, και το αυτόματο μελάνι (§38, σημασιολογία ACI 7) λύνεται σωστά μία φορά.
 *
 * ⚠️ **ΟΧΙ η προεπιλογή «χαρτί»** του {@link decomposeTable}: εκείνη υπάρχει για την εξαγωγή,
 * που καταλήγει σε λευκή σελίδα. Στο προεπιλεγμένο θέμα `nestorApp1 (#1d283a)` το μελάνι
 * χαρτιού δίνει αντίθεση **1,27:1** — πίνακας που «εμφανίστηκε» αλλά δεν διαβάζεται, δηλαδή
 * αποτυχία που καμία πύλη δεν πιάνει.
 *
 * ⚠️ **ΟΧΙ το `liveTableSurfaceHex()`**: εκείνο περνά πρώτα από το `getPrintColorPolicy()`, που
 * είναι η πολιτική **εκτύπωσης του 2Δ καμβά**. Όσο τυπώνεται μια κάτοψη, το 3Δ φόντο δεν
 * γίνεται λευκό — ο `envmap-generator` δεν ρωτά ποτέ αυτή την πολιτική. Θα βάφαμε μαύρο μελάνι
 * σε σκούρα σκηνή για λόγο εντελώς άσχετο με τη σκηνή.
 *
 * ⚠️ Σε ενεργό HDRI το `scene.background` είναι **υφή**, όχι χρώμα. Επιστρέφουμε πάλι το χρώμα
 * καμβά: είναι η ντετερμινιστική απάντηση, και είναι **η ίδια παραδοχή** που κάνει ήδη το
 * wireframe του υποστρώματος (τα χρώματα γραμμών δεν προσαρμόζονται σε HDRI). Ένας πίνακας
 * που αλλάζει μελάνι επειδή φορτώθηκε ένα .hdr θα ήταν χειρότερος από έναν σταθερό.
 */
export function table3DSurfaceHex(): string {
  return resolveDxfCanvasBackgroundHex();
}

/**
 * Ο πίνακας → γραμμές + κείμενα του 3Δ υποστρώματος, σε **native μονάδες σκηνής** (το ίδιο
 * σύστημα με κάθε άλλη οντότητα εδώ· το `group.scale` του ορόφου τις ανεβάζει σε μέτρα).
 *
 * **Καθαρή**: μηδέν ανάγνωση store, ώστε να είναι ντετερμινιστικά δοκιμάσιμη. Η ζωντανή
 * εκδοχή είναι το {@link decomposeTableForUnderlay3DLive} — ακριβώς το ζεύγος
 * `computeTableEntityGeometry` / `…Live` που το ίδιο το ADR-739 §4.1 καθιέρωσε.
 */
export function decomposeTableForUnderlay3D(
  table: TableEntity,
  drawingScale: number,
  sceneUnits: SceneUnits,
  surfaceHex: string,
): DxfTable3DParts {
  const decomposed = decomposeTable(table, drawingScale, sceneUnits, surfaceHex);
  if (decomposed.length === 0) return EMPTY;

  const segments: DxfEntityUnion[] = [];
  const texts: DxfText[] = [];
  const fills: TableFill3D[] = [];
  for (const part of decomposed) {
    if (part.type === 'line') {
      // Δομικά ένα `DxfLine`: το `makeLine` κληρονομεί id/layerId/visible + το ρητό μολύβι
      // (`color` + `colorTrueColor`), δηλαδή ό,τι ακριβώς διαβάζει το `resolveEntityColor`.
      segments.push(part as unknown as DxfEntityUnion);
      continue;
    }
    if (part.type === 'text') {
      const text = toUnderlayText(part);
      if (text) texts.push(text);
      continue;
    }
    if (part.type === 'hatch') {
      const fill = toUnderlayFill(part);
      if (fill) fills.push(fill);
    }
  }
  return { segments, texts, fills };
}

/**
 * Γέμισμα κελιού → τετράπλευρο του υποστρώματος.
 *
 * Το `makeSolidFill` παράγει **πάντα** τετράπλευρο για κελί πίνακα (ορθογώνιο κελιού), με το
 * ring στα `boundaryPaths[0]`. Οτιδήποτε άλλο (>4 ή <3 κορυφές) απορρίπτεται ρητά αντί να
 * τριγωνοποιηθεί με γενικό αλγόριθμο: ένας τέτοιος αλγόριθμος εδώ θα ήταν **δεύτερη**
 * υλοποίηση τριγωνοποίησης στο repo, για είσοδο που η μηχανή διάταξης δεν παράγει ποτέ.
 */
function toUnderlayFill(part: Entity): TableFill3D | null {
  const hatch = part as unknown as {
    boundaryPaths?: readonly (readonly { x: number; y: number }[])[];
    color?: string;
    colorTrueColor?: number;
  };
  const ring = hatch.boundaryPaths?.[0];
  if (!ring || ring.length !== 4) return null;
  const colorInt = hatch.colorTrueColor ?? (hatch.color ? hexToTrueColor(hatch.color) : null);
  if (colorInt === null) return null;
  return { ring, colorInt: colorInt & 0xFFFFFF };
}

/**
 * Το ίδιο, με τα **ζωντανά** SSoT (κλίμακα σχεδίασης + επιφάνεια), διαβασμένα με getter τη
 * στιγμή της κλήσης — καμία συνδρομή, ADR-040. Την καλεί ο converter, ο οποίος τρέχει ήδη
 * εκτός React render.
 *
 * ⚠️ Το `drawingScale` **δεν** διαβάζεται εδώ μόνο: ο converter το περνά και στο κλειδί
 * ταυτοδυναμίας του (`dxf-overlay-sync-guard`). Αν το διάβαζε **μόνο** αυτή η συνάρτηση, μια
 * αλλαγή 1:100 → 1:50 θα άφηνε το κλειδί αμετάβλητο ⇒ ο πίνακας θα έμενε στο **παλιό** μέγεθος
 * μέχρι κάποια άσχετη αλλαγή να ξαναχτίσει τη σκηνή. Γι' αυτό η καθαρή εκδοχή δέχεται τον
 * αριθμό αντί να τον διαβάζει: **μία** ανάγνωση, δύο καταναλωτές που δεν μπορούν να αποκλίνουν.
 */
export function decomposeTableForUnderlay3DLive(
  table: TableEntity,
  sceneUnits: SceneUnits,
): DxfTable3DParts {
  return decomposeTableForUnderlay3D(
    table, useDrawingScaleStore.getState().drawingScale, sceneUnits, table3DSurfaceHex(),
  );
}

/**
 * Αποδομημένο κείμενο → το επίπεδο `DxfText` που ζητά ο atlas.
 *
 * 🔴 **Γιατί χρειάζεται προβολή καθόλου**: το `makeText` γράφει την τυπογραφία στο **AST**
 * (`textNode.paragraphs[0].runs[0].style` — έντονα, πλάγια, οικογένεια), γιατί αυτό είναι το
 * λεξιλόγιο που διαβάζουν DXF group 7, PDF και ΤΕΚ (ADR-344). Ο atlas όμως ρωτά το **επίπεδο**
 * `entity.textStyle` (`resolveTextFont` → `faceKey`). Χωρίς τη μετάφραση, μια **έντονη
 * κεφαλίδα θα ζωγραφιζόταν κανονική** στο 3Δ — σιωπηλά, με κάθε πύλη πράσινη, γιατί το
 * κείμενο θα εμφανιζόταν κανονικότατα, απλώς σε λάθος όψη.
 *
 * Ο μεταφραστής **υπάρχει ήδη** και είναι ο ίδιος που χρησιμοποιούν το ghost των λαβών και ο
 * vector emitter: `projectSceneEntityText` → `extractFirstRunStyle`. Δεύτερη ανάγνωση του AST
 * εδώ θα ήταν το πέμπτο λεξιλόγιο που προειδοποιεί το `neutral-primitive-factory`.
 *
 * 🔴 **Γιατί `{ ...part, ...projected }` και όχι σκέτο `projected`**: το `projectSceneTextToDxf`
 * απαντά στο ερώτημα «πού και με τι γράμματα» — **δεν** μεταφέρει `layerId` / `color` /
 * `colorTrueColor`, γιατί οι καλούντες του (λαβές, όρια) δεν χρωματίζουν. Εδώ χρωματίζουμε: το
 * `resolveEntityColor` διαβάζει ακριβώς αυτά τα πεδία, και σκέτο το `projected` θα έβγαζε
 * **κάθε κελί λευκό** — χάνοντας το μελάνι που η διάταξη μόλις υπολόγισε σωστά. Ξεκινώντας από
 * την πλήρη αποδομημένη οντότητα, κάθε **μελλοντικό** πεδίο στυλ του `makeText` κληρονομείται
 * αυτόματα· μια χειρόγραφη λίστα πεδίων θα ήταν ένα ακόμα ζεύγος λιστών να αποκλίνει.
 */
function toUnderlayText(part: Entity): DxfText | null {
  const projected = projectSceneEntityText(part, part.id);
  if (!projected) return null;
  return { ...(part as unknown as DxfText), ...projected };
}

// ──────────────────────────────────────────────────────────────────────────────
// Η σύνδεση με τον χτίστη του ορόφου
// ──────────────────────────────────────────────────────────────────────────────

/** ADR-739 Φ.Θ — οι δεξαμενές του υποστρώματος, όπως τις γεμίζει το `buildLineGroup`. */
export interface TableUnderlaySink {
  /** Η ζωντανή κλίμακα σχεδίασης, διαβασμένη **μία φορά** ανά sync από τον converter. */
  readonly drawingScale: number;
  readonly sceneUnits: SceneUnits;
  /** Θέσεις ανά επιλυμένο χρώμα — ένα `LineSegments` ανά κλειδί. */
  readonly colorBuckets: Map<number, number[]>;
  /** Η ουρά κειμένου του ορόφου — καταλήγει στον κοινό `AtlasTextMeshBuilder`. */
  readonly textEntities: DxfText[];
  /**
   * Τρίγωνα γεμίσματος ανά χρώμα — ένα `THREE.Mesh` ανά κλειδί, ζωγραφισμένο **κάτω** από το
   * πλέγμα και τα γράμματα. Ξεχωριστός χάρτης από τα `colorBuckets`: εκείνα είναι ζεύγη
   * κορυφών για `LineSegments`, αυτά τριάδες για `Mesh` — ίδιο χρώμα, **ασύμβατη** τοπολογία.
   */
  readonly fillBuckets: Map<number, number[]>;
  /**
   * Ο πίνακας στρωμάτων — **περνά κανονικά**, δεν είναι διακοσμητικός. Κάθε αποδομημένο
   * κομμάτι κληρονομεί το `layerId` του πίνακα (`inheritStyle`), οπότε ένα κομμάτι χωρίς ρητό
   * μολύβι οφείλει να πέσει στον ByLayer καταρράκτη όπως κάθε άλλη οντότητα. Ένα `undefined`
   * εδώ θα το έβαφε σιωπηλά **λευκό** (`DEFAULT_COLOR`) — σωστό σήμερα κατά σύμπτωση (όλα τα
   * κομμάτια πίνακα φέρουν ρητό χρώμα), λάθος την πρώτη φορά που δεν θα φέρουν.
   */
  readonly layersById: Record<string, SceneLayer> | undefined;
}

/**
 * ADR-739 Φ.Θ — ένας πίνακας → τα δύο υπάρχοντα μονοπάτια του υποστρώματος.
 *
 * Οι γραμμές του **δεν** μπαίνουν σε ένα ενιαίο bucket «του πίνακα»: κάθε αποδομημένο κομμάτι
 * κουβαλά **δικό του** μολύβι (η κεφαλίδα γκρίζα, το εξωτερικό πλαίσιο χοντρό, οι εσωτερικοί
 * διαχωριστές λεπτοί — δες `penFor`), οπότε περνά από το ίδιο `resolveEntityColor` με κάθε
 * άλλη οντότητα και προσγειώνεται στο σωστό bucket. Ένα ενιαίο bucket θα ισοπέδωνε ακριβώς τα
 * χρώματα που η Φ.Ε/Φ1 πλήρωσε για να φτάσουν ως εδώ.
 *
 * Το κείμενο μπαίνει στην **ίδια** ουρά με το υπόλοιπο κείμενο του ορόφου, άρα κληρονομεί
 * αυτούσια τη ροή με προτεραιότητα, τον κοινό atlas και τη μία κλήση draw.
 */
export function appendTableToUnderlay(table: DxfTable, sink: TableUnderlaySink): void {
  // Το καθιερωμένο ιδίωμα γεφύρωσης του repo (ίδιο με `TableRenderer.drawTable`): `DxfTable` και
  // `TableEntity` κουβαλούν τα ΙΔΙΑ πεδία πίνακα (position/angleRad/styleId/model) πάνω σε
  // διαφορετικές βάσεις, και ο φρουρός επιβεβαιώνει τον διακριτή πριν από τη μετατροπή.
  if (!isTableEntity(table)) return;
  const parts = decomposeTableForUnderlay3D(
    table as unknown as TableEntity, sink.drawingScale, sink.sceneUnits, table3DSurfaceHex(),
  );
  for (const segment of parts.segments) {
    appendEntitySegments(bucketFor(sink.colorBuckets, resolveEntityColor(segment, sink.layersById)), segment);
  }
  for (const fill of parts.fills) {
    appendFillTriangles(bucketFor(sink.fillBuckets, fill.colorInt), fill.ring);
  }
  sink.textEntities.push(...parts.texts);
}

/** Ο buffer ενός χρώματος, δημιουργημένος κατ' απαίτηση. */
function bucketFor(buckets: Map<number, number[]>, color: number): number[] {
  let bucket = buckets.get(color);
  if (!bucket) {
    bucket = [];
    buckets.set(color, bucket);
  }
  return bucket;
}

/**
 * Τετράπλευρο κελιού → δύο τρίγωνα στο επίπεδο δαπέδου, με τη **μία** χαρτογράφηση
 * `DXF x → X, DXF y → −Z` — η ίδια που εφαρμόζει το `appendEntitySegments` στις γραμμές. Αν οι
 * δύο αποκλίνανε, το γέμισμα θα καθόταν καθρεφτισμένο ως προς το πλέγμα του.
 *
 * Το ring είναι TL → TR → BR → BL (η σειρά που παράγει το `fillPrimitive`), οπότε τα τρίγωνα
 * είναι `0-1-2` και `0-2-3`. `side: DoubleSide` στο υλικό ⇒ η φορά περιέλιξης δεν έχει σημασία
 * και ένας περιστραμμένος πίνακας δεν εξαφανίζεται από backface culling.
 */
function appendFillTriangles(buf: number[], ring: readonly { x: number; y: number }[]): void {
  // Ο έλεγχος γίνεται ΠΡΙΝ από κάθε εγγραφή, για ΟΛΟ το ring: ένας φρουρός μέσα στον βρόχο θα
  // άφηνε μισό τρίγωνο στον buffer — δηλαδή θα αντάλλασσε το NaN με σκουπίδια γεωμετρία, που
  // είναι χειρότερο (το NaN τουλάχιστον φαίνεται). Ίδια πρόθεση με το `pushSeg` (ADR-537): μία
  // μη πεπερασμένη συντεταγμένη δηλητηριάζει το `Box3` του υποστρώματος → NaN-frame της ΚΟΙΝΗΣ
  // κάμερας → σβήνει ΚΑΙ το BIM. Πέταξε το κελί, κράτα τον πίνακα.
  for (const corner of ring) {
    if (!Number.isFinite(corner.x) || !Number.isFinite(corner.y)) return;
  }
  for (const i of [0, 1, 2, 0, 2, 3]) {
    buf.push(ring[i].x, 0, -ring[i].y);
  }
}
