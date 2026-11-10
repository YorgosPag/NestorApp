/**
 * ADR-911 Δ5 · ADR-929 Δ7 — **τοίχοι από παράλληλα ζεύγη παρειών** (καθαρό).
 *
 * Ένας τοίχος σε κάτοψη είναι δύο παράλληλες γραμμές σε απόσταση πάχους: οι παρειές του. Δεν χρειάζεται να
 * κλείνουν σε ορθογώνιο (αυτό ζητά το `closedRectangleStrategy`). Αρκεί να υπάρχουν απέναντι. Είναι το πρότυπο
 * του «CAD to Walls» του Chief Architect. Εδώ γράφεται μία φορά και ωφελεί **και** τα διανυσματικά DXF **και** τις
 * γραμμές από εικόνα (Φ2).
 *
 * Αλγόριθμος:
 *   1. **Οικογένειες διεύθυνσης**: τα τμήματα ομαδοποιούνται κατά γωνία (`COLLINEAR_SIN_TOL`, η ίδια ανοχή με την
 *      ένωση τοίχων). Ο μέσος άξονας παίρνεται με διπλασιασμένη γωνία, ώστε `θ` και `θ + π` να είναι το ίδιο.
 *   2. **Φορείς**: μέσα σε κάθε οικογένεια, τμήματα στην ίδια ευθεία (κάθετη απόκλιση ≤ `offsetTol`) γίνονται ένας
 *      φορέας με **σύνολο διαστημάτων** κάλυψης.
 *   3. **Ζεύγη από το πλησιέστερο**: ζεύγη φορέων σε απόσταση στο `[minThickness, maxThickness]`, με αύξουσα
 *      απόσταση. Τοίχος υπάρχει όπου **και οι δύο** παρειές υπάρχουν (τομή). Ένα κομμάτι παρειάς χρησιμοποιείται
 *      **μία** φορά: μια παρειά χωρίζει τοίχο από χώρο, δεν είναι παρειά δύο τοίχων. Έτσι μια γραμμή διάστασης
 *      έξω από τον τοίχο δεν ζευγαρώνει με την εξωτερική παρειά, που ήδη πήγε στον πλησιέστερο τοίχο.
 *   4. **Κόμβος Τ ≠ άνοιγμα**: κενό στη μία παρειά μόνο, ενώ η άλλη συνεχίζει, είναι κόμβος (εκεί ενώνεται άλλος
 *      τοίχος) και γεφυρώνεται. Κενό και στις δύο είναι άνοιγμα και κόβει τον τοίχο (Φ6 / `findWallRunGaps`).
 *      **Γωνία L**: οι παρειές τελειώνουν σε εξωτερική και εσωτερική γωνία· ο μέσος τους είναι ο άξονας του κάθετου
 *      τοίχου (`cornerExtent`).
 *   5. **Το υπόλοιπο της γωνίας δεν είναι τοίχος**: stub που ακουμπά παρειά της άλλης πλευράς απορρίπτεται
 *      (`cornerRemnant`). Έτσι η εξωτερική παρειά στη γωνία δεν ζευγαρώνει με γραμμή διάστασης.
 *   6. **Το καπάκι δεν είναι παρειά**: η γραμμή που κλείνει το άκρο ενός προτεινόμενου τοίχου αφαιρείται
 *      (`consumeCap`), ώστε δύο παραστάδες ανοίγματος να μη γίνουν «τοίχος» πάχους όσο το άνοιγμα.
 *   7. **Ένα σώμα, μία ερμηνεία**: κομμάτι που το κέντρο του πέφτει μέσα σε ήδη προτεινόμενο ορθογώνιο
 *      απορρίπτεται. Οι δύο κοντές πλευρές ενός κλειστού ορθογωνίου 4 γραμμών είναι κι αυτές «ζεύγος», αλλά το σώμα
 *      τους το εξήγησε ήδη το λεπτότερο ζεύγος.
 *  7β. **Το κενό ανοίγματος δεν είναι τοίχος** (ADR-929 §6.15): κομμάτι που συμπίπτει με το κενό ανάμεσα σε δύο
 *      κομμάτια **ενός** άλλου τοίχου (κενό και στις δύο παρειές = άνοιγμα, βήμα 4) είναι τα καπάκια του ανοίγματος
 *      ζευγαρωμένα, όχι τοίχος. Συμβαίνει όταν το άνοιγμα είναι ≤ πάχος: τότε το ζεύγος των καπακιών κρίνεται πριν
 *      από τις παρειές και το βήμα 6 δεν προλαβαίνει. Η κρίση γίνεται αφού κριθούν **όλα** τα ζεύγη, άρα δεν εξαρτάται
 *      από τη σειρά. Ένας τοίχος σύνδεσης ανάμεσα σε **δύο διαφορετικούς** τοίχους δεν είναι κενό κανενός, και μένει.
 *   8. **Άκρα στις παρειές**: κάθε άκρο έλκεται στην παρειά του γείτονα μέσα σε `endSnapReach`
 *      (`wall-rect-end-snap.ts`), ώστε το auto-join να το πάει στον άξονα και όταν η γραμμή ήρθε από εικόνα.
 *   9. **Κανένας άξονας που δεν τον ξέρουμε** (ADR-929 §6.14, κανόνας Α): κάθε κομμάτι σχεδόν τετράγωνο
 *      (`isNearSquare`, λόγος < `ambiguousAspectRatio`) βγαίνει **χωρίς** `axis`, ανεξάρτητα από τα καπάκια, όπως
 *      από τον ανιχνευτή κλειστών ορθογωνίων. Εκεί το ζεύγος που κράτησε το βήμα 7 δεν λέει προς τα πού τρέχει ο
 *      τοίχος. Ο βοηθός κάνει την ΙΔΙΑ ερώτηση (συμφραζόμενο → άνθρωπος) από σχέδιο και από εικόνα. Η κρίση γίνεται
 *      **μετά** το βήμα 8, στο τελικό σχήμα, δηλαδή σε αυτό που κρίνει και ο βοηθός (`isAmbiguous`). Η έλξη άκρων
 *      μένει όπως ήταν.
 *
 * Έξοδος: `DetectedRectangle` με **ρητό** `axis` (κανείς δεν μαντεύει «μεγάλη πλευρά = άξονας», ADR-419), εκτός από
 * τα σχεδόν τετράγωνα του βήματος 9. Τα Τ κλείνουν **κατάντη**, από το υπάρχον auto-join
 * (`wall-region-autojoin.ts`) και τα trims.
 *
 * @see ../model-from-drawing/wall-detection-strategy.ts (η ραφή)
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.3
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  coversInterval,
  intersectIntervals,
  intervalContaining,
  normalizeIntervals,
  subtractIntervals,
  type Interval,
} from '@/lib/geometry/interval-set';
import { pointInPolygon } from '@/lib/geometry/planar-polygon';
import { isNearSquare, type DetectedRectangle, type RegionLineSeg } from './wall-in-region';
import { COLLINEAR_SIN_TOL } from './wall-merge';
import { rectFromAxis, snapRectEndsToFaces } from './wall-rect-end-snap';

/** Όλα σε μονάδες σκηνής. */
export interface ParallelPairOptions {
  readonly minThickness: number;
  readonly maxThickness: number;
  /** Ανοχή «ίδια ευθεία»: κάθετη απόκλιση τμημάτων, και ένωση διαστημάτων κατά μήκος. */
  readonly offsetTol: number;
  /**
   * Εμβέλεια έλξης άκρων σε παρειές (βήμα 8): η αβεβαιότητα θέσης ενός άκρου στην πηγή. Διανυσματικό σχέδιο: λίγα
   * mm. Εικόνα: λίγα px (το άκρο σε λοξό κόμβο χάνει μισή πινελιά / sin γωνίας, μετρημένο στη Φ2).
   */
  readonly endSnapReach: number;
  /**
   * Βήμα 9: κάτω από αυτόν τον λόγο πλευρών ένα κομμάτι δεν έχει γνωστό άξονα. Το ΙΔΙΟ κατώφλι με τον βοηθό
   * (`MODEL_FROM_DRAWING_LIMITS.AMBIGUOUS_ASPECT_RATIO`), αδιάστατο.
   */
  readonly ambiguousAspectRatio: number;
}

