/**
 * ADR-526 (Tekton .TEK IMPORT — stair-first) — intermediate parse types (pure).
 *
 * Ο Τέκτων (FESPA) εξάγει το native `<tekton>` XML σε **μέτρα** με Y «προς τα πάνω»
 * (CAD frame). Αυτά τα types είναι η ΕΝΔΙΑΜΕΣΗ αναπαράσταση μετά το parse του XML
 * και ΠΡΙΝ το mapping σε BIM entities — καθαρά δεδομένα, μηδέν geometry math.
 *
 * Είναι ο ΚΑΘΡΕΦΤΗΣ (read-side) του export `tek-types.ts` (write-side): ό,τι γράφει
 * ο writer, το διαβάζει ο reader. Οι μετατροπές meters→scene-units + Y-flip ΔΕΝ
 * γίνονται εδώ· γίνονται στους mappers (`tek-*-to-bim.ts`) μέσω του SSoT.
 */

import type { TekStairScalars } from './tek-stair-scalars';

/** Σημείο κάτοψης του Τέκτονα — **μέτρα**, Y προς τα πάνω (όπως γράφεται στο XML). */
export interface TekPoint2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Ένα `<stair>` record (entity type 21) όπως διαβάζεται από το XML — όλες οι τιμές
 * στις ΜΟΝΑΔΕΣ ΤΟΥ ΤΕΚΤΟΝΑ (μέτρα / μοίρες-όχι), χωρίς καμία μετατροπή.
 *
 * Τα `polylines` είναι οι ακατέργαστες `<point2d>` λίστες με τη σειρά που εμφανίζονται
 * (ακμές βαθμίδων, εσωτερικό/εξωτερικό περίγραμμα, γραμμή πορείας). Διατηρούνται ΟΛΕΣ
 * ώστε ο mapper να παράγει είτε πιστή 2D αναπαράσταση είτε παραμετρική σκάλα.
 */
export interface TekStairRecord extends TekStairScalars {
  /**
   * Το **αυθεντικό `<record>` XML** της σκάλας (ADR-526 Φ3 — preserve-and-replay). Διατηρείται
   * αυτούσιο ώστε στο export μιας μη-τροποποιημένης εισαγόμενης σκάλας να εκπέμπεται **verbatim**
   * → byte-faithful round-trip (ο Τέκτων τη ζωγραφίζει ΑΚΡΙΒΩΣ όπως την έδωσε, με τα δικά του
   * σύμβολα/βέλη/τόξα). Μηδέν lossy regeneration των ιδιόκτητων Tekton συμβόλων.
   */
  readonly rawXml: string;
  /** Όλες οι `<point2d>` πολυγραμμές (μέτρα), με σειρά εμφάνισης· κενές παραλείπονται. */
  readonly polylines: readonly (readonly TekPoint2D[])[];
}

/**
 * Ένα `<line>` record (entity type 4) — δύο κορυφές σε **μέτρα** (Y-up), χρώμα **BGR**.
 * Καθρέφτης (read-side) του export `TekLine` (`LINE_RECORD_TEMPLATE`). Καμία μετατροπή εδώ.
 */
export interface TekLineRecord {
  /** `<v0X>` αρχή X (μέτρα). */
  readonly v0x: number;
  /** `<v0Y>` αρχή Y (μέτρα, Y-up). */
  readonly v0y: number;
  /** `<v1X>` τέλος X (μέτρα). */
  readonly v1x: number;
  /** `<v1Y>` τέλος Y (μέτρα, Y-up). */
  readonly v1y: number;
  /** `<color>` αυθεντικό RGB hex (όπως το γράφει ο export `colorHex6`· `#` + normalize στον mapper). */
  readonly color: string;
}

/**
 * Ένα `<arc>` record (entity type 5) — κέντρο + 2 ακραία σημεία σε **μέτρα** (Y-up).
 * Καθρέφτης του export `TekArc` (`ARC_RECORD_TEMPLATE`). `isCircle` ⇒ `<circle>1`.
 * ΣΗΜ.: ο export γράφει `p0=τέλος`, `p1=αρχή` (το Y-flip αντιστρέφει τη φορά) — ο mapper
 * το αντιστρέφει. Για κύκλο, `p0` = σημείο περιφέρειας, `p1` = (0,0) αγνοείται.
 */
