/**
 * Διαβάζει τα **σημάδια κατάστασης** του δεσμού πίνακα (`TABLE_BOUND_STATE`) από το
 * `src/subapps/dxf-viewer/config/color-config.ts`.
 *
 * ## 🔴 Γιατί διαβάζει ΤΑ ΙΔΙΑ ΠΕΔΙΑ που ζωγραφίζει ο ζωγράφος
 * Η πύλη μπορούσε να στηριχθεί σε ξεχωριστό «μεταδεδομένο καναλιού» δίπλα στα χρώματα —
 * και θα ήταν **ψεύτικη**: ένα πεδίο που κανείς δεν ζωγραφίζει μπορεί να λέει «τρίγωνο
 * πάνω-δεξιά» ενώ ο καμβάς βάφει πάνω-αριστερά, και η πύλη θα έμενε πράσινη. Ίδιο σχήμα με
 * τις δύο λίστες namespace του CHECK 3.34 και με τη χειρόγραφη λίστα του CHECK 3.37.
 *
 * Εδώ το `corner` **είναι** το όρισμα του `traceCornerTriangle`, και το `staleDashPx` **είναι**
 * το `setLineDash`. Αν αποκλίνουν, έχει σπάσει η ζωγραφιά, όχι η πύλη.
 *
 * ⚠️ **AST, ΟΧΙ regex** — για τον ίδιο λόγο που το δηλώνει το `ts-token-palette.js`: το
 * μονοπάτι μιας ιδιότητας είναι δομή, όχι κείμενο.
 *
 * @module scripts/lib/contrast/state-marks
 * @see scripts/check-state-channel-distinctness.js — η κρίση
 */

'use strict';

const path = require('path');
const ts = require('typescript');
const { openGateInput } = require('../gate-input');

const { readThemes } = require('./css-token-themes');
const { parseHslToken, hslToRgb, toHex } = require('./wcag-contrast');

/** ADR-923 §5.5.2 Β8 — το αρχείο που ΟΡΙΖΕΙ τα σημάδια κατάστασης πάνω στο PDF της αναθεώρησης εισαγωγής. */
const REVIEW_MARKS_PATH = path.join('src', 'subapps', 'catalog', 'import', 'review-marks.ts');

/** ADR-929 §6.21.10 — το αρχείο που ΟΡΙΖΕΙ τους τόνους της προεπισκόπησης (και τους τόνους γραμμής του βοηθού). */
const PREVIEW_STYLE_PATH = path.join('src', 'subapps', 'dxf-viewer', 'systems', 'region-preview', 'preview-zone-style.ts');

/** Το αρχείο που ΟΡΙΖΕΙ τα σημάδια κατάστασης του δεσμού. */
const COLOR_CONFIG_PATH = path.join(
  'src', 'subapps', 'dxf-viewer', 'config', 'color-config.ts',
);

/** Βρίσκει το αρχικοποιητή ενός `export const <name> = {...}` στο ανώτατο επίπεδο. */
function findConstObject(source, name) {
  let found = null;
  source.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== name) continue;
      found = unwrapAsConst(decl.initializer);
    }
  });
  return found;
}

/** `{...} as const` · `{...} as const satisfies T` → `{...}`. */
function unwrapAsConst(node) {
  if (node === undefined) return null;
  return ts.isAsExpression(node) || ts.isTypeAssertionExpression?.(node) || ts.isSatisfiesExpression?.(node)
    ? unwrapAsConst(node.expression)
    : node;
}

/** Οι property assignments ενός object literal, ως `Map<string, Node>`. */
function propsOf(objectLiteral) {
  const map = new Map();
  if (objectLiteral === null || !ts.isObjectLiteralExpression(objectLiteral)) return map;
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (key !== null) map.set(key, unwrapAsConst(prop.initializer));
  }
  return map;
}

