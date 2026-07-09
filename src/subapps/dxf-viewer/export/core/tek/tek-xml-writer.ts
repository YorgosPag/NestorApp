/**
 * ADR-507/508 (Tekton .TEK export) — XML serialization (pure SSoT, mirror dxf-ascii-writer).
 *
 * Παράγει τα `<record>` (τοίχοι/objects) και τα εγχέει στους markers του skeleton
 * template. Το template περνά ως ΟΡΙΣΜΑ (ο adapter το lazy-load-άρει) → ο writer μένει
 * ελαφρύς/testable, ΧΩΡΙΣ να import-άρει το 2.3MB skeleton.
 */

import { escapeXml } from '@/lib/xml/escape-xml';
import {
  WALL_RECORD_TEMPLATE,
  OPEN_RECORD_TEMPLATE,
  PLANE_RECORD_TEMPLATE,
  PLANE_POINT_TEMPLATE,
  AUTOROOF_RECORD_TEMPLATE,
  AUTOROOF_POINT_TEMPLATE,
  AUTOROOF_V3_TEMPLATE,
  LINE_RECORD_TEMPLATE,
  ARC_RECORD_TEMPLATE,
  STAIR_RECORD_HEAD,
  STAIR_RECORD_TAIL,
  OBJECT_RECORD_TEMPLATE,
  TEXT_RECORD_TEMPLATE,
  HATCH_RECORD_TEMPLATE,
  HATCH_EDGE_TEMPLATE,
} from './tek-record-templates';
import type {
  TekArc, TekHatch, TekHatchEdge, TekLine, TekObject, TekOpening, TekPlane, TekPlanePoint, TekRoof,
  TekRoofFace, TekRoofPoint, TekStair, TekStairPoint, TekText, TekWall, TekXMatrix,
} from './tek-types';

export { escapeXml }; // SSoT στο src/lib/xml — re-export για consumers/tests του TEK module.

// Markers — literal-synced με το auto-generated tek-skeleton.template.ts (μηδέν import εκεί).
const TEK_WALL_MARKER = '<!--TEK_WALL_RECORDS-->';
const TEK_OBJECT_MARKER = '<!--TEK_OBJECT_RECORDS-->';
const TEK_PLANE_MARKER = '<!--TEK_PLANE_RECORDS-->';
const TEK_AUTOROOF_MARKER = '<!--TEK_AUTOROOF_RECORDS-->';
const TEK_LINE_MARKER = '<!--TEK_LINE_RECORDS-->';
const TEK_ARC_MARKER = '<!--TEK_ARC_RECORDS-->';
const TEK_STAIR_MARKER = '<!--TEK_STAIR_RECORDS-->';
const TEK_TEXT_MARKER = '<!--TEK_TEXT_RECORDS-->';
const TEK_HATCH_MARKER = '<!--TEK_HATCH_RECORDS-->';

/** Tekton-friendly αριθμός: δεκαδικά, χωρίς εκθετική μορφή, trimmed. */
export function tekNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number(n.toFixed(9)).toString();
}

/** Κανονικοποίηση χρώματος → 6-ψήφιο hex (κεφαλαία, χωρίς `#`)· fallback default τοίχου. */
export function colorHex6(hex: string): string {
  const h = hex.replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(h) ? h : '80BCFC';
}

// ── ADR-608 — Tekton tags/ετικέτες (grouping) ────────────────────────────────
// Το κενό `<taglist>` κάθε record (auto-generated template) + το κενό top-level
// `<tag_visibility>` του skeleton. Verified schema από «Χαρτί σχεδίασης Α0.tek»:
//   record:   <taglist>\n<s>ΟΝΟΜΑ</s></taglist>
//   registry: <tag_visibility>\n<tag>\n<name>ΟΝΟΜΑ</name><visible>1</visible></tag>…</tag_visibility>
const EMPTY_TAGLIST = '<taglist>\n</taglist>';
const EMPTY_TAG_VISIBILITY = '<tag_visibility>\n</tag_visibility>';

