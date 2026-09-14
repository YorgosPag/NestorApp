/**
 * 🔒 PR-1C: Rate Limit Configuration (SSoT)
 *
 * Single Source of Truth for all rate limiting configuration.
 * Production-grade for Vercel/serverless with Upstash Redis.
 *
 * @module lib/middleware/rate-limit-config
 * @version 2.0.0
 * @since 2026-01-29 - PR-1C Re-Architecture
 *
 * @enterprise Local_Protocol compliant:
 * - ZERO hardcoded values in code
 * - All config centralized here
 * - Environment-aware (dev/staging/production)
 */

import { API_ROUTES } from '@/config/domain-constants';
import { EMAIL_SUBSCRIPTION_API } from '@/lib/notifications/email-subscription-routes';
import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RATE_LIMIT_CONFIG');

// =============================================================================
// ENVIRONMENT VARIABLES (SSoT)
// =============================================================================

/**
 * Upstash Redis environment variable names.
 * All env keys centralized here - no scattered strings.
 */
export const UPSTASH_ENV_KEYS = {
  /** Upstash Redis REST URL */
  URL: 'UPSTASH_REDIS_REST_URL',
  /** Upstash Redis REST Token */
  TOKEN: 'UPSTASH_REDIS_REST_TOKEN',
} as const;

/**
 * Rate limit key prefixes for Redis.
 * Enables easy debugging and namespace isolation.
 */
export const RATE_LIMIT_KEY_PREFIXES = {
  /** Prefix for all rate limit keys */
  BASE: 'nestor:ratelimit',
  /** Prefix for authenticated user rate limits */
  USER: 'user',
  /** Prefix for anonymous/IP-based rate limits */
  ANON: 'anon',
} as const;

// =============================================================================
// RATE LIMIT POLICY (SSoT)
// =============================================================================

/**
 * Rate limit window configuration.
 */
export const RATE_LIMIT_WINDOW = {
  /** Window size in milliseconds (1 minute) */
  MS: 60_000,
  /** Window size in seconds (for Upstash) */
  SECONDS: 60,
} as const;

/**
 * **Τι κάνει η βαθμίδα όταν ο μετρητής ΔΕΝ απαντά** (ADR-855 Α3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Η ΔΗΛΩΜΕΝΗ ΜΕΤΡΙΑΣΗ ΤΟΥ ADR-068 §4 ΔΕΝ ΥΠΗΡΧΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο πίνακας κινδύνων του ADR-068 έγραφε *«Upstash Redis Down → Fallback to in-memory store
 * (graceful degradation) ✅ Implemented»*. **Δεν ισχύει**: ο `getRateLimitStore()` επιλέγει
 * store **μία φορά**, ως singleton, στην πρώτη κλήση. Αν το Upstash πέσει **αργότερα**, δεν
 * υπάρχει καμία διαδρομή προς τη μνήμη — ο `UpstashRateLimitStore.check` πιάνει το σφάλμα
 * και επιστρέφει `{ allowed: true }`, δηλαδή **fail-open, καθολικά**.
 *
 * Καθολικά σημαίνει: **και** στο `/api/auth/password-reset`, **και** στο
 * `/api/first-contacts/guest/confirm` που φυλά εξαψήφιο κωδικό, **και** στο
 * `/api/attendance/qr/validate` που το ADR-170 ονομάζει *anti-brute-force*.
 *
 * 🏛️ Η ΠΡΑΚΤΙΚΗ ΤΗΣ ΒΙΟΜΗΧΑΝΙΑΣ ΕΙΝΑΙ ΟΜΟΦΩΝΗ ΚΑΙ ΔΙΧΑΣΜΕΝΗ ΑΝΑ ΔΙΑΔΡΟΜΗ:
 * *fail-open* για γενικά API — μια βλάβη του limiter δεν επιτρέπεται να γίνει βλάβη του
 * API· *fail-closed* για ό,τι φυλά **διαπιστευτήρια ή χρήματα** — *«allowing a request you
 * couldn't authorize is a security bypass»*.
 *
 * ⛔ **ΟΧΙ καθολικό fail-closed**: μια στιγμιαία αστοχία του Upstash θα έριχνε **όλη** την
 *    εφαρμογή, και το ίδιο το ADR-855 §11 το απορρίπτει ονομαστικά.
 */
