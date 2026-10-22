/**
 * @module server/pdf-seal/seal-config.server
 * @description **Η ρύθμιση του παρόχου σφραγίδας** (ADR-918 §5) — ονόματα, όχι τιμές· δηλωμένα στο
 * `config/environment-contract.ts`, που δείχνει **εδώ** ως καταναλωτή.
 *
 * 🔑 **Κανένα κλειδί στο περιβάλλον.** Εδώ ζουν μόνο τα **διαπιστευτήρια πρόσβασης** στην υπηρεσία CSC του παρόχου
 * (OAuth2 `client_credentials`) — το ιδιωτικό κλειδί της σφραγίδας μένει στο HSM/QSCD του QTSP και δεν φεύγει ποτέ.
 * Ανάκληση = ο πάροχος απενεργοποιεί τον client· κανένα αρχείο κλειδιού να «ξεχαστεί» σε δίσκο ή backup.
 *
 * 🔑 **Το «υπάρχει;» το απαντά ΜΟΝΟ το `readConfiguredValue`** (ADR-777 §8.35): κενή ή μόνο-κενά τιμή ⇒ απούσα.
 * Λείπει έστω μία ⇒ `awaiting-seal-configuration` με **τα ονόματα** που λείπουν — ποτέ μισή ρύθμιση που
 * αποτυγχάνει στο δίκτυο με παραπλανητικό μήνυμα.
 */

import 'server-only';

import { readConfiguredValue, type EnvironmentSource } from '@/lib/environment/environment-audit';

export const SEAL_CSC_BASE_URL_ENV = 'NESTOR_SEAL_CSC_BASE_URL';
export const SEAL_CSC_CLIENT_ID_ENV = 'NESTOR_SEAL_CSC_CLIENT_ID';
export const SEAL_CSC_CLIENT_SECRET_ENV = 'NESTOR_SEAL_CSC_CLIENT_SECRET';
export const SEAL_CSC_CREDENTIAL_ID_ENV = 'NESTOR_SEAL_CSC_CREDENTIAL_ID';
export const SEAL_TSA_URL_ENV = 'NESTOR_SEAL_TSA_URL';
/** Προαιρετικά: HTTP Basic για TSA που το απαιτεί (οι εγκεκριμένες TSA συχνά είναι συνδρομητικές). */
export const SEAL_TSA_USERNAME_ENV = 'NESTOR_SEAL_TSA_USERNAME';
export const SEAL_TSA_PASSWORD_ENV = 'NESTOR_SEAL_TSA_PASSWORD';

const REQUIRED = [
  SEAL_CSC_BASE_URL_ENV,
  SEAL_CSC_CLIENT_ID_ENV,
  SEAL_CSC_CLIENT_SECRET_ENV,
  SEAL_CSC_CREDENTIAL_ID_ENV,
  SEAL_TSA_URL_ENV,
] as const;

export interface CscConfiguration {
  /** Βάση της υπηρεσίας, π.χ. `https://…/csc/v2` — χωρίς τελική κάθετο. */
  readonly baseUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly credentialId: string;
}

export interface TsaConfiguration {
  readonly url: string;
  readonly basicAuth: { readonly username: string; readonly password: string } | null;
}

export type SealConfiguration =
  | { readonly kind: 'configured'; readonly csc: CscConfiguration; readonly tsa: TsaConfiguration }
  | { readonly kind: 'awaiting-seal-configuration'; readonly missing: readonly string[] };

/** Μόνο `https:` — διαπιστευτήρια και συνόψεις δεν ταξιδεύουν ποτέ καθαρά. Μη-https ⇒ μετρά ως απούσα. */
function httpsValue(env: EnvironmentSource, name: string): string | null {
  const value = readConfiguredValue(env, name);
  if (value === null) return null;
  try {
    return new URL(value).protocol === 'https:' ? value.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

function tsaBasicAuth(env: EnvironmentSource): TsaConfiguration['basicAuth'] {
  const username = readConfiguredValue(env, SEAL_TSA_USERNAME_ENV);
  const password = readConfiguredValue(env, SEAL_TSA_PASSWORD_ENV);
  return username !== null && password !== null ? { username, password } : null;
}

/** Η ρύθμιση, ή **τα ονόματα** που λείπουν. Ρωτιέται **μία** φορά ανά εκτέλεση (ADR-918 §5). */
export function sealConfigurationOf(env: EnvironmentSource): SealConfiguration {
  const urls = new Set<string>([SEAL_CSC_BASE_URL_ENV, SEAL_TSA_URL_ENV]);
  const values = new Map(REQUIRED.map((name) => [name, urls.has(name) ? httpsValue(env, name) : readConfiguredValue(env, name)]));
  const missing = REQUIRED.filter((name) => values.get(name) === null);
  if (missing.length > 0) return { kind: 'awaiting-seal-configuration', missing };
  const read = (name: (typeof REQUIRED)[number]): string => values.get(name) ?? '';
  return {
    kind: 'configured',
    csc: {
      baseUrl: read(SEAL_CSC_BASE_URL_ENV),
      clientId: read(SEAL_CSC_CLIENT_ID_ENV),
      clientSecret: read(SEAL_CSC_CLIENT_SECRET_ENV),
      credentialId: read(SEAL_CSC_CREDENTIAL_ID_ENV),
    },
    tsa: { url: read(SEAL_TSA_URL_ENV), basicAuth: tsaBasicAuth(env) },
  };
}
