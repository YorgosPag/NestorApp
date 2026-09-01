/**
 * @fileoverview SSoT — γεωμετρία **ανοιχτής πολυγραμμής** (άξονας δρόμου): πλευρά,
 * απόσταση, ζώνη μετώπου.
 * @related types/geo/coordinates.ts (GeoPolyline) · types/property-demand.ts (FrontageSide)
 *   · geo-ring.ts (αδελφό module — αυτό ρωτά «ποια πλευρά;», εκείνο «μέσα;»)
 * @module lib/geo/geo-line
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΠΟ ΤΟ `geo-ring.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο δακτύλιος **περικλείει** (η ερώτηση είναι «μέσα;»), η πολυγραμμή **χωρίζει** (η
 * ερώτηση είναι «ποια πλευρά;») — η ίδια διάκριση με την οποία γεννήθηκε ο τύπος
 * {@link GeoPolyline}. Δύο διαφορετικά ερωτήματα, δύο modules, ώστε κανένα από τα δύο
 * να μην αναγκαστεί να ξέρει για το άλλο.
 *
 * ⚠️ **Καμία εξάρτηση προς τα πάνω.** Αυτό το module ΔΕΝ κάνει import από
 * `types/property-demand` — ο τύπος `FrontageSide` (`'left' | 'right' | 'both'`) είναι
 * **αίτημα ανθρώπου** (και το `'both'` είναι νόμιμο αίτημα χωρίς να είναι ποτέ
 * γεγονός), ενώ το {@link PolylineSide} εδώ είναι **γεωμετρική απάντηση** για ένα
 * σημείο (`'left' | 'right' | 'on'`, ποτέ `'both'`). Αν αυτό το module δεχόταν τον
 * τύπο του αιτήματος, ένα leaf module γεωμετρίας θα εξαρτιόταν από το domain πάνω από
 * αυτό — η αντίστροφη κατεύθυνση εξάρτησης. Η `frontagePolylineOutline` δέχεται
 * literal union `'left' | 'right' | 'both'`, δικό της, ταυτόσημο σε ονόματα αλλά
 * ανεξάρτητο ως τύπος.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΖΩΝΗ ΕΙΝΑΙ ΚΑΨΟΥΛΑ, ΟΧΙ ΟΡΘΟΓΩΝΙΟ — ΣΚΟΠΙΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * {@link metresOutsideFrontage} = `max(0, distanceToPolylineMetres - depthMetres)`.
 * Η απόσταση σημείου–τμήματος «σφίγγει» στα άκρα (nearest point clamped στο segment),
 * άρα η ζώνη γύρω από κάθε άκρο του άξονα είναι **κύκλος ακτίνας depth**, όχι γωνία
 * 90°. Αυτό είναι πρόθεση: ένα γωνιακό οικόπεδο λίγο **μετά** το τέλος του σχεδιασμένου
 * τμήματος δεν σταμάτησε να είναι «πάνω στον δρόμο» επειδή ο άνθρωπος που τράβηξε τη
 * γραμμή δεν την πήγε ως την επόμενη γωνία. Ορθογώνια ζώνη θα το έκοβε απότομα, με
 * ασυνέχεια ακριβώς εκεί που η πραγματικότητα είναι συνεχής.
 */

import type { GeoOutline, GeoPoint, GeoPolyline } from '@/types/geo/coordinates';
import { fromLocalMetres, toLocalMetres, type LocalPoint } from './geo-local-frame';

/** Ποια πλευρά του άξονα — γεωμετρική **απάντηση** για ένα σημείο (όχι αίτημα). */
export type PolylineSide = 'left' | 'right' | 'on';

/**
 * Πόσο κοντά (σε μέτρα) στον άξονα θεωρείται «πάνω» στη γραμμή αντί για μία από τις
 * δύο πλευρές. Οποιαδήποτε θετική τιμή θα δούλευε ως φρουρός floating-point — 5 cm
 * είναι κάτω από την ακρίβεια κάθε GPS/σχεδίου με το δάχτυλο, άρα δεν «τρώει» καμία
 * πραγματική πλευρά.
 */
