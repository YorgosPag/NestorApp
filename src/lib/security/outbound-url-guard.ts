/**
 * Outbound URL Guard — SSoT για κάθε fetch σε URL που **δίνει τρίτος**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Όταν ο server δέχεται URL από ανώνυμο καλούντα και το κατεβάζει, γίνεται
 * **proxy μέσα στο ίδιο του το δίκτυο**: ο επιτιθέμενος δίνει
 * `http://169.254.169.254/…` (cloud metadata) ή `http://127.0.0.1:8080/admin`
 * και ο server χτυπά endpoints που ο ίδιος ο επιτιθέμενος δεν φτάνει. Αυτό είναι
 * το SSRF, και το πρότυπο MCP το ονομάζει ρητά ως τον κίνδυνο του CIMD:
 *
 * > «A malicious client could use this to trigger the authorization server to
 * >  make requests to arbitrary URLs, such as requests to private administration
 * >  endpoints the authorization server has access to.»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΡΙΑ ΣΤΡΩΜΑΤΑ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ ΠΡΩΤΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **Συντακτικό** (`https`, χωρίς credentials, χωρίς fragment). Πιάνει το
 *    προφανές — και **μόνο** αυτό. Ένα `https://evil.example` που το DNS του
 *    δείχνει στο `127.0.0.1` περνά καθαρό.
 * 2. **Ανάλυση ονόματος**: λύνουμε **όλες** τις διευθύνσεις και απορρίπτουμε αν
 *    **έστω μία** είναι ιδιωτική. Όχι «η πρώτη» — ένα κακόβουλο DNS επιστρέφει
 *    δημόσια πρώτη και ιδιωτική δεύτερη, και ο client μπορεί να διαλέξει.
 * 3. **`redirect: 'error'`**: ένα 302 προς `127.0.0.1` θα παρέκαμπτε **και τα
 *    δύο** προηγούμενα, γιατί ο έλεγχος έγινε στο *αρχικό* URL. Δεν
 *    ακολουθούμε ανακατευθύνσεις — καθόλου.
 *
 * ⚠️ **Γνωστό υπόλοιπο (TOCTOU):** μεταξύ του βήματος 2 και της σύνδεσης του
 * `fetch` το DNS μπορεί να ξαναλυθεί σε άλλη διεύθυνση (DNS rebinding). Πλήρες
 * κλείσιμο απαιτεί custom dispatcher με `lookup` hook στη στιγμή της σύνδεσης —
 * το `undici` **δεν** είναι άμεση εξάρτηση του έργου (Node 20 το έχει
 * ενσωματωμένο αλλά όχι εκτεθειμένο). Το παράθυρο είναι χιλιοστά του
 * δευτερολέπτου και το πρακτικό αντίμετρο είναι ο **περιορισμός στο ποιος
 * φτάνει εδώ**: ο μοναδικός καταναλωτής σήμερα είναι το CIMD fetch, όπου το
 * αποτέλεσμα δεν επιστρέφεται ποτέ αυτούσιο στον καλούντα — μόνο **επικυρωμένα
 * πεδία**. Δηλαδή ακόμη κι αν η ανακατεύθυνση πετύχαινε, ο επιτιθέμενος δεν
 * βλέπει την απάντηση. Καταγράφεται εδώ αντί να αποσιωπηθεί.
 *
 * @module lib/security/outbound-url-guard
 * @see ADR-738 §Ασφάλεια — CIMD fetch
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00#name-server-side-request-forgery
 */

import 'server-only';

import { lookup } from 'node:dns/promises';

// ============================================================================
// ΟΡΙΑ — SSoT, καμία διάσπαρτη σταθερά
// ============================================================================

export const OUTBOUND_FETCH_LIMITS = {
  /** Χρόνος μέχρι εγκατάλειψη. Αργός τρίτος δεν κρατά δικό μας αίτημα όμηρο. */
  TIMEOUT_MS: 5_000,
  /** Ανώτατο μέγεθος σώματος. Ένα «metadata document» των 10 MB είναι επίθεση. */
  MAX_BYTES: 64 * 1024,
} as const;

