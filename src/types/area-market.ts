/**
 * @fileoverview **Η ΣΥΝΟΨΗ ΑΓΟΡΑΣ ΜΙΑΣ ΠΕΡΙΟΧΗΣ** — το δημόσιο έγγραφο που γράφει η νυχτερινή εργασία και
 * διαβάζει η σελίδα `/area/[id]` (ADR-890 §5.2).
 * @related ADR-890 · `lib/market/area-market-summary.ts` (ο υπολογισμός) · `lib/market/market-statistics.ts`
 * @module types/area-market
 *
 * 🔑 **Μόνο ΖΗΤΟΥΜΕΝΕΣ τιμές (πηγή Α).** Κάθε αριθμός εδώ βγαίνει από `commercial.askingPrice` /
 * `commercial.rentPrice` δημοσιευμένων αγγελιών — **ποτέ** από `finalPrice` (τιμή συμβολαίου). Η ετικέτα
 * της οθόνης το λέει ρητά (ADR-890 §3). Οι τιμές συμβολαίου (πηγή Β) έρχονται στη Φ2, από άλλο αρχείο.
 *
 * 🔑 **Κάθε αποκλεισμός μετριέται, κανένας δεν χάνεται σιωπηλά.** Ό,τι δεν μπήκε στη διάμεσο έχει λόγο και
 * αριθμό (`excluded`), και κάθε ανάλυση λέει πόσες αγγελίες **δεν δήλωσαν** τον άξονα (`undeclared`).
 */

import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import type { MarketSegment } from '@/lib/market/market-segments';
import type { AreaSummaryFile } from '@/lib/market/market-transactions-file';
import type { StatCell } from '@/lib/market/market-statistics';
import type { PriceMapAreas } from '@/lib/market/price-map';
import type { PublicListing } from '@/types/public-listing';

/** Η εκδοχή του σχήματος του εγγράφου. */
export const AREA_MARKET_SNAPSHOT_SCHEMA_VERSION = 1;

/** Οι βαθμίδες που έχουν σελίδα περιοχής (ADR-890 §5.1): Δήμος (5) και Δημοτική Ενότητα (6). */
export const MUNICIPALITY_LEVEL = 5;
export const MUNICIPAL_UNIT_LEVEL = 6;
export const AREA_MARKET_LEVELS = [MUNICIPALITY_LEVEL, MUNICIPAL_UNIT_LEVEL] as const;

/** Έχει αυτή η βαθμίδα δική της σελίδα περιοχής; */
export function hasAreaMarketPage(level: number): boolean {
  return (AREA_MARKET_LEVELS as readonly number[]).includes(level);
}

/** Οι δύο ζητούμενες τιμές που συνοψίζονται. Η διανυκτέρευση δεν είναι αγορά κατοικίας. */
export const ASKING_OFFERS = ['sale', 'rent'] as const;
export type AskingOffer = (typeof ASKING_OFFERS)[number];

/** Γιατί μια αγγελία της περιοχής **δεν** μπήκε στη διάμεσο. */
export const ASKING_EXCLUSIONS = ['noPrice', 'noSize', 'noSegment', 'implausible'] as const;
export type AskingExclusion = (typeof ASKING_EXCLUSIONS)[number];

/**
 * Οι άξονες ανάλυσης (ADR-890 §6 Φ1: εμβαδόν / υπνοδωμάτια / όροφος · §12: έτος κατασκευής).
 *
 * 🔑 **ΕΞΕΛΙΞΗ ΣΧΗΜΑΤΟΣ ΧΩΡΙΣ ΑΛΛΑΓΗ ΕΚΔΟΧΗΣ** (ADR-890 §12.1, πρακτική protobuf/Avro): νέος άξονας = νέο
 * **προαιρετικό** κλειδί στο `breakdowns` ⇒ το `AREA_MARKET_SNAPSHOT_SCHEMA_VERSION` **δεν** ανεβαίνει. Άξονας
 * **απών** = «δεν μετρήθηκε» (έγγραφο πριν από τον άξονα)· **παρών** με κενούς κάδους = «μετρήθηκε, κανείς δεν
 * δήλωσε». ⚠️ Τα κλειδιά κάδων είναι σαν αριθμοί πεδίων: αλλαγή ορίων = **νέο** κλειδί, ποτέ το ίδιο.
 */