/**
 * Λύνει έναν κόμβο σε **τιμή**: string/number literal, πίνακας, ή `UI_COLORS.X` /
 * `UI_COLORS_BASE.X` μέσω του χάρτη των πρωτογενών.
 *
 * Επιστρέφει `null` όταν δεν μπορεί να λύσει — **ποτέ** μαντεψιά: μια ανεπίλυτη αναφορά
 * είναι σφάλμα που πρέπει να φανεί, όχι τιμή που πρέπει να εφευρεθεί.
 */
function resolveValue(node, primitives) {
  if (node === null || node === undefined) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((el) => resolveValue(el, primitives));
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const root = node.expression.text;
    if (root === 'UI_COLORS' || root === 'UI_COLORS_BASE') {
      return primitives.get(node.name.text) ?? null;
    }
  }
  return null;
}

/** Ο χάρτης των πρωτογενών χρωμάτων (`UI_COLORS_BASE`), όνομα → hex. */
function readPrimitives(source) {
  const map = new Map();
  const base = findConstObject(source, 'UI_COLORS_BASE');
  for (const [key, node] of propsOf(base)) {
    if (ts.isStringLiteral(node)) map.set(key, node.text);
  }
  return map;
}

/**
 * Το `color-config.ts` **μία φορά**: το AST του και ο χάρτης των πρωτογενών χρωμάτων.
 *
 * ⚠️ Εξήχθη επειδή το **CHECK 3.28** το έπιασε ως κλώνο τη στιγμή που προστέθηκε η δεύτερη
 * οικογένεια (ADR-782 §27.4): δύο αναγνώστες, δύο ταυτόσημα προοίμια `readFileSync` +
 * `createSourceFile` + `readPrimitives`. Δεν ήταν στιλιστικό — δύο σημεία που ανοίγουν το ίδιο
 * αρχείο μπορούν να αποκλίνουν σε **ποιο** αρχείο ανοίγουν.
 */
function parseColorConfig(repoRoot, input = openGateInput({ root: repoRoot })) {
  // ADR-924: από την ΕΙΣΟΔΟ — με `--index` το config ΤΟΥ COMMIT, όχι του δίσκου
  const file = path.join(repoRoot, COLOR_CONFIG_PATH);
  const text = input.readRequired(COLOR_CONFIG_PATH);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  return { source, primitives: readPrimitives(source) };
}

/**
 * Τα σημάδια κατάστασης, **ως δεδομένα**.
 *
 * Κάθε εγγραφή: `{ id, carrier, variant, hex }`.
 * - `carrier` = ο **φορέας** (λωρίδα στήλης ή τρίγωνο κελιού) — δύο διαφορετικοί φορείς
 *   διακρίνονται ήδη γεωμετρικά.
 * - `variant` = το μη-χρωματικό διακριτικό **μέσα** στον ίδιο φορέα, φτιαγμένο από τα πεδία
 *   που όντως ζωγραφίζονται.
 */
function readBoundStateMarks(repoRoot = process.cwd(), input = undefined, parsed = parseColorConfig(repoRoot, input)) {
  const { source, primitives } = parsed;
  const bound = propsOf(findConstObject(source, 'TABLE_BOUND_STATE'));
  if (bound.size === 0) {
    throw new Error(`TABLE_BOUND_STATE δεν βρέθηκε στο ${COLOR_CONFIG_PATH}`);
  }

  const val = (key) => resolveValue(bound.get(key) ?? null, primitives);
  const columnHex = val('columnHex');
  const staleHex = val('staleHex');
  const dash = val('staleDashPx');

  const marks = [
    {
      id: 'bound-writable',
      carrier: 'column-strip',
      variant: `solid:alpha=${val('columnAlpha')}`,
      hex: columnHex,
    },
    {
      id: 'bound-readonly',
      carrier: 'column-strip',
      variant: `solid:alpha=${val('readOnlyColumnAlpha')}`,
      hex: columnHex,
    },
    {
      id: 'stale',
      carrier: 'column-strip',
      variant: `dashed:${Array.isArray(dash) ? dash.join('-') : dash}`,
      hex: staleHex,
    },
  ];

  const exceptions = propsOf(bound.get('exceptionMarks') ?? null);
  for (const [id, node] of exceptions) {
    const spec = propsOf(node);
    marks.push({
      id,
      carrier: 'cell-triangle',
      variant: `corner=${resolveValue(spec.get('corner') ?? null, primitives)}`,
      hex: resolveValue(spec.get('hex') ?? null, primitives),
    });
  }
  return marks;
}

