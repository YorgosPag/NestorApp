/**
 * ADR-608 — Neutral primitive factory (SSoT for decomposed annotation output).
 *
 * A tiny set of builders that turn raw world-space geometry into the neutral
 * `Entity[]` the shared vector emitter (`print/vector/scene-vector-emitter.ts`)
 * AND the DXF ascii writer already understand (line / lwpolyline / circle / arc /
 * text / solid-fill hatch). Every builder inherits the SOURCE entity's plot style
 * (colour / ACI / lineweight / layer / visibility) so the decomposed primitives
 * render with the exact colour the annotation had on screen. Centralised here so
 * the annotation-symbol and scale-bar decomposers share ONE construction path
 * (N.18 — no per-decomposer entity literals drifting apart).
 *
 * Solid fills are emitted as a `hatch` carrying `dxfFaces` (z = 0 planar faces),
 * the SAME carrier `overlay-dxf-collector.ts` uses for BIM poché — so both the
 * vector emitter (`emitHatch` fills each face) and the DXF writer (`3DFACE`) draw
 * them without a new code path.
 *
 * @see print/vector/scene-vector-emitter.ts — the vector backend (input contract)
 * @see export/core/overlay-dxf-collector.ts — the solid-fill hatch carrier SSoT
 * @see export/core/annotation-to-primitives.ts — the sole caller (decomposers)
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  Entity,
  LineEntity,
  LWPolylineEntity,
  CircleEntity,
  ArcEntity,
  HatchEntity,
  TextEntity,
  LineweightMm,
} from '../../types/entities';
// 🏢 Color-Conversion SSoT (ADR-573): hex → packed 0xRRGGBB for DXF group 420.
import { hexToTrueColor } from '../../utils/dxf-true-color';
// ADR-739 Φ.Ε/Φ1 — το ΥΠΑΡΧΟΝ λεξιλόγιο τυπογραφίας του text-engine. Δεύτερος καταναλωτής
// μετά το `detail-primitives-to-entities.ts` (ADR-651), με το ΙΔΙΟ ιδίωμα: ένα run, ένα
// paragraph, ένας κόμβος. Καμία νέα έννοια «έντονου» — αυτή είναι η μία που υπάρχει.
import {
  DEFAULT_RUN_STYLE,
  makeNode,
  makeParagraph,
  makeRun,
} from '../../text-engine/templates/defaults/template-helpers';
// ADR-635 Φ C.25 — στοίχιση → σειρά **γραμμής βάσης** του πλέγματος 9 σημείων. Ο ΙΔΙΟΣ
// χάρτης που διαβάζει ο importer· δες {@link makeText} για το γιατί είναι κρίσιμος.
import { ALIGNMENT_TO_ATTACHMENT } from '../../utils/dxf-text-anchor';

/**
 * Optional vertical-baseline hint the vector emitter honours for a decomposed
 * label. `TextEntity.alignment` carries the horizontal side; this carries the
 * vertical anchor (annotation glyph labels + scale-bar numerals want `middle`,
 * scene text keeps the default `alphabetic`). Absent ⇒ emitter default.
 */
export interface VectorTextBaselineHint {
  readonly vBaseline?: 'alphabetic' | 'top' | 'middle' | 'bottom';
}

/** A neutral text entity that may carry the emitter baseline hint. */
export type NeutralTextEntity = TextEntity & VectorTextBaselineHint;

/** Plot-style fields copied onto every decomposed primitive (mirror what the emitter reads). */
interface InheritedStyle {
  readonly layerId: string;
  readonly color?: string;
  readonly colorAci?: number;
  /** The ISO plot-width union, NOT a free number — it is copied straight off `Entity`. */
  readonly lineweightMm?: LineweightMm;
  readonly visible: boolean;
  /**
   * ADR-608 — grouping provenance: the SOURCE annotation/scale-bar id. Every
   * primitive of ONE symbol shares it so the TEK writer emits ONE shared
   * `<taglist>` tag (and the DXF writer ONE anonymous BLOCK) per symbol → the
   * symbol re-assembles as a single selectable unit in Tekton / AutoCAD.
   */
  readonly groupId: string;
}