export const AREA_BREAKDOWN_AXES = ['size', 'bedrooms', 'floor', 'yearBuilt'] as const;
export type AreaBreakdownAxis = (typeof AREA_BREAKDOWN_AXES)[number];

/** Ανάλυση της τιμής μονάδας κατά έναν άξονα: κελί ανά κάδο + πόσες δεν δήλωσαν τον άξονα. */
export interface AreaBreakdown {
  /** Κλειδί = ταυτότητα κάδου του `lib/market/market-breakdowns.ts`. Κάδοι με 0 αγγελίες παραλείπονται. */
  readonly buckets: Readonly<Record<string, StatCell>>;
  readonly undeclared: number;
}

/** Ένα τμήμα αγοράς μέσα σε μια προσφορά. */
export interface AreaSegmentSummary {
  /** €/τ.μ. (ή € ανά μονάδα όπου το τμήμα μετριέται ανά μονάδα, `SEGMENT_METRIC`). */
  readonly unitPrice: StatCell;
  /** Συνολική ζητούμενη τιμή (ή μηνιαίο ενοίκιο). */
  readonly price: StatCell;
  /** Εμβαδόν σε τ.μ. */
  readonly size: StatCell;
  readonly breakdowns: Readonly<Partial<Record<AreaBreakdownAxis, AreaBreakdown>>>;
}

/** Μία προσφορά (πώληση ή ενοίκιο) σε μια περιοχή. */
export interface AreaOfferSummary {
  /** Αγγελίες της περιοχής σε αγορά με αυτή την προσφορά. */
  readonly listings: number;
  /** Όσες μπήκαν στα στατιστικά (`listings` − άθροισμα `excluded`). */
  readonly counted: number;
  readonly excluded: Readonly<Record<AskingExclusion, number>>;
  readonly segments: Readonly<Partial<Record<MarketSegment, AreaSegmentSummary>>>;
}

/** Το έγγραφο: μία περιοχή, μία ημέρα αγοράς. */
export interface AreaMarketSnapshot {
  readonly schemaVersion: typeof AREA_MARKET_SNAPSHOT_SCHEMA_VERSION;
  /** Ταυτότητα ADR-883 (`municipality:…` ή `municipal_unit:…`). */
  readonly areaId: string;
  /** Ημέρα αγοράς Αθήνας `YYYY-MM-DD` (`marketDayOf`). */
  readonly day: string;
  /** Όλες οι δημοσιευμένες αγγελίες της περιοχής, οποιασδήποτε προσφοράς. */
  readonly listingCount: number;
  readonly offers: Readonly<Record<AskingOffer, AreaOfferSummary>>;
}

/**
 * **Το σημάδι ολοκλήρωσης μιας νυχτερινής εκτέλεσης** — γράφεται **τελευταίο**.
 *
 * 🔑 Η σελίδα διαβάζει πρώτα την τελευταία ολοκληρωμένη εκτέλεση και **μετά** το έγγραφο της περιοχής
 * εκείνης της ημέρας. Έτσι (α) δεν διαβάζει ποτέ μισογραμμένη ημέρα, και (β) μια περιοχή που **άδειασε**
 * δεν δείχνει τα χθεσινά της νούμερα: απουσία εγγράφου στην τελευταία εκτέλεση = «καμία αγγελία σήμερα».
 */
export interface AreaMarketRun {
  readonly schemaVersion: typeof AREA_MARKET_SNAPSHOT_SCHEMA_VERSION;
  readonly day: string;
  /** Περιοχές με έγγραφο αυτή την ημέρα. */
  readonly areas: number;
  /** Αγγελίες που διαβάστηκαν. */
  readonly listings: number;
  /** Αγγελίες χωρίς `adminArea` (παλιός κρίκος ή εκτός ορίων) — **δεν** μέτρησαν πουθενά. */
  readonly unassigned: number;
  /** `true` όταν ο αναγνώστης άγγιξε το όριό του ⇒ οι αριθμοί είναι κάτω φράγμα. */
  readonly truncated: boolean;
  /** ISO χρόνος ολοκλήρωσης. */
  readonly completedAt: string;
}