/**
 * Τα σημάδια της **αντιστοίχισης υποβάθρου** (`BASEMAP_CORRESPONDENCE_MARKS`, ADR-782 §27.4).
 *
 * ## Γιατί το `variant` είναι `<σχήμα>:<μοτίβο>` και ΔΕΝ περιέχει μέγεθος
 * Είναι **ακριβώς** τα δύο πεδία που ζωγραφίζει ο
 * `components/dxf-layout/BasemapCorrespondenceMarksLeaf.tsx` — το `shape` επιλέγει `<rect>` ή
 * `<circle>`, το `dash` γίνεται `strokeDasharray`. Το μέγεθος **σκόπιμα** μένει έξω: αν
 * συμμετείχε, δύο ταυτόσημα σχήματα θα περνούσαν το Κ1 επειδή το ένα είναι μεγαλύτερο — και το
 * μέγεθος δεν είναι διακριτικό κανάλι (ίδιος λόγος με το `markSizePx` της πρώτης οικογένειας).
 *
 * Και οι τρεις μοιράζονται **ένα** hex ⇒ το Κ2 δεν έχει τίποτα να κρίνει, **εκ κατασκευής**.
 */
function readCorrespondenceMarks(source, primitives) {
  const spec = propsOf(findConstObject(source, 'BASEMAP_CORRESPONDENCE_MARKS'));
  if (spec.size === 0) {
    throw new Error(`BASEMAP_CORRESPONDENCE_MARKS δεν βρέθηκε στο ${COLOR_CONFIG_PATH}`);
  }
  const hex = resolveValue(spec.get('hex') ?? null, primitives);
  const marks = [];
  for (const [id, node] of propsOf(spec.get('states') ?? null)) {
    const state = propsOf(node);
    const shape = resolveValue(state.get('shape') ?? null, primitives);
    const dash = resolveValue(state.get('dash') ?? null, primitives);
    marks.push({ id, carrier: 'basemap-mark', variant: `${shape}:${dash}`, hex });
  }
  if (marks.length === 0) {
    throw new Error(`BASEMAP_CORRESPONDENCE_MARKS.states είναι κενό στο ${COLOR_CONFIG_PATH}`);
  }
  return marks;
}

/**
 * ADR-929 §6.21.10 — ο φορέας **όλων** των γραμμών της κοινής επιφάνειας της κάτοψης (τμήματα αναγνώρισης + γραμμές του
 * βοηθού). Ένας φορέας ⇒ το Κ1 τις συγκρίνει **όλες** μεταξύ τους.
 */
const PLAN_LINE_CARRIER = 'plan-line';

/** ADR-911 §Φ3β-palette — ο φορέας των τόνων μιας επικάλυψης προεπισκόπησης (ζώνες + γραμμές του βοηθού). */
const PREVIEW_ZONE_CARRIER = 'zone';

/**
 * Το μοτίβο **όπως ζωγραφίζεται** (`strokeDasharray` σε px), κανονικοποιημένο: κενό/απόν ⇒ `solid` (ο browser τότε
 * ζωγραφίζει συμπαγή). Συγκρίνεται το px και **όχι** το όνομα: οι πηγές ονομάζουν διαφορετικά («dashed» ↔ «6 4»), και
 * δύο ίδια μοτίβα με άλλο όνομα πρέπει να συγκρουστούν στο Κ1.
 */
