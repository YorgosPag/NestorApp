/**
 * Client ID Metadata Documents (CIMD) — ταυτοποίηση client χωρίς προεγγραφή
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ ΚΑΙ ΓΙΑΤΙ ΟΧΙ DCR
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένας MCP client που δεν έχει ξαναμιλήσει με τον Νέστορα πρέπει κάπως να πει
 * «ποιος είμαι». Η παλιά απάντηση ήταν **Dynamic Client Registration**: ο
 * server εκδίδει ταυτότητα σε όποιον ζητήσει. Η Autodesk το πολέμησε ακριβώς
 * γι' αυτό — «difficult to control access to sensitive systems and enforce
 * approval processes» — και πέτυχε να μπει στο πρότυπο το CIMD: το `client_id`
 * είναι **HTTPS URL** που δείχνει σε έγγραφο μεταδεδομένων στο domain του
 * client. Δηλαδή η ταυτότητα είναι **σταθερή και ελέγξιμη**, δεμένη σε domain
 * που κάποιος κατέχει, αντί για τυχαίο id που εκδώσαμε σε άγνωστο.
 *
 * Στο 2025-11-25 το DCR υποβαθμίστηκε σε `MAY` («included for backwards
 * compatibility») και το CIMD ανέβηκε σε `SHOULD`. Ο Νέστωρ υλοποιεί **μόνο**
 * CIMD + preregistration· δεν εκθέτει `registration_endpoint`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΟΡΙΟ ΠΟΥ ΤΟ CIMD **ΔΕΝ** ΛΥΝΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ίδιο το πρότυπο το γράφει: «Client ID Metadata Documents cannot prevent
 * `localhost` URL impersonation by themselves.» Κακόβουλο πρόγραμμα στο
 * μηχάνημα του χρήστη δηλώνει το **νόμιμο** client_id, δεσμεύει δικό του
 * τοπικό port και εισπράττει τον code — και ο χρήστης βλέπει το νόμιμο όνομα.
 * Η άμυνα δεν είναι τεχνική εδώ· είναι **η οθόνη συγκατάθεσης**, που δείχνει
 * ρητά το redirect hostname/port. Γι' αυτό αυτό το module επιστρέφει το
 * `isLoopbackRedirect` — δεν είναι διακοσμητικό.
 *
 * @module lib/oauth/client-id-metadata
 * @see ADR-738 §4
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00
 */

import 'server-only';

import { fetchGuardedText } from '@/lib/security/outbound-url-guard';
import { OAUTH_TTL } from './oauth-config';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

/** Τα πεδία CIMD που καταναλώνει ο Νέστωρ. */
export interface ClientMetadataDocument {
  readonly client_id: string;
  readonly client_name: string;
  readonly redirect_uris: readonly string[];
  readonly client_uri?: string;
  readonly logo_uri?: string;
  readonly grant_types?: readonly string[];
  readonly response_types?: readonly string[];
  readonly token_endpoint_auth_method?: string;
}

export type ClientMetadataRejection =
  | 'client_id_not_https'
  | 'client_id_no_path'
  | 'fetch_failed'
  | 'not_json'
  | 'missing_required_fields'
  | 'client_id_mismatch'
  | 'no_valid_redirect_uris';

export type ClientMetadataResult =
  | { readonly ok: true; readonly document: ClientMetadataDocument }
  | { readonly ok: false; readonly rejection: ClientMetadataRejection };

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry {
  readonly document: ClientMetadataDocument;
  readonly expiresAt: number;
}

/**
 * Μνήμη ανά διεργασία.
 *
 * ⚠️ **Βελτιστοποίηση, όχι ορθότητα.** Το Next.js δεν εγγυάται συνέχεια
 * διεργασίας μεταξύ αιτημάτων· ένα cold start απλώς ξανακατεβάζει. Καμία
 * απόφαση ασφαλείας δεν εξαρτάται από το αν βρέθηκε εδώ κάτι.
 */
const metadataCache = new Map<string, CacheEntry>();

/** `max-age` σε ms, ή `null` αν ο εκδότης δεν το δήλωσε αξιοποιήσιμα. */
function parseMaxAgeMs(cacheControl: string): number | null {
  if (/no-store|no-cache/i.test(cacheControl)) return null;
  const match = /max-age\s*=\s*(\d+)/i.exec(cacheControl);
  if (!match) return null;

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds, 86_400) * 1_000;
}

// ============================================================================
// ΕΠΙΚΥΡΩΣΗ
// ============================================================================

/**
 * Το `client_id` ως URL — https **και με path**.
 *
 * Το path δεν είναι φορμαλισμός: χωρίς αυτό το `client_id` θα ήταν σκέτο
 * origin, και κάθε σελίδα του domain θα μπορούσε να διεκδικήσει την ταυτότητα.
 */
function validateClientIdShape(clientId: string): ClientMetadataRejection | null {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return 'client_id_not_https';
  }

  if (url.protocol !== 'https:') return 'client_id_not_https';
  if (url.pathname === '' || url.pathname === '/') return 'client_id_no_path';
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Ωμό JSON → επικυρωμένο έγγραφο.
 *
 * ⚠️ Η σύγκριση `client_id` ↔ URL είναι **ακριβής, χαρακτήρα προς χαρακτήρα**,
 * όπως απαιτεί το πρότυπο («MUST validate that the fetched document's
 * `client_id` matches the URL exactly»). Χωρίς αυτό, οποιοσδήποτε θα φιλοξενούσε
 * έγγραφο που *δηλώνει* ξένο client_id και θα δανειζόταν το όνομά του στην
 * οθόνη συγκατάθεσης.
 */
