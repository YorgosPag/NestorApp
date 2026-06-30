/**
 * Linear-member **end-cap** reference snap — pure SSoT (ADR-508 §end-reference, αδελφό του ADR-523).
 *
 * Όταν το φάντασμα ενός νέου **κάθετου** τοίχου/δοκαριού πλησιάζει την **κοντή άκρη (κορυφή)** ενός
 * υφιστάμενου γραμμικού μέλους, οι **3 γραμμές αναφοράς** του φαντάσματος (βόρεια παρειά 1α / κέντρο
 * άξονα 2β / νότια παρειά 3γ) κουμπώνουν **nearest-wins** στη μία γραμμή της κορυφής, καθώς ο κέρσορας
 * κινείται κατά μήκος του άξονα του υφιστάμενου μέλους:
 *
 *   · 3γ (νότια παρειά) ≡ κορυφή → φάντασμα ΟΛΟ έξω από την άκρη (axis = E + ghostHalf)
 *   · 2β (κέντρο άξονα) ≡ κορυφή → φάντασμα μισό-μισό               (axis = E)
 *   · 1α (βόρεια παρειά) ≡ κορυφή → φάντασμα ΟΛΟ μέσα               (axis = E − ghostHalf)
 *
 * Είναι ο **end-cap** αντίστοιχος της μακριάς-παρειάς ADR-523 (column-head): εκεί η αντιστοίχιση γίνεται
 * κατά τον **κάθετο** `n` της παρειάς· εδώ κατά τον **άξονα** `u` του υφιστάμενου μέλους (η κορυφή είναι
 * στο `alongMin`/`alongMax`). Reuse `buildMemberTargetFrame` (ΕΝΑ projection SSoT — a/u/p + cursor
 * along/perp + outline έκταση)· μηδέν νέο math. Pure — zero React/DOM/store. Μονάδες: **scene units**.
 *
 * Gate ώστε να **μη μάχεται** τους υπάρχοντες κλάδους:
 *   · κέρσορας στον **άξονα** (small |cPerp|) → αφήνεται στη συγγραμμική επέκταση (🔴 overlap).
 *   · κέρσορας **βαθιά στο σώμα** (μακριά από κάθε κορυφή) → αφήνεται στο body Τ-framing (🟢 beam).
 *
 * @see ./linear-member-face-snap.ts — body Τ-framing + `buildMemberTargetFrame`/`MemberGhostSnapResult`
 * @see ./member-ghost-snap.ts — ο dispatcher που τον καλεί ΠΡΙΝ το body T-framing (preview ≡ commit)
 * @see ../columns/column-reference-lines.ts — ADR-523, η μακριάς-παρειάς αδελφή (column-head)
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StripJustification } from '../types/foundation-types';
import {
  buildMemberTargetFrame,
  type LinearMemberSnapTarget,
  type LinearMemberFaceSnapOptions,
  type MemberGhostSnapResult,
  type MemberTargetFrame,
} from './linear-member-face-snap';

/** Επιλεγμένος υποψήφιος end-reference (η κορυφή `E`, η θέση άξονα φαντάσματος `G`, πλευρά/ταυτότητα). */
interface EndReferenceHit {
  readonly fr: MemberTargetFrame;
  readonly id: string;
  readonly h: number; // ημι-πάχος υφιστάμενου μέλους (max|perp|)
  readonly e: number; // διαμήκης θέση κορυφής (`alongMin`/`alongMax`) — location line / pivot κατά `u`
  readonly off: number; // tier offset = g − E ∈ {−ghostHalf, 0, +ghostHalf} (πόσο μετατοπίζεται ο άξονας από την κορυφή)
  readonly side: number; // φορά stub (προς την πλευρά του κέρσορα) κατά `p`
  readonly residual: number; // συνολικό υπόλοιπο (along + perp overflow) — nearest-wins ανάμεσα σε στόχους
}