/** Γιατί απορρίφθηκε — μηχανικός κωδικός, όχι κείμενο προς χρήστη. */
export type OutboundUrlRejection =
  | 'malformed'
  | 'scheme_not_https'
  | 'credentials_in_url'
  | 'fragment_present'
  | 'hostname_missing'
  | 'address_not_public'
  | 'dns_failed';

export type OutboundUrlCheck =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly rejection: OutboundUrlRejection };

// ============================================================================
// ΕΛΕΓΧΟΣ ΔΙΕΥΘΥΝΣΗΣ
// ============================================================================

/** Τα οκτάδα ενός IPv4 σε αριθμούς, ή `null` αν δεν είναι IPv4 literal. */
function parseIpv4(address: string): readonly number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : -1));
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

/**
 * Εύρη IPv4 που **δεν** επιτρέπεται να χτυπηθούν.
 *
 * Το `169.254.0.0/16` δεν είναι απλώς link-local: περιέχει το
 * `169.254.169.254`, το endpoint μεταδεδομένων **όλων** των μεγάλων παρόχων
 * cloud — η κλασική λεία κάθε SSRF. Το `100.64.0.0/10` (CGNAT) μπαίνει επειδή
 * σε πολλά περιβάλλοντα φιλοξενίας οδηγεί σε γειτονικά μηχανήματα.
 */
function isBlockedIpv4(octets: readonly number[]): boolean {
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast (224/4) + δεσμευμένα (240/4)
  return false;
}

/**
 * IPv6 — συμπεριλαμβανομένων των μορφών που **κρύβουν** IPv4.
 *
 * Το `::ffff:127.0.0.1` είναι έγκυρη IPv6 γραφή του loopback· χωρίς αυτόν τον
 * έλεγχο η IPv6 διαδρομή θα ήταν ανοιχτή πίσω πόρτα στα ίδια εύρη.
 */
function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized === '::1' || normalized === '::') return true;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized);
  if (mapped) {
    const octets = parseIpv4(mapped[1]);
    return octets === null || isBlockedIpv4(octets);
  }

  const head = normalized.split(':')[0];
  if (/^f[cd][0-9a-f]{2}$/.test(head)) return true; // fc00::/7 unique local
  if (/^fe[89ab][0-9a-f]$/.test(head)) return true; // fe80::/10 link-local
  if (/^ff[0-9a-f]{2}$/.test(head)) return true;    // ff00::/8 multicast
  return normalized.startsWith('64:ff9b:');          // NAT64 → IPv4 πίσω πόρτα
}

/** `true` αν η διεύθυνση είναι δημόσια δρομολογήσιμη. */
export function isPublicAddress(address: string): boolean {
  const octets = parseIpv4(address);
  if (octets !== null) return !isBlockedIpv4(octets);
  return address.includes(':') ? !isBlockedIpv6(address) : false;
}

// ============================================================================
// ΕΛΕΓΧΟΣ URL
// ============================================================================

/**
 * Συντακτικός έλεγχος — χωρίς δίκτυο, άρα φθηνός και ντετερμινιστικός.
 *
 * Τα credentials στο URL (`https://user:pass@host`) απορρίπτονται γιατί είναι
 * κλασικό όχημα σύγχυσης parser: `https://trusted.example@evil.example` διαβάζεται
 * από τον άνθρωπο ως «trusted» και από τη μηχανή ως «evil».
 */