/**
 * Εγχέει ένα tag στο κενό `<taglist>` ενός record. `tag` absent ⇒ αμετάβλητο
 * (μένει κενό). Έτσι μόνο τα σύμβολα (που φέρουν `groupId`) ταξινομούνται.
 */
function injectTag(recordXml: string, tag?: string): string {
  if (!tag) return recordXml;
  return recordXml.replace(EMPTY_TAGLIST, `<taglist>\n<s>${escapeXml(tag)}</s></taglist>`);
}

/**
 * Το top-level `<tag_visibility>` registry: ΚΑΘΕ tag που χρησιμοποιείται πρέπει να
 * δηλωθεί εδώ (αλλιώς ο Τέκτων το αγνοεί). Όλα ορατά (`<visible>1</visible>`).
 * Κενή λίστα ⇒ `''` (ο caller κρατά το κενό skeleton block).
 */
export function buildTagVisibilityXml(tags: readonly string[]): string {
  if (tags.length === 0) return '';
  const rows = tags
    .map((t) => `<tag>\n<name>${escapeXml(t)}</name><visible>1</visible></tag>`)
    .join('\n');
  return `<tag_visibility>\n${rows}\n</tag_visibility>`;
}

/** `<xmatrix>` element (σειρά x00,x01,x10,x11,x20,x21 όπως το δείγμα). */
export function xmatrixXml(m: TekXMatrix): string {
  return (
    `<xmatrix>` +
    `<x00>${tekNum(m.x00)}</x00><x01>${tekNum(m.x01)}</x01>` +
    `<x10>${tekNum(m.x10)}</x10><x11>${tekNum(m.x11)}</x11>` +
    `<x20>${tekNum(m.x20)}</x20><x21>${tekNum(m.x21)}</x21>` +
    `</xmatrix>`
  );
}

/** Γεμίζει το parameterized wall record template με τις τιμές ενός τοίχου. */
export function buildWallRecordXml(w: TekWall): string {
  return WALL_RECORD_TEMPLATE
    .replace('{{ID}}', String(w.id))
    .replace('{{NAME}}', escapeXml(w.name))
    .replace('{{HEIGHT}}', tekNum(w.heightM))
    .replace('{{ELEVATION}}', tekNum(w.elevationM))
    .replace('{{COLOR}}', colorHex6(w.colorHex))
    .replace('{{XMATRIX}}', xmatrixXml(w.xmatrix))
    .replace('{{OPEN}}', w.openXml ?? '');
}

/** Γεμίζει το parameterized opening record template με τις τιμές ενός κουφώματος. */
export function buildOpenRecordXml(o: TekOpening): string {
  return OPEN_RECORD_TEMPLATE
    .replace('{{NAME}}', escapeXml(o.name))
    .replace('{{ELEVATION}}', tekNum(o.sillM))
    .replace('{{TOP}}', tekNum(o.headM))
    .replace('{{SIDE}}', String(o.side))
    .replace('{{STYLE}}', String(o.style))
    .replace('{{TXTPOS_X}}', tekNum(o.txtX))
    .replace('{{TXTPOS_Y}}', tekNum(o.txtY))
    .replace('{{XMATRIX}}', xmatrixXml(o.xmatrix));
}

/** Σειριοποιεί τις κορυφές footprint ενός επίπλου σε `<point3d>` records (μέτρα). */
export function buildPlanePointsXml(points: readonly TekPlanePoint[]): string {
  return points
    .map((p) =>
      PLANE_POINT_TEMPLATE
        .replace('{{X}}', tekNum(p.x))
        .replace('{{Y}}', tekNum(p.y))
        .replace('{{Z}}', tekNum(p.z)),
    )
    .join('\n');
}

