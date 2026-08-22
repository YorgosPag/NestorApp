/**
 * Plan-local frame — γεωμετρικό SSoT (ADR-408 / ADR-584 N.18) για κάθε
 * **παραμετρική τοποθέτηση σχετικά με τοπικούς άξονες κάτοψης**.
 *
 * ΕΝΑ μέρος που απαντά την ερώτηση: *«δώσε μου το σημείο που απέχει `alongOffset`
 * κατά τον τοπικό +X και `perpOffset` κατά τον τοπικό +Y ενός τοποθετημένου
 * σώματος»* — χωρίς καμία τριγωνομετρία στο σημείο κλήσης, γιατί οι άξονες
 * διαβάζονται από την **ήδη περιστραμμένη** γεωμετρία.
 *
 * Είναι το ορθογώνιο ανάλογο του {@link ./polyline-frame.ts} (`PolylineFrame` =
 * σημείο + εφαπτόμενο + κάθετο πάνω σε καμπύλη): ίδια ιδέα, άλλη προέλευση.
 *
 * ## Το μοντέλο — αυτό που κάνουν οι μεγάλοι
 *
 * Revit `Transform` (`Origin` + `BasisX`/`BasisY`, **ορθοκανονικά**, με τα extents
 * να ζουν ΧΩΡΙΣΤΑ στο `BoundingBox`) · ArchiCAD `API_Tranmat` · Cinema 4D object
 * matrix (`off` + μοναδιαία `v1`/`v2`/`v3`) · Figma `relativeTransform` +
 * `absoluteBoundingBox`. Και οι τέσσερις κρατούν **μοναδιαία βάση + χωριστά
 * μεγέθη** — γι' αυτό το ίδιο σχήμα εδώ: {@link PlanFrame} = αρχή + βάση,
 * {@link BodyFrame} = το ίδιο **συν** τα extents του ίχνους.
 *
 * ## ⚠️ ΤΙ ΔΕΝ ΕΙΝΑΙ — δύο γειτονικά SSoT που ΔΕΝ ενοποιούνται
 *
 * 1. **`../../floorplan-symbols/symbol-vector-helpers.ts`** (`rect`/`line`/`ellipse`)
 *    δουλεύει σε **κανονικοποιημένες** συντεταγμένες `(u,v) ∈ [0,1]²` πάνω σε
 *    **ΜΗ** μοναδιαία βάση ⇒ κάθε άξονας κλιμακώνεται με **διαφορετικό** μέγεθος
 *    (ανισότροπο). Είναι σωστό για «κλάσμα του πλάτους» — και γι' αυτό η συνάρτησή
 *    του λέγεται `ellipse`, όχι `circle`. Εδώ η βάση είναι **μοναδιαία** και οι
 *    μετατοπίσεις **μετρικές** (canvas units), ώστε ένας κύκλος ακτίνας `r` να
 *    βγαίνει **αληθινός κύκλος** σε σώμα οποιασδήποτε αναλογίας. Ενοποίηση θα
 *    μετέτρεπε σιωπηλά τα δοχεία/μανόμετρα σε **ελλείψεις**.
 * 2. **`./curve-tessellation.ts`** τεμαχίζει τόξο **παγκόσμιου χώρου** από DXF
 *    `bulge`, με πλήθος τμημάτων **προσαρμοστικό** στην απόκλιση χορδής. Το
 *    {@link frameArc} δίνει **σταθερό, συμβολικό** N-gon: το σύμβολο είναι
 *    σχηματικό, και το πλήθος κορυφών του είναι μέρος της **ταυτότητάς** του.
 * 3. **`./footprint-face-frame.ts`** είναι **world-aligned AABB** (face-snap E/W/N/S)
 *    — σκοπίμως ΟΧΙ rotation-aware. Άλλη ερώτηση.
 *
 * Pure — zero React/DOM/store. Μονάδες: canvas units (οι κορυφές έρχονται ήδη
 * world-baked από το {@link ./rectangular-body-geometry.ts}, που κατέχει την
 * **αντίστροφη** κατεύθυνση: παράμετροι → ίχνος στον κόσμο).
 *
 * @see ./rectangular-body-geometry.ts — η αντίστροφη κατεύθυνση (params → world footprint)
 * @see ./polyline-frame.ts — το ίδιο για καμπύλη αντί για ορθογώνιο
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { BimPoint } from '../../types/bim-base';

/** Μοναδιαίο διάνυσμα κατεύθυνσης στην κάτοψη (world-space, canvas units). */
export interface PlanAxis {
  readonly x: number;
  readonly y: number;
}