function dashPattern(px) {
  return typeof px === 'string' && px.trim() !== '' ? px.trim().replace(/\s+/g, ' ') : 'solid';
}

/** Το `dashPx[όνομα]` ενός λεξιλογίου μοτίβων του `color-config` (όνομα που δεν υπάρχει ⇒ `undefined` ⇒ συμπαγής). */
function namedDashPattern(spec, name) {
  return dashPattern(resolveValue(propsOf(spec.get('dashPx') ?? null).get(name) ?? null, new Map()));
}

/**
 * Τα επίπεδα βεβαιότητας των τμημάτων αναγνώρισης κάτοψης (`PLAN_CONFIDENCE_MARKS`, ADR-929 Φ5). Το `variant` είναι το
 * `dashPx[dash]` — ακριβώς ό,τι γίνεται `strokeDasharray` στην επικάλυψη. Το `hex` είναι **ένα** για όλα τα επίπεδα
 * (§6.21.10: η βεβαιότητα στο μοτίβο, όχι στην απόχρωση) ⇒ το Κ2 δεν έχει τίποτα να κρίνει **μεταξύ** τους, εκ κατασκευής.
 */
function readPlanConfidenceMarks(source, primitives) {
  const spec = propsOf(findConstObject(source, 'PLAN_CONFIDENCE_MARKS'));
  if (spec.size === 0) {
    throw new Error(`PLAN_CONFIDENCE_MARKS δεν βρέθηκε στο ${COLOR_CONFIG_PATH}`);
  }
  const hex = resolveValue(spec.get('hex') ?? null, primitives);
  const marks = [];
  for (const [id, node] of propsOf(spec.get('tiers') ?? null)) {
    const tier = propsOf(node);
    const dash = resolveValue(tier.get('dash') ?? null, primitives);
    marks.push({ id, carrier: PLAN_LINE_CARRIER, variant: namedDashPattern(spec, dash), hex });
  }
  if (marks.length === 0) {
    throw new Error(`PLAN_CONFIDENCE_MARKS.tiers είναι κενό στο ${COLOR_CONFIG_PATH}`);
  }
  return marks;
}

/**
 * Τα σημάδια **ρόλου** των τμημάτων εκτός τοίχων (`PLAN_SEGMENT_ROLE_MARKS`, ADR-929 Φ5.4β). Ζωγραφίζονται στην
 * **ίδια** επικάλυψη με τα επίπεδα βεβαιότητας, με τον ίδιο φορέα, άρα κρίνονται **στην ίδια οικογένεια**: ένα μοτίβο
 * ρόλου ίσο με μοτίβο επιπέδου θα ήταν σύγχυση που το Κ1 πρέπει να δει.
 */
function readPlanRoleMarks(source, primitives) {
  const spec = propsOf(findConstObject(source, 'PLAN_SEGMENT_ROLE_MARKS'));
  if (spec.size === 0) {
    throw new Error(`PLAN_SEGMENT_ROLE_MARKS δεν βρέθηκε στο ${COLOR_CONFIG_PATH}`);
  }
  const marks = [];
  for (const [id, node] of propsOf(spec.get('roles') ?? null)) {
    const role = propsOf(node);
    marks.push({
      id: `role:${id}`,
      carrier: PLAN_LINE_CARRIER,
      variant: namedDashPattern(spec, resolveValue(role.get('dash') ?? null, primitives)),
      hex: resolveValue(role.get('hex') ?? null, primitives),
    });
  }
  if (marks.length === 0) {
    throw new Error(`PLAN_SEGMENT_ROLE_MARKS.roles είναι κενό στο ${COLOR_CONFIG_PATH}`);
  }
  return marks;
}

