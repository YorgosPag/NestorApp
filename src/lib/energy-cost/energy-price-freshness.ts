/**
 * @fileoverview **Η φρεσκάδα των τιμών αναφοράς ενέργειας** (ADR-777 §8.95.10) — πόσο απέχει η ημέρα που θα σβήσει
 * η εκτίμηση κόστους στην παραγωγή.
 * @related `./energy-reference-prices.ts` (`staleAfter` — ΤΟ ένα σημείο του «πότε λήγει») ·
 *   `./listing-energy-cost.ts` (σβήνει την εκτίμηση εκείνη την ημέρα) ·
 *   `scripts/check-energy-price-freshness.ts` (ο CLI του CI) · `.github/workflows/energy-prices-refresh.yml`
 * @module lib/energy-cost/energy-price-freshness
 *
 * 🔑 **Η ΕΡΩΤΗΣΗ ΔΕΝ ΕΙΝΑΙ «ΠΟΣΟ ΠΑΛΙΑ ΕΙΝΑΙ», ΕΙΝΑΙ «ΠΟΣΟ ΜΑΣ ΜΕΝΕΙ».** Ιδίωμα dbt `source freshness`
 * (`warn_after` / `error_after`, όπως η πύλη Ε8 του ADR-889 §11) — με μία διαφορά: τα όρια δεν μετρούν ηλικία από
 * αριθμό που διάλεξε κάποιος, μετρούν **ημέρες μέχρι τη λήξη**, και η λήξη έρχεται από το `staleAfter`, δηλαδή από
 * την ΙΔΙΑ συνάρτηση που σβήνει την εκτίμηση. Αν αλλάξει το `REFERENCE_PRICE_MAX_AGE_MONTHS`, η πύλη ακολουθεί μόνη.
 *
 * ⚠️ **ΓΙΑΤΙ 180 / 90 ΗΜΕΡΕΣ.** Η Eurostat δημοσιεύει κάθε εξάμηνο ~4–5 μήνες μετά το τέλος του, άρα σε υγιή ροή
 * το νεότερο εξάμηνο είναι το πολύ ~11 μηνών και μένουν ≥ 7 μήνες ως τη λήξη: **καμία ⚠️ όταν όλα δουλεύουν**.
 * Το ⚠️ σημαίνει «χάθηκε μία δημοσίευση»· το ❌ αφήνει **τρεις μήνες** σε άνθρωπο πριν αδειάσει οθόνη στην παραγωγή.
 */

import { daysBetweenDateKeys } from '@/lib/calendar/date-key';
import type { CertificateEnergySource } from '@/constants/certificate-energy-sources';

import { ENERGY_SOURCE_PRICING, staleAfter, type EnergyReferencePrices } from './energy-reference-prices';

/** Λιγότερες ημέρες ως τη λήξη ⇒ ⚠️. */
export const FRESHNESS_WARN_DAYS_LEFT = 180;
/** Λιγότερες ημέρες ως τη λήξη ⇒ ❌ (κόκκινο CI). */
export const FRESHNESS_ERROR_DAYS_LEFT = 90;

export type FreshnessLevel = 'ok' | 'warn' | 'error';

export interface SourceFreshness {
  readonly source: CertificateEnergySource;
  /** Το νεότερο εξάμηνο του πίνακα· `null` όταν η πηγή λείπει ή είναι άδεια. */
  readonly newest: string | null;
  /** Η τελευταία ημέρα που η εκτίμηση βγαίνει· `null` όταν δεν μπορεί να υπολογιστεί. */
  readonly expiresOn: string | null;
  /** Ημέρες από `today` ως `expiresOn` (αρνητικό = ήδη ληγμένο)· `null` όταν δεν μπορεί να υπολογιστεί. */
  readonly daysLeft: number | null;
  readonly level: FreshnessLevel;
}

function levelOf(daysLeft: number | null): FreshnessLevel {
  // Ό,τι δεν μετριέται είναι ❌ — ποτέ σιωπηλό «περνά» (ίδιο δόγμα με την Ε8).
  if (daysLeft === null || daysLeft <= FRESHNESS_ERROR_DAYS_LEFT) return 'error';
  return daysLeft <= FRESHNESS_WARN_DAYS_LEFT ? 'warn' : 'ok';
}

/** Μία πηγή `priced`: νεότερο εξάμηνο → λήξη → ημέρες που μένουν. */
function sourceFreshness(
  source: CertificateEnergySource,
  prices: EnergyReferencePrices,
  today: string,
): SourceFreshness {
  const periods = prices.sources[source]?.periods ?? [];
  const newest = periods.length > 0 ? periods[periods.length - 1].period : null;
  const expiresOn = newest === null ? null : staleAfter(newest);
  const daysLeft = expiresOn === null ? null : daysBetweenDateKeys(today, expiresOn);
  return { source, newest, expiresOn, daysLeft, level: levelOf(daysLeft) };
}

/**
 * Η φρεσκάδα **κάθε** πηγής `priced` — και όσων λείπουν από τον πίνακα: μια πηγή που δεν γράφτηκε σημαίνει ότι κάθε
 * πιστοποιητικό με αυτήν χάνει την εκτίμηση, άρα είναι ❌, όχι «δεν αφορά».
 *
 * @param today `YYYY-MM-DD` (UTC)
 */
export function energyPriceFreshness(prices: EnergyReferencePrices, today: string): readonly SourceFreshness[] {
  return (Object.keys(ENERGY_SOURCE_PRICING) as CertificateEnergySource[])
    .filter((source) => ENERGY_SOURCE_PRICING[source] === 'priced')
    .map((source) => sourceFreshness(source, prices, today));
}

/** Η χειρότερη στάθμη — αυτή κρίνει το CI. */
export function worstFreshnessLevel(rows: readonly SourceFreshness[]): FreshnessLevel {
  if (rows.some((row) => row.level === 'error')) return 'error';
  return rows.some((row) => row.level === 'warn') ? 'warn' : 'ok';
}
