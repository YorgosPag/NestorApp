/**
 * @fileoverview **«Είναι αυτό αποτυχία ΦΟΡΤΩΣΗΣ κώδικα;»** — η ΜΙΑ ταξινόμηση.
 * @related ADR-860 §Ε3 · ADR-858 §5.5
 * @module lib/app-version/chunk-recovery/chunk-load-error
 *
 * 🔑 **ΤΑΞΙΝΟΜΗΣΗ ≠ ΜΕΤΑΦΡΑΣΗ.** Το `components/ui/ErrorBoundary/error-message-translator.ts`
 * κρατά regex στο **μήνυμα** για να δείξει ανθρώπινο κείμενο — και εκεί φτάνει. Εδώ κρίνεται
 * αν θα γίνει **επανάληψη ή ανανέωση**, άρα η κρίση στηρίζεται σε **δομικά** πεδία που γράφουν
 * οι ίδιοι οι φορτωτές του webpack, όχι σε κείμενο.
 *
 * ⛔ **ADR-858 — ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΘΕΡΑΠΕΥΤΕΙ.** Ένα `ReferenceError: Cannot
 * access 'o' before initialization` (κύκλος/TDZ) εμφανίζεται **κατά την αξιολόγηση** module, όχι
 * κατά τη φόρτωση. Αν ταξινομούνταν ως φόρτωση, η ανάκαμψη θα το «θεράπευε» με ανανέωση που
 * ξαναπέφτει στο ίδιο — και θα το έκρυβε από το error boundary. Γι' αυτό: **μόνο** τα σχήματα
 * που παράγουν οι φορτωτές.
 *
 * Τα δύο σχήματα, και τα δύο με `request` (το URL που απέτυχε):
 *   • **JS** — `__webpack_require__.f.j` (μετρημένο στο `.next-oracle`):
 *     `name = "ChunkLoadError"`, `type ∈ { missing, timeout, error }`.
 *   • **CSS** — `mini-css-extract-plugin` runtime: `name = "Error"` (!),
 *     `code = "CSS_CHUNK_LOAD_FAILED"`. Χωρίς αυτή την περίπτωση τα CSS chunks δεν θα
 *     ανέκαμπταν ποτέ, αφού το όνομά τους δεν είναι `ChunkLoadError`.
 */

/** Οι τιμές `type` που γράφει ο φορτωτής JS — κλειστό σύνολο. */
const JS_LOAD_FAILURE_TYPES = ['missing', 'timeout', 'error'] as const;

const CSS_LOAD_FAILURE_CODE = 'CSS_CHUNK_LOAD_FAILED';

/** Σφάλμα φορτωτή chunk (JS ή CSS), με τα δομικά του πεδία ρητά. */
export interface ChunkLoadError extends Error {
  readonly type?: string;
  readonly code?: string;
  readonly request?: string;
}

type LoaderFields = Error & { readonly type?: unknown; readonly code?: unknown; readonly request?: unknown };

function isJsLoadFailure(error: LoaderFields): boolean {
  if (error.name !== 'ChunkLoadError') return false;
  const knownType = typeof error.type === 'string' && (JS_LOAD_FAILURE_TYPES as readonly string[]).includes(error.type);
  return knownType || typeof error.request === 'string';
}

function isCssLoadFailure(error: LoaderFields): boolean {
  return error.code === CSS_LOAD_FAILURE_CODE && typeof error.request === 'string';
}

/**
 * `true` **μόνο** για αποτυχία φόρτωσης από φορτωτή chunk του webpack.
 *
 * ⚠️ Για JS δεν αρκεί το `name`: απαιτείται και `type` από το κλειστό σύνολο **ή** `request`.
 * Ένα χειροποίητο `new Error()` με όνομα `ChunkLoadError` χωρίς αυτά δεν είναι του φορτωτή.
 */
export function isChunkLoadError(error: unknown): error is ChunkLoadError {
  if (!(error instanceof Error)) return false;
  const fields = error as LoaderFields;
  return isJsLoadFailure(fields) || isCssLoadFailure(fields);
}

/** Το URL του chunk που απέτυχε, για τηλεμετρία. `null` αν ο runtime δεν το έδωσε. */
export function chunkRequestOf(error: ChunkLoadError): string | null {
  return typeof error.request === 'string' ? error.request : null;
}