const ON_AXIS_TOLERANCE_METRES = 0.05;

/** Πόσα τμήματα έχει κάθε στρογγυλό άκρο της ζώνης όταν σχεδιάζεται (όχι όταν κρίνεται). */
const CAP_ARC_SEGMENTS = 16;

// =============================================================================
// ΕΣΩΤΕΡΙΚΑ — τοπικό επίπεδο, απόσταση σημείου-τμήματος, πλησιέστερο τμήμα
// =============================================================================

/** Η πολυγραμμή σε τοπικά μέτρα· origin = **πρώτο σημείο του άξονα** (δεν έχει κέντρο βάρους με νόημα). */
function toLocalAxis(axis: GeoPolyline): readonly LocalPoint[] {
  return toLocalMetres(axis, axis[0]);
}

interface NearestSegment {
  /** Απόσταση (μέτρα, ≥0) στο **κοντινότερο σημείο του τμήματος** — clamped στα άκρα. */
  readonly distanceMetres: number;
  /**
   * Πρόσημο cross-product του νικητή τμήματος: θετικό αριστερά, αρνητικό δεξιά,
   * μηδέν πάνω στην (άπειρη) ευθεία του.
   */
  readonly crossSign: number;
}

/**
 * Βρίσκει το **πλησιέστερο τμήμα** της πολυγραμμής σε ένα σημείο, και την πλευρά
 * κρίνει **σε εκείνο** το τμήμα.
 *
 * ⚠️ **Διφορούμενη ζώνη σε εσωτερική γωνία.** Σε πολυγραμμή σχήματος «Γ», ένα σημείο
 * κοντά στην εσωτερική γωνία μπορεί να είναι εξίσου κοντά σε δύο τμήματα με
 * **αντίθετο** πρόσημο πλευράς. Η επιλογή εδώ είναι «ο νικητής της απόστασης
 * αποφασίζει και την πλευρά» — συνεπές με το ίδιο ερώτημα («ποιο κομμάτι δρόμου με
 * αφορά;») και όχι κάποιος μέσος όρος που δεν θα αντιστοιχούσε σε κανένα πραγματικό
 * τμήμα δρόμου.
 */
