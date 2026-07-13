/**
 * ADR-608 Φ-texts — ελεύθερα κείμενα του καμβά → Tekton `text` records (type 3).
 *
 * Εξήχθη από το `dxf-to-tek.ts` (N.7.1 — 500 γρ./αρχείο, 2026-07-13): εκεί μένουν τα
 * γεωμετρικά primitives (line/arc/object/hatch), εδώ ΟΛΟ το text pipeline (sizing +
 * calibrated anchor + alignment). Κοινό SSoT με τον γονέα: `entityColor` / `entityTag`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-512-tekton-tek-export.md
 */

import type { Entity, TextEntity } from '../../../types/entities';
import { degToRad } from '../../../rendering/entities/shared/geometry-angle-utils';
import { buildSymbolObjectXMatrix, buildTextRecordXml } from './tek-xml-writer';
import { sceneXYToTekMeters } from './tek-geometry';
import {
  TEK_HALLIGN, TEK_VALLIGN, type TekHAlignKey, type TekVAlignKey,
} from './tek-text-alignment';
import type { TekText } from './tek-types';
import { entityColor, entityTag } from './dxf-to-tek';

// ── ADR-608 Φ-texts — text sizing ────────────────────────────────────────────
// Ο Τέκτων ζωγραφίζει native ttfont text με μέγεθος `<ptsize>` (font=30, abssize=0),
// xmatrix κλίμακα γλύφου = 1 (όπως ΟΛΑ τα verified real records). Χαρτογραφούμε το
// ύψος (μέτρα) → ptsize μέσω σταθεράς calibration (verified label ~0.25 m ≈ 11 pt).
// Το ακριβές model-height ανά drawing-scale = tunable follow-up (όπως το object scale=1).
const TEK_TEXT_PT_PER_M = 44;
const TEK_TEXT_MIN_PT = 6;
const TEK_TEXT_MAX_PT = 60;
/** Fallback ύψος (scene units) όταν το text entity δεν φέρει height/fontSize. */
const DEFAULT_TEXT_HEIGHT = 2.5;
// ── ADR-608 Φ-texts — text ANCHOR (browser-calibrated) ──────────────────────
// Browser-verify (Giorgio 2026-07-09): ο Τέκτων ΔΕΝ τιμά το `hallign` για κέντρο —
// αγκυρώνει το type-3 text στην ΑΡΙΣΤΕΡΗ ακμή στο (x20,x21), οπότε τα κεντραρισμένα
// labels (N/E/S/W σε πυξίδα/ρόδα ανέμων) πέφτουν ΔΕΞΙΑ κατά ~μισό πλάτος γράμματος.
// Διόρθωση: μετατοπίζουμε ΕΜΕΙΣ το anchor οριζόντια αριστερά κατά `factor × ύψος`
// (center → μισό πλάτος, right → ολόκληρο). 🎛️ CALIBRATION KNOB (οριζόντιο· μισό
// πλάτος κεφαλαίου Arial ≈ 0.35 × cap-height).
const TEK_TEXT_HSHIFT_PER_HEIGHT = 0.35;
// Ο Τέκτων αγκυρώνει επίσης το `vallign:middle` text στην ΚΟΡΥΦΗ → τα σύμβολα (N/E/S/W)
// κρέμονται κάτω από το κέντρο. Ανεβάζουμε ΕΜΕΙΣ κατά `factor × ύψος` (Y-up) ώστε η μέση
// του γράμματος να πέσει στο anchor. 🎛️ CALIBRATION KNOB (κάθετο· μισό cap-height ≈ 0.5).
const TEK_TEXT_VSHIFT_PER_HEIGHT = 0.5;

export interface TekTextCollectResult {
  readonly textsXml: string;
  readonly textCount: number;
  /** ADR-608 — distinct tag/ετικέτα ονόματα (για το `<tag_visibility>` registry). */
  readonly tags: readonly string[];
}

/** Clamp helper για το ptsize (χωρίς εξάρτηση σε util). */
function clampPt(pt: number): number {
  return Math.min(TEK_TEXT_MAX_PT, Math.max(TEK_TEXT_MIN_PT, pt));
}