/** Γεμίζει το parameterized plane record template με τις τιμές ενός επίπλου-κουτιού. */
export function buildPlaneRecordXml(p: TekPlane): string {
  return PLANE_RECORD_TEMPLATE
    .replace('{{COLOR}}', colorHex6(p.colorHex))
    .replace('{{WIDTH}}', tekNum(p.widthM))
    .replace('{{POINTS}}', `\n${buildPlanePointsXml(p.points)}\n`);
}

/**
 * Συναρμολογεί το `{{OPEN}}` payload ενός τοίχου από τα κουφώματά του. Κενό → `''`
 * (το wall template εκπέμπει `<open></open>`)· αλλιώς `\n<record>…</record>\n` ώστε να
 * προκύψει `<open>\n<record>…\n</record>\n</open>` όπως το δείγμα.
 */
export function buildOpenXml(openings: readonly TekOpening[]): string {
  if (openings.length === 0) return '';
  return `\n${openings.map(buildOpenRecordXml).join('\n')}\n`;
}

/** Σειριοποιεί τις footprint κορυφές μιας στέγης σε `<point><record>` (μέτρα + κλίση rad). */
export function buildRoofPointsXml(points: readonly TekRoofPoint[]): string {
  return points
    .map((p) =>
      AUTOROOF_POINT_TEMPLATE
        .replace('{{X}}', tekNum(p.x))
        .replace('{{Y}}', tekNum(p.y))
        .replace('{{ANGLE}}', tekNum(p.angleRad)),
    )
    .join('\n');
}

/** Σειριοποιεί τα «νερά» (faces) μιας στέγης σε `<v3list>` → `<onev3list><v3>…</v3></onev3list>`. */
export function buildRoofV3ListXml(faces: readonly TekRoofFace[]): string {
  return faces
    .map((face) => {
      const v3s = face
        .map((v) =>
          AUTOROOF_V3_TEMPLATE
            .replace('{{X}}', tekNum(v.x))
            .replace('{{Y}}', tekNum(v.y))
            .replace('{{Z}}', tekNum(v.z)),
        )
        .join('\n');
      return `<onev3list>\n${v3s}</onev3list>`;
    })
    .join('\n');
}

/** Γεμίζει το parameterized autoroof record template με τις τιμές μιας στέγης. */
export function buildAutoroofRecordXml(r: TekRoof): string {
  return AUTOROOF_RECORD_TEMPLATE
    .replace('{{ID}}', String(r.id))
    .replace('{{ELEVATION}}', tekNum(r.elevationM))
    .replace('{{VOLUME}}', tekNum(r.volumeM3))
    .replace('{{WIDTH}}', tekNum(r.widthM))
    .replace('{{COLOR}}', colorHex6(r.colorHex))
    .replace('{{V3LIST}}', r.faces.length > 0 ? `\n${buildRoofV3ListXml(r.faces)}\n` : '')
    .replace('{{POINTS}}', `\n${buildRoofPointsXml(r.points)}\n`);
}

/** Γεμίζει το line record template (DXF line / polyline segment → `<line><record>`). */
export function buildLineRecordXml(l: TekLine): string {
  const xml = LINE_RECORD_TEMPLATE
    .replace('{{N}}', String(l.id))
    .replace('{{V0X}}', tekNum(l.v0.x))
    .replace('{{V0Y}}', tekNum(l.v0.y))
    .replace('{{ELEV0}}', tekNum(l.elevation0))
    .replace('{{V1X}}', tekNum(l.v1.x))
    .replace('{{V1Y}}', tekNum(l.v1.y))
    .replace('{{ELEV1}}', tekNum(l.elevation1))
    .replace('{{COLOR}}', colorHex6(l.colorHex));
  return injectTag(xml, l.tag); // ADR-608 — grouping tag στο κενό <taglist>
}