/**
 * Το `preview-zone-style.ts` **μία φορά**: οι παλέτες ανά επιφάνεια (`PREVIEW_SURFACES`), το μοτίβο ανά τόνο
 * (`PREVIEW_ZONE_STYLE`) και ο κλειστός κατάλογος τόνων γραμμής (`PREVIEW_LINE_TONES`). Διαβάζονται τα **ίδια** πεδία που
 * διαβάζει ο ζωγράφος (`previewZoneStyle` → `stroke` · `dash`). Κάθε κενό ή ανεπίλυτο ⇒ σφάλμα, ποτέ σιωπηλό πράσινο.
 */
function readPreviewStyle(repoRoot, input, primitives) {
  const text = input.readRequired(PREVIEW_STYLE_PATH);
  const source = ts.createSourceFile(path.join(repoRoot, PREVIEW_STYLE_PATH), text, ts.ScriptTarget.Latest, true);
  const lineTones = resolveValue(findConstObject(source, 'PREVIEW_LINE_TONES'), primitives);
  if (!Array.isArray(lineTones) || lineTones.length === 0) {
    throw new Error(`PREVIEW_LINE_TONES δεν βρέθηκε ή είναι κενό στο ${PREVIEW_STYLE_PATH}`);
  }
  const patterns = propsOf(findConstObject(source, 'PREVIEW_ZONE_STYLE'));
  const surfaces = new Map();
  for (const [id, node] of propsOf(findConstObject(source, 'PREVIEW_SURFACES'))) {
    const spec = propsOf(node);
    const surface = resolveValue(spec.get('surface') ?? null, primitives);
    const strokes = new Map([...propsOf(spec.get('stroke') ?? null)].map(([tone, n]) => [tone, resolveValue(n, primitives)]));
    if (typeof surface !== 'string' || strokes.size === 0) {
      throw new Error(`PREVIEW_SURFACES.${id}: ανεπίλυτη επιφάνεια ή κενή παλέτα στο ${PREVIEW_STYLE_PATH}`);
    }
    surfaces.set(id, { surface, strokes });
  }
  if (surfaces.size === 0) throw new Error(`PREVIEW_SURFACES δεν βρέθηκε ή είναι κενό στο ${PREVIEW_STYLE_PATH}`);
  return { lineTones, patterns, surfaces };
}

/** Ένα σημάδι τόνου προεπισκόπησης πάνω σε μια επιφάνεια: μοτίβο από το `PREVIEW_ZONE_STYLE`, χρώμα από την παλέτα. */
function previewMark(style, surfaceId, tone, carrier, primitives) {
  const pattern = propsOf(style.patterns.get(tone) ?? null);
  if (pattern.size === 0) throw new Error(`PREVIEW_ZONE_STYLE.${tone} δεν βρέθηκε στο ${PREVIEW_STYLE_PATH}`);
  const hex = style.surfaces.get(surfaceId).strokes.get(tone);
  if (typeof hex !== 'string') throw new Error(`PREVIEW_SURFACES.${surfaceId}.stroke.${tone} δεν λύνεται στο ${PREVIEW_STYLE_PATH}`);
  return { id: `preview:${tone}`, carrier, variant: dashPattern(resolveValue(pattern.get('dash') ?? null, primitives)), hex };
}

/**
 * ADR-929 §6.21.10 (Ε3) — οι **τόνοι γραμμής** του βοηθού («απόφαση» · «μονή γραμμή») πάνω σε μια επιφάνεια: ζωγραφίζονται
 * στην **ίδια** επιφάνεια με τα τμήματα της αναγνώρισης, άρα κρίνονται μαζί τους (`plan-surface[:<επιφάνεια>]`).
 */
function readPreviewLineMarks(style, surfaceId, primitives) {
  return style.lineTones.map((tone) => previewMark(style, surfaceId, tone, PLAN_LINE_CARRIER, primitives));
}

