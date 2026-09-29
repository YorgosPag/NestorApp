/**
 * @fileoverview **ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΧΩΡΙΚΗΣ ΠΕΡΙΗΓΗΣΗΣ** — μία ρίζα για ορατότητα, προέλευση, κοινό,
 * πηγή λήψης, πηγή κάτοψης, ορόσημα.
 * @related ADR-884 Φ0.6 · §12 Δ2–Δ6 · CHECK 3.73 (πρότυπο `constants/marketing-audiences.ts`)
 * @module constants/spatial-tour-vocabulary
 *
 * ⚠️ Δήλωση στο `.domain-vocabulary.json` **μόλις** κάποιο από αυτά επαναληφθεί σε διαδρομή + κανόνες +
 * i18n (Κ2/Κ3) — η πύλη είναι αντιδραστική (Φ0.6).
 *
 * **Layering**: leaf — καμία εξάρτηση. Ασφαλές για server, client, tests.
 */

const includes = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

// =============================================================================
// 1. Η ΠΕΡΙΗΓΗΣΗ
// =============================================================================

/**
 * Ποιος βλέπει την περιήγηση (§12 Δ3):
 * - `public`     — όλοι, χωρίς λογαριασμό (δημόσιο ράφι)
 * - `on-request` — όποιος ζητήσει **και** εγκριθεί· η έγκριση δένεται στον **λογαριασμό** (Φ0.13)
 * - `link-only`  — μόνο με προσωπικό σύνδεσμο ανά παραλήπτη· **αόρατη** στην αγγελία (Φ0.12)
 */
export const SPATIAL_TOUR_VISIBILITIES = ['public', 'on-request', 'link-only'] as const;
export type SpatialTourVisibility = (typeof SPATIAL_TOUR_VISIBILITIES)[number];
// Η προεπιλογή «Όλοι» (§12 Δ3) ζει στη ΔΗΜΙΟΥΡΓΙΑ (Κ2), ποτέ στην ανάγνωση: απούσα ορατότητα σε αποθηκευμένο
// έγγραφο είναι βλάβη, όχι «δημόσια» — βλ. `spatial-tour-from-document`.

/** `draft` = το «Private» του Matterport· `withdrawn` = εκτός ραφιού, με ιστορία. */
export const SPATIAL_TOUR_LIFECYCLES = ['draft', 'published', 'withdrawn'] as const;
export type SpatialTourLifecycle = (typeof SPATIAL_TOUR_LIFECYCLES)[number];

/** Πεπερασμένοι κόμβοι ⇒ πίνακας στο ίδιο έγγραφο (Ε6)· ~300 B/κόμβο ⇒ ≪ 1 MiB. */
export const MAX_TOUR_NODES = 250;

/** Από πού προέκυψε ένας σύνδεσμος κόμβων (Α4): από άνοιγμα του BIM, ή χειροκίνητα — πάντα δηλωμένο. */
export const TOUR_LINK_VIAS = ['bim-opening', 'manual'] as const;
export type TourLinkVia = (typeof TOUR_LINK_VIAS)[number];

// =============================================================================
// 2. Η ΛΗΨΗ
// =============================================================================

/** Με τι έγινε η λήψη (§12 Δ2 · Φ3). Ο θεατής **δεν** διακλαδίζεται — ένα κανονικό πανόραμα. */
export const TOUR_CAPTURE_SOURCES = ['camera-360', 'phone', 'bim-render'] as const;
export type TourCaptureSource = (typeof TOUR_CAPTURE_SOURCES)[number];

/**
 * Τι **δείχνει** η λήψη (§12 Δ4 · ADR-841 Α11):
 * - `as-built`        — η πραγματικότητα
 * - `virtual-staging` — εικονική διακόσμηση, **μόνο επιφανειακά**, πάνω σε `as-built`
 * - `design-study`    — μελέτη ανακαίνισης, **μόνο** μηχανικός με ΤΕΕ
 */
export const TOUR_CAPTURE_PROVENANCES = ['as-built', 'virtual-staging', 'design-study'] as const;
export type TourCaptureProvenance = (typeof TOUR_CAPTURE_PROVENANCES)[number];
/** Οι προελεύσεις που «ντύνουν» μια πραγματική λήψη — απαιτούν `baseCaptureId` (αναλλοίωτο #1). */
export const DERIVED_CAPTURE_PROVENANCES: readonly TourCaptureProvenance[] = ['virtual-staging', 'design-study'];