/**
 * Revit location-line justification ανά βαθμίδα: το pivot (1ο κλικ) μπαίνει ΠΑΝΤΑ στην κορυφή `E`,
 * και η `justification` ορίζει προς ποια πλευρά «κρέμεται» το σώμα ώστε ο άξονας να πέσει στο `E+off`:
 *   · off=0 (2β≡κορυφή)  → 'center' (σώμα κεντραρισμένο στην κορυφή)
 *   · off≠0 (3γ ή 1α≡κορυφή) → 'left'/'right' ανάλογα με την πλευρά (`side`) ώστε ο canonical normal
 *     του location line (= `side·u`) να μετατοπίσει το σώμα στη σωστή φορά (βλ. axis-justify.ts).
 * `Math.sign(off) === side → 'left'` προκύπτει από `edgeAlignmentPointForJustification` ('left'=+n_ccw):
 * το shed shift = `side·ghostHalf` για 'left' → ίσο με `off` ακριβώς όταν `sign(off)===side`.
 */
function justificationForTier(off: number, side: number): StripJustification {
  if (off === 0) return 'center';
  return Math.sign(off) === side ? 'left' : 'right';
}

/** Οι 3 διαμήκεις θέσεις άξονα φαντάσματος (κατά `u`) που φέρνουν 1α/2β/3γ flush στην κορυφή `E`. */
const TIER_OFFSETS = (ghostHalf: number): readonly number[] => [-ghostHalf, 0, ghostHalf];

/**
 * Επιλέγει το end-cap 3-tier flush snap πάνω σε υφιστάμενο γραμμικό μέλος. Pure. `null` όταν ο κέρσορας
 * δεν είναι κοντά σε κορυφή (στο πλάι) κανενός στόχου → ο caller πέφτει στο body Τ-framing / overlap.
 */
export function resolveMemberEndReferenceSnap(
  cursor: Readonly<Point2D>,
  targets: readonly LinearMemberSnapTarget[],
  opts: Readonly<LinearMemberFaceSnapOptions>,
): MemberGhostSnapResult | null {
  const ghostHalf = opts.memberWidthScene / 2;
  if (ghostHalf <= 0) return null;
  // Tunable (Giorgio browser-verify): πόσο μακριά (κατά τον άξονα του υφιστάμενου) από την πλησιέστερη
  // από τις 3 βαθμίδες παραμένει ενεργό το snap. Floor = capture/2 ώστε λεπτά μέλη να πιάνονται άνετα.
  const endCaptureScene = Math.max(ghostHalf, opts.captureScene * 0.5);

  let best: EndReferenceHit | null = null;
  for (const t of targets) {
    if (t.axis.length < 2 || t.outline.length < 3) continue;
    const fr = buildMemberTargetFrame(cursor, t);
    if (!fr) continue;
    const h = Math.max(Math.abs(fr.perpMin), Math.abs(fr.perpMax)); // ημι-πάχος υφιστάμενου
    if (h < 1e-9) continue;

    // ── perp gate: ο κέρσορας πρέπει να είναι ΣΤΟ ΠΛΑΪ (κοντά σε μακριά παρειά), όχι στον άξονα ──
    const absPerp = Math.abs(fr.cPerp);
    if (absPerp < h * 0.5) continue; // on-axis → συγγραμμική επέκταση (🔴 overlap) — όχι κάθετο Τ
    if (absPerp > h + opts.captureScene) continue; // πολύ μακριά στο πλάι
    const perpOverflow = Math.max(0, absPerp - h); // πόσο πέρα από την παρειά (0 αν εντός σώματος)
    const side = fr.cPerp >= 0 ? 1 : -1;

    // ── along gate + nearest tier: 2 κορυφές × 3 γραμμές αναφοράς φαντάσματος ──
    for (const e of [fr.alongMin, fr.alongMax]) {
      for (const off of TIER_OFFSETS(ghostHalf)) {
        const g = e + off; // διαμήκης θέση άξονα φαντάσματος αν αυτή η γραμμή κουμπώσει στην κορυφή
        const alongResidual = Math.abs(fr.cAlong - g);
        if (alongResidual > endCaptureScene) continue;
        const residual = alongResidual + perpOverflow;
        if (!best || residual < best.residual) {
          best = { fr, id: t.id, h, e, off, side, residual };
        }
      }
    }
  }
  if (!best) return null;

  const { fr, h, e, side } = best;
  // Revit location line — start/end = η γραμμή αναφοράς ΠΑΝΩ στην κορυφή `E` (το pivot του 1ου κλικ),
  // στην παρειά της πλευράς του κέρσορα. Το σώμα μετατοπίζεται μέσω `justification` (ο builder κάνει
  // `computeWallAlignmentOffset`). Έτσι το κέντρο περιστροφής μένει στην κορυφή σε ΟΛΕΣ τις βαθμίδες.
  const start: Point2D = {
    x: fr.a.x + e * fr.u.x + side * h * fr.p.x,
    y: fr.a.y + e * fr.u.y + side * h * fr.p.y,
  };
  // end = μικρό ghost κατά μήκος της location line (κάθετα στο υφιστάμενο μέλος, προς την πλευρά κέρσορα).
  const end: Point2D = {
    x: start.x + side * opts.ghostLenScene * fr.p.x,
    y: start.y + side * opts.ghostLenScene * fr.p.y,
  };
  // 🟢 έγκυρο κάθετο Τ στην κορυφή. `justification` ανά βαθμίδα (3γ→σώμα έξω / 2β→κέντρο / 1α→σώμα μέσα).
  // faceFrame παραλείπεται (όπως ο overlap κλάδος) — listening dims ανά-βαθμίδα = follow-up TODO.
  // `targetId` διαδίδει τον host (preview≡commit).
  return { start, end, status: 'beam', targetId: best.id, justification: justificationForTier(best.off, side) };
}