/** Γεμίζει το arc record template (DXF arc / circle → `<arc><record>`). */
export function buildArcRecordXml(a: TekArc): string {
  const xml = ARC_RECORD_TEMPLATE
    .replace('{{N}}', String(a.id))
    .replace('{{CIRCLE}}', a.isCircle ? '1' : '0')
    .replace('{{CX}}', tekNum(a.centre.x))
    .replace('{{CY}}', tekNum(a.centre.y))
    .replace('{{P0X}}', tekNum(a.p0.x))
    .replace('{{P0Y}}', tekNum(a.p0.y))
    .replace('{{P1X}}', tekNum(a.p1.x))
    .replace('{{P1Y}}', tekNum(a.p1.y))
    .replace('{{ELEV}}', tekNum(a.elevation))
    .replace('{{COLOR}}', colorHex6(a.colorHex));
  return injectTag(xml, a.tag); // ADR-608 — grouping tag στο κενό <taglist>
}

/**
 * ADR-608 — `<xmatrix>` ενός built-in συμβόλου (type-7 object): θέση (μέτρα,
 * ήδη Y-flipped) + περιστροφή + ομοιόμορφη κλίμακα. Ο Τέκτων (Y-up) αντιστρέφει
 * τη φορά περιστροφής του καμβά (Y-down) → `θ_tekton = −rotationRad`, που δίνει
 * τους παρακάτω όρους. `rotationRad=0` → μοναδιαίο·scale + μετάθεση (== δείγμα).
 */
export function buildSymbolObjectXMatrix(
  xMeters: number, yMeters: number, rotationRad: number, scale: number,
): TekXMatrix {
  const c = Math.cos(rotationRad);
  const s = Math.sin(rotationRad);
  return {
    x00: scale * c, x01: -scale * s,
    x10: scale * s, x11: scale * c,
    x20: xMeters, x21: yMeters,
  };
}

/**
 * ADR-608 Φ-texts — γεμίζει το type-3 text record template (ελεύθερη ετικέτα → `<text><record>`).
 * `<s>` escaped· `ptSize` στρογγυλοποιείται· grouping tag στο κενό `<taglist>` (SSoT `injectTag`).
 */
export function buildTextRecordXml(t: TekText): string {
  const xml = TEXT_RECORD_TEMPLATE
    .replace('{{N}}', String(t.id))
    .replace('{{S}}', escapeXml(t.content))
    .replace('{{COLOR}}', colorHex6(t.colorHex))
    .replace('{{HALLIGN}}', String(t.hAlign))
    .replace('{{VALLIGN}}', String(t.vAlign))
    .replace('{{PTSIZE}}', String(Math.round(t.ptSize)))
    .replace('{{XMATRIX}}', xmatrixXml(t.xmatrix));
  return injectTag(xml, t.tag); // ADR-608 — grouping tag στο κενό <taglist>
}

/** Γεμίζει το type-7 object record template (built-in σύμβολο → ΕΝΑ `<object><record>`). */
export function buildObjectRecordXml(o: TekObject): string {
  return OBJECT_RECORD_TEMPLATE
    .replace('{{N}}', String(o.id))
    .replace('{{TYPE_RES}}', String(o.typeRes))
    .replace('{{XMATRIX}}', xmatrixXml(o.xmatrix));
}

/** Σειριοποιεί τις ακμές περιγράμματος μιας γραμμοσκίασης σε `<record>` (μέτρα, Y-flipped). */
export function buildHatchVectorXml(edges: readonly TekHatchEdge[]): string {
  return edges
    .map((e) =>
      HATCH_EDGE_TEMPLATE
        .replace('{{V0X}}', tekNum(e.v0.x))
        .replace('{{V0Y}}', tekNum(e.v0.y))
        .replace('{{V1X}}', tekNum(e.v1.x))
        .replace('{{V1Y}}', tekNum(e.v1.y)),
    )
    .join('\n');
}

/**
 * ADR-512 — γεμίζει το hatch record template (γραμμοσκίαση → `<hatch>` primitive type 6).
 * `<n>` = πλήθος ακμών· `<type>` = αριθμός μοτίβου Τέκτονα (`tektonNum`)· grouping tag μέσω
 * του SSoT `injectTag` (κοινό με line/arc/text). Χρώμα/scale μέσω των SSoT `colorHex6`/`tekNum`.
 */
