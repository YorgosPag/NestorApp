/**
 * OAuth 2.1 Authorization Server — SSoT ρυθμίσεων (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΔΙΚΟΣ ΜΑΣ AUTHORIZATION SERVER
 * ─────────────────────────────────────────────────────────────────────────────
 * Το πρότυπο MCP 2025-11-25 ορίζει τον MCP server ως **resource server** και
 * αφήνει τον authorization server **εκτός εμβέλειας**: «It may be hosted with
 * the resource server or a separate entity.» Άρα δεν υπάρχει υποχρέωση να
 * αγοραστεί πάροχος — υπάρχει υποχρέωση να εκδίδονται σωστά tokens.
 *
 * Ο Νέστωρ ταυτοποιεί ήδη με Firebase. Το Firebase όμως **δεν είναι**
 * authorization server: δεν έχει authorization endpoint για ξένους clients,
 * ούτε consent, ούτε scopes. Αυτό που λείπει δεν είναι *ταυτότητα* — είναι
 * *εξουσιοδότηση τρίτου*. Οπότε:
 *
 * - **Firebase** = ποιος είσαι (η SSoT ταυτότητας παραμένει **μία**)
 * - **αυτός ο AS** = τι επιτρέπεις σε **αυτόν** τον πράκτορα, και για πόσο
 *
 * Ίδιο σχήμα με Figma (`figma.com/oauth/mcp` πάνω από Figma login) και Autodesk
 * (3LO πάνω από Autodesk ID). Δεύτερος πάροχος ταυτότητας **δεν** μπαίνει.
 *
 * @module lib/oauth/oauth-config
 * @see ADR-738 §3 — ρόλοι
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */

// ============================================================================
// SCOPES
// ============================================================================

/**
 * Τα scopes που εκδίδει ο AS.
 *
 * ⚠️ Σκόπιμα **ένα**. Το `scopes_supported` του RFC 9728 ορίζεται ως «το
 * ελάχιστο σύνολο για βασική λειτουργία» και το πρότυπο ζητά ρητά *scope
 * minimization*. Ένα προληπτικό `boq:write` που δεν αντιστοιχεί σε τίποτα
 * εκτελέσιμο (το `WRITE_CAPABILITIES_ENABLED` είναι `false`, ADR-734 §5.4) θα
 * ζητούσε από τον χρήστη να εγκρίνει εξουσία που **δεν υπάρχει** — δηλαδή θα
 * εκπαίδευε στο να πατά «ναι» χωρίς νόημα. Μπαίνει στη Φάση 4, μαζί με τον
 * κώδικα που το κάνει αληθές.
 */
export const OAUTH_SCOPES = {
  BOQ_READ: 'boq:read',
} as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[keyof typeof OAUTH_SCOPES];

/** Όλα τα υποστηριζόμενα scopes, σταθερή σειρά. */
export const SUPPORTED_SCOPES: readonly OAuthScope[] = [OAUTH_SCOPES.BOQ_READ];

/** Το scope που απαιτεί το MCP endpoint για κάθε κλήση εργαλείου. */
export const MCP_REQUIRED_SCOPE: OAuthScope = OAUTH_SCOPES.BOQ_READ;

export function isSupportedScope(value: string): value is OAuthScope {
  return (SUPPORTED_SCOPES as readonly string[]).includes(value);
}

// ============================================================================
// ΔΙΑΡΚΕΙΕΣ
// ============================================================================

/**
 * ⚠️ Ο authorization code ζει **60 δευτερόλεπτα**. Το OAuth 2.1 λέει «SHOULD be
 * short-lived» και δίνει 10 λεπτά ως ανώτατο· εδώ ο code ταξιδεύει μέσω
 * redirect σε localhost και εξαργυρώνεται αμέσως — ένα παράθυρο 10 λεπτών θα
 * ήταν 600× μεγαλύτερο από την πραγματική ανάγκη, χωρίς κανένα όφελος.
 */