/** Ποιος βλέπει τη λήψη (§12 Δ6). **Κάθε λήψη ζει σε δικό της έγγραφο** — οι κανόνες δεν φιλτράρουν πεδία. */
export const TOUR_CAPTURE_AUDIENCES = ['public-listing', 'project-team', 'unit-owner'] as const;
export type TourCaptureAudience = (typeof TOUR_CAPTURE_AUDIENCES)[number];

/** Ορόσημα εργοταξίου (ορολογία OpenSpace, §11) — ο άξονας του χρονολογίου Φ6/Φ7. */
export const TOUR_MILESTONES = ['structure', 'mep-rough-in', 'pre-closure', 'finishes', 'handover'] as const;
export type TourMilestone = (typeof TOUR_MILESTONES)[number];

/** Η κατάσταση των πλακιδίων μιας λήψης — τη γεμίζει ο ψήστης της Φ2. */
export const TOUR_TILESET_STATES = ['pending', 'ready', 'failed'] as const;
export type TourTilesetState = (typeof TOUR_TILESET_STATES)[number];

// =============================================================================
// 2α. ΠΡΟΣΒΑΣΗ — περιορισμένες άδειες πάνω σε ΜΙΑ περιήγηση (Φ0.5 · Φ0.13)
// =============================================================================

/**
 * Τα εύρη των αδειών περιήγησης — κρίνονται **μόνο** από το `evaluateScopedGrant` (`lib/auth/scoped-grant`).
 * - `tour:view`           — θέαση περιήγησης `on-request`, από εγκεκριμένο αίτημα (Φ0.13)
 * - `tour:capture:upload` — ανέβασμα λήψεων από φωτογράφο, **χωρίς** διαχείριση (Φ0.5)
 *
 * Ξεχωριστά από το `GRANT_SCOPES` του ακινήτου (`lib/auth/types`): εκείνα δίνονται σε **μονάδα**, αυτά σε
 * **περιήγηση** — άλλος πόρος, άλλο έγγραφο, ίδιος κριτής.
 */
export const TOUR_GRANT_SCOPES = ['tour:view', 'tour:capture:upload'] as const;
export type TourGrantScope = (typeof TOUR_GRANT_SCOPES)[number];

/**
 * Οι **αποθηκευμένες** καταστάσεις ενός αιτήματος θέασης — **μόνο αποφάσεις ανθρώπου**.
 *
 * 🔑 **`revoked` και `expired` ΔΕΝ αποθηκεύονται.** Ένα εγκεκριμένο αίτημα **είναι** άδεια
 * (`expiresAt` + `revokedAt?`), και το «ισχύει ακόμη;» το απαντά ο **ένας** κριτής αδειών. Αποθηκευμένο
 * `expired` θα χρειαζόταν cron που το γράφει — και ως τότε ένα `approved` θα ίσχυε μετά τη λήξη του.
 */
export const TOUR_ACCESS_REQUEST_STATES = ['pending', 'approved', 'declined', 'withdrawn'] as const;
export type TourAccessRequestState = (typeof TOUR_ACCESS_REQUEST_STATES)[number];

/**
 * Η **παράγωγη** θέση ενός αιτήματος τώρα (`tourAccessStanding`): οι αποφάσεις ανθρώπου + ό,τι λέει ο
 * κριτής αδειών για ένα `approved`. `unreadable` = έγκριση με λήξη που δεν διαβάζεται — **άρνηση**.
 */
export const TOUR_ACCESS_STANDINGS = [
  'pending', 'active', 'declined', 'withdrawn', 'revoked', 'expired', 'unreadable',
] as const;
export type TourAccessStanding = (typeof TOUR_ACCESS_STANDINGS)[number];

/**
 * **Με ποια βάση βλέπει κάποιος την περιήγηση** (ADR-884 Κ3β) — υπογράφεται μέσα στο κουπόνι θέασης και
 * οδηγεί το ίχνος (ποιος μετρητής αυξάνεται). Σειρά = προτεραιότητα της κρίσης (`judgeTourView`):
 * - `manager` — ο υπεύθυνος (καμία μέτρηση — δεν είναι ενδιαφέρον αγοραστή)
 * - `link`    — προσωπικός σύνδεσμος ανά παραλήπτη (Φ0.12)
 * - `request` — εγκεκριμένο αίτημα θέασης, δεμένο στον λογαριασμό (Φ0.13)
 * - `public`  — δημοσιευμένη περιήγηση ορατότητας `public`
 */