// ─── Ο ΧΑΡΤΗΣ ΤΙΜΩΝ ΜΙΑΣ ΝΥΧΤΑΣ (ADR-890 §14.4) — ένα έγγραφο για όλη την Ελλάδα ──────────────────────────

/** Η εκδοχή του σχήματος του χάρτη. Προσθετικό πεδίο δεν την ανεβάζει (ADR-890 §12.1). */
export const AREA_MARKET_MAP_SCHEMA_VERSION = 1;

/**
 * Το έγγραφο `area_market_maps`: **μόνο** ό,τι δημοσιεύεται (`[n]` / `[n, διάμεσος]`), για κάθε περιοχή με αγγελίες
 * τη νύχτα `day`. Γράφεται **πριν** από το σημάδι της νύχτας, όπως τα στιγμιότυπα.
 */
export interface AreaMarketMap {
  readonly schemaVersion: typeof AREA_MARKET_MAP_SCHEMA_VERSION;
  readonly day: string;
  readonly offers: Readonly<Record<AskingOffer, PriceMapAreas>>;
}

// ─── Η ΜΗΝΙΑΙΑ ΣΕΙΡΑ ΖΗΤΟΥΜΕΝΩΝ (ADR-890 §13) — ένα έγγραφο ανά περιοχή ──────────────────────────────────

/**
 * Η εκδοχή του σχήματος της σειράς. Νέο **προαιρετικό** πεδίο δεν την ανεβάζει (ADR-890 §12.1)· μόνο σπάσιμο.
 */
export const AREA_MARKET_SERIES_SCHEMA_VERSION = 1;

/** Διάμεσος €/τ.μ. (ή € ανά μονάδα, `SEGMENT_METRIC`) ανά τμήμα αγοράς. Τμήμα χωρίς αγγελία ⇒ απόν. */
export type AskingSegmentCells = Readonly<Partial<Record<MarketSegment, StatCell>>>;

/**
 * **Ένα σημείο της σειράς = ένας ημερολογιακός μήνας.** Ορισμός του Zillow (*Median List Price*, «active at any time
 * in the month»): η διάμεσος πάνω σε **κάθε διακριτή αγγελία που ήταν ενεργή έστω μία νύχτα του μήνα**, με την
 * τελευταία ζητούμενή της. Ποτέ διάμεσος ημερήσιων διαμέσων — δεν είναι διάμεσος.
 */
export interface AreaMarketMonthPoint {
  /** Η τελευταία νύχτα που μπήκε στο σημείο (`YYYY-MM-DD`). Για κλειστό μήνα = η τελευταία του νύχτα με αγγελίες. */
  readonly asOf: string;
  readonly offers: Readonly<Record<AskingOffer, AskingSegmentCells>>;
}

/** Μήνας `YYYY-MM` → σημείο. Μήνας χωρίς καμία αγγελία της περιοχής ⇒ απών (όχι σημείο με μηδενικά). */
export type AreaMarketSeriesPoints = Readonly<Record<string, AreaMarketMonthPoint>>;

/** Μία παρατήρηση του βιβλίου: το τμήμα και η τιμή μονάδας της αγγελίας, όπως τα έκρινε το `observeAsking`. */
export interface AskingBookEntry {
  readonly segment: MarketSegment;
  readonly unitPrice: number;
}

/**
 * **Το βιβλίο του ΤΡΕΧΟΝΤΟΣ μήνα** — `ταυτότητα αγγελίας → παρατήρηση` ανά προσφορά. Υπάρχει μόνο για να βγαίνει
 * σωστή μηνιαία διάμεσος από νυχτερινές εκτελέσεις· **δεν** διαβάζεται ποτέ από τη σελίδα (`fieldMask`).
 */
export interface AskingMonthBook {
  readonly month: string;
  readonly offers: Readonly<Record<AskingOffer, Readonly<Record<string, AskingBookEntry>>>>;
}