/**
 * Τοπικό πλαίσιο κάτοψης: αρχή + **ορθοκανονική** βάση δύο αξόνων.
 * Το ανάλογο του Revit `Transform` (`Origin`/`BasisX`/`BasisY`).
 */
export interface PlanFrame {
  /** Η αρχή του πλαισίου σε παγκόσμιες συντεταγμένες. */
  readonly origin: BimPoint;
  /** Μοναδιαίος τοπικός +X. */
  readonly along: PlanAxis;
  /** Μοναδιαίος τοπικός +Y. */
  readonly perp: PlanAxis;
}

/**
 * {@link PlanFrame} με τα **extents** του ίχνους — τα μεγέθη ζουν χωριστά από τη
 * βάση (πρότυπο Revit `Transform` + `BoundingBox`), ώστε η βάση να μένει μοναδιαία.
 */
export interface BodyFrame extends PlanFrame {
  /** Έκταση του σώματος κατά τον {@link PlanFrame.along}, σε canvas units. */
  readonly width: number;
  /** Έκταση του σώματος κατά τον {@link PlanFrame.perp}, σε canvas units. */
  readonly depth: number;
}

/**
 * Μοναδιαίο διάνυσμα από τις συνιστώσες του. Εκφυλισμένη είσοδος (μηδενικό μήκος)
 * επιστρέφει το ίδιο το διάνυσμα διαιρεμένο με 1 — δηλαδή `{0,0}` — αντί για `NaN`,
 * ώστε ένα εκφυλισμένο ίχνος να ζωγραφίζει **τίποτα** αντί να μολύνει τη σκηνή.
 */
