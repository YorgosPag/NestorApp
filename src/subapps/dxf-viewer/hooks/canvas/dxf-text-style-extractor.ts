/**
 * 🏢 ENTERPRISE: DXF Text Style Extractor (pure, module-level)
 *
 * @description Pure helpers that derive canvas-renderable text style + height from a
 * SceneModel text entity's `textNode`. Extracted from {@link convertEntity}
 * (dxf-scene-entity-converter.ts) to keep that file ≤500 LOC (Google SRP).
 *
 * ADR-344 Phase 6.E — textNode-aware style/height resolution.
 */

import type { DxfTextStyle } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfColor, DxfTextNode, TextRun, TextVerticalAnchor } from '../../text-engine/types';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
// ADR-635 Φ C.20 — SSoT για το χρώμα ενός run (TrueColor + ACI + κληρονομιά).
import { resolveRunColorHex } from '../../text-engine/render/run-color';

/**
 * Entity shape required by the text-style helpers (narrow subset of SceneEntity).
 *
 * ADR-737 §18 — το `height` εδώ σημαίνει **ύψος ΧΑΡΑΚΤΗΡΑ** (DXF group 40) και τίποτα άλλο.
 * Είναι δομικός τύπος, οπότε η εγγύηση δεν είναι το όνομα αλλά το ότι **κανένας τύπος
 * οντότητας δεν έχει `height` με άλλη σημασία**: το `MTextEntity` έλεγε κάποτε «ύψος
 * πλαισίου» με το ίδιο όνομα και ταίριαζε σιωπηλά εδώ. Μετονομάστηκε σε `definedHeight`
 * ακριβώς ώστε να **μην** ταιριάζει. Αν προσθέσεις πεδίο `height` σε νέα οντότητα με
 * σημασία «κουτί», αυτή η υπογραφή θα το καταπιεί ξανά — μην το κάνεις.
 */
type TextStyledEntity = { textNode?: DxfTextNode; height?: number; fontSize?: number };

/**
 * ADR-635 Φ C.26 — THE node → vertical-anchor map. `baselineAnchored` (DXF TEXT group 73 = 0)
 * wins over the attachment row, because it is the one vertical state the 3-row grid cannot
 * encode; otherwise the row decides, exactly as before.
 *
 * Every consumer that needs «where does `position` sit on the glyphs?» — the renderer's
 * `ctx.textBaseline`, the glyph-run paint, the text box, the grips — resolves it HERE. A second
 * reading of `attachment[0]` anywhere else is how the box stops hugging the letters.
 */
export function resolveVerticalAnchor(node: DxfTextNode | undefined): TextVerticalAnchor {
  if (!node) return 'top';
  if (node.baselineAnchored) return 'alphabetic';
  const row = node.attachment?.[0];
  return row === 'M' ? 'middle' : row === 'B' ? 'bottom' : 'top';
}

/**
 * ADR-344 Phase 6.E — Extract canvas-renderable style from the first run of textNode.
 * Returns undefined when textNode is absent or yields no style fields.
 */