export interface TekArcRecord {
  /** `<circle>` — `true` (1) κύκλος, `false` (0) τόξο. */
  readonly isCircle: boolean;
  /** `<centreX>` κέντρο X (μέτρα). */
  readonly centreX: number;
  /** `<centreY>` κέντρο Y (μέτρα, Y-up). */
  readonly centreY: number;
  /** `<p0X>` (μέτρα) — τόξο: τέλος· κύκλος: σημείο περιφέρειας (→ ακτίνα). */
  readonly p0x: number;
  /** `<p0Y>` (μέτρα, Y-up). */
  readonly p0y: number;
  /** `<p1X>` (μέτρα) — τόξο: αρχή· κύκλος: αγνοείται. */
  readonly p1x: number;
  /** `<p1Y>` (μέτρα, Y-up). */
  readonly p1y: number;
  /** `<color>` αυθεντικό RGB hex (όπως ο export). */
  readonly color: string;
}

/** 2×3 affine πίνακας του Τέκτονα (column-major) — `<xmatrix>` element. */
export interface TekXMatrix {
  readonly x00: number; readonly x01: number;
  readonly x10: number; readonly x11: number;
  readonly x20: number; readonly x21: number;
}

/**
 * Ένα `<text>` record (entity type 3). Το περιεχόμενο ζει **inline** στο `<s>` (π.χ.
 * `<s>ΚΟΥΖΙΝΑ</s>`, `<s>Ε = 70.77 τμ</s>`, ή ψηφία `<s>1</s>`). Θέση/μέγεθος/περιστροφή
 * από το `<xmatrix>` (x20/x21 = θέση μέτρα Y-up· x00/x11 = κλίμακα γλύφου).
 */
export interface TekTextRecord {
  /** `<s>` — το κείμενο αυτούσιο (inline). */
  readonly content: string;
  /** `<xmatrix>` — θέση + κλίμακα + περιστροφή. */
  readonly matrix: TekXMatrix;
  /** `<color>` RGB hex (όπως line/arc). */
  readonly color: string;
  /** `<hallign>` — 0=αριστερά, 1=κέντρο, 2=δεξιά. */
  readonly hAlign: number;
  /** `<ttfont><name>` — οικογένεια γραμματοσειράς (π.χ. "Arial"). Κενό → renderer default. */
  readonly fontFamily: string;
}

/**
 * ADR-531 Φ5b — ένα «άνοιγμα» (κούφωμα: πόρτα/παράθυρο) μέσα σε `<wall><open><record>`
 * (entity type 2). Matrix-placed: `<xmatrix>` x00 = πλάτος (μέτρα) κατά τον u-άξονα του τοίχου,
 * (x20,x21) = θέση. `elevation` = στάθμη περβαζιού, `top` = ανώφλι (μέτρα). Y-up, χωρίς μετατροπή.
 */
export interface TekOpeningRecord {
  /** `<xmatrix>` — θέση + πλάτος (x00) + προσανατολισμός του ανοίγματος. */
  readonly matrix: TekXMatrix;
  /** `<elevation>` — στάθμη περβαζιού/κατωφλιού (μέτρα). */
  readonly elevationM: number;
  /** `<top>` — στάθμη ανωφλιού (μέτρα). Ύψος ανοίγματος = top − elevation. */
  readonly topM: number;
  /** `<style>` — παραλλαγή εμφάνισης κάτοψης (0/1…). */
  readonly style: number;
  /** `<side>` — προσανατολισμός/πλευρά τοίχου (2/3…). */
  readonly side: number;
  /** `<frame_width>` — πλάτος πλαισίου/κάσας κατά το πάχος τοίχου (μέτρα). */
  readonly frameWidthM: number;
  /** `<frame_thickness>` — πάχος προφίλ πλαισίου (μέτρα). */
  readonly frameThicknessM: number;
  /** `<jamb_width>` — πλάτος παραστάτη (μέτρα). */
  readonly jambWidthM: number;
  /** `<jamb_thickness>` — πάχος παραστάτη (μέτρα). */
  readonly jambThicknessM: number;
  /** `<ledge_height>` — προεξοχή ποδιάς (μέτρα). */
  readonly ledgeHeightM: number;
  /** `<color>` RGB hex (όπως line/arc). */
  readonly color: string;
}