interface Oriented {
  readonly seg: RegionLineSeg;
  readonly dx: number;
  readonly dy: number;
  readonly length: number;
}

/** Οικογένεια διεύθυνσης: άθροισμα διπλασιασμένης γωνίας σταθμισμένο με το μήκος. */
interface Family {
  c2: number;
  s2: number;
  readonly members: Oriented[];
}

interface Direction {
  readonly ux: number;
  readonly uy: number;
}

/** Η πλευρά του φορέα όπου βρίσκεται το σώμα του τοίχου: `+1` προς μεγαλύτερο offset, `−1` προς μικρότερο. */
type BodySide = 1 | -1;

interface Carrier {
  readonly offset: number;
  /** Η αρχική κάλυψη του φορέα (αμετάβλητη): ποια σημεία του επιπέδου πατά μια γραμμή. */
  readonly span: readonly Interval[];
  free: Interval[];
  /** Κομμάτια που ήδη έγιναν παρειά, με την πλευρά του σώματός τους. */
  readonly used: { readonly piece: Interval; readonly side: BodySide }[];
}

/** Οι φορείς μιας διεύθυνσης. */
interface FamilyCarriers {
  readonly direction: Direction;
  readonly carriers: readonly Carrier[];
}

interface PairCandidate {
  readonly direction: Direction;
  readonly lo: Carrier;
  readonly hi: Carrier;
  readonly distance: number;
}