export type RateLimitFailMode =
  /** Ο μετρητής δεν απάντησε ⇒ **άφησε το αίτημα να περάσει**. Αναγνώσεις, CRUD, assets. */
  | 'open'
  /** Ο μετρητής δεν απάντησε ⇒ **503**. Ταυτότητα, δημόσιες πόρτες, ακριβές πράξεις. */
  | 'closed';

/** Ό,τι ξέρει μια βαθμίδα για τον εαυτό της — όριο, συμπεριφορά σε βλάβη, **και γιατί**. */
export interface RateLimitPolicy {
  /** Αιτήματα ανά παράθυρο. */
  readonly limit: number;
  /** Τι γίνεται όταν ο μετρητής δεν απαντά. */
  readonly failMode: RateLimitFailMode;
  /** ⚠️ **Υποχρεωτικός**: ένας αριθμός χωρίς λόγο είναι ρύθμιση που κανείς δεν μπορεί να κρίνει. */
  readonly why: string;
}

/**
 * **Ο ΕΝΑΣ πίνακας βαθμίδων** — όριο **και** συμπεριφορά σε βλάβη **και** αιτιολογία.
 *
 * 🔑 Μέχρι το ADR-855 αυτός ο πίνακας ήταν `Record<string, number>`: ένας αριθμός δεν έχει
 * πού να κουβαλήσει την απόφαση «τι γίνεται αν πέσει ο μετρητής», οπότε **η απόφαση δεν
 * υπήρχε**. Δεν είναι καλλωπισμός τύπου· είναι το σημείο όπου η ερώτηση γίνεται εκφράσιμη.
 *
 * @enterprise Adjust based on production monitoring
 */
export const RATE_LIMIT_POLICY = {
  /**
   * Immutable binary assets served through an authenticated proxy (ADR-655 asset packs).
   * Distinct traffic class: a content palette legitimately fetches hundreds of sprites on a
   * cold cache, so a CRUD-sized cap (100/min) would be a self-inflicted DoS. Responses are
   * `immutable` + versioned ⇒ each asset is fetched once per browser, ever. The cap stays
   * bounded so a scripted scrape of a whole pack still throttles.
   */
  ASSET: {
    limit: 600,
    failMode: 'open',
    why: 'Αμετάβλητα δυαδικά πίσω από auth· μια αστοχία μετρητή δεν επιτρέπεται να αδειάσει την παλέτα.',
  },
  HIGH: {
    limit: 100,
    failMode: 'open',
    why: 'Λίστες και αναζήτηση — αναγνώσεις. Το κόστος μιας διαρροής είναι κύκλοι, όχι πρόσβαση.',
  },
  STANDARD: {
    limit: 60,
    failMode: 'open',
    why: 'CRUD. Η προεπιλογή· fail-open ώστε βλάβη του Upstash να μη γίνεται βλάβη της εφαρμογής.',
  },
  SENSITIVE: {
    limit: 20,
    failMode: 'closed',
    why:
      'Ταυτότητα και χρήματα: /api/auth/* · /api/oauth/* · διαχείριση χρηστών · GDPR εξαγωγή/διαγραφή. '
      + 'Απεριόριστες προσπάθειες εδώ είναι παράκαμψη εξουσιοδότησης, όχι απώλεια απόδοσης.',
  },
  HEAVY: {
    limit: 10,
    failMode: 'closed',
    // ⚠️ Το σπάσιμο των γραμμών εδώ ΔΕΝ είναι αισθητικό: η RULE 1 του
    //    `validate-project-rules.sh` ψάχνει διαδρομές αποθήκευσης με προθέματα όπως
    //    `'attendance/`, και μια συνέχεια συμβολοσειράς που τυχαίνει να **αρχίζει** με
    //    αυτό διαβάζεται ως hardcoded path. Το `· ` μπαίνει μπροστά ώστε ο έλεγχος να
    //    βλέπει αυτό που είναι: **αιτιολογία**, όχι διαδρομή.
    why:
      'Δημόσιες πόρτες χωρίς ταυτότητα (vendor/quote/[token] · first-contacts/guest/confirm'
      + ' · attendance/qr/validate) και ακριβές πράξεις. Εκεί το όριο ΕΙΝΑΙ ο φρουρός — '
      + 'το ADR-844 §13 και το ADR-170 στηρίζονται ονομαστικά σε αυτό.',
  },
  WEBHOOK: {
    limit: 30,
    failMode: 'open',
    why:
      'Εισερχόμενα από πάροχο (Mailgun · Meta). Fail-closed θα έχανε γεγονότα που ο πάροχος '
      + 'δεν ξαναστέλνει· η αυθεντικότητα κρίνεται από υπογραφή, όχι από το όριο.',
  },
  TELEGRAM: {
    limit: 15,
    failMode: 'open',
    why: 'Bot· ίδιο σκεπτικό με τα webhooks — η ταυτότητα κρίνεται αλλού.',
  },
} as const satisfies Record<string, RateLimitPolicy>;