/** Snapshot the source entity's plot style so each primitive renders identically. */
function inheritStyle(source: Entity): InheritedStyle {
  return {
    layerId: source.layerId,
    color: source.color,
    colorAci: source.colorAci,
    lineweightMm: source.lineweightMm,
    visible: source.visible ?? true,
    groupId: source.id,
  };
}

/**
 * 🔴 ADR-739 Φ.Ε/Φ1 — **το ρητό μολύβι ενός primitive**, όταν το αποδομούμενο σχέδιο ορίζει
 * δικό του χρώμα/πάχος ανά στοιχείο (ένας πίνακας: γκρίζα κεφαλίδα, χοντρό εξωτερικό
 * πλαίσιο, λεπτοί εσωτερικοί διαχωριστές). Απόν ⇒ ισχύει ακέραιη η κληρονομιά του
 * {@link inheritStyle} — τα σύμβολα σημείωσης και ο χάρακας κλίμακας δεν αλλάζουν byte.
 */
export interface NeutralPen {
  /** `#rrggbb` — νικά το κληρονομημένο χρώμα της οντότητας-πηγής. */
  readonly colorHex?: string;
  /** Πάχος από τον κατάλογο ISO (`nearestIsoLineweight`) — νικά το κληρονομημένο. */
  readonly lineweightMm?: LineweightMm;
  /** Μοτίβο διακεκομμένης σε **world units**· το τιμούν καμβάς/preview (`BaseEntity.dashMm`). */
  readonly dashMm?: readonly number[];
}

/**
 * 🔴 **Ρητό χρώμα ⇒ ΣΒΗΝΕΙ το κληρονομημένο `colorAci`. Δεν είναι λεπτομέρεια.**
 *
 * Ο `resolveAci` (`dxf-ascii-writer-helpers.ts`) διαβάζει με σειρά προτεραιότητας
 * `colorTrueColor > colorAci > color`. Το {@link inheritStyle} αντιγράφει το `colorAci` της
 * οντότητας-πηγής, οπότε ένα `color: '#EDEDED'` γραμμένο **δίπλα** σε κληρονομημένο
 * `colorAci` θα αγνοούνταν **σιωπηλά** — το primitive θα έβγαινε στο χρώμα ολόκληρου του
 * πίνακα και το σφάλμα θα φαινόταν μόνο σε πίνακα που ο χρήστης είχε βάψει.
 *
 * Το `colorTrueColor` δεν είναι πλεονασμός: η παλέτα ACI έχει **έξι** γκρι, και το
 * `#EDEDED` της κεφαλίδας πέφτει στο ACI **7 — την κανονική λευκή/μαύρη πένα** (μετρημένο
 * στο `settings/standards/aci.ts`). Χωρίς group 420 η γκρίζα κεφαλίδα βγαίνει **λευκή** στο
 * CAD και **μαύρη** στην εκτύπωση (το `applyPlotColor` κάνει ρητά το ACI 7 μαύρο μελάνι) —
 * ακριβώς το σύμπτωμα που αυτή η φάση διορθώνει. Δες `emitEntityStyle`.
 */
function withPen(style: InheritedStyle, pen?: NeutralPen): InheritedStyle & {
  readonly colorTrueColor?: number;
  readonly dashMm?: readonly number[];
} {
  if (!pen) return style;
  const colored = pen.colorHex
    ? {
      ...style,
      color: pen.colorHex,
      colorAci: undefined,
      colorTrueColor: hexToTrueColor(pen.colorHex),
    }
    : style;
  return {
    ...colored,
    ...(pen.lineweightMm !== undefined ? { lineweightMm: pen.lineweightMm } : {}),
    // Το `dashMm` μπαίνει **μόνο** όταν υπάρχει (ίδιος κανόνας με το `borderPrimitive`):
    // ρητό `undefined` αλλάζει το σχήμα του αντικειμένου και σπάει snapshots.
    ...(pen.dashMm && pen.dashMm.length > 0 ? { dashMm: pen.dashMm } : {}),
  };
}

export function makeLine(
  source: Entity, id: string, start: Point2D, end: Point2D, pen?: NeutralPen,
): LineEntity {
  return { ...withPen(inheritStyle(source), pen), id, type: 'line', start, end };
}