/**
 * ADR-911 §Φ3β-palette — **όλοι** οι τόνοι μιας παλέτας (ζώνες + γραμμές που ζωγραφίζονται μαζί στην ίδια επικάλυψη),
 * φορέας `zone`, `variant` = το `strokeDasharray` σε px. Η οικογένεια δηλώνει και την `surface` της ⇒ το Κ3 κρίνει
 * αντίθεση ≥ 3:1 (WCAG 1.4.11) **στη δική της** επιφάνεια. Ζώνες ↔ γραμμές αναγνώρισης **δεν** συγκρίνονται εδώ
 * (άλλος φορέας· η εξαντλητική αναζήτηση 2026-11-16 έδειξε μηδέν λύσεις με αυτή την απαίτηση).
 */
function readPreviewZoneFamilies(style, primitives) {
  return [...style.surfaces].map(([surfaceId, { surface, strokes }]) => ({
    id: `preview-zone:${surfaceId}`,
    surface,
    marks: [...strokes.keys()].map((tone) => previewMark(style, surfaceId, tone, PREVIEW_ZONE_CARRIER, primitives)),
  }));
}

/**
 * Το token χαρτιού → hex. Το χαρτί είναι λευκό σε **κάθε** θέμα, άρα το token ζει **μόνο** στο `:root`: αν το σκοτεινό
 * θέμα το ξαναδηλώσει με άλλη τιμή, η υπόσχεση «τα σημάδια δεν αλλάζουν με το θέμα» έσπασε ⇒ σφάλμα, όχι επιλογή.
 */
function paperTokenHex(themes, token) {
  const name = `--${token}`;
  const light = themes.light.get(name);
  const dark = themes.dark.get(name);
  if (light === undefined) throw new Error(`${name} δεν δηλώνεται στο :root του ${themes.source}`);
  if (dark !== undefined && dark !== light) throw new Error(`${name} αλλάζει στο .dark — το χαρτί είναι λευκό σε κάθε θέμα`);
  const hsl = parseHslToken(light);
  if (hsl === null) throw new Error(`${name} δεν είναι κυριολεκτική HSL («${light}») — η πύλη δεν μαντεύει έμμεσες τιμές`);
  return toHex(hslToRgb(hsl));
}

/**
 * Τα σημάδια του **χάρτη κατάστασης πάνω στο PDF** της αναθεώρησης εισαγωγής (`IMPORT_REVIEW_MARKS`, ADR-923 §5.5.2 Β8).
 * Το `variant` είναι `<dash>:<glyph>` — **ακριβώς** τα δύο πεδία που ζωγραφίζει το `ImportReviewOverlay` (μοτίβο γραμμής
 * + σύμβολο γωνίας). Το `strokePx` μένει έξω για τον ίδιο λόγο με το μέγεθος του `basemap-correspondence`: το πάχος
 * είναι έμφαση, όχι ταυτότητα.
 */
function readImportReviewMarks(repoRoot, input) {
  const text = input.readRequired(REVIEW_MARKS_PATH);
  const source = ts.createSourceFile(path.join(repoRoot, REVIEW_MARKS_PATH), text, ts.ScriptTarget.Latest, true);
  const spec = propsOf(findConstObject(source, 'IMPORT_REVIEW_MARKS'));
  if (spec.size === 0) throw new Error(`IMPORT_REVIEW_MARKS δεν βρέθηκε στο ${REVIEW_MARKS_PATH}`);
  const themes = readThemes(repoRoot, input);
  const marks = [];
  for (const [id, node] of propsOf(spec.get('tones') ?? null)) {
    const tone = propsOf(node);
    const value = (key) => resolveValue(tone.get(key) ?? null, new Map());
    marks.push({ id, carrier: 'pdf-region', variant: `${value('dash')}:${value('glyph')}`, hex: paperTokenHex(themes, value('token')) });
  }
  if (marks.length === 0) throw new Error(`IMPORT_REVIEW_MARKS.tones είναι κενό στο ${REVIEW_MARKS_PATH}`);
  return marks;
}

