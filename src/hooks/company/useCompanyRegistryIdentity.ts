'use client';

/**
 * @fileoverview **Η ΝΟΜΙΚΗ ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΟΡΓΑΝΙΣΜΟΥ, ΑΠΕΝΑΝΤΙ ΣΤΟ ΓΕΜΗ** — ανάγνωση + δύο πράξεις.
 * @related ADR-841 §7 Α23 · app/api/companies/registry-verification/route.ts ·
 *   app/api/companies/registry-verification/legal-name/route.ts
 * @module hooks/company/useCompanyRegistryIdentity
 *
 * 🔑 **Ένας καταναλωτής των διαδρομών, πολλές οθόνες**: η δήλωση μεσιτείας διαβάζει από εδώ τον
 * αριθμό ΓΕΜΗ του προφίλ (δεν τον ξαναρωτά), η βιτρίνα την κρίση «επαληθευμένη;».
 *
 * ⚠️ **Τέσσερις καταστάσεις, ποτέ `null`**: `forbidden` (δεν είσαι διαχειριστής) ≠ `unavailable`
 * (δεν απάντησε) ≠ `loading`. Ένα «δεν έχει αριθμό ΓΕΜΗ» σε διακοπή δικτύου θα έστελνε τον
 * άνθρωπο να ξαναγράψει κάτι που το σύστημα **ήδη** κρατά.
 *
 * ⚠️ **Η παλιά κρίση ΜΕΝΕΙ ορατή όσο και αν η φρέσκια ερώτηση αποτύχει**: ο άνθρωπος δεν χάνει
 * την ημερομηνία του προηγούμενου ελέγχου επειδή το ΓΕΜΗ δεν απάντησε τώρα.
 *
 * 🔑 **«Υιοθέτηση επωνυμίας ΓΕΜΗ»** (Φ3.2 Γ): στέλνει **ό,τι είδε** ο άνθρωπος (`expectedLegalName`).
 * Σε 409/422 ο διακομιστής επιστρέφει τη **νέα** αναφορά — η οθόνη δείχνει αμέσως τη φρέσκια
 * προεπισκόπηση, και το `adoption` λέει **γιατί** (AIP-154: `ABORTED` ⇒ ξαναδιάβασε, ξαναπροσπάθησε).
 *
 * 🔒 Μία πράξη τη φορά ανά κουμπί (`useInFlightAction`, ADR-332 D27 Ζ5): δεύτερο πάτημα όσο τρέχει
 * **αγνοείται** — ποτέ δύο αιτήματα για την ίδια πρόθεση.
 */

import { useCallback, useEffect, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { useInFlightAction } from '@/hooks/useInFlightAction';
import { createModuleLogger } from '@/lib/telemetry';
import type { RegistryIdentityReport } from '@/types/company-registry';

const logger = createModuleLogger('useCompanyRegistryIdentity');

const ENDPOINT = API_ROUTES.COMPANIES.REGISTRY_VERIFICATION;
const LEGAL_NAME_ENDPOINT = API_ROUTES.COMPANIES.REGISTRY_LEGAL_NAME;

export type CompanyRegistryIdentityState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly report: RegistryIdentityReport }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'unavailable' };

/** Η έκβαση της **τελευταίας** υιοθέτησης — `none` πριν από κάθε πράξη ή μετά από νέα επαλήθευση. */
export type LegalNameAdoptionFeedback = 'none' | 'adopted' | 'registry-changed' | 'not-adoptable' | 'failed';

export interface CompanyRegistryIdentity {
  readonly state: CompanyRegistryIdentityState;
  readonly verifying: boolean;
  /** «Επαλήθευση από ΓΕΜΗ» — η **μόνη** πράξη που ρωτά το μητρώο. */
  readonly verify: () => Promise<void>;
  readonly adopting: boolean;
  readonly adoption: LegalNameAdoptionFeedback;
  /** «Υιοθέτηση επωνυμίας ΓΕΜΗ» — `expectedLegalName` = η επωνυμία της προεπισκόπησης, αυτούσια. */
  readonly adoptLegalName: (expectedLegalName: string) => Promise<void>;
}