export const OAUTH_TTL = {
  AUTHORIZATION_CODE_MS: 60_000,
  /**
   * Πόσο ζει ένα εκκρεμές αίτημα ενόσω ο **άνθρωπος** αποφασίζει. Δέκα λεπτά:
   * αρκετά για να διαβάσει τι ζητείται και να συνδεθεί αν χρειαστεί, αρκετά
   * λίγα ώστε μια ξεχασμένη καρτέλα να μην είναι ανοιχτή πρόσκληση.
   */
  AUTH_REQUEST_MS: 10 * 60_000,
  ACCESS_TOKEN_MS: 60 * 60 * 1_000,
  REFRESH_TOKEN_MS: 30 * 24 * 60 * 60 * 1_000,
  /** Πόσο κρατάμε στη μνήμη ένα CIMD όταν ο εκδότης δεν δίνει `Cache-Control`. */
  CLIENT_METADATA_FALLBACK_MS: 10 * 60 * 1_000,
} as const;

// ============================================================================
// PKCE
// ============================================================================

/**
 * **Μόνο** `S256`.
 *
 * Το `plain` είναι συντακτικά μέρος του PKCE αλλά δεν προσφέρει τίποτα: ο
 * verifier ταξιδεύει αυτούσιος, οπότε όποιος υπέκλεψε το authorization request
 * έχει ήδη ό,τι χρειάζεται. Το OAuth 2.1 απαιτεί `S256` όπου είναι τεχνικά
 * δυνατό — για client που τρέχει σε Node/Electron είναι πάντα δυνατό.
 */
export const PKCE_CODE_CHALLENGE_METHODS: readonly string[] = ['S256'];

// ============================================================================
// ΔΙΕΥΘΥΝΣΕΙΣ
// ============================================================================

export const OAUTH_PATHS = {
  AUTHORIZE: '/api/oauth/authorize',
  TOKEN: '/api/oauth/token',
  CONSENT_PAGE: '/oauth/consent',
  MCP_ENDPOINT: '/api/mcp',
  WELL_KNOWN_AS: '/.well-known/oauth-authorization-server',
  WELL_KNOWN_PRM: '/.well-known/oauth-protected-resource',
} as const;

const APP_URL_ENV_KEY = 'NEXT_PUBLIC_APP_URL';

/**
 * Η βάση κάθε δημόσιου URL που ανακοινώνουμε.
 *
 * ⚠️ **Ποτέ από τον `Host` header.** Ο issuer και το canonical resource URI
 * μπαίνουν μέσα σε tokens και σε metadata documents· αν παράγονταν από τον
 * header του αιτήματος, ένας πλαστός `Host` θα έστρεφε τον client σε ξένο
 * authorization endpoint και θα άλλαζε το ακροατήριο του token — δηλαδή θα
 * ακύρωνε τον ίδιο τον έλεγχο που το §Token Audience Binding επιβάλλει.
 * Σε production η απουσία της μεταβλητής είναι **σφάλμα εκκίνησης**, όχι
 * σιωπηλό fallback.
 */
