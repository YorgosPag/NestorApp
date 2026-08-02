/**
 * ADR-505 §A / ADR-636 — pure resolution helpers for the DXF ASCII writer
 * (file-size SRP split, N.7.1 — mirror of the tables/hatch/text/primitive-emitter
 * splits that already live beside `dxf-ascii-writer.ts`).
 *
 * Two stateless derivations that the writer's entity loop consumes:
 *   • `resolveAci`        — entity/layer colour cascade → ACI index (code 62).
 *   • `collectTextStyles` — distinct STYLE table entries the TEXT/MTEXT reference.
 *
 * Zero React / DOM / Firestore deps.
 */

import type { Entity } from '../../types/entities';
import type { DxfStyleTableEntry } from '../../text-engine/types/text-ast.types';
import { hexToAci } from '../../ui/text-toolbar/controls/aci-palette';
// 🏢 Color-Conversion SSoT (ADR-573): int(0xRRGGBB)→hex via canonical `dxf-true-color`.
import { trueColorToHex } from '../../utils/dxf-true-color';
import {
  readTextEntityFamily, readTextEntityBold, readTextEntityItalic, textStyleName, resolveExportFont,
} from './dxf-ascii-text-writer';
// ADR-739 Φ.Ε/Φ2 βήμα 4 — «SHX ή TrueType;» + όνομα αρχείου → οικογένεια. Από το φύλλο, όχι
// από το barrel `text-engine/fonts` (που θα έσερνε το Firebase SDK του font manager).
import { fontKindOf, fontFamilyOfFileName } from '../../text-engine/fonts/font-file-kind';
import { TEXT_OBLIQUE_ITALIC_DEG } from '../../config/text-rendering-config';
import type { DxfWriteLayer } from './dxf-ascii-writer';

const DEFAULT_ACI = 7; // white/black (ByLayer-ish fallback)

/**
 * Resolve an entity's display colour to an ACI index, mirroring the renderer's
 * cascade (colorTrueColor > colorAci > concrete hex > ByLayer → layer colour).
 */
export function resolveAci(e: Entity, layer: DxfWriteLayer | undefined): number {
  if (e.colorMode !== 'ByLayer') {
    if (e.colorTrueColor != null) return hexToAci(trueColorToHex(e.colorTrueColor));
    if (e.colorAci != null && e.colorAci > 0) return e.colorAci;
    if (e.color) return hexToAci(e.color);
  }
  if (layer) {
    if (layer.colorTrueColor != null) return hexToAci(trueColorToHex(layer.colorTrueColor));
    if (layer.colorAci != null && layer.colorAci > 0) return layer.colorAci;
    if (layer.color) return hexToAci(layer.color);
  }
  return DEFAULT_ACI;
}

/**
 * Collect the distinct STYLE table entries the TEXT/MTEXT entities reference — the inverse of
 * the import's `buildStyleFontMap`. Style name = font family (the ONE derivation `textStyleName`
 * shares with the per-entity group-7 code, so table and entities agree); `fontFile` = the family
 * verbatim (import strips the extension on the way in, so no synthetic `.shx` is fabricated). The
 * always-present `STANDARD` needs no entry (AutoCAD implicit) so font-less text adds nothing.
 *
 * 🔴 ADR-739 Φ.Ε/Φ1 — **ένα record ανά ΠΑΡΑΛΛΑΓΗ, όχι ανά οικογένεια.** Το DXF δηλώνει το
 * βάρος στο text style (XDATA 1071), οπότε ένας πίνακας με έντονη κεφαλίδα και κανονικά
 * δεδομένα παράγει **δύο** records — `Arial` και `Arial-Bold` — που δείχνουν στο **ίδιο**
 * αρχείο γραμματοσειράς και διαφέρουν μόνο στις σημαίες. Ίδιο ιδίωμα με το AutoCAD, όπου
 * «Arial» και «Arial Bold» είναι δύο ξεχωριστά text styles.
 *
 * Το κλειδί του dedup είναι το **όνομα του style** (που ήδη περιέχει την παραλλαγή), άρα
 * παραμένει ένα record ανά διακριτό group 7 — καμία διπλοεγγραφή, κανένα ορφανό.
 */
export function collectTextStyles(entities: readonly Entity[]): DxfStyleTableEntry[] {
  const byName = new Map<string, DxfStyleTableEntry>();
  for (const e of entities) {
    if (e.type !== 'text' && e.type !== 'mtext') continue;
    const family = readTextEntityFamily(e);
    const bold = readTextEntityBold(e);
    const italic = readTextEntityItalic(e);
    const name = textStyleName(family, bold, italic);
    if (name === 'STANDARD' || byName.has(name)) continue;
    byName.set(name, styleEntryFor(name, family, bold, italic));
  }
  return [...byName.values()];
}

