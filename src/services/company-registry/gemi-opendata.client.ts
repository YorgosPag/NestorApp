/**
 * @fileoverview SSoT — **πώς μιλάμε στο ΓΕΜΗ**. Μία πόρτα, ετυμηγορία που λέει τι έμαθε.
 * @related ADR-841 §7 Α23 · types/company-registry.ts · lib/cache/verdict-cache.ts
 * @module services/company-registry/gemi-opendata.client
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΠΗΓΗ — ΕΠΑΛΗΘΕΥΜΕΝΗ ΖΩΝΤΑΝΑ, ΟΧΙ ΑΠΟ ΜΝΗΜΗΣ (2026-09-14)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `GET https://opendata-api.businessportal.gr/api/opendata/v1/companies/{arGemi}` με κεφαλίδα
 * **`api_key`**· χωρίς κλειδί απαντά `401 {"message":"No API key found in request"}`. Κλειδί με
 * αίτηση στο `opendata.businessportal.gr/register`. Άδεια δεδομένων **ODC-BY-1.0** (απαιτεί
 * αναφορά πηγής — η οθόνη γράφει «ΓΕΜΗ»).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΚΑΘΕ ΚΛΗΣΗ = ΜΙΑ ΑΝΘΡΩΠΙΝΗ ΠΡΑΞΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Καλείται όταν ο επαγγελματίας πατά «Επαλήθευση» ή δημοσιεύει βιτρίνα (Α1.6: *η πράξη
 * κατέχει τη συνέπεια*). ⛔ **ΜΗΝ** γράψεις εδώ βρόχο σάρωσης, cron ή προθέρμανση: τα όρια
 * κλήσεων του κλειδιού παραγωγής **δεν** επαληθεύτηκαν, και μαζική άντληση δεδομένων ατομικών
 * επιχειρήσεων θα ήταν επεξεργασία χωρίς τη νομική βάση που γράφτηκε (6(1)(στ), ανά πράξη).
 *
 * | Απάντηση | Ετυμηγορία | Μνήμη |
 * |---|---|---|
 * | 200 + σώμα που περνά τον φρουρό | `found` | 5′ |
 * | 404 · 400 (ο αριθμός είναι ήδη έγκυρα ψηφία ⇒ «δεν τον δέχεται») | `absent` | 2′ |
 * | αριθμός που δεν είναι αριθμός ΓΕΜΗ | `invalid-number` — **καμία κλήση** | — |
 * | 401/403 · 429 · 5xx · δίκτυο · σώμα άκυρο · χωρίς κλειδί | `unavailable` + λόγος | ❌ ποτέ |
 *
 * 🔑 **Σύντομες διάρκειες, επίτηδες**: ο άνθρωπος που μόλις διόρθωσε κάτι στο ΓΕΜΗ και ξαναπατά
 * «Επαλήθευση» περιμένει **φρέσκια** απάντηση. Η μνήμη εδώ υπάρχει για το διπλό κλικ, όχι για
 * εξοικονόμηση.
 *
 * **Layering**: διακομιστής — `fetch` + μνήμη διεργασίας. Καμία εξάρτηση από Firestore.
 */

import 'server-only';

import { apiCache } from '@/lib/cache/enterprise-api-cache';
import { createVerdictCache } from '@/lib/cache/verdict-cache';
import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { readConfiguredValue, type EnvironmentSource } from '@/lib/environment/environment-audit';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type { RegistryLookupVerdict, RegistryUnavailableReason } from '@/types/company-registry';

import { parseGemiCompany, parseGemiStatusCatalog, type StatusCatalog } from './gemi-opendata-parse';

const logger = createModuleLogger('gemi-opendata.client');

/** Δηλωμένο στο `config/environment-contract.ts` — το literal εδώ το ελέγχει η άγκυρα Σ2. */
const API_KEY_ENV = 'GEMI_OPENDATA_API_KEY';

const BASE_URL =
  process.env.GEMI_OPENDATA_BASE_URL || 'https://opendata-api.businessportal.gr/api/opendata/v1';
const TIMEOUT_MS = Number.parseInt(process.env.GEMI_OPENDATA_TIMEOUT_MS || '8000', 10);

/**
 * Endpoint του **HTTP API του ΓΕΜΗ** — ονομασμένο, όχι inline πρότυπο: το `/companies/${…}` είναι
 * σχήμα διαδρομής Storage για το SSoT ratchet (`storage-path-construction`), και εδώ δεν είναι.
 */
const COMPANY_ENDPOINT = '/companies';

const CACHE_PREFIX = 'gemi-registry:v1';
const COMPANY_FOUND_TTL_MS = 5 * 60_000;
const COMPANY_ABSENT_TTL_MS = 2 * 60_000;
/** Ο κατάλογος καταστάσεων αλλάζει σπάνια — και αποτυχία του δεν χαλά τίποτα (⇒ `unknown`). */
const STATUS_CATALOG_KEY = `${CACHE_PREFIX}|status-catalog`;
const STATUS_CATALOG_TTL_MS = 24 * 60 * 60_000;