/** Το έγγραφο `area_market_series`: μία περιοχή, όλοι οι μήνες της. */
export interface AreaMarketSeries {
  readonly schemaVersion: typeof AREA_MARKET_SERIES_SCHEMA_VERSION;
  readonly areaId: string;
  readonly points: AreaMarketSeriesPoints;
  readonly book: AskingMonthBook;
}

// ─── Η ΣΕΛΙΔΑ `/area/[id]` — ό,τι περνά από τον διακομιστή στο client component ─────────────────────────

/** Η σύνοψη όπως τη βλέπει η σελίδα: καμία ολοκληρωμένη νύχτα, ή η τελευταία (με τον γονέα για αναγωγή). */
export type AreaMarketState =
  | { readonly kind: 'no-run' }
  | {
      readonly kind: 'ready';
      readonly run: AreaMarketRun;
      /** `null` = καμία αγγελία της περιοχής εκείνη τη νύχτα. */
      readonly snapshot: AreaMarketSnapshot | null;
      /** Ο Δήμος μιας Δ.Ε. — για την αναγωγή κάτω από το κατώφλι. */
      readonly parent: AreaMarketSnapshot | null;
      /** Η μηνιαία σειρά της περιοχής (ADR-890 §13) — `null` = δεν γράφτηκε ακόμη (περιοχή πριν από τη σειρά). */
      readonly series: AreaMarketSeriesPoints | null;
    };

/** Το παράθυρο ετών της πηγής (ADR-889 §5.2). */
export interface MarketTransactionsWindow {
  readonly from: number;
  readonly to: number;
}

/**
 * Οι τιμές συμβολαίων όπως τις βλέπει η σελίδα. `none` = η περιοχή **δεν** είχε συμβόλαια (γεγονός, δείχνεται) ·
 * `unavailable` = δεν μπορέσαμε να διαβάσουμε (ποτέ ως «κανένα συμβόλαιο»).
 */
export type AreaContractsState =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'none'; readonly window: MarketTransactionsWindow }
  | {
      readonly kind: 'ready';
      readonly window: MarketTransactionsWindow;
      readonly summary: AreaSummaryFile;
      /** Ο Δήμος μιας Δ.Ε. — για την αναγωγή κάτω από το κατώφλι. */
      readonly parent: AreaSummaryFile | null;
    };

export interface AreaListingsPreview {
  readonly items: readonly PublicListing[];
  /** Όλες οι δημοσιευμένες αγγελίες της περιοχής **τώρα** (ζωντανή καταμέτρηση). */
  readonly total: number;
}

/** Όσα χρειάζεται η σελίδα μιας περιοχής που υπάρχει. */
export interface AreaMarketPageData {
  readonly area: AdminArea;
  /** Από τον άμεσο γονέα προς τα πάνω. */
  readonly ancestors: readonly AdminArea[];
  /** Οι Δ.Ε. ενός δήμου (κενό για Δ.Ε. ή δήμο χωρίς Δ.Ε.). */
  readonly children: readonly AdminArea[];
  readonly market: AreaMarketState;
  readonly listings: AreaListingsPreview;
  /** Πηγές Β + Γ — τιμές συμβολαίων και τιμή ζώνης (ADR-889 Φ2 · ADR-890 Φ2). */
  readonly contracts: AreaContractsState;
  /**
   * Τα αρχεία ζωνών αντικειμενικών αξιών που ζωγραφίζει ο χάρτης (ADR-889 Φ5): η ίδια η περιοχή και οι Δ.Ε. της, όσες
   * έχουν ζώνες. `[]` = καμία ζώνη (γεγονός) · `null` = το ευρετήριο δεν διαβάστηκε («δεν ξέρω»).
   */
  readonly valueZoneFiles: readonly string[] | null;
}

/** Τρεις εκβάσεις: 404 · 5xx (δεν μπορέσαμε να ρωτήσουμε) · η σελίδα. */
export type AreaMarketPage =
  | { readonly kind: 'not-found' }
  | { readonly kind: 'unavailable' }
  | ({ readonly kind: 'found' } & AreaMarketPageData);