function familyDirection(f: Family): Direction {
  const a = Math.atan2(f.s2, f.c2) / 2;
  return { ux: Math.cos(a), uy: Math.sin(a) };
}

function addToFamily(f: Family, o: Oriented): void {
  const a = 2 * Math.atan2(o.dy, o.dx);
  f.c2 += Math.cos(a) * o.length;
  f.s2 += Math.sin(a) * o.length;
  f.members.push(o);
}

/** Βήμα 1: ομαδοποίηση κατά διεύθυνση. Τμήματα κοντύτερα από `minLength` αγνοούνται. */
function groupByDirection(segments: readonly RegionLineSeg[], minLength: number): Family[] {
  const families: Family[] = [];
  for (const seg of segments) {
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    const length = Math.hypot(dx, dy);
    if (length < minLength) continue;
    const o: Oriented = { seg, dx, dy, length };
    const home = families.find((f) => {
      const d = familyDirection(f);
      return Math.abs(d.ux * dy - d.uy * dx) / length <= COLLINEAR_SIN_TOL;
    });
    if (home) addToFamily(home, o);
    else {
      const f: Family = { c2: 0, s2: 0, members: [] };
      addToFamily(f, o);
      families.push(f);
    }
  }
  return families;
}

interface Projected {
  readonly offset: number;
  readonly interval: Interval;
  readonly length: number;
}

function project(o: Oriented, d: Direction): Projected {
  const along = (p: Point2D) => p.x * d.ux + p.y * d.uy;
  const across = (p: Point2D) => -p.x * d.uy + p.y * d.ux;
  const a = along(o.seg.start);
  const b = along(o.seg.end);
  return {
    offset: (across(o.seg.start) + across(o.seg.end)) / 2,
    interval: { lo: Math.min(a, b), hi: Math.max(a, b) },
    length: o.length,
  };
}

/** Βήμα 2: φορείς της οικογένειας, ταξινομημένοι κατά κάθετη θέση. */
function buildCarriers(family: Family, d: Direction, offsetTol: number): Carrier[] {
  const projected = family.members.map((o) => project(o, d)).sort((a, b) => a.offset - b.offset);
  const groups: Projected[][] = [];
  for (const p of projected) {
    const last = groups[groups.length - 1];
    if (last && p.offset - last[last.length - 1].offset <= offsetTol) last.push(p);
    else groups.push([p]);
  }
  return groups.map((g) => {
    const weight = g.reduce((s, p) => s + p.length, 0);
    const span = normalizeIntervals(g.map((p) => p.interval), offsetTol);
    return { offset: g.reduce((s, p) => s + p.offset * p.length, 0) / weight, span, free: [...span], used: [] };
  });
}

/** Βήμα 3: τα υποψήφια ζεύγη μιας οικογένειας (οι φορείς είναι ταξινομημένοι κατά θέση). */
function pairCandidates(
  carriers: readonly Carrier[], direction: Direction, options: ParallelPairOptions, out: PairCandidate[],
): void {
  for (let i = 0; i < carriers.length; i++) {
    for (let j = i + 1; j < carriers.length; j++) {
      const distance = carriers[j].offset - carriers[i].offset;
      if (distance > options.maxThickness + options.offsetTol) break;
      if (distance >= options.minThickness - options.offsetTol) {
        out.push({ direction, lo: carriers[i], hi: carriers[j], distance });
      }
    }
  }
}

