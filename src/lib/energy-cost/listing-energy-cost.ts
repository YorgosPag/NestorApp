/**
 * @fileoverview **Η εκτίμηση ετήσιου κόστους ενέργειας μιας αγγελίας** (ADR-777 §8.95) — παράγωγο κατά την ανάγνωση.
 * @related `lib/energy-certificate/certificate-final-energy.ts` (τα δύο δηλωμένα πεδία) ·
 *   `./energy-reference-prices.ts` (οι τιμές) · `components/listing-detail/ListingEnergyCost.tsx` (η οθόνη) ·
 *   `lib/objective-value/listing-objective-value.ts` (το ίδιο σχήμα: η προβολή κουβαλά δηλώσεις, το ποσό βγαίνει εδώ)
 * @module lib/energy-cost/listing-energy-cost
 *
 * 🔴 **ΠΟΤΕ ΑΠΟ ΠΡΩΤΟΓΕΝΗ ΕΝΕΡΓΕΙΑ.** Ο αριθμός της κλάσης (kWh/m² πρωτογενούς) περιέχει συντελεστές μετατροπής που
 * δεν πληρώνει κανείς. Εδώ μπαίνει **μόνο** η τελική ενέργεια ανά πηγή, όπως την τυπώνει το ΠΕΑ, επί την ωφέλιμη
 * επιφάνεια του ίδιου πιστοποιητικού, επί την επίσημη τιμή της πηγής.
 *
 * 🔑 **Το ποσό δεν αποθηκεύεται**: οι τιμές αλλάζουν κάθε εξάμηνο. Αποθηκευμένο ποσό θα ήταν μπαγιάτικο από την
 * επόμενη δημοσίευση της Eurostat, χωρίς να το ξέρει κανείς.
 *
 * 🔑 **Εύρος, και το πλάτος του είναι ΜΕΤΡΗΜΕΝΟ**: κάτω άκρο = κάθε πηγή στη χαμηλότερη τιμή της μέσα στο παράθυρο του
 * πίνακα, πάνω άκρο = στην υψηλότερη. Δεν υπάρχει «±15%» που διάλεξε κάποιος. Το εύρος λέει πόσο κινήθηκαν οι
 * τιμές — **όχι** πόσο διαφέρει ένα νοικοκυριό από το τυπικό· αυτό το λέει η οθόνη με λόγια.
 *
 * 🔑 **Πέντε καταστάσεις, καμία σιωπηλή** — χωρίς επαρκή δεδομένα δεν υπάρχει «0 €», υπάρχει λόγος με όνομα.
 */

import type { CertificateEnergySource } from '@/constants/certificate-energy-sources';
import type { PublicListing } from '@/types/public-listing';

import {
  ENERGY_SOURCE_PRICING,
  staleAfter,
  type EnergyReferencePrices,
  type ReferencePricePeriod,
} from './energy-reference-prices';

/** Ό,τι χρειάζεται ο υπολογισμός από την αγγελία — δομικό, ώστε τα tests να μη χτίζουν ολόκληρη προβολή. */
export type EnergyCostSubject = Pick<PublicListing, 'energyClass' | 'energyCertificate' | 'commonCharges'>;

/** Μία πηγή της εκτίμησης: πόσες kWh τον χρόνο αντιστοιχούν στο ακίνητο (όχι ανά m²). */
export interface EnergyCostLine {
  readonly source: CertificateEnergySource;
  readonly kwhPerYear: number;
}

export interface EnergyCostEstimate {
  readonly kind: 'estimated';
  /** Ευρώ τον χρόνο, στρογγυλεμένα στη δεκάδα. */
  readonly low: number;
  readonly high: number;
  /** Το παράθυρο των τιμών που μπήκαν στον υπολογισμό — εξάμηνα μορφής `2024-S2`. */
  readonly pricesFrom: string;
  readonly pricesTo: string;
  readonly lines: readonly EnergyCostLine[];
  /** Τα κοινόχρηστα δηλώνουν ότι περιλαμβάνουν θέρμανση ⇒ μέρος του ποσού ίσως πληρώνεται ήδη εκεί (§8.93.9 #3). */
  readonly heatingInCommonCharges: boolean;
}