export function extractFirstRunStyle(entity: TextStyledEntity): DxfTextStyle | undefined {
  if (!entity.textNode) return undefined;
  const result: DxfTextStyle = {};

  // Node-level: attachment column → textAlign (H); the vertical anchor comes from the SSoT
  // (ADR-635 Φ C.26) so a baseline-anchored TEXT is NOT flattened onto the 'bottom' row.
  const attachment = entity.textNode.attachment;
  const col = attachment?.[1]; // 'TL'[1]='L', 'TC'[1]='C', 'TR'[1]='R'
  if (col === 'C') result.textAlign = 'center';
  else if (col === 'R') result.textAlign = 'right';
  // 'L' = default 'left', omit
  const anchor = resolveVerticalAnchor(entity.textNode);
  // 'top' = the renderer default, omitted so an unstyled node keeps producing no style field.
  if (anchor !== 'top') result.textBaseline = anchor;

  // Run-level: first run style (bold / italic / underline / font / color).
  const para = entity.textNode.paragraphs?.[0];
  const run = para?.runs?.[0];
  if (run && !('top' in run)) {
    const s = (run as TextRun).style;
    if (s) {
      if (s.bold !== undefined) result.bold = s.bold;
      if (s.italic !== undefined) result.italic = s.italic;
      if (s.underline !== undefined) result.underline = s.underline;
      if (s.overline !== undefined) result.overline = s.overline;
      if (s.strikethrough !== undefined) result.strikethrough = s.strikethrough;
      if (s.fontFamily) result.fontFamily = s.fontFamily;
      // ADR-557 — carry the AutoCAD oblique angle so `TextRenderer` can shear the glyphs
      // (the ribbon «Κλίση» writes `run.style.obliqueAngle`; the renderer reads it from here).
      if (s.obliqueAngle !== undefined) result.obliqueAngle = s.obliqueAngle;
      // Carry the AutoCAD `\T` character tracking so `TextRenderer` can space the glyphs
      // (the ribbon «Διάκενο» writes `run.style.tracking`; the renderer reads it from here).
      if (s.tracking !== undefined) result.tracking = s.tracking;
      // ADR-635 Φ C.20 — χρώμα run μέσω του SSoT (TrueColor **και** ACI· ByLayer/ByBlock →
      // undefined = κληρονομεί το χρώμα της οντότητας). Πριν καλυπτόταν ΜΟΝΟ το TrueColor,
      // οπότε κάθε inline `\C<n>;` του AutoCAD αγνοούνταν και όλο το κείμενο έπαιρνε το
      // group-62 της οντότητας — «όλα κόκκινα».
      const runColor = resolveRunColorHex(s.color as DxfColor | undefined);
      if (runColor) result.runColor = runColor;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * ADR-344 Phase 6.E — Resolve text height: prefer first run's textNode height,
 * fall back to flat entity.height / entity.fontSize / default.
 *
 * 🏢 **ADR-737 §18 — Ο ΜΟΝΟΣ ΕΓΚΥΡΟΣ ΑΝΑΓΝΩΣΤΗΣ ΥΨΟΥΣ ΧΑΡΑΚΤΗΡΑ.** Κάθε άλλο σημείο που
 * γράφει μόνο του `height ?? fontSize ?? 2.5` απαντά **λάθος** σε δύο περιπτώσεις:
 *
 * 1. **Αγνοεί το AST.** Όταν υπάρχει `textNode`, το ζωντανό ύψος ζει στο run· μια κλίμακα ή
 *    ένα grip-resize γράφει ΕΚΕΙ. Ο αναγνώστης που κοιτά μόνο τα flat πεδία διαβάζει τιμή
 *    *shadowed* — το σχήμα που το `scale-entity-transform` περιγράφει ρητά.
 * 2. **Χάνει τη διάκριση χαρακτήρα/πλαισίου.** Το `MTextEntity` είχε ομώνυμο `height` που
 *    σήμαινε **ύψος κουτιού** (τώρα `definedHeight`) ⇒ επέστρεφε πλαίσιο ως γραμματοσειρά.
 *
 * ⚠️ **Το `||` ΔΕΝ είναι στιλιστική επιλογή — μην το «διορθώσεις» σε `??`.** Στο DXF το
 * μηδενικό ύψος είναι **έγκυρη τιμή με σημασία «δεν ορίζεται εδώ»**: όταν το TextStyle έχει
 * σταθερό ύψος, το group 40 της οντότητας γράφεται `0` και το πραγματικό ύψος έρχεται από το
 * STYLE. Το `??` θα κρατούσε το `0` και θα ζωγράφιζε **αόρατο κείμενο**· το `||` προχωρά στην
 * επόμενη πηγή. Ίδιος λόγος και για τον έλεγχο `h > 0` στο run παραπάνω — τα δύο σκέλη
 * λένε **το ίδιο πράγμα** και πρέπει να αλλάζουν μαζί.
 *
 * @see MTextEntity.definedHeight — το ύψος πλαισίου, που ΔΕΝ διαβάζεται ποτέ από εδώ
 */
export function resolveTextHeight(entity: TextStyledEntity): number {
  const run = entity.textNode?.paragraphs?.[0]?.runs?.[0];
  if (run && !('top' in run)) {
    const h = (run as TextRun).style?.height;
    if (h !== undefined && h > 0) return h;
  }
  // 🐛 ADR-737 §18 — ΗΤΑΝ `DEFAULT_FONT_SIZE` (**12**), δηλαδή ο ίδιος ο SSoT κουβαλούσε το
  // σφάλμα που το `bounds-primitives` είχε διορθώσει τοπικά στις 2026-02-20: «*Used
  // entity.fontSize || DEFAULT_FONT_SIZE (12) — but DXF entities have height (e.g. 2.5) →
  // bounds were ~5x inflated*». Το `DEFAULT_FONT_SIZE: 12` είναι πρακτικό fallback σε **pixels**
  // (ADR-142)· εδώ μιλάμε **drawing units**, όπου το πρότυπο είναι ISO 3098 / AutoCAD = 2,5.
  // Γι' αυτό τα 7 σημεία είχαν γράψει το καθένα το δικό του `|| 2.5`: **παρέκαμπταν** τον SSoT
  // επειδή ο SSoT απαντούσε λάθος. Διορθώνεται εδώ, μία φορά, κι έτσι η υιοθέτηση είναι ασφαλής.
  return entity.height || entity.fontSize || TEXT_SIZE_LIMITS.DEFAULT_HEIGHT;
}
