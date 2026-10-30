/**
 * @fileoverview **Οι τιμές αναφοράς ενέργειας** (ADR-777 §8.95) — ποια πηγή του ΠΕΑ έχει επίσημη τιμή καταναλωτή,
 * και ο πίνακας των τελευταίων εξαμήνων.
 * @related `./energy-reference-prices.json` (**παραγόμενο** — `npm run energy-prices:refresh`) ·
 *   `scripts/generate-energy-reference-prices.js` (οι πηγές, με όνομα) · `./listing-energy-cost.ts` (ο υπολογισμός)
 * @module lib/energy-cost/energy-reference-prices
 *
 * 🔑 **Καμία τιμή χωρίς περίοδο και προέλευση.** Ο πίνακας γράφεται **μόνο** από τον γεννήτορα, από την Eurostat
 * (ρεύμα · φυσικό αέριο) και το Weekly Oil Bulletin της Επιτροπής (πετρέλαιο θέρμανσης). Χειρόγραφος αριθμός εδώ θα
 * ήταν ακριβώς ο ισχυρισμός χωρίς πηγή που το έργο κυνηγά.
 *
 * 🔑 **Τρεις κατηγορίες πηγών, δηλωμένες — όχι συμπερασμένες από το «υπάρχει τιμή;»**
 *
 * | Κατηγορία | Πηγές | Γιατί |
 * |---|---|---|
 * | `priced` | ηλεκτρική · πετρέλαιο · φυσικό αέριο | επίσημη σειρά τιμών καταναλωτή, με φόρους |
 * | `free` | ηλιακή · γεωθερμία | ενέργεια περιβάλλοντος: δεν αγοράζεται. Το ρεύμα της αντλίας ή του κυκλοφορητή το γράφει το ΠΕΑ στη γραμμή «Ηλεκτρική» |
 * | `unpriced` | άλλα ορυκτά · βιομάζα · άλλη ΑΠΕ | **καμία** επίσημη σειρά (ξύλο, πέλετ, υγραέριο αγοράζονται σε τιμές που κανείς δεν δημοσιεύει ενιαία)· και η «άλλη ΑΠΕ» δεν λέει τι είναι |
 *
 * Πιστοποιητικό με γραμμή `unpriced` **δεν παίρνει εκτίμηση**: ένα ποσό που παραλείπει το καύσιμο της θέρμανσης θα
 * ήταν χαμηλότερο από την αλήθεια, με τη σφραγίδα της αγγελίας.
 */

import type { CertificateEnergySource } from '@/constants/certificate-energy-sources';
// Σχετικές διαδρομές επίτηδες: το αρχείο το φορτώνει το `scripts/check-energy-price-freshness.ts` (ίδιο δόγμα με το `calendar-day`).
import { daysInMonth } from '../date/calendar-arithmetic';
import { isoCalendarDay } from '../date/calendar-day';

import generated from './energy-reference-prices.json';

export type EnergySourcePricing = 'priced' | 'free' | 'unpriced';

export const ENERGY_SOURCE_PRICING: Readonly<Record<CertificateEnergySource, EnergySourcePricing>> = {
  electricity: 'priced',
  oil: 'priced',
  'natural-gas': 'priced',
  'other-fossil': 'unpriced',
  solar: 'free',
  biomass: 'unpriced',
  geothermal: 'free',
  'other-renewable': 'unpriced',
};

/** Εξάμηνο σε μορφή Eurostat: `2026-S1` · `2026-S2`. */
export interface ReferencePricePeriod {
  readonly period: string;
  /** €/kWh τελικής ενέργειας, με όλους τους φόρους και τις χρεώσεις. */
  readonly eurPerKwh: number;
}

export interface EnergyReferencePrices {
  /** Η ημέρα που έτρεξε ο γεννήτορας, `YYYY-MM-DD`. */
  readonly generatedAt: string;
  /** Ανά πηγή, τα εξάμηνα **παλαιότερο πρώτο**. Πηγή `priced` που λείπει εδώ ⇒ καμία εκτίμηση. */
  readonly sources: Readonly<Partial<Record<CertificateEnergySource, { readonly periods: readonly ReferencePricePeriod[] }>>>;
}

/** Ο πίνακας όπως τον έγραψε ο γεννήτορας. */
export const ENERGY_REFERENCE_PRICES: EnergyReferencePrices = generated;

/**
 * Οι δύο εκδότες των τιμών, με σύνδεσμο — η απόδοση που ζητά η πολιτική επαναχρησιμοποίησης της Επιτροπής
 * (απόφαση 2011/833/ΕΕ: ελεύθερη χρήση **με αναφορά της πηγής**). Κύρια ονόματα: δεν μεταφράζονται.
 */
export const ENERGY_PRICE_SOURCES = [
  { name: 'Eurostat', url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table' },
  { name: 'Weekly Oil Bulletin', url: 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en' },
] as const;

/** Πόσους μήνες μετά το τέλος του νεότερου εξαμήνου ο πίνακας θεωρείται παλιός — τρία εξάμηνα. */
export const REFERENCE_PRICE_MAX_AGE_MONTHS = 18;

/**
 * Η τελευταία ημέρα που ένα εξάμηνο μετρά ως φρέσκο: τέλος του εξαμήνου + `REFERENCE_PRICE_MAX_AGE_MONTHS`,
 * `YYYY-MM-DD`. `null` σε εξάμηνο που δεν διαβάζεται.
 *
 * 🔑 **ΕΝΑ σημείο για το «πότε λήγει»**: το διαβάζουν ο υπολογισμός (`listing-energy-cost.ts`, που σβήνει την
 * εκτίμηση) **και** η πύλη φρεσκάδας (`energy-price-freshness.ts`, που προειδοποιεί πριν από αυτό). Δύο αντίγραφα
 * θα μπορούσαν να αποκλίνουν, και τότε η πύλη θα έλεγε «έχεις χρόνο» την ημέρα που η οθόνη έχει ήδη αδειάσει.
 */
export function staleAfter(period: string): string | null {
  const match = /^(\d{4})-S([12])$/.exec(period);
  if (match === null) return null;
  const endMonth = match[2] === '1' ? 6 : 12;
  const months = Number(match[1]) * 12 + endMonth + REFERENCE_PRICE_MAX_AGE_MONTHS;
  const year = Math.floor((months - 1) / 12);
  const month = ((months - 1) % 12) + 1;
  return isoCalendarDay(year, month, daysInMonth(year, month));
}