/**
 * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **ένα STYLE record, δύο εντελώς διαφορετικές δοκτρίνες κλίσης.**
 *
 * Το DXF δηλώνει τα πλάγια με **δύο ασύμβατους μηχανισμούς**, και ποιος ισχύει το καθορίζει
 * ο **τύπος** της γραμματοσειράς — όχι προτίμηση:
 *
 * | | TrueType | SHX |
 * |---|---|---|
 * | πλάγια | σημαία `ITALIC` στο **XDATA 1071** | **γωνία κλίσης**, group **50** |
 * | γιατί | η οικογένεια **έχει** σχεδιασμένη πλάγια όψη· το AutoCAD τη φορτώνει | τα σχήματα SHX δεν έχουν πλάγια όψη· η μόνη κλίση είναι γεωμετρική |
 * | αποτέλεσμα | σωστά σχεδιασμένα πλάγια γράμματα | γερμένα κανονικά γράμματα |
 *
 * Μια γεωμετρική κλίση πάνω σε TrueType θα ήταν **χειρότερη**, όχι απλώς διαφορετική: το
 * `Arial Italic` δεν είναι το `Arial` γερμένο κατά 15° — έχει άλλα σχήματα για τα `a`, `e`,
 * `f`. Επιπλέον ένα μη-μηδενικό oblique σε TTF **εμποδίζει την εξαγωγή του κειμένου ως
 * κείμενο** σε PDF από το AutoCAD (τεκμηριωμένο από τη Bluebeam), δηλαδή θα χαλούσε την
 * αναζησιμότητα σε κάθε PDF που παράγει ο παραλήπτης.
 *
 * ## 🔴 Γιατί το XDATA γράφεται πλέον για **ΚΑΘΕ** TrueType style, όχι μόνο για τα πλάγια/έντονα
 *
 * Η Φ1 έγραφε XDATA μόνο για την έντονη παραλλαγή, με το σκεπτικό «ένα `1071 = 34` σε κάθε
 * style θα άλλαζε byte χωρίς κανένα κέρδος». Το κέρδος **υπάρχει**, και δεν είναι το `1071`
 * — είναι το `1000`:
 *
 * Το group 3 που γράφουμε είναι `<οικογένεια>.ttf`, δηλαδή **εικασία για το όνομα αρχείου**.
 * Για `Arial` / `Calibri` πετυχαίνει. Για `Times New Roman` το πραγματικό αρχείο των Windows
 * είναι `times.ttf`, για `Courier New` `cour.ttf` — και οι δύο **βρίσκονται** στη λίστα
 * γραμματοσειρών του ίδιου του έργου (`DIM_FONT_OPTIONS`). Εκεί η εικασία αστοχεί και τα
 * Windows υποκαθιστούν σιωπηλά **άλλη** γραμματοσειρά. Το `1000 <οικογένεια>` είναι
 * **τυπογραφικό** όνομα, όχι αρχείου: είναι το σημείο όπου το AutoCAD αναγνωρίζει τη σωστή
 * όψη όταν το αρχείο αστοχήσει, και είναι η μόνη δήλωση «αυτό το style ΕΙΝΑΙ TrueType» που
 * επιβιώνει ανεξάρτητα από το τι υπάρχει στον δίσκο του παραλήπτη.
 *
 * Αντίστροφα, ένα SHX style **δεν** παίρνει ποτέ XDATA: η παρουσία του extended font data
 * αφορά εξ ορισμού μόνο TrueType, οπότε XDATA πάνω σε `romans.shx` θα ήταν **ψέμα** για τον
 * τύπο της γραμματοσειράς — και τα SHX δεν έχουν βάρος/κλίση να δηλώσουν ούτως ή άλλως.
 */
function styleEntryFor(
  name: string, family: string, bold: boolean, italic: boolean,
): DxfStyleTableEntry {
  const fontFile = resolveExportFont(family);
  const trueType = fontKindOf(fontFile) === 'truetype';
  return {
    // ADR-644 (#8) — Greek-capable font (the SHX `txt` renders Greek as «?»).
    name, fontFile, bigFontFile: '',
    height: 0, widthFactor: 1, flags: 0, textGenerationFlags: 0,
    // Η γεωμετρική κλίση αφορά **μόνο** τα SHX (δες τον πίνακα παραπάνω). Για TrueType μένει
    // 0 — byte-identical με πριν για κάθε υπάρχον style.
    obliqueAngle: !trueType && italic ? TEXT_OBLIQUE_ITALIC_DEG : 0,
    // 🔴 Η οικογένεια του XDATA παράγεται από το **αρχείο που γράφτηκε**, όχι από το αρχείο
    // που ζητήθηκε. Η διαφορά φαίνεται σε ένα εισαγόμενο `txt.shx`: το ADR-644 (#8) το
    // υποκαθιστά με `Arial.ttf` επειδή το SHX `txt` δεν έχει ελληνικά γλυφά, οπότε ένα
    // `1000 txt.shx` θα δήλωνε ως τυπογραφική οικογένεια ένα **όνομα αρχείου SHX** πάνω σε
    // TrueType record — αντίφαση που ο πρώτος αναγνώστης θα την έλυνε όπως ήθελε.
    ...(trueType ? { extendedFont: { family: fontFamilyOfFileName(fontFile), bold, italic } } : {}),
  };
}