/** Βήμα 4: γεφύρωση κενού που υπάρχει στη μία παρειά μόνο (κόμβος Τ), ως το μέγιστο πάχος τοίχου. */
function bridgeJunctions(pieces: readonly Interval[], a: readonly Interval[], b: readonly Interval[], maxGap: number): Interval[] {
  const out: Interval[] = [];
  for (const piece of pieces) {
    const last = out[out.length - 1];
    const gapLo = last?.hi ?? 0;
    const bridged = last && piece.lo - gapLo <= maxGap
      && (coversInterval(a, gapLo, piece.lo) || coversInterval(b, gapLo, piece.lo));
    if (bridged) out[out.length - 1] = { lo: last.lo, hi: piece.hi };
    else out.push(piece);
  }
  return out;
}

/** Σημείο του επιπέδου από (κατά μήκος, κάθετα) μιας διεύθυνσης. */
function planePoint(d: Direction, along: number, off: number): Point2D {
  return { x: d.ux * along - d.uy * off, y: d.uy * along + d.ux * off };
}

/**
 * Περνά **μία** γραμμή άλλης διεύθυνσης από **όλα** τα σημεία; Κάθετα στη γραμμή ισχύει η ανοχή γραμμής (`offTol`).
 * Κατά μήκος της ισχύει η αβεβαιότητα **άκρου** (`endTol`), γιατί τα σημεία είναι άκρα γραμμών, και ένα άκρο από εικόνα
 * κινείται 2–4 px (μετρημένο στη Φ2: με την ανοχή γραμμής και κατά μήκος, οι γωνίες σε στραβή σάρωση δεν κρίνονταν).
 */
function crossedByFace(
  field: readonly FamilyCarriers[], d: Direction, points: readonly Point2D[], offTol: number, endTol: number,
): boolean {
  return field.some(({ direction: e, carriers }) => {
    if (Math.abs(e.ux * d.uy - e.uy * d.ux) <= COLLINEAR_SIN_TOL) return false;
    const at = points.map((p) => ({ off: -p.x * e.uy + p.y * e.ux, along: p.x * e.ux + p.y * e.uy }));
    return carriers.some((c) => at.every((q) => Math.abs(c.offset - q.off) <= offTol
      && c.span.some((i) => i.lo - endTol <= q.along && q.along <= i.hi + endTol)));
  });
}

/** Ό,τι χρειάζεται η κρίση «γωνία L» για ένα ζεύγος. */
interface CornerContext {
  readonly field: readonly FamilyCarriers[];
  readonly d: Direction;
  readonly lo: Carrier;
  readonly hi: Carrier;
  readonly reach: number;
  readonly tol: number;
  readonly endTol: number;
}

/**
 * Βήμα 4β: **γωνία L**. Η εξωτερική παρειά τελειώνει στην εξωτερική γωνία και η εσωτερική στην εσωτερική. Ο μέσος των
 * δύο άκρων είναι ο άξονας του κάθετου τοίχου, το σημείο ένωσης των αξόνων (Revit/ArchiCAD). Χωρίς αυτό το auto-join
 * δεν κλείνει τη γωνία: η ακτίνα του ψάχνει τον άξονα του γείτονα, που σταματά κι αυτός στην παρειά (μετρημένο στη Φ2).
 * Το ίδιο ισχύει στη **λοξή πρόσκρουση**: τα δύο άκρα κάθονται στην **ίδια** παρειά του γείτονα, και ο μέσος τους είναι
 * η τομή του άξονα με αυτήν.
 * Γωνία είναι **μόνο** όταν: (α) τα δύο άκρα διαφέρουν ως ένα πάχος τοίχου, (β) από το εσωτερικό άκρο περνά κάθετη
 * παρειά (η εσωτερική του κάθετου τοίχου) και (γ) η εξωτερική παρειά του κάθετου τοίχου **διασχίζει όλο το πάχος**
 * του δικού μας στο εξωτερικό άκρο: είναι η πλευρά του τετραγώνου της γωνίας. Μετρημένο στο «Ισόγειο 1» (ADR-911):
 * χωρίς το (β) τοίχοι τεντώνονταν έξω από το σώμα τους, και με «περνά γραμμή από το σημείο» αντί για το (γ) μια
 * γραμμή άλλου τοίχου ικανοποιούσε τον έλεγχο κατά σύμπτωση.
 */