export function validateOutboundUrlSyntax(raw: string): OutboundUrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, rejection: 'malformed' };
  }

  if (url.protocol !== 'https:') return { ok: false, rejection: 'scheme_not_https' };
  if (url.username !== '' || url.password !== '') {
    return { ok: false, rejection: 'credentials_in_url' };
  }
  if (url.hash !== '') return { ok: false, rejection: 'fragment_present' };
  if (url.hostname === '') return { ok: false, rejection: 'hostname_missing' };

  const literal = url.hostname.startsWith('[')
    ? url.hostname.slice(1, -1)
    : url.hostname;
  const isLiteralIp = parseIpv4(literal) !== null || literal.includes(':');
  if (isLiteralIp && !isPublicAddress(literal)) {
    return { ok: false, rejection: 'address_not_public' };
  }

  return { ok: true, url };
}

/**
 * Πλήρης έλεγχος: συντακτικό **και** ανάλυση ονόματος.
 *
 * Απορρίπτει αν **έστω μία** από τις διευθύνσεις που επιστρέφει το DNS είναι
 * ιδιωτική — όχι μόνο η πρώτη. Ένας κακόβουλος DNS server επιστρέφει σκόπιμα
 * μεικτό σύνολο ακριβώς για να περάσει έναν έλεγχο «της πρώτης».
 */
export async function validateOutboundUrl(raw: string): Promise<OutboundUrlCheck> {
  const syntax = validateOutboundUrlSyntax(raw);
  if (!syntax.ok) return syntax;

  const hostname = syntax.url.hostname.startsWith('[')
    ? syntax.url.hostname.slice(1, -1)
    : syntax.url.hostname;

  if (parseIpv4(hostname) !== null || hostname.includes(':')) {
    return syntax; // literal IP — ήδη ελεγμένο συντακτικά
  }

  try {
    const resolved = await lookup(hostname, { all: true });
    if (resolved.length === 0) return { ok: false, rejection: 'dns_failed' };
    if (!resolved.every((entry) => isPublicAddress(entry.address))) {
      return { ok: false, rejection: 'address_not_public' };
    }
  } catch {
    return { ok: false, rejection: 'dns_failed' };
  }

  return syntax;
}

// ============================================================================
// ΦΥΛΑΓΜΕΝΟ FETCH
// ============================================================================

export type GuardedFetchResult =
  | { readonly ok: true; readonly body: string; readonly contentType: string; readonly cacheControl: string }
  | { readonly ok: false; readonly rejection: OutboundUrlRejection | 'http_error' | 'too_large' | 'timeout' };

/**
 * Κατεβάζει κείμενο από URL τρίτου με **όλα** τα στρώματα ενεργά.
 *
 * ⚠️ `redirect: 'error'` — **σκόπιμα**. Ακολουθώντας ανακατεύθυνση θα ίσχυαν οι
 * έλεγχοι για το URL που *δώσαμε* και όχι για αυτό που *χτυπήσαμε*, δηλαδή θα
 * είχαμε γράψει τους ελέγχους και θα τους είχαμε παρακάμψει ταυτόχρονα. Ένα
 * legitimate metadata document δεν χρειάζεται ανακατεύθυνση.
 */
export async function fetchGuardedText(raw: string): Promise<GuardedFetchResult> {
  const check = await validateOutboundUrl(raw);
  if (!check.ok) return { ok: false, rejection: check.rejection };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OUTBOUND_FETCH_LIMITS.TIMEOUT_MS);

  try {
    const response = await fetch(check.url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });

    if (!response.ok) return { ok: false, rejection: 'http_error' };

    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > OUTBOUND_FETCH_LIMITS.MAX_BYTES) return { ok: false, rejection: 'too_large' };

    const body = await response.text();
    if (body.length > OUTBOUND_FETCH_LIMITS.MAX_BYTES) return { ok: false, rejection: 'too_large' };

    return {
      ok: true,
      body,
      contentType: response.headers.get('content-type') ?? '',
      cacheControl: response.headers.get('cache-control') ?? '',
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { ok: false, rejection: aborted ? 'timeout' : 'http_error' };
  } finally {
    clearTimeout(timer);
  }
}