export function makePolyline(
  source: Entity, id: string, vertices: readonly Point2D[], closed: boolean,
): LWPolylineEntity {
  return { ...inheritStyle(source), id, type: 'lwpolyline', vertices: [...vertices], closed };
}

export function makeCircle(source: Entity, id: string, center: Point2D, radius: number): CircleEntity {
  return { ...inheritStyle(source), id, type: 'circle', center, radius };
}

export function makeArc(
  source: Entity, id: string, center: Point2D, radius: number, startAngle: number, endAngle: number,
): ArcEntity {
  return { ...inheritStyle(source), id, type: 'arc', center, radius, startAngle, endAngle };
}

/**
 * Solid fill → `hatch` carrying one planar `dxfFaces` face (z = 0). Boundary paths
 * mirror the ring so the DXF native-hatch fallback still has a loop; the vector
 * emitter fills the face directly.
 *
 * ⚠️ ADR-739 Φ.Ε/Φ1 — `colorHex` **δεν είναι προαιρετική διακόσμηση**: χωρίς αυτό το
 * `fillColor` έπαιρνε το `style.color`, δηλαδή **κληρονομούσε** το ενιαίο χρώμα της
 * οντότητας-πηγής. Ένα γέμισμα κελιού πίνακα έχει εξ ορισμού **δικό του** χρώμα (γκρίζα
 * κεφαλίδα μέσα σε μαύρο πίνακα), οπότε ο μόνος τρόπος να χρησιμοποιηθεί σωστά είναι με
 * ρητό χρώμα. Απόν ⇒ η ιστορική συμπεριφορά ακέραιη (σύμβολα σημείωσης, χάρακας κλίμακας).
 */
export function makeSolidFill(
  source: Entity, id: string, ring: readonly Point2D[], colorHex?: string,
): HatchEntity {
  const style = withPen(inheritStyle(source), colorHex ? { colorHex } : undefined);
  const boundary = ring.map((p) => ({ x: p.x, y: p.y }));
  return {
    ...style,
    id,
    type: 'hatch',
    fillColor: style.color,
    // 🔴 ADR-739 Φ.Ε/Φ1 — **τρίγωνο/τετράπλευρο ⇒ native `SOLID`, ΟΧΙ `3DFACE`.**
    //
    // Μετρημένο στο ίδιο το αρχείο του Giorgio (`Ισόγειο_Ισόγειο (5).dxf`, 2026-08-02): το
    // γέμισμα γραφόταν σωστά — `3DFACE` με `420 = 15592941` (= ακριβώς `#EDEDED`) — και
    // **δεν φαινόταν**. Το `3DFACE` είναι οντότητα **επιφάνειας 3Δ**: στα wireframe visual
    // styles ζωγραφίζονται μόνο οι **ακμές** της, γεμίζει μόνο σε σκιασμένα. Ο μηχανικός
    // όμως σχεδιάζει σε **2D Wireframe** — δηλαδή το γέμισμα ήταν αόρατο ακριβώς εκεί όπου
    // υπάρχει. Το `SOLID` είναι η **2Δ** συμπαγής οντότητα: γεμίζει στο 2D Wireframe
    // (FILLMODE=1) και είναι ό,τι παράγει το ίδιο το AutoCAD για φόντο κελιού.
    //
    // Ο δρόμος **υπήρχε ήδη**: ο dispatcher δρομολογεί `dxfSourceType` + 3/4 κορυφές στο
    // `emitQuadFill` (ADR-636 Φ2.4 D.3). Δεν γράφεται νέο μονοπάτι — δηλώνεται ο τύπος.
    //
    // ⚠️ Ring με >4 κορυφές (κύκλοι γραμματοσειράς, πολύγωνα συμβόλων) **δεν** μπαίνει εδώ:
    // το `SOLID` δέχεται το πολύ 4 γωνίες. Αυτά μένουν `3DFACE` — υπάρχον χρέος, όχι νέο.
    ...(ring.length === 3 || ring.length === 4 ? { dxfSourceType: 'solid' as const } : {}),
    patternType: 'solid',
    patternName: 'SOLID',
    boundaryPaths: [boundary],
    // ONE planar (z = 0) face — same carrier as ADR-505 §C poché; x/y in scene mm.
    // `dxfFaces` is an array OF faces (each face = a corner ring), so a single
    // polygon must be wrapped: `[ring]`, NOT the bare `ring` (else `emitHatch`
    // iterates corners, `corner.length` is undefined, and nothing fills).
    dxfFaces: [ring.map((p) => ({ x: p.x, y: p.y, zMm: 0 }))],
  } as HatchEntity;
}