function cornerEnd(x: number, pick: (i: Interval) => number, k: CornerContext): number {
  const ia = intervalContaining(k.lo.free, x, k.tol);
  const ib = intervalContaining(k.hi.free, x, k.tol);
  if (!ia || !ib) return x;
  const [ea, eb] = [pick(ia), pick(ib)];
  if (Math.abs(ea - eb) <= k.tol || Math.abs(ea - eb) > k.reach) return x;
  // Λοξή πρόσκρουση: και οι δύο παρειές τελειώνουν πάνω στην ΙΔΙΑ γραμμή άλλης διεύθυνσης (την παρειά του γείτονα),
  // σε διαφορετικά σημεία λόγω γωνίας. Ο μέσος τους είναι η τομή του άξονα με αυτήν.
  const ends = [planePoint(k.d, ea, k.lo.offset), planePoint(k.d, eb, k.hi.offset)];
  if (crossedByFace(k.field, k.d, ends, k.tol, k.endTol)) return (ea + eb) / 2;
  // Το εξωτερικό άκρο (αυτό που προεξέχει) και η παρειά στην οποία ανήκει.
  const outer = Math.abs(ea - x) > Math.abs(eb - x) ? ea : eb;
  const inner = outer === ea ? { along: eb, off: k.hi.offset } : { along: ea, off: k.lo.offset };
  const sideOfSquare = [planePoint(k.d, outer, k.lo.offset), planePoint(k.d, outer, k.hi.offset)];
  const faced = crossedByFace(k.field, k.d, [planePoint(k.d, inner.along, inner.off)], k.tol, k.endTol)
    && crossedByFace(k.field, k.d, sideOfSquare, k.tol, k.endTol);
  return faced ? (ea + eb) / 2 : x;
}

function cornerExtent(piece: Interval, k: CornerContext): Interval {
  return { lo: cornerEnd(piece.lo, (i) => i.lo, k), hi: cornerEnd(piece.hi, (i) => i.hi, k) };
}

/** Το ορθογώνιο ενός κομματιού ζεύγους: άξονας στη μέση των δύο παρειών (ένας κατασκευαστής, `rectFromAxis`). */
function pieceRect(d: Direction, offLo: number, offHi: number, piece: Interval): DetectedRectangle {
  const mid = (offLo + offHi) / 2;
  return rectFromAxis(planePoint(d, piece.lo, mid), planePoint(d, piece.hi, mid), offHi - offLo);
}

/**
 * Μια παρειά χωρίζει τοίχο από χώρο. Το **υπόλοιπο** της εξωτερικής παρειάς στη γωνία (εκεί που τελειώνει ο τοίχος
 * της και αρχίζει ο κάθετος) ακουμπά κομμάτι ήδη χρησιμοποιημένο με σώμα στην **άλλη** πλευρά, και απέναντί του είναι
 * ο έξω χώρος. Αν ζευγαρώσει (π.χ. με γραμμή διάστασης), βγαίνει **stub**: κομμάτι κοντύτερο από το πάχος του. Αυτό
 * ακριβώς απορρίπτεται: stub που ακουμπά, χωρίς επικάλυψη, παρειά της άλλης πλευράς.
 * Μετρημένο στο «Ισόγειο 1» (ADR-911): πραγματικοί τοίχοι ακουμπούν **άκρο με άκρο** σώματα της άλλης πλευράς της
 * ίδιας γραμμής (σχέδιο από εφαπτόμενα ορθογώνια), αλλά είναι μακριοί. Γι' αυτό ο κανόνας αφορά μόνο τα stubs.
 * ⚠️ Υπολειπόμενο: γραμμή διάστασης **πιο κοντά** από το πάχος του κάθετου τοίχου δίνει υπόλοιπο μακρύτερο από το
 * πάχος του ζεύγους. Στις κατόψεις οι διαστάσεις απέχουν συνήθως ≥ 500 mm.
 */
