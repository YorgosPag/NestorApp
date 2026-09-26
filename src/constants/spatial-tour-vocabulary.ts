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
export const isFloorPlanRecordState = (v: unknown): v is FloorPlanRecordState => includes(FLOOR_PLAN_RECORD_STATES, v);