export function buildHatchRecordXml(h: TekHatch): string {
  const xml = HATCH_RECORD_TEMPLATE
    .replace('{{N}}', String(h.edges.length))
    .replace('{{SCALEX}}', tekNum(h.scaleX))
    .replace('{{SCALEY}}', tekNum(h.scaleY))
    .replace('{{TYPE}}', String(Math.round(h.tektonNum)))
    .replace('{{COLOR}}', colorHex6(h.colorHex))
    // `<boundary>`: default 0 (user hatch — γέμισμα χωρίς περίγραμμα)· native area → 1.
    .replace('{{BOUNDARY}}', String(Math.round(h.boundary ?? 0)))
    // Το raster background: default = ίδιο χρώμα (μονόχρωμο γέμισμα user hatch, χωρίς άσπρα
    // κενά)· native area → λευκό (bgColorHex='FFFFFF') ώστε το μοτίβο να φαίνεται (ground-truth).
    .replace('{{BGCOLOR}}', colorHex6(h.bgColorHex ?? h.colorHex))
    .replace('{{VECTOR}}', buildHatchVectorXml(h.edges));
  return injectTag(xml, h.tag); // ADR-608 — grouping tag στο κενό <taglist>
}

/** Serializes a stair polyline into `<point2d>` (empty -> `<point2d>\n</point2d>`). */
export function buildStairPoint2dXml(points: readonly TekStairPoint[]): string {
  if (points.length === 0) return '<point2d>\n</point2d>';
  const recs = points
    .map((p) => `<record>\n<pX>${tekNum(p.x)}</pX><pY>${tekNum(p.y)}</pY></record>`)
    .join('\n');
  return `<point2d>\n${recs}\n</point2d>`;
}

/** Serializes a segment-types list into `<intlist>` (empty -> `<intlist>\n</intlist>`). */
export function buildStairIntlistXml(values: readonly number[]): string {
  if (values.length === 0) return '<intlist>\n</intlist>';
  const items = values.map((v) => `<i>${Math.round(v)}</i>`).join('');
  return `<intlist>\n${items}</intlist>`;
}

/**
 * Συναρμολογεί ένα stair `<record>` (type 21) για **ευθεία σκάλα έτοιμη-για-3Δ**, καθρέφτης
 * του ground-truth `ΜΟΝΟΝ_ΟΡΙΣΜΟΣ_ΣΚΑΛΑΣ`: 3 κενά point2d (σύμβολα 2Δ που σχεδιάζει ο Τέκτων)
 * + 7 κενές intlist + οι **3 γραμμές ανάβασης** (αριστερή/κεντρική/δεξιά παρειά, slots 4/5/6,
 * συνδεδεμένες πολυγραμμές με τερματικό sentinel) + 2 κενά + scalar ουρά. Ο Τέκτων ΦΤΙΑΧΝΕΙ
 * τις βαθμίδες από τις γραμμές + scalars — δεν του δίνουμε γραμμές βαθμίδων.
 */