function cornerRemnant(c: Carrier, piece: Interval, side: BodySide, thickness: number, reach: number, tol: number): boolean {
  if (piece.hi - piece.lo >= thickness) return false;
  return c.used.some((u) => {
    if (u.side === side) return false;
    const overlap = Math.min(u.piece.hi, piece.hi) - Math.max(u.piece.lo, piece.lo);
    return overlap <= tol && u.piece.lo - piece.hi <= reach && piece.lo - u.piece.hi <= reach;
  });
}

function rectCentre(rect: DetectedRectangle): Point2D {
  const [a, , c] = rect.polygon;
  return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
}


/**
 * Βήμα 6: ό,τι **κλείνει το άκρο** ενός προτεινόμενου τοίχου είναι το καπάκι του, όχι παρειά άλλου. Χωρίς αυτό, τα
 * καπάκια δύο τοίχων εκατέρωθεν ενός ανοίγματος (παράλληλα, απέναντι) θα γίνονταν «τοίχος» πάχους όσο το άνοιγμα.
 * Καπάκι είναι μόνο διάστημα φορέα που **χωρά ολόκληρο** στο άκρο. Σε κόμβο Τ το άκρο του κορμού κάθεται πάνω στην
 * παρειά του κάθετου τοίχου, που συνεχίζει πέρα από αυτό: εκείνη μένει ανέγγιχτη (μετρημένο στο «Ισόγειο 1»).
 */
function consumeCap(field: readonly FamilyCarriers[], a: Point2D, b: Point2D, tol: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return;
  for (const { direction: d, carriers } of field) {
    if (Math.abs(d.ux * dy - d.uy * dx) / length > COLLINEAR_SIN_TOL) continue;
    const offset = -a.x * d.uy + a.y * d.ux;
    const along = [a.x * d.ux + a.y * d.uy, b.x * d.ux + b.y * d.uy];
    const lo = Math.min(...along) - tol;
    const hi = Math.max(...along) + tol;
    for (const c of carriers) {
      if (Math.abs(c.offset - offset) <= tol) c.free = c.free.filter((i) => i.lo < lo || i.hi > hi);
    }
  }
}

/** Βήμα 9: το ίδιο ορθογώνιο χωρίς ρητό άξονα (ίδιο πολύγωνο και μετρικές, όπως από τον ανιχνευτή κλειστών). */
function withoutAxis(rect: DetectedRectangle): DetectedRectangle {
  return { polygon: rect.polygon, longSide: rect.longSide, shortSide: rect.shortSide, area: rect.area };
}

/**
 * Βήμα 7β (ADR-929 §6.15): τα κενά **ανάμεσα** σε διαδοχικά κομμάτια του ΙΔΙΟΥ ζεύγους, εκεί όπου καμία από τις δύο
 * παρειές δεν έχει γραμμή, είναι ανοίγματα (βήμα 4· τα κενά κόμβων Τ τα γεφύρωσε ήδη το `bridgeJunctions`). Επιστρέφει
 * το ορθογώνιο κάθε ανοίγματος: μήκος όσο το κενό, πλάτος όσο το πάχος του τοίχου.
 */
function openingVoids(c: PairCandidate, kept: readonly Interval[], tol: number): DetectedRectangle[] {
  const touched = (span: readonly Interval[], gap: Interval) =>
    intersectIntervals(span, [gap]).some((p) => p.hi - p.lo > tol);
  const sorted = [...kept].sort((a, b) => a.lo - b.lo);
  const voids: DetectedRectangle[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap: Interval = { lo: sorted[i - 1].hi, hi: sorted[i].lo };
    if (gap.hi - gap.lo <= tol || touched(c.lo.span, gap) || touched(c.hi.span, gap)) continue;
    voids.push(pieceRect(c.direction, c.lo.offset, c.hi.offset, gap));
  }
  return voids;
}

/** Ίδιο ορθογώνιο μέσα σε ανοχή: κάθε γωνία του `a` απέχει ≤ `tol` από κάποια γωνία του `b`. */
function sameRect(a: DetectedRectangle, b: DetectedRectangle, tol: number): boolean {
  return a.polygon.every((p) => b.polygon.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= tol));
}

/**
 * Βήματα 4–6 για ένα ζεύγος: τα κομμάτια του γίνονται ορθογώνια και καταναλώνουν παρειές και καπάκια. Τα ανοίγματά
 * του (βήμα 7β) προστίθενται στο `voids`.
 */