export function unitAxis(dx: number, dy: number): PlanAxis {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Γραμμική παρεμβολή δύο σημείων κάτοψης. `z` ισοπεδώνεται στο 0 (επίπεδο κάτοψης). */
export function lerpPlanPoint(a: BimPoint, b: BimPoint, t: number): BimPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

/**
 * Πλαίσιο **προεξοχής/συνδέσμου**: αρχή στη ρίζα του κλάδου, τοπικός +X = η φορά
 * εξόδου, τοπικός +Y = ο CCW 90° άξονάς της. Αυτό είναι το πλαίσιο κάθε
 * connector glyph (καπναγωγός, κρουνός, σιφώνι, εξουδετερωτής).
 */
export function stubFrame(root: BimPoint, outward: PlanAxis): PlanFrame {
  return { origin: root, along: outward, perp: { x: -outward.y, y: outward.x } };
}

/**
 * Πλαίσιο **σώματος** από τις τέσσερις κορυφές ενός ίχνους, με τη σύμβαση του
 * {@link ./rectangular-body-geometry.ts}: `v0=(−hw,−hl) v1=(hw,−hl) v2=(hw,hl)
 * v3=(−hw,hl)`, ήδη περιστραμμένες στον κόσμο. Η αρχή είναι το **κεντροειδές**
 * του ίχνους (μέσος όρος των τεσσάρων κορυφών) — όχι η γωνία `v0`.
 */
export function bodyFrame(v0: BimPoint, v1: BimPoint, v2: BimPoint, v3: BimPoint): BodyFrame {
  return {
    origin: {
      x: (v0.x + v1.x + v2.x + v3.x) / 4,
      y: (v0.y + v1.y + v2.y + v3.y) / 4,
      z: 0,
    },
    along: unitAxis(v1.x - v0.x, v1.y - v0.y),
    perp: unitAxis(v3.x - v0.x, v3.y - v0.y),
    width: Math.hypot(v1.x - v0.x, v1.y - v0.y),
    depth: Math.hypot(v3.x - v0.x, v3.y - v0.y),
  };
}

/**
 * Το σημείο που απέχει `alongOffset` κατά τον τοπικό +X και `perpOffset` κατά τον
 * τοπικό +Y από την αρχή του πλαισίου. Μετρικές μετατοπίσεις (canvas units).
 */
export function framePoint(frame: PlanFrame, alongOffset: number, perpOffset: number): BimPoint {
  return {
    x: frame.origin.x + frame.along.x * alongOffset + frame.perp.x * perpOffset,
    y: frame.origin.y + frame.along.y * alongOffset + frame.perp.y * perpOffset,
    z: 0,
  };
}

/**
 * Ίδιο πλαίσιο, **μετατοπισμένη αρχή** — το ανάλογο του Revit
 * `Transform.CreateTranslation` συνθεμένου με το υπάρχον. Επιτρέπει σε ένα glyph
 * να πάρει το δικό του υπο-πλαίσιο μέσα στο σώμα (π.χ. «άνω θάλαμος, πλευρά +Y»)
 * και μετά να τοποθετεί τα σημεία του **σχετικά με τον εαυτό του**.
 *
 * Τα extents ενός {@link BodyFrame} **δεν** μεταφέρονται: το υπο-πλαίσιο είναι
 * σημείο μέσα στο σώμα, δεν είναι σώμα — και μια `width` που περιγράφει το
 * γονικό ίχνος θα ήταν λάθος απάντηση σε λάθος ερώτηση.
 */
export function shiftFrame(frame: PlanFrame, alongOffset: number, perpOffset: number): PlanFrame {
  return {
    origin: framePoint(frame, alongOffset, perpOffset),
    along: frame.along,
    perp: frame.perp,
  };
}

/**
 * Οι δύο **αντικριστές πλευρικές θέσεις κλάδου** ενός ορθογώνιου σώματος: τα μέσα των
 * παρειών −X και +X, το καθένα ως πλήρες {@link PlanFrame} με τοπικό +X = η φορά **εξόδου**
 * (μακριά από το σώμα). Έτσι ο καταναλωτής γράφει `framePoint(negative, stubLen, 0)` και
 * παίρνει την άκρη του κλάδου χωρίς να ξαναγράψει καμία κατεύθυνση.
 *
 * Είναι το ζεύγος «παροχή/επιστροφή» του καλοριφέρ και «κρύο/ζεστό» του θερμοσίφωνα —
 * **ίδια γεωμετρική ερώτηση**, δύο ονοματολογίες τομέα. Ό,τι διαφέρει (ταξινόμηση
 * συστήματος, φορά ροής, μήκος κλάδου) μένει **στον καταναλωτή**: εδώ ζει μόνο το
 * «πού και προς τα πού», που είναι το κοινό.
 *
 * ⚠️ Το `perp` του αρνητικού πλαισίου αντιστρέφεται **μαζί** με το `along`, ώστε και τα δύο
 * πλαίσια να μένουν δεξιόστροφα· αλλιώς ένα glyph που κρέμεται από τον κλάδο θα
 * καθρεφτιζόταν στη μία μόνο πλευρά.
 */
export function lateralStubFrames(body: BodyFrame): {
  readonly negative: PlanFrame;
  readonly positive: PlanFrame;
} {
  const half = body.width / 2;
  return {
    negative: {
      origin: framePoint(body, -half, 0),
      along: { x: -body.along.x, y: -body.along.y },
      perp: { x: -body.perp.x, y: -body.perp.y },
    },
    positive: {
      origin: framePoint(body, half, 0),
      along: body.along,
      perp: body.perp,
    },
  };
}

/**
 * Τόξο δειγματοληπτημένο ως πολυγωνική γραμμή **γύρω από την αρχή** του πλαισίου,
 * με **ίση ακτίνα σε αμφότερους** τους άξονες ⇒ αληθινός κύκλος ανεξαρτήτως
 * αναλογίας σώματος. Γωνία 0 = ο τοπικός +X, θετική φορά προς τον τοπικό +Y.
 *
 * Επιστρέφει `segments + 1` σημεία (το τελευταίο κλείνει το τόξο· για πλήρη κύκλο
 * με `sweepRad = 2π` συμπίπτει με το πρώτο, δηλαδή το πολύγωνο βγαίνει κλειστό).
 */
export function frameArc(
  frame: PlanFrame,
  radius: number,
  startRad: number,
  sweepRad: number,
  segments: number,
): BimPoint[] {
  const pts: BimPoint[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = startRad + (sweepRad * i) / segments;
    pts.push(framePoint(frame, radius * Math.cos(a), radius * Math.sin(a)));
  }
  return pts;
}