/**
 * Faithful στοίχιση κειμένου (καθρέφτης `scene-vector-emitter` γρ. 154-158): μόνο ένα
 * decomposed label (φέρει `vBaseline` hint) έχει το `position` = alignment anchor → τιμούμε
 * `alignment`+`vBaseline`. Το «σκέτο» scene text (χωρίς hint) κρατά left/baseline ώστε
 * imported κείμενο με insertion-semantics που δεν κατέχουμε να μη μετατοπίζεται.
 */
function resolveTextAlign(e: Entity): { hAlignKey: TekHAlignKey; vAlignKey: TekVAlignKey } {
  const hint = (e as { vBaseline?: TekVAlignKey }).vBaseline;
  if (hint === undefined) return { hAlignKey: 'left', vAlignKey: 'alphabetic' };
  return { hAlignKey: (e as TextEntity).alignment ?? 'left', vAlignKey: hint };
}

/**
 * ADR-608 Φ-texts — συλλέγει τα ελεύθερα κείμενα (annotation labels N/A/1/0.00 +
 * scale-bar νούμερα, αποδομημένα σε `text` primitives) ως `<text>` records (type 3).
 * Θέση = anchor Y-flipped ΑΚΡΙΒΩΣ στο (x20,x21) (SSoT `sceneXYToTekMeters`) — καμία εκτίμηση
 * πλάτους/ύψους· η στοίχιση δηλώνεται με `hallign`/`vallign` (SSoT `tek-text-alignment`) και
 * ο Τέκτων κεντράρει το glyph box μόνος του (καθρέφτης `scene-vector-emitter` declare-and-anchor).
 * Περιστροφή/κλίμακα γλύφου (1, όπως τα real records) μέσω `buildSymbolObjectXMatrix`· μέγεθος →
 * `ptsize`. `f` = μέτρα ανά scene unit.
 */
export function collectTekTexts(entities: readonly Entity[], f: number): TekTextCollectResult {
  const records: string[] = [];
  const tags = new Set<string>();
  let id = 1;
  for (const e of entities) {
    if (e.type !== 'text') continue;
    const t = e as TextEntity;
    const content = (t.text ?? '').trim();
    if (content === '') continue; // κενή ετικέτα → χωρίς record
    const anchor = sceneXYToTekMeters(t.position.x, t.position.y, f);
    const heightMeters = (t.height ?? t.fontSize ?? DEFAULT_TEXT_HEIGHT) * f;
    const ptSize = clampPt(Math.round(heightMeters * TEK_TEXT_PT_PER_M));
    const { hAlignKey, vAlignKey } = resolveTextAlign(e);
    // Ο Τέκτων αγκυρώνει αριστερά (δεν κεντράρει με hallign) → μετατοπίζουμε το anchor
    // αριστερά: center = μισό πλάτος, right = ολόκληρο (× TEK_TEXT_HSHIFT_PER_HEIGHT × ύψος).
    const hShiftUnits = hAlignKey === 'center' ? 1 : hAlignKey === 'right' ? 2 : 0;
    const xShift = heightMeters * TEK_TEXT_HSHIFT_PER_HEIGHT * hShiftUnits;
    // Κάθετα: το middle-anchored σύμβολο κρέμεται κάτω → ανεβάζουμε κατά μισό ύψος ώστε η
    // μέση του γράμματος να πέσει στο anchor. Y-flip: «πάνω» στον Τέκτονα = ΑΦΑΙΡΕΣΗ. Μόνο 'middle'.
    const yShift = vAlignKey === 'middle' ? heightMeters * TEK_TEXT_VSHIFT_PER_HEIGHT : 0;
    // Anchor στο (x20,x21)· κλίμακα γλύφου 1 (native ttfont, μέγεθος από ptsize).
    const xmatrix = buildSymbolObjectXMatrix(
      anchor.x - xShift, anchor.y - yShift, degToRad(t.rotation ?? 0), 1,
    );
    const tag = entityTag(e);
    records.push(buildTextRecordXml({
      id, content, hAlign: TEK_HALLIGN[hAlignKey], vAlign: TEK_VALLIGN[vAlignKey], ptSize, xmatrix,
      colorHex: entityColor(e), tag,
    } satisfies TekText));
    if (tag) tags.add(tag);
    id += 1;
  }
  return { textsXml: records.join('\n'), textCount: records.length, tags: [...tags] };
}