/**
 * ADR-531 Φ5b — ένας **3Δ τοίχος** `<wall><record>` (entity type 1). MATRIX-PLACED (ΟΧΙ
 * polyline): start = (x20,x21), u-άξονας = (x00,x01) → end = start + u (μήκος = |u|), v-άξονας
 * = (x10,x11) = πάχος band στην κάτοψη. Τα ανοίγματα ζουν nested στο `<open>`. Y-up, μέτρα.
 */
export interface TekWallRecord {
  /** `<xmatrix>` — τοποθέτηση unit-square τοίχου σε world (μέτρα). */
  readonly matrix: TekXMatrix;
  /** `<height>` — ύψος τοίχου (μέτρα). */
  readonly heightM: number;
  /** `<elevation>` — στάθμη βάσης (μέτρα). */
  readonly elevationM: number;
  /** `<inner_width>` — πάχος εσωτερικού φύλλου (μέτρα)· fallback πάχους αν λείπει το v-scale. */
  readonly innerWidthM: number;
  /** `<color>` RGB hex. */
  readonly color: string;
  /** Τα `<open><record>` ανοίγματα του τοίχου (κούφωματα). */
  readonly openings: readonly TekOpeningRecord[];
}

/**
 * ADR-531 Φ5b.5 — μια **κολώνα / τοιχίο** `<pillar><record>`. ΠΡΟΣΟΧΗ: ζει ΜΕΣΑ στο `<wall>`
 * container (entity type 1, ΟΠΩΣ ο τοίχος) — διακρίνεται από τον τοίχο με το flag `<pillar>1`.
 * MATRIX-PLACED centered box/circle (ΟΧΙ line+πάχος σαν τοίχος): u-άξονας (x00,x01)=πλάτος,
 * v-άξονας (x10,x11)=βάθος, origin(x20,x21)=γωνία u=v=0. `<round>`1=κυκλική / 0=ορθογώνια
 * (η διάκριση κολώνα↔τοιχίο γίνεται στον mapper από τη σχέση πλευρών — EC8 §5.4.2.4). Y-up, μέτρα.
 */
export interface TekPillarRecord {
  /** `<xmatrix>` — τοποθέτηση unit-box κολώνας σε world (μέτρα). */
  readonly matrix: TekXMatrix;
  /** `<round>` — `true` (1) κυκλική διατομή, `false` (0) ορθογώνια/τοιχίο. */
  readonly round: boolean;
  /** `<height>` — ύψος κολώνας (μέτρα). */
  readonly heightM: number;
  /** `<elevation>` — στάθμη βάσης (μέτρα). */
  readonly elevationM: number;
  /** `<color>` RGB hex. */
  readonly color: string;
}

/**
 * ADR-531 Φ5b.6 — μια **γραμμοσκίαση** `<hatch><record>` (entity type 6). Το όριο ζει στο
 * `<vector>` container ως λίστα segments (`v0X/v0Y`→`v1X/v1Y`, μέτρα Y-up)· το μοτίβο είναι το
 * **ΔΕΥΤΕΡΟ** `<type>` (pattern index `pattern.inf`· 22=solid). `scaleX`/`rotation` = κλίμακα/γωνία
 * μοτίβου. Y-up, μέτρα — καμία μετατροπή εδώ (γίνεται στον mapper `tek-hatch-to-bim`).
 */
export interface TekHatchRecord {
  /** Κορυφές ορίου (μέτρα, Y-up) — τα `v0` κάθε `<vector><record>` segment, με σειρά (κλειστό loop). */
  readonly boundary: readonly TekPoint2D[];
  /** Το 2ο `<type>` — pattern index (`pattern.inf`)· 22 = solid. */
  readonly patternNum: number;
  /** `<scaleX>` — κλίμακα μοτίβου. */
  readonly scaleX: number;
  /** `<rotation>` — γωνία μοτίβου (μοίρες). */
  readonly rotationDeg: number;
  /** `<color>` RGB hex — χρώμα γραμμών μοτίβου. */
  readonly color: string;
  /** `<raster_bgcolor>` RGB hex — χρώμα φόντου ΠΙΣΩ από τις γραμμές (π.χ. FFFFFF λευκό). */
  readonly bgColor: string;
}