function nearestSegment(point: LocalPoint, axis: readonly LocalPoint[]): NearestSegment {
  let best: NearestSegment = { distanceMetres: Infinity, crossSign: 0 };

  for (let i = 0; i < axis.length - 1; i++) {
    const a = axis[i];
    const b = axis[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;

    // Το «σφίξιμο» στο [0,1] κρατά το κοντινότερο σημείο ΜΕΣΑ στο τμήμα (ADR-071:
    // η ονομασμένη clamp01 ζει στο dxf-viewer και δεν εισάγεται από εδώ).
    const rawT =
      lengthSq === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
    const t = Math.min(1, Math.max(0, rawT));
    const closestX = a.x + t * dx;
    const closestY = a.y + t * dy;
    const distanceMetres = Math.hypot(point.x - closestX, point.y - closestY);

    if (distanceMetres < best.distanceMetres) {
      const crossSign = dx * (point.y - a.y) - dy * (point.x - a.x);
      best = { distanceMetres, crossSign };
    }
  }

  return best;
}

// =============================================================================
// ΔΗΜΟΣΙΟ API — πλευρά, απόσταση, ζώνη μετώπου
// =============================================================================

/**
 * **Ο ΜΟΝΑΔΙΚΟΣ κριτής του «είναι άξονας;»** — γνήσιος type guard, μηδέν μετατροπή.
 *
 * 🔑 **Γι' αυτό ζει ΕΔΩ και όχι στη φόρμα.** Το ερώτημα «έχει αυτός ο πίνακας αρκετές
 * κορυφές για να οριστεί διεύθυνση;» είναι **γεωμετρικό**, και το ρωτούν **δύο**
 * ανεξάρτητοι καταναλωτές: ο μεταφραστής της φόρμας (πριν χτίσει τη ζήτηση) και η
 * ίδια η οθόνη (πριν ζωγραφίσει τη ζώνη). Γραμμένος δύο φορές, ο ένας από τους δύο
 * **ήταν ήδη** `as unknown as GeoPolyline` — δηλαδή ισχυρισμός αντί για έλεγχο, και ο
 * μεταγλωττιστής έπαυε να φυλάει ακριβώς εκεί που η πλειάδα υπάρχει για να φυλάει
 * (σχήμα ADR-749: δύο αρχές για ένα ερώτημα).
 *
 * ⚠️ Το `points is GeoPolyline` **δεν είναι** cast: ο μεταγλωττιστής στενεύει τον τύπο
 * **επειδή** ο έλεγχος έτρεξε. Καμία διαδρομή δεν παρακάμπτει το μήκος.
 */
export function isGeoPolyline(points: readonly GeoPoint[]): points is GeoPolyline {
  return points.length >= 2;
}

/**
 * Ποια πλευρά του άξονα· κρίνεται στο **πλησιέστερο τμήμα** της πολυγραμμής.
 *
 * 🔑 **Σύμβαση προσήμου** (μαθηματικό επίπεδο x=ανατολικά, y=βόρεια, ΟΧΙ οθόνη):
 * cross = dx·(py−ay) − dy·(px−ax) πάνω στο τμήμα a→b. Θετικό ⇒ `'left'`. Αυτό είναι
 * η κανονική «αριστερά ως προς τη φορά διαγραφής» — αν ο άξονας δείχνει από Βορρά
 * προς Νότο, «αριστερά» είναι η **ανατολική** πλευρά (σαν να περπατάς προς τον
 * Νότο: η Ανατολή είναι στο αριστερό σου χέρι). {@link ADR-769} το λέει ήδη για το
 * `FrontageSide`: το δέσιμο με ανθρώπινη ονομασία («νότια») σπάει σε καμπύλο δρόμο·
 * η φορά του άξονα είναι η μόνη σταθερά.
 */
export function sideOfPolyline(point: GeoPoint, axis: GeoPolyline): PolylineSide {
  const localAxis = toLocalAxis(axis);
  const localPoint = toLocalMetres([point], axis[0])[0];
  const { distanceMetres, crossSign } = nearestSegment(localPoint, localAxis);

  if (distanceMetres < ON_AXIS_TOLERANCE_METRES) return 'on';
  return crossSign > 0 ? 'left' : 'right';
}

/**
 * Κάθετη απόσταση σημείου–πολυγραμμής σε μέτρα (≥0).
 *
 * Στα άκρα «σφίγγει» στο τελικό σημείο του άξονα (clamped point-segment distance) —
 * όχι στην άπειρη προέκταση της ευθείας. Αυτό είναι το ίδιο clamping που κάνει τη
 * ζώνη μετώπου κάψουλα αντί για ορθογώνιο (βλ. σχόλιο κεφαλίδας αρχείου).
 */
export function distanceToPolylineMetres(point: GeoPoint, axis: GeoPolyline): number {
  const localAxis = toLocalAxis(axis);
  const localPoint = toLocalMetres([point], axis[0])[0];
  return nearestSegment(localPoint, localAxis).distanceMetres;
}

/**
 * Πόσα μέτρα **ΕΞΩ** από το μέτωπο βρίσκεται το σημείο. `0` όταν είναι μέσα
 * (ή πάνω στο όριο).
 *
 * ⚠️ **Δεν ρωτά ποια πλευρά.** Το `side` της ζήτησης δεν επηρεάζει αυτόν τον
 * υπολογισμό — φιλτράρει *ποιος* άξονας/πλευρά εφαρμόζεται πριν κληθεί αυτή η
 * συνάρτηση, όχι μέσα σε αυτήν. Ταυτόσημη λογική με το `outside-area` του δακτυλίου:
 * «πόσο έξω», όχι «είσαι μέσα;».
 */
export function metresOutsideFrontage(point: GeoPoint, axis: GeoPolyline, depthMetres: number): number {
  return Math.max(0, distanceToPolylineMetres(point, axis) - depthMetres);
}

// =============================================================================
// ΠΕΡΙΓΡΑΜΜΑ ΖΩΝΗΣ — ΓΙΑ ΖΩΓΡΑΦΙΣΜΑ, ΟΧΙ ΓΙΑ ΚΡΙΣΗ
// =============================================================================

function unitDir(a: LocalPoint, b: LocalPoint): LocalPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  // Διαδοχικά ταυτόσημα σημεία δεν αναμένονται από σχέδιο ανθρώπου (θα ήταν
  // εκφυλισμένο τμήμα μηδενικού μήκους) — ο φρουρός αποτρέπει μόνο NaN.
  if (length === 0) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
}