export const TOUR_VIEW_BASES = ['manager', 'link', 'request', 'public'] as const;
export type TourViewBasis = (typeof TOUR_VIEW_BASES)[number];

// =============================================================================
// 3. Η ΚΑΤΟΨΗ — ιεραρχία αξιοπιστίας (§12 Δ5)
// =============================================================================

/**
 * **Ταξινομημένο κατά βαθμίδα** (1 = πιο αξιόπιστη). Η σειρά **είναι** σημασιολογία: από εδώ
 * **παράγεται** η δυνατότητα μέτρησης — δεν ρυθμίζεται χωριστά, δεν αποθηκεύεται.
 */
export const FLOOR_PLAN_SOURCES = ['engineer', 'device-scan', 'photo-estimate', 'user-sketch', 'none'] as const;
export type FloorPlanSource = (typeof FLOOR_PLAN_SOURCES)[number];

export const FLOOR_PLAN_RECORD_STATES = ['active', 'superseded'] as const;
export type FloorPlanRecordState = (typeof FLOOR_PLAN_RECORD_STATES)[number];

/** Τι μετρήσεις επιτρέπει η πηγή (§12 Δ5): `exact` ⇒ ακριβείς, `indicative` ⇒ ενδεικτικές, `none` ⇒ καμία. */
export type FloorPlanMeasurability = 'exact' | 'indicative' | 'none';

const MEASURABILITY: Readonly<Record<FloorPlanSource, FloorPlanMeasurability>> = {
  engineer: 'exact',
  'device-scan': 'exact',
  'photo-estimate': 'indicative',
  'user-sketch': 'indicative',
  none: 'none',
};

/** Βαθμίδα 1–5 (μικρότερη = πιο αξιόπιστη). */
export function floorPlanTier(source: FloorPlanSource): number {
  return FLOOR_PLAN_SOURCES.indexOf(source) + 1;
}

export function floorPlanMeasurability(source: FloorPlanSource): FloorPlanMeasurability {
  return MEASURABILITY[source];
}

/** Η `candidate` είναι **αναβάθμιση** της `current`; — μόνο τότε το σύστημα προτείνει αντικατάσταση. */
export function isFloorPlanUpgrade(current: FloorPlanSource, candidate: FloorPlanSource): boolean {
  return floorPlanTier(candidate) < floorPlanTier(current);
}

/**
 * **Οι πηγές που ΔΗΛΩΝΕΙ άνθρωπος** όταν διαλέγει εικόνα κάτοψης από τα αρχεία του ακινήτου (ADR-884 Φ2στ-β · §12 Δ7.1).
 * Οι `device-scan` / `photo-estimate` τις γράφει **μηχανή** (Φ2.Κ) — ποτέ επιλογή σε φόρμα· η `none` είναι η απουσία.
 * Κανένα από τα δύο δεν προεπιλέγεται σιωπηλά (ίδια αρχή με τον τύπο χώρου, §4.12).
 */
export const FLOOR_PLAN_DECLARABLE_SOURCES = ['engineer', 'user-sketch'] as const satisfies readonly FloorPlanSource[];
export type FloorPlanDeclarableSource = (typeof FLOOR_PLAN_DECLARABLE_SOURCES)[number];

/**
 * **Από πού ήρθε ο προσανατολισμός μιας λήψης** (ADR-884 Φ2στ-β · §4.13): `device` = GPano/πυξίδα της συσκευής (απών ⇒
 * αυτό, παλιά έγγραφα αμετάβλητα)· `manual` = ο υπεύθυνος τον ευθυγράμμισε πάνω στην κάτοψη (ή δέχτηκε την πρόταση).
 */
export const TOUR_HEADING_SOURCES = ['device', 'manual'] as const;
export type TourHeadingSource = (typeof TOUR_HEADING_SOURCES)[number];

// =============================================================================
// 3β. ΟΙ ΧΩΡΟΙ — τι δωμάτιο είναι ένα σημείο (ADR-884 Φ2στ · §4.12)
// =============================================================================