/** Επιλεγμένος υποψήφιος corner-cap (κορυφή `e`, καθρεφτισμένη θέση γωνίας `q`, φορά/άκρη). */
interface CornerCapHit {
  readonly fr: MemberTargetFrame;
  readonly id: string;
  readonly e: number; // διαμήκης θέση κορυφής (location line / νότια παρειά φαντάσματος)
  readonly q: number; // κάθετη θέση «πίσω-κάτω» γωνίας φαντάσματος = −cPerp (καθρέφτης), clamped στο πλάτος
  readonly dir: number; // φορά απλώματος κατά `p` (cPerp≥0 → +1 ανατολικά· <0 → −1 δυτικά)
  readonly endOut: number; // φορά «έξω» από το σώμα κατά `u` (top κορυφή +1 / bottom −1)
  readonly beyond: number; // πόσο πέρα από την κορυφή είναι ο κέρσορας — nearest-wins
}

/**
 * ADR-508 §end-reference (corner-cap / γωνία Γ) — όταν ο κέρσορας είναι **βόρεια της κορυφής** (εκεί που
 * πριν έβγαινε 🔴 ομοαξονικό) ΚΑΙ **εντός του πλάτους** του υφιστάμενου (μέχρι την παρειά), το φάντασμα
 * γίνεται **οριζόντιο** με τη **νότια παρειά flush στην κορυφή** (Giorgio: «πάντα νότια κολλάει στη βόρεια
 * μικρή παρειά») και σχηματίζει **γωνία Γ**:
 *
 *   · cPerp ≥ 0 (δεξιά/ανατολικά) → απλώνεται ΑΝΑΤΟΛΑ· η ΝΔ γωνία = καθρέφτης `−cPerp` (στον άξονα→μέσο,
 *     στην Α παρειά→ΒΔ γωνία· **ολισθαίνει**, Giorgio 1B).
 *   · cPerp < 0 (αριστερά/δυτικά) → απλώνεται ΔΥΣΗ· η ΝΑ γωνία = καθρέφτης `−cPerp` (στη Δ παρειά→ΒΑ γωνία).
 *
 * Reuse ΟΛΟΥ του location-line + `justification` (start = η «πίσω-κάτω» γωνία ΠΑΝΩ στην κορυφή = pivot·
 * σώμα «κρέμεται» έξω από το υφιστάμενο). Pure. `null` όταν ο κέρσορας δεν είναι πέρα από κορυφή / εκτός
 * πλάτους → ο caller πέφτει στο §end-reference 3-tier (πλάι) ή στη συγγραμμική επέκταση.
 */
