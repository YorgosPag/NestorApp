/**
 * @fileoverview **Η ΜΗΝΙΑΙΑ ΣΕΙΡΑ ΖΗΤΟΥΜΕΝΩΝ ΤΙΜΩΝ ΑΝΑ ΠΕΡΙΟΧΗ** — καθαρή συνάρτηση: (σειρά χθες, αγγελίες απόψε)
 * ⇒ σειρά σήμερα (ADR-890 §13). Κανένα I/O· ο γραφέας είναι το `area-market-rollup.service.ts`.
 * @related ADR-890 §13 · `types/area-market.ts` · `lib/market/area-market-summary.ts` (`observeAsking`)
 * @module lib/market/area-market-series
 *
 * 🔑 **ΜΗΝΙΑΙΑ, ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ.** Zillow (*Median List Price*), Redfin, idealista, ONS: μηνιαία σημεία. Κανείς δεν
 * δείχνει ημερήσια ή εβδομαδιαία ζητούμενη σε μικρή περιοχή — είναι θόρυβος (το Redfin εξομαλύνει τα εβδομαδιαία
 * του με μοντέλο).
 *
 * 🔴 **Η ΔΙΑΜΕΣΟΣ ΤΟΥ ΜΗΝΑ ΒΓΑΙΝΕΙ ΑΠΟ ΤΙΣ ΑΓΓΕΛΙΕΣ, ΟΧΙ ΑΠΟ ΤΑ ΣΤΙΓΜΙΟΤΥΠΑ.** Ο διάμεσος ημερήσιων διαμέσων δεν
 * είναι διάμεσος. Γι' αυτό ο γραφέας κρατά το **βιβλίο** του τρέχοντος μήνα (`αγγελία → τελευταία παρατήρηση`) και
 * ξαναϋπολογίζει το σημείο κάθε νύχτα με το ΙΔΙΟ `summarize` και το ΙΔΙΟ κατώφλι.
 *
 * 🔑 **Ιδεμποτικό**: η ίδια νύχτα δύο φορές ⇒ οι ίδιες παρατηρήσεις ⇒ το ίδιο σημείο. Χαμένη νύχτα δεν χάνει
 * αγγελίες: ο μήνας είναι **ένωση** των νυχτών του.
 */

import type { PublicListing } from '@/types/public-listing';
import {
  AREA_MARKET_SERIES_SCHEMA_VERSION,
  ASKING_OFFERS,
  type AreaMarketMonthPoint,
  type AreaMarketSeries,
  type AreaMarketSeriesPoints,
  type AskingBookEntry,
  type AskingMonthBook,
  type AskingOffer,
  type AskingSegmentCells,
} from '@/types/area-market';

import { observeAsking } from './area-market-summary';
import type { MarketSegment } from './market-segments';
import { monthOfDay, shiftMonth, summarize } from './market-statistics';

/** Πόσους μήνες κρατά η σειρά (5 έτη). Παλαιότεροι κόβονται — η σελίδα δείχνει το πολύ 12. */
export const AREA_MARKET_SERIES_RETENTION_MONTHS = 60;

function emptyBook(month: string): AskingMonthBook {
  return { month, offers: { sale: {}, rent: {} } };
}

/**
 * **Απόψε μέσα στο βιβλίο του μήνα.** Νέος μήνας ⇒ καθαρό βιβλίο (ο προηγούμενος μένει παγωμένος στα `points`).
 * Η **τελευταία** παρατήρηση μιας αγγελίας κερδίζει (αλλαγή τιμής μέσα στον μήνα). Αγγελία που απόψε δεν κρίθηκε
 * (π.χ. έφυγε από την αγορά) **κρατά** την παρατήρηση του μήνα: ήταν ενεργή έστω μία νύχτα του.
 */
export function mergeAskingBook(book: AskingMonthBook | null, day: string, listings: readonly PublicListing[]): AskingMonthBook {
  const month = monthOfDay(day);
  const base = book !== null && book.month === month ? book : emptyBook(month);
  const offers = Object.fromEntries(ASKING_OFFERS.map((offer) => {
    const entries: Record<string, AskingBookEntry> = { ...base.offers[offer] };
    for (const listing of listings) {
      const verdict = observeAsking(listing, offer);
      if (verdict !== null && 'observed' in verdict) {
        entries[listing.id] = { segment: verdict.observed.segment, unitPrice: verdict.observed.unitPrice };
      }
    }
    return [offer, entries];
  })) as Record<AskingOffer, Record<string, AskingBookEntry>>;
  return { month, offers };
}

/** Το σημείο του μήνα από το βιβλίο: μία διάμεσος ανά τμήμα, με το ΙΔΙΟ `summarize` (και κατώφλι) της σύνοψης. */
function monthPointOf(book: AskingMonthBook, day: string): AreaMarketMonthPoint {
  const offers = Object.fromEntries(ASKING_OFFERS.map((offer) => {
    const bySegment = new Map<MarketSegment, number[]>();
    for (const entry of Object.values(book.offers[offer])) {
      const values = bySegment.get(entry.segment);
      if (values === undefined) bySegment.set(entry.segment, [entry.unitPrice]);
      else values.push(entry.unitPrice);
    }
    const cells: AskingSegmentCells = Object.fromEntries([...bySegment].map(([segment, values]) => [segment, summarize(values)]));
    return [offer, cells];
  })) as Record<AskingOffer, AskingSegmentCells>;
  return { asOf: day, offers };
}

function retainedPoints(points: AreaMarketSeriesPoints, lastMonth: string): AreaMarketSeriesPoints {
  const oldest = shiftMonth(lastMonth, -(AREA_MARKET_SERIES_RETENTION_MONTHS - 1));
  return Object.fromEntries(Object.entries(points).filter(([month]) => month >= oldest && month <= lastMonth));
}

/**
 * **Η σειρά μιας περιοχής μετά από απόψε.** Γράφεται μόνο για περιοχή **με** αγγελίες απόψε· περιοχή που άδειασε
 * κρατά ό,τι μέτρησε ο μήνας της ως τη νύχτα που άδειασε (ήταν ενεργές τότε).
 */
export function nextAreaMarketSeries(
  previous: AreaMarketSeries | null,
  areaId: string,
  day: string,
  listings: readonly PublicListing[],
): AreaMarketSeries {
  const book = mergeAskingBook(previous?.book ?? null, day, listings);
  const points = { ...(previous?.points ?? {}), [book.month]: monthPointOf(book, day) };
  return {
    schemaVersion: AREA_MARKET_SERIES_SCHEMA_VERSION,
    areaId,
    points: retainedPoints(points, book.month),
    book,
  };
}