/**
 * **Τύπος χώρου** ενός σημείου — κλειστό, μεταφράσιμο λεξιλόγιο (ο ξένος αγοραστής διαβάζει «Kitchen», όχι «Κουζίνα»).
 * Βάση: τα 21 `classifications` της Matterport (Model API «Room Names») + ό,τι ζητά η ελληνική αγγελία (`wc` · `storage` ·
 * `laundry` · `terrace`). Το ελεύθερο **όνομα** (`TourRoom.label`) υπερισχύει στην προβολή — ίδια προτεραιότητα με τη
 * Matterport (`label` πάνω από `classifications`). **Η σειρά είναι η σειρά του επιλογέα** (συχνότερα πρώτα).
 */
export const TOUR_ROOM_TYPES = [
  'living-room', 'kitchen', 'dining-room', 'bedroom', 'bathroom', 'wc', 'entrance', 'hallway', 'office', 'closet',
  'storage', 'laundry', 'utility-room', 'balcony', 'terrace', 'patio', 'garage', 'basement', 'loft', 'staircase',
  'pantry', 'family-room', 'game-room', 'exercise-room', 'other',
] as const;
export type TourRoomType = (typeof TOUR_ROOM_TYPES)[number];

/** Ενιαίος χώρος = έως τόσοι τύποι (Matterport: «Kitchen, Living Room, Dining Room»). */
export const TOUR_ROOM_MAX_TYPES = 3;
/** Μήκος ελεύθερου ονόματος — χωρά σε βελάκι και επικεφαλίδα κινητού. */
export const TOUR_ROOM_LABEL_MAX = 60;

/**
 * Από πού ήρθε το όνομα — `manual` σήμερα· στη Φ4 το `IfcSpace` του BIM (`bim`) **αναβαθμίζει** το χειροκίνητο, ποτέ
 * σιωπηλά (ίδιο σχήμα με την κάτοψη, §12 Δ5).
 */
export const TOUR_ROOM_SOURCES = ['manual'] as const;
export type TourRoomSource = (typeof TOUR_ROOM_SOURCES)[number];

// =============================================================================
// 3γ. ΤΑ ΣΧΗΜΑΤΑ ΤΩΝ ΧΩΡΩΝ — περιγράμματα + νοητές γραμμές ανά όροφο (ADR-884 Φ2στ-γ Γ3β · §12 Δ8)
// =============================================================================

/**
 * **Από πού ήρθε ένα περίγραμμα χώρου**: `detected` = πρόταση της ανίχνευσης (Γ3α) που ενέκρινε άνθρωπος · `manual` = σχεδιάστηκε
 * με το χέρι · `dxf` = κλειστό περίγραμμα χώρου σχεδίου (Δ8.1, όταν έρθει κάτοψη DXF). Σε **κάθε** περίπτωση το περίγραμμα
 * δημοσιεύεται μόνο με έγκριση — ποτέ αυτόματα.
 */
export const TOUR_SPACE_SOURCES = ['detected', 'manual', 'dxf'] as const;
export type TourSpaceSource = (typeof TOUR_SPACE_SOURCES)[number];

/**
 * **Η πρόθεση μιας εντολής σχήματος** (Γ3γ-2α · πρότυπο Linear CreationTransaction ≠ UpdateTransaction): το id το κόβει ο
 * πελάτης, άρα ο κριτής πρέπει να ξέρει αν ζητήθηκε **νέο** ή **αλλαγή** — ποτέ τυφλό upsert (θα ανάσταινε σβησμένο χώρο).
 */
export const TOUR_SHAPE_MODES = ['create', 'replace'] as const;
export type TourShapeMode = (typeof TOUR_SHAPE_MODES)[number];

/**
 * **Από πού ήρθε ένα δηλωμένο εμβαδόν** (Δ8.4 · απόφαση Giorgio Γ3β-2): υποχρεωτικό — ο αγοραστής ξεχωρίζει τη μελέτη από
 * την εκτίμηση. Η σειρά = φθίνουσα αξιοπιστία (και σειρά επιλογέα).
 */
export const TOUR_DECLARED_AREA_SOURCES = ['engineer-study', 'site-measurement', 'owner-declared'] as const;
export type TourDeclaredAreaSource = (typeof TOUR_DECLARED_AREA_SOURCES)[number];

