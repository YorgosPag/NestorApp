/**
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΣΤΟ ΜΗΤΡΩΟ ΕΝΕΡΓΕΙΑΚΩΝ ΕΠΙΘΕΩΡΗΤΩΝ** (buildingcert.gr) — ADR-915 §40.7 Φ2.
 * @related services/professional-registry/buildingcert-parse.ts (η σελίδα ⇒ ετυμηγορία) ·
 *   services/company-registry/gemi-opendata.client.ts (το πρότυπο: εγχεόμενο transport, ονομασμένη αποτυχία)
 * @module services/professional-registry/buildingcert.client
 *
 * 🔑 **Η ΔΗΜΟΣΙΑ αναζήτηση** (ΥΠΕΝ/ΣΕΝΕ/17806/1085 άρθ. 3 παρ. 5) — η ίδια φόρμα που πατά ο πολίτης στο
 *    `startValues.view`, χωρίς σύνδεση, χωρίς captcha. **Ένα** αίτημα ανά πάτημα ανθρώπου· ποτέ μαζικά, ποτέ cron.
 * ⛔ **Πίσω από τον διακόπτη** `ENERGY_INSPECTOR_REGISTRY_LOOKUP` (κλειστός μέχρι την απάντηση του helpdesk της ΕΥΕΠΕΝ):
 *    κλειστός ⇒ **καμία** κλήση δικτύου.
 * 🔒 Κανένα στοιχείο χρήστη ή οργανισμού στο αίτημα: μόνο ο αριθμός μητρώου (που είναι ήδη δημόσιος) και ουδέτερος
 *    User-Agent.
 * **Layering**: διακομιστής — `fetch`, καμία εξάρτηση από Firestore.
 */

import 'server-only';

import { isAppFeatureEnabled } from '@/config/feature-flags';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type { RegistryLookupVerdict } from '@/types/professional-registry-check';

import { parseBuildingcertResults } from './buildingcert-parse';

const logger = createModuleLogger('buildingcert.client');

/** Ο προορισμός της δημόσιας φόρμας «Αναζήτηση με προσωπικά στοιχεία» (επαληθευμένο 2026-11-14/15). */
const SEARCH_URL = 'https://www.buildingcert.gr/inspectors/searchRequests.view?search=inspector&pid=0';
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; registry-lookup/1.0)';
/** Ο αριθμός μητρώου είναι ψηφία — οτιδήποτε άλλο δεν στέλνεται καν. */
const REGISTRY_NUMBER = /^\d{1,10}$/u;

export interface BuildingcertTransport {
  readonly fetchImpl: typeof fetch;
  readonly enabled: () => boolean;
}

const LIVE_TRANSPORT: BuildingcertTransport = {
  fetchImpl: (input, init) => fetch(input, init),
  enabled: () => isAppFeatureEnabled('ENERGY_INSPECTOR_REGISTRY_LOOKUP'),
};

/** Ανοιχτός ο αυτόματος έλεγχος; — τη ρωτά και η οθόνη (μέσω της αναφοράς), ώστε να μη δείχνει κουμπί που δεν κάνει τίποτα. */
export function isBuildingcertLookupEnabled(transport: BuildingcertTransport = LIVE_TRANSPORT): boolean {
  return transport.enabled();
}

/** Τα πεδία της φόρμας «Αναζήτηση με προσωπικά στοιχεία», όπως τα στέλνει ο browser του πολίτη. */
function formBody(number: string): URLSearchParams {
  return new URLSearchParams({
    from: 'searchRequests',
    from2: 'searchRequests',
    search_ministry_code: number,
    search_last_name: '',
    type_str: '0',
  });
}

/**
 * **Ρώτα το μητρώο για έναν αριθμό.** Αριθμός που δεν είναι ψηφία ⇒ `absent` χωρίς κλήση (τέτοιος αριθμός δεν υπάρχει
 * στο μητρώο). Κάθε αποτυχία δικτύου ή σελίδας είναι **ονομασμένη**.
 */
export async function lookupEnergyInspector(
  registrationNumber: string,
  transport: BuildingcertTransport = LIVE_TRANSPORT,
): Promise<RegistryLookupVerdict> {
  if (!transport.enabled()) return { kind: 'unavailable', reason: 'disabled' };
  const number = registrationNumber.trim();
  if (!REGISTRY_NUMBER.test(number)) return { kind: 'absent' };
  try {
    const response = await transport.fetchImpl(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT, Accept: 'text/html' },
      body: formBody(number).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) {
      logger.warn('Μητρώο ενεργειακών επιθεωρητών — σφάλμα απάντησης', { data: { status: response.status } });
      return { kind: 'unavailable', reason: 'server' };
    }
    const verdict = parseBuildingcertResults(await response.text(), number);
    if (verdict.kind === 'layout-changed') logger.error('Μητρώο ενεργειακών επιθεωρητών — άγνωστη μορφή σελίδας', { data: { detail: verdict.detail } });
    return verdict;
  } catch (error) {
    logger.warn('Μητρώο ενεργειακών επιθεωρητών — δεν απάντησε', { error: getErrorMessage(error) });
    return { kind: 'unavailable', reason: 'network' };
  }
}
