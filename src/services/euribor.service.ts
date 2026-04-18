/**
 * =============================================================================
 * Euribor Service — ECB Rate Fetching & Bank Spread Management
 * =============================================================================
 *
 * Server-side only. Fetches Euribor rates from ECB SDMX-JSON API,
 * caches in Firestore settings/euribor_rates (24h TTL).
 * Manages bank spread configuration in settings/bank_spreads.
 *
 * @module services/euribor.service
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  EuriborRatesCache,
  EuriborTenor,
  BankSpreadConfig,
} from '@/types/interest-calculator';
import { DEFAULT_BANK_SPREADS } from '@/types/interest-calculator';
import { nowISO } from '@/lib/date-local';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('EURIBOR_SERVICE');

// =============================================================================
// CONSTANTS
// =============================================================================

/** Cache TTL: 24 hours in milliseconds */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Firestore document paths */
const RATES_DOC_PATH = `${COLLECTIONS.SETTINGS}/euribor_rates`;
const SPREADS_DOC_PATH = `${COLLECTIONS.SETTINGS}/bank_spreads`;

/**
 * ECB SDMX-JSON API mapping: Euribor tenor → ECB series key
 * @see https://data-api.ecb.europa.eu
 */
const ECB_SERIES_KEYS: Record<EuriborTenor | 'ECB_MAIN', string> = {
  '1W':  'EURIBOR1WD',
  '1M':  'EURIBOR1MD',
  '3M':  'EURIBOR3MD',
  '6M':  'EURIBOR6MD',
  '12M': 'EURIBOR1YD',
  ECB_MAIN: 'MRR_FR',
};

/** Base URL for ECB data API */
const ECB_BASE_URL = 'https://data-api.ecb.europa.eu/service/data/FM';

// =============================================================================
// SERVICE
// =============================================================================

export class EuriborService {
  /**
   * Get rates — returns cached if fresh (<24h), otherwise fetches from ECB.
   */
  static async getRates(): Promise<EuriborRatesCache> {
    const cached = await this.getCachedRates();

    if (cached && this.isCacheFresh(cached.lastFetchedAt)) {
      return cached;
    }

    // Cache stale or missing — try ECB
    try {
      const fresh = await this.fetchFromECB();
      await this.saveCachedRates(fresh);
      return fresh;
    } catch (err) {
      logger.warn('ECB fetch failed, using cached/fallback', { error: String(err) });

      // Return stale cache if available
      if (cached) return cached;

      // Ultimate fallback: return zeros with source=fallback
      return this.getFallbackRates();
    }
  }

  /**
   * Force refresh rates from ECB API.
   */
  static async refreshRates(): Promise<EuriborRatesCache> {
    const fresh = await this.fetchFromECB();
    await this.saveCachedRates(fresh);
    return fresh;
  }

  /**
   * Get bank spread configuration.
   */
  static async getBankSpreads(): Promise<BankSpreadConfig> {
    try {
      const db = getAdminFirestore();
      const doc = await db.doc(SPREADS_DOC_PATH).get();

      if (!doc.exists) {
        return DEFAULT_BANK_SPREADS;
      }

      const data = doc.data() as BankSpreadConfig;
      return {
        banks: data.banks ?? DEFAULT_BANK_SPREADS.banks,
        defaultSpread: data.defaultSpread ?? DEFAULT_BANK_SPREADS.defaultSpread,
      };
    } catch (err) {
      logger.error('Failed to read bank spreads', { error: String(err) });
      return DEFAULT_BANK_SPREADS;
    }
  }

