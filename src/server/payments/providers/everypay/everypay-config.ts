import 'server-only';

/**
 * @fileoverview Ρυθμίσεις Everypay — κλειδιά από το περιβάλλον, **κλειδωμένο live** (ADR-ACC-030 §2.5)
 * @description Τα κλειδιά τα ορίζει ο άνθρωπος (Netcup env / `.env.local`) — ποτέ ο κώδικας. Ο κώδικας ξέρει
 *   **μόνο** τις διευθύνσεις του sandbox: ένα live κλειδί που θα έμπαινε κατά λάθος απλώς απορρίπτεται από το
 *   sandbox API. Η μετάβαση σε live θα είναι **ρητή** απόφαση (νέα γραμμή στο `EVERYPAY_ENDPOINTS` + ADR), όχι
 *   αλλαγή μιας μεταβλητής περιβάλλοντος.
 *
 * @see https://docs.everypay.gr/get-started/api-credentials/
 */

import { readConfiguredValue, type EnvironmentSource } from '@/lib/environment/environment-audit';

/** Literal ονόματα — ώστε το `environment-contract` (Σ2) να βλέπει τον καταναλωτή. */
export const EVERYPAY_SECRET_KEY_ENV = 'EVERYPAY_SECRET_KEY';
export const EVERYPAY_PUBLIC_KEY_ENV = 'EVERYPAY_PUBLIC_KEY';
export const PAYMENTS_PROVIDER_MODE_ENV = 'PAYMENTS_PROVIDER_MODE';

/** Οι λειτουργίες που γνωρίζει ο κώδικας. Το live **δεν** υπάρχει επίτηδες. */
export const EVERYPAY_ENDPOINTS = {
  sandbox: {
    api: 'https://sandbox-api.everypay.gr',
    payform: 'https://sandbox-payform-api.everypay.gr',
  },
} as const;

export type EverypayMode = keyof typeof EVERYPAY_ENDPOINTS;

export interface EverypayCredentials {
  readonly mode: EverypayMode;
  readonly secretKey: string;
  readonly publicKey: string;
  readonly endpoints: (typeof EVERYPAY_ENDPOINTS)[EverypayMode];
}

export type EverypayConfigVerdict =
  | { readonly configured: true; readonly credentials: EverypayCredentials }
  | { readonly configured: false; readonly reason: 'keys-missing' | 'mode-unsupported' };

function isEverypayMode(value: string): value is EverypayMode {
  return Object.prototype.hasOwnProperty.call(EVERYPAY_ENDPOINTS, value);
}

/** Η κρίση — καθαρή: το περιβάλλον περνιέται. */
export function judgeEverypayConfig(env: EnvironmentSource): EverypayConfigVerdict {
  const secretKey = readConfiguredValue(env, EVERYPAY_SECRET_KEY_ENV);
  const publicKey = readConfiguredValue(env, EVERYPAY_PUBLIC_KEY_ENV);
  if (secretKey === null || publicKey === null) return { configured: false, reason: 'keys-missing' };
  const mode = readConfiguredValue(env, PAYMENTS_PROVIDER_MODE_ENV) ?? '';
  if (!isEverypayMode(mode)) return { configured: false, reason: 'mode-unsupported' };
  return { configured: true, credentials: { mode, secretKey, publicKey, endpoints: EVERYPAY_ENDPOINTS[mode] } };
}