/**
 * Rate limit category type
 */
export type RateLimitCategory = keyof typeof RATE_LIMIT_POLICY;

/**
 * Rate limit categories and their limits (requests per window).
 *
 * ⚠️ **ΠΑΡΑΓΩΓΗ ΠΡΟΒΟΛΗ, ΟΧΙ ΔΕΥΤΕΡΟΣ ΠΙΝΑΚΑΣ** (ADR-855 · ADR-749). Η αυθεντία είναι το
 * {@link RATE_LIMIT_POLICY}. Δύο χειρόγραφοι πίνακες για το ίδιο ερώτημα θα απέκλιναν την
 * πρώτη φορά που κάποιος άλλαζε τον έναν — το σχήμα που αυτό το δέντρο έχει πληρώσει σε
 * N.12 · N.18 · CHECK 3.38.
 */
export const RATE_LIMIT_CATEGORIES = Object.fromEntries(
  Object.entries(RATE_LIMIT_POLICY).map(([name, policy]) => [name, policy.limit]),
) as { readonly [K in RateLimitCategory]: (typeof RATE_LIMIT_POLICY)[K]['limit'] };

/**
 * **Τι κάνουμε όταν ο μετρητής δεν απάντησε για αυτή τη βαθμίδα;**
 *
 * ⚠️ Άγνωστη βαθμίδα ⇒ `'closed'` (**fail-closed**): μια τιμή που δεν καταλαβαίνουμε δεν
 * επιτρέπεται να διαβαστεί ως «άσε το να περάσει».
 */
export function getCategoryFailMode(category: RateLimitCategory): RateLimitFailMode {
  return RATE_LIMIT_POLICY[category]?.failMode ?? 'closed';
}

/**
 * Endpoint path to category mappings.
 * Used for auto-detection of rate limit category.
 */