export function getPublicBaseUrl(): string {
  const configured = process.env[APP_URL_ENV_KEY];
  if (configured && configured.length > 0) {
    return configured.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[oauth-config] ${APP_URL_ENV_KEY} is required in production — ` +
        'issuer and resource URIs must not derive from request headers',
    );
  }

  return 'http://localhost:3000';
}

/** Ο issuer του AS (RFC 8414 `issuer`). */
export function getIssuerUrl(): string {
  return getPublicBaseUrl();
}

/**
 * Το **canonical** URI του MCP server, με την έννοια του RFC 8707 §2.
 *
 * Αυτή η τιμή είναι το ακροατήριο κάθε access token και πρέπει να ταυτίζεται
 * με το `resource` που στέλνει ο client. Χωρίς trailing slash, χωρίς fragment —
 * το πρότυπο συνιστά ρητά τη μορφή χωρίς κατάληξη «/» για διαλειτουργικότητα.
 */
export function getMcpResourceUri(): string {
  return `${getPublicBaseUrl()}${OAUTH_PATHS.MCP_ENDPOINT}`;
}

/**
 * Κανονικοποίηση του `resource` που δίνει ο client, πριν συγκριθεί.
 *
 * Το πρότυπο ζητά να **δεχόμαστε** κεφαλαία scheme/host «for robustness» ενώ η
 * κανονική μορφή είναι πεζά. Άρα η σύγκριση γίνεται σε κανονικοποιημένη μορφή,
 * όχι σε ωμό string — αλλιώς `HTTPS://Nestor…` θα απορριπτόταν ενώ είναι έγκυρο.
 */
export function canonicalizeResourceUri(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.hash !== '') return null;

  const path = url.pathname.replace(/\/+$/, '');
  return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${path}`;
}

/**
 * Το `resource` που ζήτησε ο client → το ακροατήριο του token, ή `null`.
 *
 * ⚠️ **Ένας κανόνας, δύο endpoints.** Και το `/oauth/authorize` και το
 * `/oauth/token` απαντούν στην ίδια ερώτηση — «για ποιον server ζητά token;» —
 * και **πρέπει** να απαντούν το ίδιο. Γραμμένος δύο φορές, ο κανόνας θα
 * μπορούσε να αποκλίνει, και τότε ένα αίτημα που περνά τον έναν έλεγχο θα
 * απορριπτόταν (ή, χειρότερα, θα γινόταν δεκτό) στον άλλο. Το CHECK 3.28 έπιασε
 * ακριβώς αυτό το δίδυμο κατά την υλοποίηση (N.18).
 *
 * **Απουσία ⇒ δεκτή**, με προεπιλογή τον δικό μας MCP endpoint. Το πρότυπο
 * υποχρεώνει τον *client* να στέλνει `resource`, αλλά ο server που απορρίπτει
 * την απουσία σπάει κάθε παλαιότερο client χωρίς να κερδίζει ασφάλεια: το
 * ακροατήριο που θα έμπαινε στο token είναι έτσι κι αλλιώς **μόνο δικό μας**.
 *
 * **`resource` που δείχνει αλλού ⇒ απόρριψη.** Εκεί ο client ζητά ρητά token
 * για ξένο server· σιωπηλή αποδοχή θα εξέδιδε διαπιστευτήριο με λάθος
 * ακροατήριο — ακριβώς η παραβίαση που απαγορεύει το §Token Audience Binding.
 */
export function resolveRequestedAudience(raw: string | null): string | null {
  const expected = getMcpResourceUri();
  if (raw === null || raw === '') return expected;

  const canonical = canonicalizeResourceUri(raw);
  if (canonical === null) return null;
  return canonical === canonicalizeResourceUri(expected) ? expected : null;
}

// ============================================================================
// ΠΟΛΙΤΙΚΗ ΕΜΠΙΣΤΟΣΥΝΗΣ CLIENTS
// ============================================================================

/**
 * Domains των οποίων το CIMD θεωρείται γνωστό.
 *
 * ⚠️ **Δεν είναι allowlist πρόσβασης** — είναι allowlist *οικειότητας*. Το
 * πρότυπο επιτρέπει στους servers «Allowlists for trusted domains» ή «Accept
 * any HTTPS client_id». Η Figma διάλεξε κλειστό κατάλογο· αυτό αποκλείει κάθε
 * νέο εργαλείο μέχρι να το εγκρίνει η Figma. Εδώ επιλέγεται το ενδιάμεσο:
 * **κάθε** HTTPS client_id γίνεται δεκτό, αλλά όσα δεν είναι σε αυτή τη λίστα
 * σημαίνονται στη σελίδα συγκατάθεσης ως άγνωστα, με το hostname τους μπροστά
 * στα μάτια του χρήστη. Δηλαδή η απόφαση μένει στον άνθρωπο, με πληροφορία —
 * αντί να λαμβάνεται σιωπηλά από κατάλογο που δεν ελέγχει.
 */
export const FAMILIAR_CLIENT_DOMAINS: readonly string[] = [
  'claude.ai',
  'anthropic.com',
  'cursor.com',
  'cursor.sh',
  'github.com',
  'microsoft.com',
  'visualstudio.com',
];

/** `true` αν το hostname είναι το domain ή υποτομέας του. */
export function isFamiliarClientDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return FAMILIAR_CLIENT_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}