function leftNormalOf(dir: LocalPoint): LocalPoint {
  return { x: -dir.y, y: dir.x };
}

function negate(v: LocalPoint): LocalPoint {
  return { x: -v.x, y: -v.y };
}

function addScaled(p: LocalPoint, dir: LocalPoint, scale: number): LocalPoint {
  return { x: p.x + dir.x * scale, y: p.y + dir.y * scale };
}

/**
 * Το **αριστερό** μοναδιαίο κάθετο ανά κορυφή — μέσος όρος των δύο γειτονικών
 * τμημάτων στις εσωτερικές κορυφές, ώστε η γραμμή offset να μην ανοίγει κενό στις
 * στροφές. Στα δύο άκρα του άξονα υπάρχει μόνο ένα γειτονικό τμήμα.
 */
function vertexLeftNormals(axis: readonly LocalPoint[]): readonly LocalPoint[] {
  const segmentDirs: LocalPoint[] = [];
  for (let i = 0; i < axis.length - 1; i++) segmentDirs.push(unitDir(axis[i], axis[i + 1]));

  return axis.map((_, i) => {
    const prev = segmentDirs[i - 1];
    const next = segmentDirs[i];
    if (!prev) return leftNormalOf(next);
    if (!next) return leftNormalOf(prev);

    const sum = { x: prev.x + next.x, y: prev.y + next.y };
    const length = Math.hypot(sum.x, sum.y);
    // Γωνία 180° (ο άξονας γυρίζει ακριβώς πίσω στον εαυτό του): δεν έχει νόημα μέση
    // κατεύθυνση — πέφτε πίσω στο επόμενο τμήμα, ίδιο πνεύμα με τον φρουρό του `unitDir`.
    const avgDir = length === 0 ? next : { x: sum.x / length, y: sum.y / length };
    return leftNormalOf(avgDir);
  });
}

/** Γωνία στο (-π, π]. */
function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Τόξο ακτίνας `radius` γύρω από `center`, από τη διεύθυνση `fromDir` προς τη
 * διεύθυνση `toDir`, διαλέγοντας την **κατεύθυνση περιστροφής** (ωρολογιακά ή
 * αντίθετα) που περνάει από `throughDir` — έτσι ώστε το τόξο να καμπυλώνει προς τα
 * **έξω** από τη ζώνη και όχι προς τα μέσα.
 */
