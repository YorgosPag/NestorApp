/**
 * =============================================================================
 * ΓΙΑΤΙ ΔΕΝ ΚΑΤΕΒΗΚΕ ΤΟ ΜΕΣΟ (ADR-934 §5.2 Μ9 · §5.2.2 Μ-β2) — ΡΙΖΑ, CHECK 3.73
 * =============================================================================
 *
 * Το **κλειστό** σύνολο κωδικών αποτυχίας μιας λήψης μέσου από διεύθυνση. Κάθε αποτυχία είναι **δηλωμένη** και
 * ξαναδοκιμάσιμη (Μ9), ποτέ σιωπηλή, και δεν μπλοκάρει τις τιμές του ίδιου προϊόντος.
 *
 * 🔑 **Δύο οικογένειες**: η **μεταφορά** (ο φρουρός SSRF απέρριψε ή ο τρίτος δεν απάντησε) και το **περιεχόμενο** (τα
 *   bytes ήρθαν αλλά δεν είναι αρχείο αυτού του ρόλου). Ο άνθρωπος διορθώνει άλλα πράγματα σε καθεμιά.
 * 🔑 **Δεμένο στον φρουρό**: ο πίνακας {@link ASSET_FETCH_FAILURE_OF_REJECTION} είναι `Record<GuardedFetchRejection,…>` —
 *   νέος λόγος απόρριψης στο `outbound-fetch` σπάει τη μεταγλώττιση εδώ, αντί να γίνει σιωπηλά «σφάλμα».
 *
 * @module subapps/catalog/vocabulary/asset-fetch
 */

import type { GuardedFetchRejection } from '@/lib/security/outbound-fetch';

export const ASSET_FETCH_FAILURES = [
  // ── μεταφορά ──
  'notFound', // 404 · 410: ο σύνδεσμος του προμηθευτή δεν δείχνει πια αρχείο
  'httpError', // κάθε άλλη απάντηση εκτός 2xx/304, ή σύνδεση που έπεσε
  'timeout',
  'tooLarge', // πάνω από το όριο του είδους — δηλωμένο ή μετρημένο μέσα στη ροή
  'notPublic', // η διεύθυνση λύνεται σε ιδιωτική/εσωτερική IP (SSRF)
  'dnsFailed',
  'tooManyRedirects',
  'invalidUri', // συντακτικά άκυρη · όχι http(s) · με διαπιστευτήρια
  // ── περιεχόμενο ──
  'notAFile', // σελίδα HTML (σύνδεση · «404» με 200)
  'unknownContent', // τα bytes δεν είναι τύπος που γνωρίζει το μητρώο αρχείων
  'kindMismatch', // αρχείο αναγνωρίσιμο, αλλά όχι είδος που δέχεται ο ρόλος
  'typeConflict', // η διεύθυνση/ο τύπος δηλώνουν άλλη οικογένεια από τα bytes
  // ── φύλαξη ──
  'contentUnavailable', // η εγγραφή αυτών των bytes υπάρχει αλλά δεν είναι δική μας (ξένη · αλλοιωμένη)· κάδος/επιτύμβιο ΔΕΝ φτάνουν εδώ (Μ-β5: ανάσταση)
] as const;

export type AssetFetchFailure = (typeof ASSET_FETCH_FAILURES)[number];

/** Ο λόγος απόρριψης του φρουρού → κωδικός αποτυχίας. Το `http_error` εξειδικεύεται από τον κωδικό HTTP. */
export const ASSET_FETCH_FAILURE_OF_REJECTION: Readonly<Record<GuardedFetchRejection, AssetFetchFailure>> = {
  malformed: 'invalidUri',
  scheme_not_https: 'invalidUri',
  credentials_in_url: 'invalidUri',
  fragment_present: 'invalidUri',
  hostname_missing: 'invalidUri',
  address_not_public: 'notPublic',
  dns_failed: 'dnsFailed',
  http_error: 'httpError',
  too_large: 'tooLarge',
  timeout: 'timeout',
  too_many_redirects: 'tooManyRedirects',
};

/** Το αρχείο **δεν υπάρχει πια** (όχι προσωρινό σφάλμα): ξαναδοκιμή δεν θα βοηθήσει χωρίς νέο σύνδεσμο. */
const GONE_STATUSES: ReadonlySet<number> = new Set([404, 410]);

/** Η αποτυχία μεταφοράς ως κωδικός — η ΜΙΑ αντιστοίχιση, για τον server (Μ-β4) και κάθε αναφορά. */
export function assetFetchFailureOf(rejection: GuardedFetchRejection, status: number | null): AssetFetchFailure {
  const failure = ASSET_FETCH_FAILURE_OF_REJECTION[rejection];
  return failure === 'httpError' && status !== null && GONE_STATUSES.has(status) ? 'notFound' : failure;
}