interface Settled {
  readonly state: CompanyRegistryIdentityState;
  readonly adoption: LegalNameAdoptionFeedback;
}

const UNAVAILABLE: CompanyRegistryIdentityState = { kind: 'unavailable' };
const FORBIDDEN: CompanyRegistryIdentityState = { kind: 'forbidden' };

/** Κωδικός απάντησης υιοθέτησης ⇒ έκβαση. Ό,τι λείπει ⇒ `failed`. */
const ADOPTION_BY_STATUS: Readonly<Record<number, LegalNameAdoptionFeedback>> = {
  200: 'adopted',
  409: 'registry-changed',
  422: 'not-adoptable',
};

/** Η αναφορά του σώματος — και στις ονομασμένες αρνήσεις, που τη φέρνουν κι αυτές. */
async function reportIn(response: Response): Promise<RegistryIdentityReport | null> {
  const body = (await response.json().catch(() => null)) as { data?: RegistryIdentityReport } | null;
  return body?.data ?? null;
}

function isForbidden(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

async function stateOf(response: Response): Promise<CompanyRegistryIdentityState> {
  if (isForbidden(response)) return FORBIDDEN;
  if (!response.ok) return UNAVAILABLE;
  const report = await reportIn(response);
  return report ? { kind: 'ready', report } : UNAVAILABLE;
}

function logFailure(message: string, error: unknown): void {
  logger.error(message, { error: error instanceof Error ? error.message : String(error) });
}

async function requestReport(method: 'GET' | 'POST'): Promise<CompanyRegistryIdentityState> {
  try {
    return await stateOf(await fetch(ENDPOINT, { method }));
  } catch (error) {
    logFailure('Η νομική ταυτότητα δεν διαβάστηκε', error);
    return UNAVAILABLE;
  }
}

async function settleAdoption(response: Response): Promise<Settled> {
  if (isForbidden(response)) return { state: FORBIDDEN, adoption: 'failed' };
  const outcome = ADOPTION_BY_STATUS[response.status];
  const report = outcome ? await reportIn(response) : null;
  if (!outcome || !report) return { state: UNAVAILABLE, adoption: 'failed' };
  return { state: { kind: 'ready', report }, adoption: outcome };
}

async function requestAdoption(expectedLegalName: string): Promise<Settled> {
  try {
    const response = await fetch(LEGAL_NAME_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedLegalName }),
    });
    return await settleAdoption(response);
  } catch (error) {
    logFailure('Η υιοθέτηση επωνυμίας δεν ολοκληρώθηκε', error);
    return { state: UNAVAILABLE, adoption: 'failed' };
  }
}

/** Νέα αναφορά κερδίζει· αποτυχία **δεν** σβήνει την τελευταία γνωστή κρίση. */
function keepLastKnown(previous: CompanyRegistryIdentityState, next: CompanyRegistryIdentityState) {
  return next.kind === 'ready' || previous.kind !== 'ready' ? next : previous;
}

export function useCompanyRegistryIdentity(): CompanyRegistryIdentity {
  const [state, setState] = useState<CompanyRegistryIdentityState>({ kind: 'loading' });
  const [adoption, setAdoption] = useState<LegalNameAdoptionFeedback>('none');
  const { isRunning: verifying, run: runVerify } = useInFlightAction();
  const { isRunning: adopting, run: runAdoption } = useInFlightAction();

  useEffect(() => {
    let active = true;
    void requestReport('GET').then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const verify = useCallback(
    () =>
      runVerify(async () => {
        setAdoption('none');
        const next = await requestReport('POST');
        setState((previous) => keepLastKnown(previous, next));
      }),
    [runVerify],
  );

  const adoptLegalName = useCallback(
    (expectedLegalName: string) =>
      runAdoption(async () => {
        setAdoption('none');
        const settled = await requestAdoption(expectedLegalName);
        setState((previous) => keepLastKnown(previous, settled.state));
        setAdoption(settled.adoption);
      }),
    [runAdoption],
  );

  return { state, verifying, verify, adopting, adoption, adoptLegalName };
}