function resolvePair(
  c: PairCandidate, options: ParallelPairOptions, field: readonly FamilyCarriers[],
  emitted: DetectedRectangle[], voids: DetectedRectangle[],
): void {
  const { lo, hi, direction } = c;
  const maxGap = options.maxThickness + options.offsetTol;
  const pieces = bridgeJunctions(intersectIntervals(lo.free, hi.free), lo.free, hi.free, maxGap)
    .filter((p) => p.hi - p.lo >= options.minThickness);
  const kept: Interval[] = [];
  for (const piece of pieces) {
    const tol = options.offsetTol;
    if (cornerRemnant(lo, piece, 1, c.distance, tol, tol) || cornerRemnant(hi, piece, -1, c.distance, tol, tol)) continue;
    // Δύο άκρα συγκρίνονται (της παρειάς και της κάθετης παρειάς), το καθένα με τη δική του αβεβαιότητα: άθροισμα.
    const corner: CornerContext = { field, d: direction, lo, hi, reach: maxGap, tol, endTol: 2 * options.endSnapReach };
    const rect = pieceRect(direction, lo.offset, hi.offset, cornerExtent(piece, corner));
    if (emitted.some((r) => pointInPolygon(rectCentre(rect), r.polygon))) continue;
    emitted.push(rect);
    kept.push(piece);
    lo.used.push({ piece, side: 1 });
    hi.used.push({ piece, side: -1 });
  }
  if (kept.length === 0) return;
  voids.push(...openingVoids(c, kept, options.offsetTol));
  lo.free = subtractIntervals(lo.free, kept);
  hi.free = subtractIntervals(hi.free, kept);
  for (const rect of emitted.slice(-kept.length)) {
    const [p0, p1, p2, p3] = rect.polygon;
    consumeCap(field, p1, p2, options.offsetTol);
    consumeCap(field, p3, p0, options.offsetTol);
  }
}

/**
 * Τοίχοι από παράλληλα ζεύγη παρειών. Τα ζεύγη **όλων** των διευθύνσεων κρίνονται μαζί, από το πλησιέστερο: τα
 * καπάκια ενός κλειστού ορθογωνίου (ζεύγος σε απόσταση = μήκος) έρχονται μετά τις παρειές του (απόσταση = πάχος),
 * όποια διεύθυνση κι αν έχουν. ⚠️ ΔΕΝ ισχύει για τα καπάκια δύο τοίχων εκατέρωθεν ανοίγματος ≤ πάχος (μετρημένο,
 * ADR-929 §6.15): εκεί το ζεύγος των καπακιών κρίνεται πρώτο. Γι' αυτό το βήμα 7β κρίνει **αφού** κριθούν όλα τα ζεύγη.
 */
export function findWallsFromParallelPairs(
  segments: readonly RegionLineSeg[],
  options: ParallelPairOptions,
): DetectedRectangle[] {
  const field: FamilyCarriers[] = groupByDirection(segments, options.offsetTol).map((family) => {
    const direction = familyDirection(family);
    return { direction, carriers: buildCarriers(family, direction, options.offsetTol) };
  });
  const candidates: PairCandidate[] = [];
  for (const { direction, carriers } of field) pairCandidates(carriers, direction, options, candidates);
  candidates.sort((a, b) => a.distance - b.distance);
  const emitted: DetectedRectangle[] = [];
  const voids: DetectedRectangle[] = [];
  for (const c of candidates) resolvePair(c, options, field, emitted, voids);
  // Βήμα 7β μετά από ΟΛΑ τα ζεύγη (ανεξάρτητο από τη σειρά) και πριν από το 8 (το κενό δεν γίνεται παρειά έλξης).
  // Ανοχή: δύο άκρα από δύο ζεύγη, το καθένα με τη δική του αβεβαιότητα, όπως στο `endTol` της `resolvePair`.
  const voidTol = options.offsetTol + 2 * options.endSnapReach;
  const walls = emitted.filter((r) => !voids.some((v) => sameRect(r, v, voidTol)));
  // Βήμα 8 πριν από το 9: η έλξη δουλεύει με τον άξονα του ζεύγους· το 9 κρίνει το ΤΕΛΙΚΟ σχήμα, αυτό που κρίνει και ο βοηθός.
  return snapRectEndsToFaces(walls, options.endSnapReach)
    .map((rect) => (isNearSquare(rect, options.ambiguousAspectRatio) ? withoutAxis(rect) : rect));
}