export const ENDPOINT_CATEGORY_MAPPINGS: Record<string, RateLimitCategory> = {
  // Admin endpoints - SENSITIVE
  '/api/admin': 'SENSITIVE',
  '/api/admin/buildings': 'SENSITIVE',
  '/api/admin/templates': 'SENSITIVE',

  // 🔴 ADR-855 Α2 — ΤΑ ΔΗΛΩΜΕΝΑ-ΚΑΙ-ΑΠΟΝΤΑ ΤΟΥ ADR-068 §6.
  //
  // Το §6 («Category Assignment Logic») δηλώνει ρητά *«SENSITIVE: `/api/admin/*`,
  // **`/api/auth/*`**, `/api/pricing/*`, `/api/setup/*`»* — και ο πίνακας είχε **μόνο**
  // το πρώτο. Δηλαδή ο ίδιος ο πίνακας είχε αποκλίνει από την πρόθεση του ADR που τον
  // όρισε: **τρίτη** ανεξάρτητη απόκλιση πάνω στο ίδιο ερώτημα (σχήμα ADR-749).
  //
  // ⚠️ Μετρημένο ότι ΔΕΝ είναι θεωρητικό: οι πέντε διαδρομές του `/api/auth/*`
  //    (`session` · `password-reset` · `mfa/enroll/complete` · `email-verification` ·
  //    `workspace-access-request`) και οι τέσσερις του `/api/oauth/*` (`authorize` ·
  //    `token` · `consent-request` · `consents`) δήλωναν **όλες** SENSITIVE μέσω wrapper
  //    και έτρεχαν στα **60** — ακριβώς η επιφάνεια brute-force.
  //
  // 🔑 Το `/api/oauth` ΔΕΝ είναι στο §6 και μπαίνει εδώ **με λόγο**: το §6 γράφτηκε πριν
  //    υπάρξει διακομιστής OAuth (ADR-738). Είναι ταυτότητα, άρα ανήκει στην ίδια βαθμίδα.
  '/api/auth': 'SENSITIVE',
  '/api/oauth': 'SENSITIVE',
  '/api/pricing': 'SENSITIVE',
  '/api/setup': 'SENSITIVE',

  // Search endpoints - HIGH
  [API_ROUTES.SEARCH]: 'HIGH',
  [API_ROUTES.PROJECTS.LIST]: 'HIGH',
  '/api/contacts/list': 'HIGH',

  // Report endpoints - HEAVY
  '/api/reports': 'HEAVY',
  '/api/export': 'HEAVY',
  '/api/analytics': 'HEAVY',

  // Webhook endpoints - WEBHOOK
  '/api/communications/webhooks': 'WEBHOOK',
  // ADR-848 — η διαγραφή ενός κλικ (RFC 8058): δημόσια, την χτυπούν ΜΗΧΑΝΕΣ (Gmail ·
  // Outlook), άρα δικός της κάδος — όχι ο ίδιος με την επικυρωμένη κίνηση CRUD.
  [EMAIL_SUBSCRIPTION_API]: 'WEBHOOK',

  // Telegram - TELEGRAM
  '/api/communications/webhooks/telegram': 'TELEGRAM',
} as const;

/**
 * Default category for unmapped endpoints
 */
export const DEFAULT_RATE_LIMIT_CATEGORY: RateLimitCategory = 'STANDARD';

// =============================================================================
// STORE CONFIGURATION
// =============================================================================

/**
 * Rate limit store type.
 */
export type RateLimitStoreType = 'upstash' | 'memory';

/**
 * Get the appropriate store type based on environment.
 *
 * - Production: Upstash (required, fail-fast if missing)
 * - Development/Test: Memory (with optional Upstash override)
 */
export function getRateLimitStoreType(): RateLimitStoreType {
  const env = getCurrentRuntimeEnvironment();

  // Production: use Upstash if available, fall back to memory
  if (env === 'production') {
    const hasUpstash = Boolean(
      process.env[UPSTASH_ENV_KEYS.URL] && process.env[UPSTASH_ENV_KEYS.TOKEN]
    );
    return hasUpstash ? 'upstash' : 'memory';
  }

  // Staging should use Upstash if available
  if (env === 'staging') {
    const hasUpstash = Boolean(
      process.env[UPSTASH_ENV_KEYS.URL] && process.env[UPSTASH_ENV_KEYS.TOKEN]
    );
    return hasUpstash ? 'upstash' : 'memory';
  }

  // Development/Test: Use memory by default, Upstash if explicitly configured
  const forceUpstash = process.env.RATE_LIMIT_FORCE_UPSTASH === 'true';
  if (forceUpstash) {
    return 'upstash';
  }

  return 'memory';
}

/**
 * Get Upstash configuration from environment.
 *
 * @throws Error in production if Upstash is not configured
 */
export function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env[UPSTASH_ENV_KEYS.URL];
  const token = process.env[UPSTASH_ENV_KEYS.TOKEN];

  if (!url || !token) {
    const env = getCurrentRuntimeEnvironment();

    // Warn in production — fall back to in-memory instead of crashing
    // Previous behavior (throw) was blocking the entire Telegram webhook handler
    if (env === 'production') {
      logger.warn(
        `Upstash Redis not configured in production. Falling back to in-memory rate limiting. ` +
          `Set ${UPSTASH_ENV_KEYS.URL} and ${UPSTASH_ENV_KEYS.TOKEN} for production-grade limiting.`
      );
    }

    return null;
  }

  return { url, token };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get rate limit for a category.
 */