export type ListingEnergyCost =
  /** Η ερώτηση δεν τίθεται, ή δεν υπάρχει κλάση: καμία γραμμή. */
  | { readonly kind: 'hidden' }
  /** Υπάρχει κλάση, αλλά λείπει η ωφέλιμη επιφάνεια ή ο πίνακας τελικής ενέργειας. */
  | { readonly kind: 'undeclared' }
  /** Το πιστοποιητικό γράφει πηγή χωρίς επίσημη τιμή καταναλωτή. */
  | { readonly kind: 'unpriced'; readonly sources: readonly CertificateEnergySource[] }
  /** Ο πίνακας τιμών λείπει για μια πηγή ή πάλιωσε. */
  | { readonly kind: 'stale-prices' }
  | EnergyCostEstimate;

/** Τα εξάμηνα μιας πηγής, **μόνο αν ο πίνακας είναι ακόμη φρέσκος** για `today`. */
function freshPeriodsOf(
  source: CertificateEnergySource,
  prices: EnergyReferencePrices,
  today: string,
): readonly ReferencePricePeriod[] | null {
  const periods = prices.sources[source]?.periods ?? [];
  const newest = periods[periods.length - 1];
  if (newest === undefined) return null;
  const limit = staleAfter(newest.period);
  return limit !== null && today <= limit ? periods : null;
}

function roundToTen(amount: number): number {
  return Math.round(amount / 10) * 10;
}

interface PricedLine extends EnergyCostLine {
  readonly periods: readonly ReferencePricePeriod[];
}

function estimateOf(lines: readonly EnergyCostLine[], priced: readonly PricedLine[], heating: boolean): EnergyCostEstimate {
  const rates = (line: PricedLine): number[] => line.periods.map((period) => period.eurPerKwh);
  const low = priced.reduce((sum, line) => sum + line.kwhPerYear * Math.min(...rates(line)), 0);
  const high = priced.reduce((sum, line) => sum + line.kwhPerYear * Math.max(...rates(line)), 0);
  const spans = priced.flatMap((line) => line.periods.map((period) => period.period)).sort();
  return {
    kind: 'estimated',
    low: roundToTen(low),
    high: roundToTen(high),
    pricesFrom: spans[0],
    pricesTo: spans[spans.length - 1],
    lines,
    heatingInCommonCharges: heating,
  };
}

/**
 * **Η μία απάντηση** στο «πόσο κοστίζει τον χρόνο η ενέργεια αυτού του ακινήτου, σε τυπική χρήση;».
 *
 * @param today `YYYY-MM-DD` — δίνεται από τον καλούντα, ώστε η παλαίωση των τιμών να ελέγχεται σε test
 */
export function listingEnergyCost(
  listing: EnergyCostSubject,
  prices: EnergyReferencePrices,
  today: string,
): ListingEnergyCost {
  const certificate = listing.energyCertificate;
  if (certificate === null || listing.energyClass === null) return { kind: 'hidden' };
  const { usefulArea, finalEnergy } = certificate;
  if (usefulArea === null || finalEnergy === null) return { kind: 'undeclared' };

  const unpriced = finalEnergy.filter((line) => ENERGY_SOURCE_PRICING[line.source] === 'unpriced');
  if (unpriced.length > 0) return { kind: 'unpriced', sources: unpriced.map((line) => line.source) };

  const lines = finalEnergy.map((line) => ({ source: line.source, kwhPerYear: line.perSqm * usefulArea }));
  const priced: PricedLine[] = [];
  for (const line of lines.filter((entry) => ENERGY_SOURCE_PRICING[entry.source] === 'priced')) {
    const periods = freshPeriodsOf(line.source, prices, today);
    if (periods === null) return { kind: 'stale-prices' };
    priced.push({ ...line, periods });
  }
  // Μόνο ενέργεια περιβάλλοντος (ηλιακή · γεωθερμία) χωρίς ούτε μία αγοραζόμενη πηγή: το πιστοποιητικό γράφει πάντα
  // ρεύμα για κυκλοφορητές και αντλίες — πίνακας χωρίς αυτό είναι μισοαντιγραμμένος, και «0 €» θα ήταν ψέμα.
  if (priced.length === 0) return { kind: 'undeclared' };

  return estimateOf(lines, priced, listing.commonCharges?.includes?.includes('heating') ?? false);
}