/** ADR-531 Φ5b — μία «πατιά» διάστασης (`<seg><record>`): η ζωγραφισμένη γραμμή + το κείμενο. */
export interface TekDimSeg {
  /** `<end0X/Y>`–`<end1X/Y>` — άκρα της γραμμής διάστασης (μέτρα, Y-up). */
  readonly end0: TekPoint2D;
  readonly end1: TekPoint2D;
  /** `<gap0X/Y>`–`<gap1X/Y>` — το κενό όπου κάθεται το κείμενο (μέτρα). */
  readonly gap0: TekPoint2D;
  readonly gap1: TekPoint2D;
  /** `<s>` — η τιμή κειμένου (π.χ. "2.10"). */
  readonly text: string;
  /** `<xmatrix>` του seg — θέση/μέγεθος του κειμένου τιμής. */
  readonly textMatrix: TekXMatrix;
}

/**
 * ADR-531 Φ5b — μία **διάσταση** `<dim><record>` (entity type 0). Αναπαριστάται πιστά από τις
 * ήδη υπολογισμένες «πατιές» (`<seg>`) του Τέκτονα — μηδέν geometry math (όπως το preserve-and-replay
 * των σκαλών). `color` = `<color>` της διάστασης (π.χ. 00FF00).
 */
export interface TekDimRecord {
  /** Οι ζωγραφισμένες πατιές της διάστασης (συνήθως 1). */
  readonly segs: readonly TekDimSeg[];
  /** `<color>` RGB hex της διάστασης (γραμμή + βελάκια). */
  readonly color: string;
  /**
   * `<dtext_color>` RGB hex του **κειμένου** τιμής (π.χ. `FFFF80` = κίτρινο). Ο Τέκτων χρωματίζει
   * το κείμενο ΞΕΧΩΡΙΣΤΑ από τη γραμμή — κενό → fallback στο `color`. (ADR-531 Φ5b.1++ calibration.)
   */
  readonly dtextColor: string;
  /** `<size>` — ύψος κειμένου τιμής (μέτρα). Το seg xmatrix είναι identity για διαστάσεις. */
  readonly textSizeM: number;
  /** `<end_style>` — στυλ άκρου (`end_style_res`)· 8 = «Βέλος 2» (τριγωνικό γεμάτο). */
  readonly endStyle: number;
  /**
   * `<ends_color>` RGB hex των **άκρων/βελών** (π.χ. `A40050` = μπορντώ). Ο Τέκτων χρωματίζει
   * τα βελάκια ΞΕΧΩΡΙΣΤΑ από τη γραμμή — κενό → fallback στο `color`. (ADR-531/608 calibration.)
   */
  readonly endsColor: string;
  /**
   * `<drv_color>` RGB hex των **οδηγών/βοηθητικών (witness) γραμμών** (π.χ. `809CFC` = μπλε).
   * Ξεχωριστό από τη γραμμή διάστασης — κενό → fallback στο `color`. (ADR-531/608 calibration.)
   */
  readonly drvColor: string;
  /**
   * `<arrow_len>` — συντελεστής μεγέθους σήμανσης άκρων λ (π.χ. 0.3). ΠΡΟΣΟΧΗ: **δεν** είναι
   * το μήκος σε μέτρα — GROUND-TRUTH από explode (`DIASTASI-ΒΕΛΗ.dxf`, Giorgio 2026-07-09): το
   * πραγματικά σχεδιασμένο «Βέλος 2» έχει μήκος ≈ 0.4 × λ (λ=0.3 → 0.12m σχεδιασμένο). 0 → default.
   */
  readonly arrowLenM: number;
  /** Σημεία αναφοράς από `<inter>` (pX/pY) — οι βάσεις των βοηθητικών γραμμών· κενό αν λείπουν. */
  readonly refPoints: readonly TekPoint2D[];
}

/**
 * ADR-608 — ένα type-7 `<object>` record (built-in σύμβολο Τέκτονα). Το `typeRes` είναι ο
 * catalog index (`Obj.inf`) — το ΔΕΥΤΕΡΟ `<type>` του record (το 1ο = entity type 7). Θέση/
 * περιστροφή/κλίμακα στο `<xmatrix>` (μέτρα, Y-up). Καθρέφτης του export `OBJECT_RECORD_TEMPLATE`.
 */
export interface TekObjectRecord {
  /** `type_res` — catalog index του built-in συμβόλου (π.χ. 51=Βορράς 1, 383=Σύμβολο τομής). */
  readonly typeRes: number;
  /** `<xmatrix>` — θέση + περιστροφή + κλίμακα (μέτρα, Y-up). */
  readonly matrix: TekXMatrix;
  /** `<color>` RGB hex (γενικό material color· cosmetic). */
  readonly color: string;
}