export function resolveMemberEndCornerCapSnap(
  cursor: Readonly<Point2D>,
  targets: readonly LinearMemberSnapTarget[],
  opts: Readonly<LinearMemberFaceSnapOptions>,
): MemberGhostSnapResult | null {
  if (opts.memberWidthScene <= 0) return null;

  let best: CornerCapHit | null = null;
  for (const t of targets) {
    if (t.axis.length < 2 || t.outline.length < 3) continue;
    const fr = buildMemberTargetFrame(cursor, t);
    if (!fr) continue;
    const h = Math.max(Math.abs(fr.perpMin), Math.abs(fr.perpMax)); // ημι-πάχος υφιστάμενου
    if (h < 1e-9) continue;

    // ── εντός πλάτους (μέχρι την παρειά) — αλλιώς ο κέρσορας είναι «στο πλάι» → §end-reference 3-tier ──
    if (Math.abs(fr.cPerp) > h) continue;

    // ── πέρα από ποια κορυφή (βόρεια/νότια του σώματος); μέσα στο σώμα → ΟΧΙ corner-cap ──
    let e: number;
    let endOut: number;
    let beyond: number;
    if (fr.cAlong > fr.alongMax) { e = fr.alongMax; endOut = 1; beyond = fr.cAlong - fr.alongMax; }
    else if (fr.cAlong < fr.alongMin) { e = fr.alongMin; endOut = -1; beyond = fr.alongMin - fr.cAlong; }
    else continue;
    if (beyond > opts.captureScene) continue; // πολύ μακριά από την κορυφή → ελεύθερη κίνηση

    // «πίσω-κάτω» γωνία = καθρέφτης του κέρσορα κατά `p` (Giorgio 1B), clamped στο πλάτος [perpMin,perpMax].
    const q = Math.min(Math.max(-fr.cPerp, fr.perpMin), fr.perpMax);
    const dir = fr.cPerp >= 0 ? 1 : -1; // απλώνεται προς την πλευρά του κέρσορα
    if (!best || beyond < best.beyond) best = { fr, id: t.id, e, q, dir, endOut, beyond };
  }
  if (!best) return null;

  const { fr, e, q, dir, endOut } = best;
  // start = η «πίσω-κάτω» γωνία ΠΑΝΩ στην κορυφή (= pivot + location line = νότια παρειά φαντάσματος).
  const start: Point2D = {
    x: fr.a.x + e * fr.u.x + q * fr.p.x,
    y: fr.a.y + e * fr.u.y + q * fr.p.y,
  };
  // end = stub κατά μήκος της location line προς την πλευρά του κέρσορα (φάντασμα οριζόντιο).
  const end: Point2D = {
    x: start.x + dir * opts.ghostLenScene * fr.p.x,
    y: start.y + dir * opts.ghostLenScene * fr.p.y,
  };
  // justification = το σώμα «κρέμεται» ΕΞΩ από το υφιστάμενο (κατά `endOut·u`). 'left'=+n_ccw του
  // location line· `endOut·dir` = πρόσημο της προβολής του `endOut·u` στο +n_ccw (βλ. axis-justify).
  const justification: StripJustification = endOut * dir > 0 ? 'left' : 'right';
  return { start, end, status: 'beam', targetId: best.id, justification };
}