/** **Εμβαδά χώρων στη δημόσια σελίδα** — διακόπτης ανά περιήγηση (Δ8.4)· απών ⇒ `shown`. */
export const TOUR_SPACE_AREA_DISPLAYS = ['shown', 'hidden'] as const;
export type TourSpaceAreaDisplay = (typeof TOUR_SPACE_AREA_DISPLAYS)[number];
/** Η προεπιλογή (Δ8.4: «μετρημένο ως προεπιλογή») — και η ανάγνωση παλιού εγγράφου χωρίς το πεδίο. */
export const TOUR_SPACE_AREA_DISPLAY_DEFAULT: TourSpaceAreaDisplay = 'shown';

/** Κορυφές ενός περιγράμματος — τρίγωνο ως ~δωμάτιο με καμπύλες (το DP της Γ3α δίνει δεκάδες, όχι εκατοντάδες). */
export const TOUR_SPACE_MIN_VERTICES = 3;
export const TOUR_SPACE_MAX_VERTICES = 200;
/** Όρια ανά όροφο — ο γράφος ζει σε **ένα** έγγραφο (όριο 1 MiB): 80 × 200 κορυφές ≈ 0,5 MB στη χειρότερη. */
export const MAX_TOUR_SPACES_PER_LEVEL = 80;
export const MAX_TOUR_SEPARATIONS_PER_LEVEL = 80;
/** Κάτω από αυτό δεν είναι χώρος αλλά μουτζούρα (μισό τετραγωνικό ≈ ντουλάπι 70 × 70). */
export const TOUR_SPACE_MIN_AREA_M2 = 0.25;
/**
 * **Ανοχή επικάλυψης** δύο χώρων: τα περιγράμματα που ακουμπούν σε κοινό τοίχο ή κοινή νοητή γραμμή «τρέμουν» κατά μισό pixel
 * εδώ κι εκεί (ορθογώνια έλξη, σύρσιμο κορυφών) ⇒ επικάλυψη = βαθύτερη από 5 cm.
 */
export const TOUR_SPACE_OVERLAP_TOLERANCE_M = 0.05;
/** Άνω όριο δηλωμένου εμβαδού ενός χώρου — πιάνει το «2800» αντί για «28,00». */
export const TOUR_DECLARED_AREA_MAX_M2 = 10_000;
/** Νοητή γραμμή κοντύτερη από αυτό δεν χωρίζει τίποτα. */
export const TOUR_SEPARATION_MIN_LENGTH_M = 0.1;
/**
 * **Πόσο κοντά στη νοητή γραμμή τελειώνει ένας χώρος που «την ακουμπά»** (Δ8.2 · Γ3γ-1 — η γειτονία **παράγεται**). Η ανίχνευση
 * σταματά το περίγραμμα λίγο πριν τη γραμμή: πάχος ραστεροποίησης (1 px) + ½ pixel ορθογώνιας έλξης + απλοποίηση DP (5 cm) ⇒
 * ~8–10 cm σε συνήθεις κλίμακες· με το χέρι, ο άνθρωπος αφήνει λίγα εκατοστά. 15 cm = περιθώριο πάνω από αυτά, **κάτω** από το
 * πάχος ενός τοίχου (≥ 20 cm): χώρος στην άλλη πλευρά αληθινού τοίχου δεν γίνεται ποτέ «ενιαίος γείτονας».
 */
export const TOUR_SPACE_ADJACENCY_TOLERANCE_M = 0.15;
/**
 * **Φύλακας δηλωμένου εμβαδού** (Δ8.4 · Δ9.4): δηλωμένο που απέχει από το μετρημένο **περισσότερο** από 15% ⇒ ο επεξεργαστής
 * ρωτά «σωστός χώρος;». Προειδοποίηση, **όχι** φραγή (Revit warnings): η μελέτη μετρά αξονικά, η κάτοψη καθαρά — μια
 * απόκλιση 5–10% είναι φυσιολογική· το 20 αντί για 12 είναι λάθος πληκτρολόγησης ή λάθος χώρος.
 */
export const TOUR_DECLARED_AREA_WARN_RATIO = 0.15;

// =============================================================================
// 3γ. Η ΙΔΙΩΤΙΚΟΤΗΤΑ — θολωμένες περιοχές μιας λήψης (ADR-884 Φ2ζ · §4.15 · Α8)
// =============================================================================