function arcBetween(center: LocalPoint, radius: number, fromDir: LocalPoint, toDir: LocalPoint, throughDir: LocalPoint): LocalPoint[] {
  const fromAngle = Math.atan2(fromDir.y, fromDir.x);
  const toAngle = Math.atan2(toDir.y, toDir.x);
  const throughAngle = Math.atan2(throughDir.y, throughDir.x);

  let delta = normalizeAngle(toAngle - fromAngle);
  const throughDelta = normalizeAngle(throughAngle - fromAngle);
  const passesThroughShortWay = delta >= 0 ? throughDelta >= 0 && throughDelta <= delta : throughDelta <= 0 && throughDelta >= delta;
  if (!passesThroughShortWay) delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;

  const points: LocalPoint[] = [];
  for (let i = 0; i <= CAP_ARC_SEGMENTS; i++) {
    const angle = fromAngle + (delta * i) / CAP_ARC_SEGMENTS;
    points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
  }
  return points;
}

/**
 * Το περίγραμμα της ζώνης μετώπου, για **ζωγράφισμα** στον χάρτη — όχι για κρίση
 * («μέσα στη ζώνη;» απαντά το {@link metresOutsideFrontage}, ανεξάρτητα από αυτή τη
 * συνάρτηση).
 *
 * 🔑 **Σχήμα ανά `side`:**
 * - `'both'`: πλήρης «κάψουλα» (stadium) — offset γραμμή αριστερά + στρογγυλό άκρο +
 *   offset γραμμή δεξιά (αντίστροφα) + στρογγυλό άκρο, χωρίς τον άξονα ως ακμή
 *   (η ζώνη είναι συμμετρική γύρω του, ο άξονας περνά από το εσωτερικό της).
 * - `'left'` / `'right'`: **μισή** κάψουλα — ο ίδιος ο άξονας είναι η «ίσια» ακμή
 *   (είναι το όριο ανάμεσα στις δύο πλευρές), και μόνο η μία πλευρά έχει το
 *   στρογγυλεμένο offset περίγραμμα. Οι δύο μισές (`'left'` + `'right'`) μαζί
 *   ξαναφτιάχνουν ακριβώς την `'both'` κάψουλα.
 */
export function frontagePolylineOutline(axis: GeoPolyline, side: 'left' | 'right' | 'both', depthMetres: number): GeoOutline {
  const origin = axis[0];
  const localAxis = toLocalMetres(axis, origin);
  const n = localAxis.length;
  const leftNormals = vertexLeftNormals(localAxis);

  const startDir = unitDir(localAxis[0], localAxis[1]);
  const endDir = unitDir(localAxis[n - 2], localAxis[n - 1]);

  const ring =
    side === 'both'
      ? buildBothSidesCapsule(localAxis, leftNormals, startDir, endDir, depthMetres)
      : buildOneSideCapsule(localAxis, leftNormals, startDir, endDir, depthMetres, side);

  return ring.map((point) => fromLocalMetres(point, origin));
}

/**
 * Το «σημείο στη μέση» δύο διευθύνσεων — χρησιμεύει ως `throughDir` σε τόξα **90°**,
 * όπου η σύντομη διαδρομή είναι μη διφορούμενη από τη φύση της (οι δύο διευθύνσεις
 * δεν είναι ποτέ αντίθετες, άρα το άθροισμα δεν μηδενίζεται). Για τόξα **180°**
 * (αντίθετες διευθύνσεις, π.χ. αριστερό vs δεξί κάθετο) ο μέσος όρος μηδενίζεται —
 * εκεί το `throughDir` δίνεται ρητά (εμπρός/πίσω κατά τον άξονα), όχι με αυτό εδώ.
 */
function bisector(a: LocalPoint, b: LocalPoint): LocalPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Πλήρης «κάψουλα» (stadium): offset γραμμή αριστερά, μισός κύκλος, offset γραμμή
 * δεξιά (αντίστροφα), μισός κύκλος — κλείνει μόνη της (η ένωση τελευταίου με πρώτο
 * σημείο είναι η ακμή του `ring`, καμία επανάληψη σημείου).
 */