export function buildStairRecordXml(s: TekStair): string {
  const blocks = [
    buildStairPoint2dXml(s.boundary),
    buildStairPoint2dXml([]),
    buildStairPoint2dXml([]),
    // intlist 1 = segment-types του περιγράμματος (3 ανεξάρτητες ευθείες). Υπόλοιπες κενές.
    buildStairIntlistXml(s.boundary.length >= 6 ? [2, 2, 2] : []),
    buildStairIntlistXml([]),
    buildStairIntlistXml([]),
    buildStairIntlistXml([]),
    buildStairIntlistXml([]),
    buildStairIntlistXml([]),
    buildStairIntlistXml([]),
    // slots 4/5 = οι δύο παρειές (ο Τέκτων χτίζει βαθμίδες ΑΝΑΜΕΣΑ τους → πρέπει αριστερή+δεξιά,
    // ΟΧΙ αριστερή+walkline· αλλιώς οι βαθμίδες φτάνουν μόνο μέχρι την walkline = ~75%). slot6 = walkline.
    buildStairPoint2dXml(s.leftLine),
    buildStairPoint2dXml(s.rightLine),
    buildStairPoint2dXml(s.centerLine),
    buildStairPoint2dXml([]),
    buildStairPoint2dXml([]),
  ];
  const tail = STAIR_RECORD_TAIL
    .replace('{{START}}', tekNum(s.startElevationM))
    .replace('{{END}}', tekNum(s.endElevationM))
    .replace('{{WIDTH}}', tekNum(s.stairWidthM))
    .replace('{{MIN_STEP}}', tekNum(s.minStepWidthM))
    .replace('{{STEPS_NUMBERING}}', s.stepsNumbering ? '1' : '0')
    .replace('{{STEPS}}', String(Math.round(s.steps)))
    .replace('{{LANDINGS}}', String(Math.round(s.landings)))
    .replace('{{WLENGTH}}', tekNum(s.walklineLengthM))
    .replace('{{GOING}}', tekNum(s.treadGoingM))
    .replace('{{RISER}}', tekNum(s.riserHeightM))
    .replace('{{WAIST}}', tekNum(s.waistThicknessM));
  return `${STAIR_RECORD_HEAD.replace('{{N}}', String(s.id))}${blocks.join('\n')}\n${tail}`;
}

/**
 * Εγχέει τα παραγόμενα records στους markers του skeleton template. Throws αν λείπει
 * marker (σπασμένο/λάθος template) ώστε να μην βγει σιωπηλά μισό αρχείο.
 */
export function injectTekEntities(
  template: string,
  wallsXml: string,
  objectsXml: string,
  planesXml = '',
  autoroofsXml = '',
  linesXml = '',
  arcsXml = '',
  stairsXml = '',
  tagVisibilityXml = '',
  textsXml = '',
  hatchesXml = '',
): string {
  if (
    !template.includes(TEK_WALL_MARKER) ||
    !template.includes(TEK_OBJECT_MARKER) ||
    !template.includes(TEK_PLANE_MARKER) ||
    !template.includes(TEK_AUTOROOF_MARKER) ||
    !template.includes(TEK_LINE_MARKER) ||
    !template.includes(TEK_ARC_MARKER) ||
    !template.includes(TEK_STAIR_MARKER) ||
    !template.includes(TEK_TEXT_MARKER) ||
    !template.includes(TEK_HATCH_MARKER)
  ) {
    throw new Error('TEK skeleton template: missing wall/object/plane/autoroof/line/arc/stair/text/hatch marker');
  }
  // ADR-608 — αν υπάρχουν tags, γέμισε το κενό top-level `<tag_visibility>` registry.
  // Απουσία tags ⇒ αμετάβλητο (κρατά το κενό block του skeleton). Throw αν το registry
  // δεν βρεθεί ενώ υπάρχουν tags (αλλαγμένο skeleton → σιωπηλά αταξινόμητα σύμβολα).
  if (tagVisibilityXml && !template.includes(EMPTY_TAG_VISIBILITY)) {
    throw new Error('TEK skeleton template: missing empty <tag_visibility> block for tag registry');
  }
  const withTags = tagVisibilityXml
    ? template.replace(EMPTY_TAG_VISIBILITY, tagVisibilityXml)
    : template;
  return withTags
    .replace(TEK_WALL_MARKER, wallsXml)
    .replace(TEK_OBJECT_MARKER, objectsXml)
    .replace(TEK_PLANE_MARKER, planesXml)
    .replace(TEK_AUTOROOF_MARKER, autoroofsXml)
    .replace(TEK_LINE_MARKER, linesXml)
    .replace(TEK_ARC_MARKER, arcsXml)
    .replace(TEK_STAIR_MARKER, stairsXml)
    .replace(TEK_TEXT_MARKER, textsXml)
    .replace(TEK_HATCH_MARKER, hatchesXml);
}