export function getCategoryLimit(category: RateLimitCategory): number {
  return RATE_LIMIT_CATEGORIES[category];
}

/**
 * **Email λογαριασμού ανά ΠΑΡΑΛΗΠΤΗ** (ADR-851) — όχι «αιτήματα ανά καλούντα».
 *
 * 🔴 Το όριο ανά IP (`SENSITIVE`) δεν φτάνει: με πολλές IP κάποιος πλημμυρίζει **ξένο** inbox
 * με email επαναφοράς στο **δικό μας** όνομα. Η ίδια η Firebase περιορίζει ανά διεύθυνση·
 * αφού τα στέλνουμε πλέον εμείς, το όριο το οφείλουμε εμείς. 3 ανά 15′ καλύπτει τον
 * άνθρωπο που δεν βρήκε το πρώτο μήνυμα, και κόβει τον βρόχο.
 */
export const AUTH_MAIL_RECIPIENT_QUOTA = { limit: 3, windowMs: 15 * 60 * 1000 } as const;

/**
 * **Email επιβεβαίωσης της κάρτας ανά ΠΑΡΑΛΗΠΤΗ** (ADR-841 §7 Α21.18) — ίδιο δόγμα με το από πάνω.
 *
 * 🔑 **Ανά 24ω και όχι ανά 15′**: εδώ ο αποστολέας είναι **συνδεδεμένος επαγγελματίας** που έχει
 * βάλει τη διεύθυνση στη δημόσια κάρτα του — δεν λείπει «το πρώτο μήνυμα» σε λίγα λεπτά, λείπει
 * σε ώρες. 3 ανά ημέρα καλύπτουν «δεν το βρήκα / έληξε», και κόβουν τη χρήση της κάρτας ως
 * όπλο βομβαρδισμού **ξένου** γραμματοκιβωτίου (OWASP: ≤10/ημέρα ανά παραλήπτη).
 */
export const SHOWCASE_EMAIL_CONFIRMATION_RECIPIENT_QUOTA = { limit: 3, windowMs: 24 * 60 * 60 * 1000 } as const;

/**
 * Get category for an endpoint path.
 */
export function getEndpointCategory(path: string): RateLimitCategory {
  // Check for prefix matches
  for (const [pattern, category] of Object.entries(ENDPOINT_CATEGORY_MAPPINGS)) {
    if (path.startsWith(pattern)) {
      return category;
    }
  }

  return DEFAULT_RATE_LIMIT_CATEGORY;
}

/**
 * Build a rate limit key for storage.
 *
 * @param identifier - User identifier (companyId:userId or hashed IP)
 * @param endpoint - API endpoint path
 * @returns Namespaced key for storage
 */
export function buildRateLimitKey(identifier: string, endpoint: string): string {
  const base = RATE_LIMIT_KEY_PREFIXES.BASE;
  // Normalize endpoint (remove query params, trailing slashes)
  const normalizedEndpoint = endpoint.split('?')[0].replace(/\/+$/, '');
  // Create a safe key (replace special chars)
  const safeEndpoint = normalizedEndpoint.replace(/[^a-zA-Z0-9]/g, '_');

  return `${base}:${identifier}:${safeEndpoint}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const RATE_LIMIT_CONFIG = {
  WINDOW: RATE_LIMIT_WINDOW,
  CATEGORIES: RATE_LIMIT_CATEGORIES,
  ENDPOINT_MAPPINGS: ENDPOINT_CATEGORY_MAPPINGS,
  DEFAULT_CATEGORY: DEFAULT_RATE_LIMIT_CATEGORY,
  KEY_PREFIXES: RATE_LIMIT_KEY_PREFIXES,
  ENV_KEYS: UPSTASH_ENV_KEYS,
} as const;
