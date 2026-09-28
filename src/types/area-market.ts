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

/** Οι άξονες ανάλυσης (ADR-890 §6 Φ1: εμβαδόν / υπνοδωμάτια / όροφος). */
export const AREA_BREAKDOWN_AXES = ['size', 'bedrooms', 'floor'] as const;
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
}

/** Τρεις εκβάσεις: 404 · 5xx (δεν μπορέσαμε να ρωτήσουμε) · η σελίδα. */
export type AreaMarketPage =
  | { readonly kind: 'not-found' }
  | { readonly kind: 'unavailable' }
  | ({ readonly kind: 'found' } & AreaMarketPageData);