function buildBothSidesCapsule(
  axis: readonly LocalPoint[],
  leftNormals: readonly LocalPoint[],
  startDir: LocalPoint,
  endDir: LocalPoint,
  depth: number,
): LocalPoint[] {
  const n = axis.length;
  const leftOffset = axis.map((p, i) => addScaled(p, leftNormals[i], depth));
  const rightOffset = axis.map((p, i) => addScaled(p, leftNormals[i], -depth));

  // Μισός κύκλος 180° — το `throughDir` ΕΙΝΑΙ υποχρεωτικό εδώ (leftNormal/rightNormal
  // είναι αντίθετες διευθύνσεις, ο μέσος όρος τους μηδενίζεται): «εμπρός» στο τέλος
  // του άξονα, «πίσω» στην αρχή — έτσι η κάψουλα φουσκώνει ΠΕΡΑ από τον άξονα, όχι
  // μέσα από το σώμα του.
  const endCap = arcBetween(axis[n - 1], depth, leftNormals[n - 1], negate(leftNormals[n - 1]), endDir);
  const startCap = arcBetween(axis[0], depth, negate(leftNormals[0]), leftNormals[0], negate(startDir));

  // `.slice(1)` σε κάθε επόμενο κομμάτι: το πρώτο του σημείο επαναλαμβάνει το
  // τελευταίο του προηγούμενου (κοινή κορυφή τόξου/ευθείας). Το τελευταίο σημείο του
  // `startCap` επαναλαμβάνει το ΠΡΩΤΟ στοιχείο του `ring` (`leftOffset[0]`) — αυτό το
  // κλείνει η ίδια η έννοια του `ring` (ακμή τελευταίου→πρώτου), άρα κόβεται κι αυτό.
  return [...leftOffset, ...endCap.slice(1), ...[...rightOffset].reverse().slice(1), ...startCap.slice(1, -1)];
}

/**
 * Μισή κάψουλα: ο άξονας είναι η ίσια ακμή (όριο ανάμεσα στις δύο πλευρές), το
 * στρογγυλεμένο offset περίγραμμα υπάρχει μόνο στην πλευρά `side`.
 */
function buildOneSideCapsule(
  axis: readonly LocalPoint[],
  leftNormals: readonly LocalPoint[],
  startDir: LocalPoint,
  endDir: LocalPoint,
  depth: number,
  side: 'left' | 'right',
): LocalPoint[] {
  const n = axis.length;
  const sign = side === 'left' ? 1 : -1;
  const outward = (normal: LocalPoint): LocalPoint => (sign === 1 ? normal : negate(normal));
  const offset = axis.map((p, i) => addScaled(p, outward(leftNormals[i]), depth));

  // Τεταρτοκύκλιο 90° σε κάθε άκρο: από «πίσω/εμπρός κατά τον άξονα» ως το κάθετο
  // offset της επιλεγμένης πλευράς. Μη διφορούμενο εξ ορισμού (οι δύο διευθύνσεις
  // δεν είναι αντίθετες) — ο διαμεσολαβητής αρκεί ως `throughDir`.
  const startArc = arcBetween(axis[0], depth, negate(startDir), outward(leftNormals[0]), bisector(negate(startDir), outward(leftNormals[0])));
  const endArc = arcBetween(axis[n - 1], depth, outward(leftNormals[n - 1]), endDir, bisector(outward(leftNormals[n - 1]), endDir));

  const axisInteriorReversed = axis.slice(1, n - 1).reverse(); // περπάτημα πίσω στον άξονα, τα άκρα τα δίνουν ήδη τα τόξα
  return [
    ...startArc, // startBack .. offset[0]
    ...offset.slice(1, n - 1), // offset[1..n-2]
    ...endArc, // offset[n-1] .. endForward
    axis[n - 1], // endForward -> τέλος άξονα (ίσια ακμή)
    ...axisInteriorReversed,
    axis[0], // κλείνει: άξονας[0] -> startBack (πρώτο στοιχείο του ring)
  ];
}
