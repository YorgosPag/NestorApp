/**
 * @fileoverview **Ο ΦΥΛΑΚΑΣ ΤΗΣ ΕΚΤΕΛΕΣΗΣ** — ζήτησε ο χάρτης κάτι από διακομιστή που **δεν** δηλώνει το μητρώο;
 * @related ADR-891 Φ1 · `basemap-catalog.ts` (η αυθεντία) · `maplibre.ts` (το σύνορο που τον φορά) · CHECK 3.95
 * @module lib/maps/basemap-request-sentinel
 *
 * 🔑 **Η ΣΤΑΤΙΚΗ ΠΥΛΗ ΒΛΕΠΕΙ ΜΟΝΟ ΟΣΑ ΓΡΑΦΟΥΜΕ.** Ένα style.json τρίτου λέει **εκείνο** από πού θα φορτώσει
 * πλακίδια, glyphs και sprites — και το αλλάζει όποτε θέλει, χωρίς commit από εμάς. Το CHECK 3.95 δεν
 * μπορεί να το δει ποτέ. Το βλέπει μόνο το σημείο από όπου περνά **κάθε** αίτημα του χάρτη: το
 * `transformRequest` της MapLibre (το ίδιο άγκιστρο που χρησιμοποιεί το Mapbox για τα κλειδιά του).
 *
 * ⚠️ **ΑΝΑΦΕΡΕΙ, ΔΕΝ ΜΠΛΟΚΑΡΕΙ** — όπως το `Content-Security-Policy-Report-Only`. Ένα μπλοκ θα έσβηνε τον
 * χάρτη του επισκέπτη για ένα λάθος του μητρώου· η αναφορά λέει σε εμάς να διορθώσουμε το μητρώο.
 * Μία φορά ανά διακομιστή, ώστε ένας χάρτης με 200 πλακίδια να μη γεννά 200 γραμμές.
 */

import type { RequestParameters, RequestTransformFunction, ResourceType } from 'maplibre-gl';
import { createModuleLogger } from '@/lib/telemetry';
import { basemapProviderOfHost } from './basemap-catalog';

const logger = createModuleLogger('MAP_REQUEST_SENTINEL');

/**
 * - `local` — `data:` / `blob:` (εικόνες δεικτών, GeoJSON στη μνήμη)
 * - `same-origin` — ο δικός μας διακομιστής (όρια περιοχών στο `/data/…`)
 * - `declared` — διακομιστής παρόχου του μητρώου
 * - `undeclared` — **κανείς δεν τον δήλωσε**
 */
export type MapRequestVerdict = 'local' | 'same-origin' | 'declared' | 'undeclared';

export interface MapRequestClassification {
  readonly verdict: MapRequestVerdict;
  readonly host: string | null;
}

const LOCAL_SCHEME = /^(data|blob):/i;

/** Καθαρή κρίση ενός αιτήματος — `origin` = η προέλευση της σελίδας (`null` εκτός περιηγητή). */
export function classifyMapRequest(url: string, origin: string | null): MapRequestClassification {
  if (LOCAL_SCHEME.test(url)) return { verdict: 'local', host: null };
  let parsed: URL;
  try {
    parsed = new URL(url, origin ?? undefined);
  } catch {
    return { verdict: 'undeclared', host: null };
  }
  const host = parsed.hostname.toLowerCase();
  if (origin !== null && parsed.origin === new URL(origin).origin) return { verdict: 'same-origin', host };
  return { verdict: basemapProviderOfHost(host) === null ? 'undeclared' : 'declared', host };
}

const reportedHosts = new Set<string>();

function pageOrigin(): string | null {
  return typeof window === 'undefined' ? null : window.location.origin;
}

/** Κοιτάζει ένα αίτημα και, αν ο διακομιστής είναι αδήλωτος, το λέει **μία** φορά. */
export function observeMapRequest(url: string, resourceType?: ResourceType): void {
  const { verdict, host } = classifyMapRequest(url, pageOrigin());
  if (verdict !== 'undeclared') return;
  const key = host ?? url;
  if (reportedHosts.has(key)) return;
  reportedHosts.add(key);
  logger.warn('Ο χάρτης ζήτησε πόρο από διακομιστή που δεν δηλώνει το μητρώο υποβάθρων (ADR-891)', {
    host: key,
    resourceType: resourceType ?? 'Unknown',
  });
}

/**
 * Το `transformRequest` που φορά **κάθε** χάρτης (μέσω του συνόρου `maplibre.ts`). Αν ο καταναλωτής
 * δίνει δικό του, ο φύλακας κοιτάζει πρώτα και μετά αφήνει τον καταναλωτή να αποφασίσει.
 */
export function withMapRequestSentinel(own?: RequestTransformFunction): RequestTransformFunction {
  return (url: string, resourceType?: ResourceType): RequestParameters | undefined => {
    observeMapRequest(url, resourceType);
    return own?.(url, resourceType);
  };
}

/** Μόνο για tests: ξεχνά ποιους διακομιστές έχει ήδη αναφέρει. */
export function resetMapRequestSentinel(): void {
  reportedHosts.clear();
}