export interface NeutralTextOptions {
  readonly position: Point2D;
  readonly text: string;
  /** Cap height in world units (model mm). */
  readonly height: number;
  readonly alignment: 'left' | 'center' | 'right';
  /** Rotation in degrees (0 = upright label). */
  readonly rotationDeg: number;
  readonly vBaseline: VectorTextBaselineHint['vBaseline'];
  /**
   * ADR-739 Φ.Ε/Φ1 — ρητό χρώμα μελανιού (`#rrggbb`)· απόν ⇒ κληρονομιά από την πηγή.
   * Ίδιος κανόνας με το {@link NeutralPen}, ίδια υλοποίηση ({@link withPen}).
   */
  readonly colorHex?: string;
  /**
   * ADR-739 Φ.Ε/Φ1 — **έντονο**. `undefined` = «δεν έχω άποψη για την τυπογραφία» ⇒ καμία
   * αλλαγή· `true`/`false` = «την κατέχω» ⇒ γεννιέται `textNode`. Δες {@link makeText}.
   */
  readonly bold?: boolean;
  /**
   * ADR-739 Φ.Ε/Φ2 βήμα 4 — **πλάγια**. Ίδια σύμβαση με το {@link bold}: `undefined` = καμία
   * άποψη ⇒ ο κόμβος δεν γεννιέται γι' αυτό τον λόγο.
   */
  readonly italic?: boolean;
  /**
   * ADR-739 Φ.Ε/Φ2 βήμα 4 — η **τυπογραφική οικογένεια**. Καταλήγει στο `RunStyle.fontFamily`,
   * απ' όπου ο `readTextEntityFamily` την ανεβάζει σε group 7 + STYLE record.
   */
  readonly fontFamily?: string;
}

/**
 * 🔴 ADR-739 Φ.Ε/Φ1 — **ο κόμβος τυπογραφίας ενός αποδομημένου κειμένου.**
 *
 * ## Γιατί `textNode` και όχι ένα νέο πεδίο `bold` πάνω στην οντότητα
 * Το `TextEntity` **δεν έχει** — και δεν πρέπει να αποκτήσει — flat `bold`. Το CAD
 * λεξιλόγιο του έργου βάζει την ανά-run τυπογραφία στο AST (ADR-344), και **όλοι** οι
 * αναγνώστες το ξέρουν ήδη: `extractFirstRunStyle` → `projectSceneTextToDxf().textStyle`
 * (PDF), `readTextEntityFamily` → group 7 (DXF), `resolveTextHeight` (ύψος). Ένα δεύτερο,
 * flat `bold` θα ήταν πέμπτο λεξιλόγιο που κανείς από αυτούς δεν διαβάζει.
 *
 * ## 🔴 Γιατί το `attachment` ΠΡΕΠΕΙ να είναι σειρά `B*` — και τι σπάει αλλιώς
 * Ο exporter διαβάζει την κατακόρυφη στοίχιση με `alignFromTextEntity` →
 * `attachmentToVJust(node.attachment)`, που δίνει **0 (γραμμή βάσης) μόνο** για `BL/BC/BR`
 * (`T*` → 3, `M*` → 2). Το `position` ενός `TableTextRun` **ΕΙΝΑΙ** η γραμμή βάσης — αυτή
 * είναι η ρητή σύμβαση του `TextPrimitive` και το σφάλμα των 1,5mm που πλήρωσε η Φ.Β.
 * Ένα `attachment: 'TL'` (η προεπιλογή του `makeNode`!) θα έγραφε `73 = 3` και θα
 * κρεμούσε **κάθε** κείμενο κελιού από την κορυφή του — δηλαδή θα μετακινούσε ολόκληρο
 * τον πίνακα κατά ένα ύψος κεφαλαίου, ως «παρενέργεια» της προσθήκης του έντονου.
 * Με τον {@link ALIGNMENT_TO_ATTACHMENT} (τον ΙΔΙΟ χάρτη που διαβάζει ο importer) το
 * `v` μένει 0 και η εξαγόμενη γεωμετρία είναι **byte-identical** με πριν.
 *
 * ## Γιατί το ύψος μπαίνει ΚΑΙ στο run
 * Ο `resolveTextHeight` ρωτά **πρώτα** το run και μόνο μετά τα flat πεδία. Ένας κόμβος
 * χωρίς ύψος θα άφηνε την ISO προεπιλογή των 2,5 να νικήσει το πραγματικό ύψος του κελιού.
 */