export function validateMetadataDocument(
  raw: unknown,
  clientId: string,
): ClientMetadataResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, rejection: 'not_json' };
  }

  const candidate = raw as Record<string, unknown>;
  const redirectUris = candidate.redirect_uris;

  if (
    !isNonEmptyString(candidate.client_id) ||
    !isNonEmptyString(candidate.client_name) ||
    !Array.isArray(redirectUris)
  ) {
    return { ok: false, rejection: 'missing_required_fields' };
  }

  if (candidate.client_id !== clientId) {
    return { ok: false, rejection: 'client_id_mismatch' };
  }

  const validUris = redirectUris.filter(
    (uri): uri is string => isNonEmptyString(uri) && isAcceptableRedirectUri(uri),
  );
  if (validUris.length === 0) {
    return { ok: false, rejection: 'no_valid_redirect_uris' };
  }

  return {
    ok: true,
    document: {
      client_id: candidate.client_id,
      client_name: candidate.client_name,
      redirect_uris: validUris,
      client_uri: isNonEmptyString(candidate.client_uri) ? candidate.client_uri : undefined,
      logo_uri: isNonEmptyString(candidate.logo_uri) ? candidate.logo_uri : undefined,
    },
  };
}

// ============================================================================
// REDIRECT URIs
// ============================================================================

/** Οι hosts που το RFC 8252 αναγνωρίζει ως loopback του ίδιου μηχανήματος. */
const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', '[::1]', '::1', 'localhost'];

export function isLoopbackRedirectUri(uri: string): boolean {
  try {
    return LOOPBACK_HOSTS.includes(new URL(uri).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Δεκτό redirect: **https**, ή loopback σε http.
 *
 * Το πρότυπο το λέει ρητά — «All redirect URIs MUST be either `localhost` or
 * use HTTPS». Το http σε loopback επιτρέπεται επειδή δεν φεύγει ποτέ από το
 * μηχάνημα· http προς οτιδήποτε άλλο εκθέτει τον code στο δίκτυο.
 */
export function isAcceptableRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }

  if (url.hash !== '') return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && isLoopbackRedirectUri(uri);
}

/**
 * Ταιριάζει το ζητούμενο redirect με τα δηλωμένα.
 *
 * ⚠️ Ακριβής σύγκριση — **εκτός από το port σε loopback**. Αυτή η εξαίρεση
 * είναι απαίτηση του RFC 8252 §7.3, όχι χαλάρωση: ένας native client δεσμεύει
 * **τυχαίο ελεύθερο port** τη στιγμή της σύνδεσης και δεν μπορεί να το ξέρει
 * όταν δημοσιεύει το CIMD του. Χωρίς αυτήν, ο Claude Desktop θα αποτύγχανε
 * κάθε φορά που το port άλλαζε — και η «διόρθωση» που θα ερχόταν στα γρήγορα
 * (prefix matching) θα άνοιγε πραγματική τρύπα σε **όλα** τα redirect URIs.
 */
export function matchRedirectUri(
  registered: readonly string[],
  requested: string,
): boolean {
  if (registered.includes(requested)) return true;
  if (!isLoopbackRedirectUri(requested)) return false;

  let want: URL;
  try {
    want = new URL(requested);
  } catch {
    return false;
  }

  return registered.some((candidate) => {
    if (!isLoopbackRedirectUri(candidate)) return false;
    try {
      const have = new URL(candidate);
      return (
        have.protocol === want.protocol &&
        have.hostname.toLowerCase() === want.hostname.toLowerCase() &&
        have.pathname === want.pathname &&
        have.search === want.search
      );
    } catch {
      return false;
    }
  });
}

// ============================================================================
// ΑΝΑΚΤΗΣΗ
// ============================================================================

/**
 * Κατεβάζει και επικυρώνει το CIMD ενός client.
 *
 * Το κατέβασμα περνά **υποχρεωτικά** από τον `outbound-url-guard`: εδώ ο server
 * χτυπά URL που έδωσε ανώνυμος καλών, δηλαδή ακριβώς το σενάριο SSRF που
 * περιγράφει το §Authorization Server Abuse Protection του προτύπου.
 */
export async function fetchClientMetadata(clientId: string): Promise<ClientMetadataResult> {
  const shapeError = validateClientIdShape(clientId);
  if (shapeError) return { ok: false, rejection: shapeError };

  const cached = metadataCache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, document: cached.document };
  }

  const fetched = await fetchGuardedText(clientId);
  if (!fetched.ok) return { ok: false, rejection: 'fetch_failed' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(fetched.body);
  } catch {
    return { ok: false, rejection: 'not_json' };
  }

  const validated = validateMetadataDocument(parsed, clientId);
  if (!validated.ok) return validated;

  const ttl = parseMaxAgeMs(fetched.cacheControl) ?? OAUTH_TTL.CLIENT_METADATA_FALLBACK_MS;
  metadataCache.set(clientId, {
    document: validated.document,
    expiresAt: Date.now() + ttl,
  });

  return validated;
}

/** Καθαρίζει τη μνήμη — για tests και για χειροκίνητη ανανέωση. */
export function clearClientMetadataCache(): void {
  metadataCache.clear();
}