/** Ό,τι χρειάζεται μια κλήση από τον έξω κόσμο — εγχεόμενο, ώστε οι άγκυρες να μην αγγίζουν δίκτυο. */
export interface RegistryTransport {
  readonly fetchImpl: typeof fetch;
  readonly env: EnvironmentSource;
}

const LIVE_TRANSPORT: RegistryTransport = {
  fetchImpl: (input, init) => fetch(input, init),
  env: process.env,
};

type Fetched =
  | { readonly kind: 'ok'; readonly body: unknown }
  | { readonly kind: 'status'; readonly status: number }
  | { readonly kind: 'network' };

const companyCache = createVerdictCache<RegistryLookupVerdict>({
  prefix: CACHE_PREFIX,
  ttlFor: (verdict) => {
    if (verdict.kind === 'found') return COMPANY_FOUND_TTL_MS;
    if (verdict.kind === 'absent') return COMPANY_ABSENT_TTL_MS;
    return null;
  },
  onUnstored: (key) => logger.info('ΓΕΜΗ: «δεν μάθαμε» — δεν αποθηκεύεται', { data: { key } }),
});

async function getJson(path: string, apiKey: string, transport: RegistryTransport): Promise<Fetched> {
  try {
    const response = await transport.fetchImpl(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: { api_key: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { kind: 'status', status: response.status };
    // Σώμα που δεν είναι JSON ⇒ `undefined` ⇒ ο φρουρός το λέει «άκυρο», όχι «δίκτυο».
    const body: unknown = await response.json().catch(() => undefined);
    return { kind: 'ok', body };
  } catch (error) {
    logger.warn('ΓΕΜΗ — δεν απάντησε', { error: getErrorMessage(error) });
    return { kind: 'network' };
  }
}

function unavailableReasonOf(status: number): RegistryUnavailableReason {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return 'rate-limited';
  return 'server';
}

/** Ο κατάλογος καταστάσεων — `null` σε κάθε αποτυχία (η ενεργότητα γίνεται `unknown`, όχι `inactive`). */
async function loadStatusCatalog(apiKey: string, transport: RegistryTransport): Promise<StatusCatalog | null> {
  const cached = apiCache.get<StatusCatalog>(STATUS_CATALOG_KEY);
  if (cached !== null) return cached;
  const fetched = await getJson('/metadata/companyStatuses', apiKey, transport);
  const catalog = fetched.kind === 'ok' ? parseGemiStatusCatalog(fetched.body) : null;
  if (catalog !== null) apiCache.set(STATUS_CATALOG_KEY, catalog, STATUS_CATALOG_TTL_MS);
  return catalog;
}

/**
 * Ρωτά το ΓΕΜΗ **χωρίς μνήμη**. Για κάθε χρήση εκτός αγκυρών: {@link lookupRegistryCompany}.
 */
export async function fetchRegistryCompany(
  registrationNumber: string,
  transport: RegistryTransport = LIVE_TRANSPORT,
): Promise<RegistryLookupVerdict> {
  const canonical = canonicalGemiNumber(registrationNumber);
  if (canonical === null) return { kind: 'invalid-number' };
  const apiKey = readConfiguredValue(transport.env, API_KEY_ENV);
  if (apiKey === null) return { kind: 'unavailable', reason: 'not-configured' };

  const fetched = await getJson(`${COMPANY_ENDPOINT}/${canonical}`, apiKey, transport);
  if (fetched.kind === 'network') return { kind: 'unavailable', reason: 'network' };
  if (fetched.kind === 'status') {
    return fetched.status === 404 || fetched.status === 400
      ? { kind: 'absent' }
      : { kind: 'unavailable', reason: unavailableReasonOf(fetched.status) };
  }

  const record = parseGemiCompany(fetched.body, await loadStatusCatalog(apiKey, transport));
  // 🔴 Απάντηση για ΑΛΛΟΝ αριθμό δεν είναι απάντηση στην ερώτησή μας.
  if (record === null || record.registrationNumber !== canonical) {
    return { kind: 'unavailable', reason: 'malformed-response' };
  }
  return { kind: 'found', record };
}

/** Η **μία** είσοδος: κανονικοποίηση → μνήμη ετυμηγοριών → ερώτηση μόνο αν χρειάζεται. */
export function lookupRegistryCompany(
  registrationNumber: string,
  transport: RegistryTransport = LIVE_TRANSPORT,
): Promise<RegistryLookupVerdict> {
  const canonical = canonicalGemiNumber(registrationNumber);
  if (canonical === null) return Promise.resolve({ kind: 'invalid-number' });
  return companyCache.lookup(`${CACHE_PREFIX}|company|${canonical}`, () =>
    fetchRegistryCompany(canonical, transport),
  );
}

/** Αδειάζει **όλη** τη μνήμη του ΓΕΜΗ (επιχειρήσεις + κατάλογο καταστάσεων) — για απομόνωση αγκυρών. */
export function clearRegistryCaches(): number {
  return companyCache.clear();
}