/**
 * ADR-531 Φ5b.4 — μία **πλάκα** `<plane><record>` (entity type 10). Footprint polygon (`<point3d>`
 * κορυφές, μέτρα Y-up) + `<width>` (πάχος εξώθησης) + `<elev1>` (στάθμη βάσης). Ο Τέκτων εξάγει τη
 * δομική πλάκα ΚΑΙ τα έπιπλα ως `<plane>` type 10 (ίδια δομή footprint+extrusion)· εδώ = δομική πλάκα.
 */
export interface TekPlaneRecord {
  /** Footprint κορυφές (μέτρα, Y-up) — `<point3d><record>` pointX/pointY. */
  readonly vertices: readonly TekPoint2D[];
  /** `<width>` — πάχος πλάκας / εξώθηση (μέτρα). */
  readonly widthM: number;
  /** `<elev1>` — στάθμη βάσης (μέτρα). */
  readonly elevationM: number;
  /**
   * Ελάχιστο `<pointZ>` των κορυφών (μέτρα) — η πραγματική στάθμη του polygon. Ο Τέκτων αφήνει
   * `elev1=0` στις πλάκες που παράγει από 3Δ αντικείμενα (π.χ. οι όψεις μπετού κάθε σκαλοπατιού),
   * κρατώντας το ύψος ΜΟΝΟ στα `<point3d>` Z· fallback στάθμης όταν `elev1≈0` (αλλιώς καταρρέουν στο 0).
   */
  readonly baseElevationM?: number;
  /** `<color>` RGB hex. */
  readonly color: string;
}

/** Αποτέλεσμα parse ενός ολόκληρου `.tek` αρχείου (stair-first scope — Φ1). */
export interface TekParseResult {
  /** Έκδοση αρχείου (`<fileversion>`) — π.χ. 516. */
  readonly fileVersion: number | null;
  /** Έκδοση Τέκτονα (`<version>`) — π.χ. "9.1.0.46". */
  readonly tektonVersion: string | null;
  /** Πλήθος ορόφων (`<numfloors>`). */
  readonly floorCount: number;
  /** Όλα τα stair records που βρέθηκαν, με σειρά ορόφου. */
  readonly stairs: readonly TekStairRecord[];
  /** Μη-κρίσιμες προειδοποιήσεις (π.χ. άδειο stair, λείπει πεδίο). */
  readonly warnings: readonly string[];
}

/**
 * Υπερσύνολο του `TekParseResult` (ADR-526 Φ5a) — προσθέτει 2Δ primitives (γραμμές/τόξα).
 * Backward-compatible: όποιος consumer χρειάζεται μόνο σκάλες διαβάζει το `stairs` ως πριν.
 * Επόμενες φάσεις (Φ5b) επεκτείνουν additive (walls/openings/slabs/roofs).
 */
export interface TekSceneParseResult extends TekParseResult {
  /** Όλα τα `<line>` records (type 4), με σειρά ορόφου. */
  readonly lines: readonly TekLineRecord[];
  /** Όλα τα `<arc>` records (type 5) — τόξα ΚΑΙ κύκλοι. */
  readonly arcs: readonly TekArcRecord[];
  /** Όλα τα `<text>` records (type 3). */
  readonly texts: readonly TekTextRecord[];
  /** ADR-531 Φ5b — όλες οι διαστάσεις (`<dim>` type 0). */
  readonly dims: readonly TekDimRecord[];
  /** ADR-531 Φ5b — όλοι οι 3Δ τοίχοι (`<wall>` type 1) μαζί με τα ανοίγματά τους. */
  readonly walls: readonly TekWallRecord[];
  /** ADR-531 Φ5b.5 — κολώνες & τοιχία: type-1 records με flag pillar=1, στο ίδιο container με τους τοίχους. */
  readonly pillars: readonly TekPillarRecord[];
  /** ADR-531 Φ5b.6 — όλες οι γραμμοσκιάσεις (`<hatch>` type 6). */
  readonly hatches: readonly TekHatchRecord[];
  /** ADR-608 — όλα τα type-7 `<object>` records (built-in σύμβολα Τέκτονα). */
  readonly objects: readonly TekObjectRecord[];
  /** ADR-531 Φ5b.4 — όλες οι πλάκες (`<plane>` type 10). */
  readonly planes: readonly TekPlaneRecord[];
}