function neutralTextNode(opts: NeutralTextOptions): TextEntity['textNode'] {
  const run = makeRun(opts.text, {
    ...DEFAULT_RUN_STYLE,
    height: opts.height,
    bold: opts.bold ?? false,
    // ADR-739 Φ.Ε/Φ2 βήμα 4 — τα πλάγια μπαίνουν στο **run**, όπως τα έντονα: εκεί τα
    // διαβάζουν και οι τρεις αναγνώστες (group 7 του DXF, `textStyle` του PDF, ύψος του ΤΕΚ)
    // χωρίς κανείς να μάθει νέο πεδίο.
    italic: opts.italic ?? false,
    // ⚠️ Η **υπογράμμιση** ΔΕΝ μπαίνει εδώ, παρότι το `RunStyle` έχει το πεδίο: στην
    // αποδομημένη διαδρομή έχει ήδη γίνει **γραμμή** στο επίπεδο των primitives (δες
    // `table-layout-to-primitives`). Ένα δεύτερο `underline: true` στο run θα σήμαινε ότι ο
    // επόμενος αναγνώστης του AST τη ζωγραφίζει **δεύτερη φορά**, μισό pixel παραπέρα.
    ...(opts.fontFamily !== undefined && { fontFamily: opts.fontFamily }),
  });
  return makeNode([makeParagraph([run])], {
    attachment: ALIGNMENT_TO_ATTACHMENT[opts.alignment],
    rotation: opts.rotationDeg,
  });
}

export function makeText(source: Entity, id: string, opts: NeutralTextOptions): NeutralTextEntity {
  return {
    ...withPen(inheritStyle(source), opts.colorHex ? { colorHex: opts.colorHex } : undefined),
    id,
    type: 'text',
    position: opts.position,
    text: opts.text,
    height: opts.height,
    alignment: opts.alignment,
    rotation: opts.rotationDeg,
    vBaseline: opts.vBaseline,
    // Ο κόμβος γεννιέται **μόνο** όταν ο καλών δηλώνει άποψη για την τυπογραφία. Τα σύμβολα
    // σημείωσης και ο χάρακας κλίμακας δεν δηλώνουν ⇒ μένουν χωρίς `textNode`, ακριβώς όπως
    // πριν (group 7 = STANDARD, κανένα STYLE record, μηδέν μεταβολή στα byte τους).
    //
    // ADR-739 Φ.Ε/Φ2 βήμα 4 — **οποιοδήποτε** από τα τρία αρκεί: μια οντότητα που δηλώνει
    // μόνο οικογένεια (χωρίς άποψη για βάρος) οφείλει να πάρει το style της, αλλιώς το
    // χειριστήριο γραμματοσειράς του βήματος 5 θα ρύθμιζε κάτι που δεν τυπώνεται — δηλαδή
    // ακριβώς το ελάττωμα που η απόφαση Α1 βάζει αυτό το βήμα να προλάβει.
    ...(opts.bold !== undefined || opts.italic !== undefined || opts.fontFamily !== undefined
      ? { textNode: neutralTextNode(opts) }
      : {}),
  };
}

/** Δειγματοληψία κλειστού κύκλου σε ring πολυγώνου (world space) — για solid-fill glyphs. */
const SOLID_CIRCLE_SEGMENTS = 32;

/**
 * Full-circle polygon (world space) — το ring που γεμίζει ένας solid κύκλος στα flat
 * backends (μέσω `makeSolidFill`). SSoT: το χρησιμοποιούν και τα annotation-symbol και τα
 * svg-glyph decomposers (N.18 — καμία δεύτερη υλοποίηση κύκλου-σε-πολύγωνο).
 */
export function circlePolygon(
  center: Point2D, radius: number, segments: number = SOLID_CIRCLE_SEGMENTS,
): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}