/**
 * **Ποιος βρήκε μια θολωμένη περιοχή**: `manual` = ο υπεύθυνος με το πινέλο (Matterport Blur Brush) · `auto` = η ανίχνευση
 * προσώπων του ψήστη (Zillow: αυτόματα, προεπιλεγμένα ενεργό). Η προέλευση **δεν** αλλάζει το αποτέλεσμα — μόνο το ίχνος.
 */
export const TOUR_REDACTION_SOURCES = ['manual', 'auto'] as const;
export type TourRedactionSource = (typeof TOUR_REDACTION_SOURCES)[number];

/** Άνω όριο περιοχών ανά λήψη — φράχτης μεγέθους εγγράφου, όχι πολιτική (ένα πλήθος σε αίθουσα ≈ δεκάδες πρόσωπα). */
export const MAX_TOUR_REDACTIONS = 64;
/** Μικρότερη γωνιακή ακτίνα (≈ 0,3°): κάτω από αυτό η περιοχή είναι λιγότερο από ένα pixel σε 8K — δεν κρύβει τίποτα. */
export const TOUR_REDACTION_MIN_RADIUS_RAD = 0.005;
/** Μεγαλύτερη γωνιακή ακτίνα (45°): ένα θόλωμα μισού ορίζοντα δεν είναι προστασία προσώπου αλλά απόκρυψη χώρου (Zillow Guidelines). */
export const TOUR_REDACTION_MAX_RADIUS_RAD = Math.PI / 4;

// =============================================================================
// 4. GUARDS
// =============================================================================

export const isSpatialTourVisibility = (v: unknown): v is SpatialTourVisibility => includes(SPATIAL_TOUR_VISIBILITIES, v);
export const isSpatialTourLifecycle = (v: unknown): v is SpatialTourLifecycle => includes(SPATIAL_TOUR_LIFECYCLES, v);
export const isTourLinkVia = (v: unknown): v is TourLinkVia => includes(TOUR_LINK_VIAS, v);
export const isTourCaptureSource = (v: unknown): v is TourCaptureSource => includes(TOUR_CAPTURE_SOURCES, v);
export const isTourCaptureProvenance = (v: unknown): v is TourCaptureProvenance => includes(TOUR_CAPTURE_PROVENANCES, v);
export const isTourCaptureAudience = (v: unknown): v is TourCaptureAudience => includes(TOUR_CAPTURE_AUDIENCES, v);
export const isTourMilestone = (v: unknown): v is TourMilestone => includes(TOUR_MILESTONES, v);
export const isTourTilesetState = (v: unknown): v is TourTilesetState => includes(TOUR_TILESET_STATES, v);
export const isTourGrantScope = (v: unknown): v is TourGrantScope => includes(TOUR_GRANT_SCOPES, v);
export const isTourAccessRequestState = (v: unknown): v is TourAccessRequestState =>
  includes(TOUR_ACCESS_REQUEST_STATES, v);
export const isTourViewBasis = (v: unknown): v is TourViewBasis => includes(TOUR_VIEW_BASES, v);
export const isFloorPlanSource =(v: unknown): v is FloorPlanSource => includes(FLOOR_PLAN_SOURCES, v);
export const isTourRoomType = (v: unknown): v is TourRoomType => includes(TOUR_ROOM_TYPES, v);
export const isTourRoomSource = (v: unknown): v is TourRoomSource => includes(TOUR_ROOM_SOURCES, v);
export const isFloorPlanRecordState =(v: unknown): v is FloorPlanRecordState => includes(FLOOR_PLAN_RECORD_STATES, v);
export const isFloorPlanDeclarableSource = (v: unknown): v is FloorPlanDeclarableSource =>
  includes(FLOOR_PLAN_DECLARABLE_SOURCES, v);
export const isTourHeadingSource = (v: unknown): v is TourHeadingSource => includes(TOUR_HEADING_SOURCES, v);
export const isTourSpaceSource = (v: unknown): v is TourSpaceSource => includes(TOUR_SPACE_SOURCES, v);
export const isTourDeclaredAreaSource = (v: unknown): v is TourDeclaredAreaSource => includes(TOUR_DECLARED_AREA_SOURCES, v);
export const isTourSpaceAreaDisplay = (v: unknown): v is TourSpaceAreaDisplay => includes(TOUR_SPACE_AREA_DISPLAYS, v);
export const isTourRedactionSource = (v: unknown): v is TourRedactionSource => includes(TOUR_REDACTION_SOURCES, v);