/**
 * **Όλες** οι οικογένειες καταστάσεων, ρητά ονομασμένες.
 *
 * 🔑 **Οικογένεια, όχι ένας σωρός.** Η κρίση τρέχει **ανά οικογένεια** γιατί και οι δύο κανόνες
 * ρωτούν κάτι που έχει νόημα μόνο μέσα σε μία: το Κ1 ρωτά «ποιο είναι ποιο **από αυτά που
 * βλέπω μαζί**;» και το Κ2 «η διαφορά που **υπόσχομαι**». Ένα κελί πίνακα και ένα σημάδι
 * χάρτη δεν συνυπάρχουν ποτέ στην ίδια επιφάνεια — μια σύγκριση μεταξύ τους θα απαιτούσε
 * χρωματική απόσταση για υπόσχεση που **κανείς δεν έδωσε**, δηλαδή θόρυβος που τελειώνει σε
 * `SKIP_`.
 *
 * Η προσθήκη είναι **ρητή** και αυτό είναι ο σχεδιασμός: μια νέα οικογένεια πρέπει να γραφτεί
 * εδώ για να κριθεί — ποτέ να συμπεριληφθεί κατά λάθος από γενικό σαρωτή.
 */
function readStateMarkFamilies(repoRoot = process.cwd(), input = undefined) {
  // ΜΙΑ είσοδος για όλες τις οικογένειες (ADR-924: με `--index` η όψη ΤΟΥ COMMIT) · ΕΝΑ parse του color-config
  const gateInput = input ?? openGateInput({ root: repoRoot });
  const parsed = parseColorConfig(repoRoot, gateInput);
  const { source, primitives } = parsed;
  const preview = readPreviewStyle(repoRoot, gateInput, primitives);
  const planMarks = [...readPlanConfidenceMarks(source, primitives), ...readPlanRoleMarks(source, primitives)];
  return [
    { id: 'table-bound-state', marks: readBoundStateMarks(repoRoot, gateInput, parsed) },
    { id: 'basemap-correspondence', marks: readCorrespondenceMarks(source, primitives) },
    // ADR-929 Φ5.4β + §6.21.10 — ΜΙΑ επιφάνεια, ΜΙΑ οικογένεια: επίπεδα βεβαιότητας + σημάδια ρόλου της αναγνώρισης
    // ΚΑΙ οι γραμμές του βοηθού που ζωγραφίζονται από πάνω τους (ως τις 2026-11-16 εκτός πύλης: «μέτρια» ↔ «απόφαση»
    // ΔE 0,5, «χαμηλή» ↔ «απόρριψη» 6,9, και η «ανεξήγητη» συμπαγής όπως η «υψηλή»).
    // ADR-911 §Φ3β-palette — μία οικογένεια ΑΝΑ επιφάνεια: οι γραμμές του βοηθού παίρνουν την παλέτα του φόντου.
    ...[...preview.surfaces.keys()].map((surfaceId) => ({
      id: surfaceId === 'light' ? 'plan-surface' : `plan-surface:${surfaceId}`,
      marks: [...planMarks, ...readPreviewLineMarks(preview, surfaceId, primitives)],
    })),
    // ADR-911 §Φ3β-palette — οι ζώνες προεπισκόπησης, μία οικογένεια ανά παλέτα, με αντίθεση στη δική της επιφάνεια (Κ3).
    ...readPreviewZoneFamilies(preview, primitives),
    // ADR-923 §5.5.2 Β8 — χάρτης κατάστασης πάνω στο PDF της αναθεώρησης: άλλο αρχείο, άλλη επιφάνεια, δική της οικογένεια.
    { id: 'import-review-overlay', marks: readImportReviewMarks(repoRoot, gateInput) },
  ];
}

module.exports = { readBoundStateMarks, readStateMarkFamilies, COLOR_CONFIG_PATH, REVIEW_MARKS_PATH, PREVIEW_STYLE_PATH };