// ── Η ουρά λήψεων μιας παρτίδας (ADR-934 §5.2.2 Μ-β4) ─────────────────────────────────────────────────────────────────

/**
 * Η κατάσταση μιας διεύθυνσης μέσα στην παρτίδα: `queued` = καμία λήψη ακόμη (δεν γράφεται ποτέ — είναι η **απουσία** εγγράφου,
 * ή μίσθωση που έληξε) · `fetching` · `ready` · `failed`.
 */
export const ASSET_FETCH_STATUSES = ['queued', 'fetching', 'ready', 'failed'] as const;
export type AssetFetchStatus = (typeof ASSET_FETCH_STATUSES)[number];

/** Όσες γράφει ο server — το `queued` είναι κατάσταση της όψης, όχι του εγγράφου. */
export type StoredAssetFetchStatus = Exclude<AssetFetchStatus, 'queued'>;

/**
 * Η μίσθωση μιας λήψης: πάνω από το `maxDuration` της διαδρομής (300″). Μετά από αυτό, όποιος την κράτησε δεν υπάρχει πια
 * και η διεύθυνση ξαναδιεκδικείται (πρότυπο `plan-reading-store`).
 */
export const ASSET_FETCH_LEASE_MS = 330_000;

/** Πόσες λήψεις τρέχουν μαζί από μία οθόνη — και πόσες προς τον **ίδιο** server (ευγένεια προς τον CDN του προμηθευτή). */
export const ASSET_FETCH_CONCURRENCY = 3;
export const ASSET_FETCH_PER_HOST = 2;

/** Πόσες ανακατευθύνσεις ακολουθεί η λήψη, με πλήρη επανέλεγχο κάθε άλματος (CDN → υπογεγραμμένο URL αποθήκευσης). */
export const ASSET_FETCH_MAX_REDIRECTS = 5;

/**
 * Το μέγιστο μήκος διεύθυνσης που δέχεται η πόρτα λήψης: RFC 9110 §4.1 συνιστά υποστήριξη **τουλάχιστον 8000** οκτάδων. Ο
 * αναγνώστης xChange δεν κόβει διευθύνσεις, άρα η πόρτα πρέπει να δέχεται ό,τι μπορεί να έχει μια πρόταση.
 */
export const ASSET_URI_MAX_LENGTH = 8192;

/**
 * Τα χρονικά όρια μιας λήψης. Το **συνολικό** μένει κάτω από το `maxDuration` της διαδρομής (300″), ώστε να προλαβαίνουν η
 * αντιγραφή στον κάδο και το κλείσιμο. Οι **κεφαλίδες** περιμένουν λίγο: server που δεν απαντά δεν κρατά τη λήψη τέσσερα
 * λεπτά. Η **σιωπή** ανάμεσα σε δύο κομμάτια κρίνεται από τον φρουρό (`IDLE_TIMEOUT_MS`).
 */
export const ASSET_FETCH_DEADLINE_MS = 240_000;
export const ASSET_FETCH_HEADERS_TIMEOUT_MS = 30_000;

/**
 * Πόσες ημέρες μένει στον κάδο ένα περιεχόμενο καραντίνας που δεν το κρατά καμία ανοιχτή παρτίδα (ADR-934 §5.2.2 Μ-β5) —
 * **ενιαία**, όχι ανά κατηγορία (`TRASH_RETENTION_BY_CATEGORY` δίνει 90 σε ένα BIM): τα bytes είναι **ανακτήσιμα** από τον
 * προμηθευτή, άρα ο κάδος αγοράζει μόνο το «ξαναφέρνω το διορθωμένο αρχείο χωρίς να ξανακατεβεί τίποτα». 30 = ο κάδος του
 * Google Drive (2020), του Box και του Microsoft 365. Όσο είναι στον κάδο, η ίδια ζήτηση το **επαναφέρει** μόνη της.
 */
export const CATALOG_MEDIA_QUARANTINE_TRASH_DAYS = 30;

/**
 * Το πρόθεμα των **προσωρινών** αντικειμένων μιας λήψης (πριν την προαγωγή στο κλειδί του περιεχομένου) — ένα, ώστε ο κανόνας
 * κύκλου ζωής του κάδου (`private-bucket-registry`, Μ-β5) να τα βρίσκει όλα. Κανονικά σβήνονται στο `finally` της ροής·
 * ο κανόνας πιάνει ό,τι αφήνει πίσω ένας server που έπεσε στη μέση.
 */
export const CATALOG_MEDIA_STAGING_PREFIX = 'staging/catalog-media';

/** Ηλικία (ημέρες) μετά την οποία ο κάδος σβήνει προσωρινό αντικείμενο λήψης — μία λήψη κρατά το πολύ ~5′ (`maxDuration`). */
export const CATALOG_MEDIA_STAGING_TTL_DAYS = 1;