  /**
   * Update bank spread configuration.
   */
  static async updateBankSpreads(
    config: BankSpreadConfig,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getAdminFirestore();
      await db.doc(SPREADS_DOC_PATH).set({
        banks: config.banks,
        defaultSpread: config.defaultSpread,
        updatedAt: nowISO(),
        updatedBy: userId,
      }, { merge: true });

      return { success: true };
    } catch (err) {
      logger.error('Failed to update bank spreads', { error: String(err) });
      return { success: false, error: 'Failed to update bank spreads' };
    }
  }

  /**
   * Resolve effective discount rate from Euribor + bank spread.
   */
  static resolveDiscountRate(
    rates: EuriborRatesCache,
    source: string,
    bankSpread: number,
    manualRate?: number
  ): number {
    if (source === 'manual' && manualRate !== undefined) {
      return manualRate;
    }

    let baseRate: number;
    switch (source) {
      case 'euribor_1M':
        baseRate = rates.euribor1M;
        break;
      case 'euribor_3M':
        baseRate = rates.euribor3M;
        break;
      case 'euribor_6M':
        baseRate = rates.euribor6M;
        break;
      case 'euribor_12M':
        baseRate = rates.euribor12M;
        break;
      case 'ecb_main':
        baseRate = rates.ecbMainRate;
        break;
      default:
        baseRate = rates.euribor3M;
    }

    return Math.round((baseRate + bankSpread) * 100) / 100;
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private static async fetchFromECB(): Promise<EuriborRatesCache> {
    logger.info('Fetching rates from ECB SDMX API...');

    const headers = {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
    };

    // Fetch all 6 rates in parallel
    const keys: Array<[string, EuriborTenor | 'ECB_MAIN']> = [
      ['1W', '1W'],
      ['1M', '1M'],
      ['3M', '3M'],
      ['6M', '6M'],
      ['12M', '12M'],
      ['ECB_MAIN', 'ECB_MAIN'],
    ];

    const results = await Promise.allSettled(
      keys.map(async ([, tenor]) => {
        const seriesKey = ECB_SERIES_KEYS[tenor];
        const flowRef = tenor === 'ECB_MAIN'
          ? `B.U2.EUR.4F.KR.${seriesKey}.LEV`
          : `B.U2.EUR.RT.MM.${seriesKey}.HSTA`;
        const url = `${ECB_BASE_URL}/${flowRef}?lastNObservations=1`;

        const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          throw new Error(`ECB API ${tenor}: HTTP ${response.status}`);
        }

        const json = await response.json() as EcbSdmxResponse;
        return { tenor, value: extractRateFromSdmx(json) };
      })
    );

    const rates: Record<string, number> = {};
    let rateDate = nowISO().split('T')[0];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        rates[r.value.tenor] = r.value.value;
      } else {
        logger.warn('Failed to fetch one rate', { reason: String(r.reason) });
      }
    }

    return {
      euribor1W: rates['1W'] ?? 0,
      euribor1M: rates['1M'] ?? 0,
      euribor3M: rates['3M'] ?? 0,
      euribor6M: rates['6M'] ?? 0,
      euribor12M: rates['12M'] ?? 0,
      ecbMainRate: rates['ECB_MAIN'] ?? 0,
      rateDate,
      lastFetchedAt: nowISO(),
      source: 'ecb_api',
    };
  }

  private static async getCachedRates(): Promise<EuriborRatesCache | null> {
    try {
      const db = getAdminFirestore();
      const doc = await db.doc(RATES_DOC_PATH).get();
      if (!doc.exists) return null;
      return doc.data() as EuriborRatesCache;
    } catch {
      return null;
    }
  }

  private static async saveCachedRates(rates: EuriborRatesCache): Promise<void> {
    try {
      const db = getAdminFirestore();
      await db.doc(RATES_DOC_PATH).set(rates);
      logger.info('Rates cached in Firestore');
    } catch (err) {
      logger.error('Failed to cache rates', { error: String(err) });
    }
  }

  private static isCacheFresh(lastFetchedAt: string): boolean {
    const fetchedMs = new Date(lastFetchedAt).getTime();
    return Date.now() - fetchedMs < CACHE_TTL_MS;
  }

  private static getFallbackRates(): EuriborRatesCache {
    return {
      euribor1W: 0,
      euribor1M: 0,
      euribor3M: 0,
      euribor6M: 0,
      euribor12M: 0,
      ecbMainRate: 0,
      rateDate: nowISO().split('T')[0],
      lastFetchedAt: nowISO(),
      source: 'fallback',
    };
  }
}

// =============================================================================
// ECB SDMX-JSON PARSING
// =============================================================================

/** Minimal SDMX-JSON structure for type safety */
interface EcbSdmxResponse {
  dataSets?: Array<{
    series?: Record<string, {
      observations?: Record<string, [number]>;
    }>;
  }>;
}

/**
 * Extract the latest rate value from ECB SDMX-JSON response.
 */
function extractRateFromSdmx(json: EcbSdmxResponse): number {
  const dataSets = json.dataSets;
  if (!dataSets || dataSets.length === 0) return 0;

  const series = dataSets[0].series;
  if (!series) return 0;

  // Get first (and only) series
  const seriesKeys = Object.keys(series);
  if (seriesKeys.length === 0) return 0;

  const observations = series[seriesKeys[0]].observations;
  if (!observations) return 0;

  // Get last observation
  const obsKeys = Object.keys(observations);
  if (obsKeys.length === 0) return 0;

  const lastObs = observations[obsKeys[obsKeys.length - 1]];
  return lastObs[0] ?? 0;
}
