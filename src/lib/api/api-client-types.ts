/**
 * =============================================================================
 * 🏢 ENTERPRISE API CLIENT — TYPE DEFINITIONS & ERROR CLASSES
 * =============================================================================
 *
 * Types, interfaces, and error classes for the enterprise API client.
 *
 * @module lib/api/api-client-types
 * @see enterprise-api-client.ts (main client)
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestConfig {
  method?: HttpMethod;
  body?: Record<string, unknown> | unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retry?: boolean;
  maxRetries?: number;
  skipAuth?: boolean;
  responseType?: 'auto' | 'json' | 'text' | 'blob';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  timestamp?: string;
  requestId?: string;
}

/** Request context for logging and debugging */
export interface RequestContext {
  method: HttpMethod;
  url: string;
  startTime: number;
  requestId: string;
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;
  /**
   * ⚠️ **ΤΟ ΣΩΜΑ ΤΟΥ ΕΙΝΑΙ ΗΔΗ ΚΑΤΑΝΑΛΩΜΕΝΟ.** Το `handleResponse` κάλεσε `.json()` πάνω
   * του· δεύτερη ανάγνωση πετά `TypeError: body stream already read`. Κρατιέται **μόνο**
   * ως ένδειξη *«ο διακομιστής απάντησε»* έναντι *«δεν έφυγε ποτέ αίτημα»*. Το
   * περιεχόμενο ζει στο {@link errorBody} — **το μοναδικό αντίγραφο**.
   */
  public readonly response?: Response;
  public readonly requestId?: string;
  /** Server-provided technical detail (response body `details`) — the real cause behind a
   *  generic `error` message. Previously discarded, leaving 500s undiagnosable client-side. */
  public readonly details?: string;
  /**
   * 🔴 **ΤΟ ΩΜΟ ΣΩΜΑ ΤΗΣ ΑΡΝΗΣΗΣ** — ADR-834 §6.5.ε.
   *
   * ────────────────────────────────────────────────────────────────────────
   * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: **25 ονομασμένοι λόγοι δεν έφταναν ΠΟΤΕ σε ανθρώπινο μάτι**
   * ────────────────────────────────────────────────────────────────────────
   *
   * Το `handleResponse` διάβαζε το σώμα σε **τοπική** μεταβλητή, κρατούσε τρία πεδία
   * και **πετούσε το υπόλοιπο** — και το `response.json()` καταναλώνει το stream **μία
   * φορά**, οπότε ό,τι δεν εξαγόταν εκεί **χανόταν οριστικά**. Τρεις καταναλωτές
   * (`rejectionOf` · `refusalOf` · `violationsOf`) διάβαζαν `cause.data.*`, πεδίο που
   * **δεν υπήρξε ποτέ** ⇒ έπαιρναν πάντα `undefined` ⇒ **κάθε** άρνηση διακομιστή
   * παρουσιαζόταν ως *«δεν υπήρξε απάντηση, ελέγξτε τη σύνδεσή σας»*. Μετρημένο
   * ζωντανά 2026-08-31: `409 {"error":"no-address"}` ⇒ οθόνη «δικτυακό σφάλμα».
   *
   * ⚠️ **ΤΟ ΟΝΟΜΑ ΕΙΝΑΙ `errorBody` ΚΑΙ ΟΧΙ `data` — ΕΠΙΤΗΔΕΣ.** Το `ApiResponse<T>`
   * **αυτού του αρχείου** έχει ήδη `data?: T` με **άλλο** νόημα *(το ξετυλιγμένο
   * ωφέλιμο)*. Και το Axios λέει `error.response.**data**`: αντιγράφοντας το φύλλο
   * χωρίς το namespace ξανακάναμε **ακριβώς** τη μισή ανάμνηση που γέννησε το bug.
   *
   * ⚠️ **`unknown`, ποτέ `Record<string, unknown>`**: έρχεται από το δίκτυο. Ο τύπος
   * **οφείλει** να αναγκάζει τον καταναλωτή σε φρουρό — δες {@link apiErrorBodyOf}.
   *
   * 🔴 **ΔΕΝ μπαίνει στο {@link toJSON}, ΠΟΤΕ.** Κάθε `logger.error({ error })` και κάθε
   * breadcrumb θα σειριοποιούσε αυθαίρετα σώματα διακομιστή — και σε αυτές τις
   * διαδρομές περνούν **στοιχεία επαφών**. Η διάγνωση έχει ήδη `errorCode`+`details`.
   */
  public readonly errorBody?: unknown;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    response?: Response,
    requestId?: string,
    details?: string,
    errorBody?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.response = response;
    this.requestId = requestId;
    this.details = details;
    this.errorBody = errorBody;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiClientError);
    }
  }

  static isApiClientError(error: unknown): error is ApiClientError {
    return error instanceof ApiClientError;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      requestId: this.requestId,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Contract Violation Error — thrown when API returns 200 OK but
 * response doesn't match expected canonical format.
 */
export class ContractViolationError extends ApiClientError {
  public readonly endpoint: string;
  public readonly receivedKeys: string[];
  public readonly expectedFormat: string;

  constructor(
    endpoint: string,
    status: number,
    requestId: string,
    receivedKeys: string[],
    expectedFormat: string = '{ success: boolean, data: T }'
  ) {
    const message = `API Contract Violation: ${endpoint} returned ${status} but response does not match canonical format. ` +
      `Expected: ${expectedFormat}. Received keys: [${receivedKeys.join(', ')}]`;

    super(message, status, 'CONTRACT_VIOLATION', undefined, requestId);
    this.name = 'ContractViolationError';
    this.endpoint = endpoint;
    this.receivedKeys = receivedKeys;
    this.expectedFormat = expectedFormat;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContractViolationError);
    }
  }

  static isContractViolationError(error: unknown): error is ContractViolationError {
    return error instanceof ContractViolationError;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function hasContentTypeHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
}

export function isBinaryRequestBody(body: unknown): body is BodyInit {
  return typeof body === 'string'
    || body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof Blob
    || body instanceof ArrayBuffer
    || ArrayBuffer.isView(body);
}

export function shouldSerializeBodyAsJson(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  return !isBinaryRequestBody(body);
}

// =============================================================================
// ΤΟ ΣΩΜΑ ΤΗΣ ΑΡΝΗΣΗΣ — ADR-834 §6.5.ε
// =============================================================================

/** Τα πεδία που ο client εξάγει από ένα σώμα σφάλματος. */
export interface ErrorFields {
  readonly message?: string;
  readonly errorCode?: string;
  readonly details?: string;
}

/**
 * **Τι λέει το σώμα σφάλματος για τον εαυτό του.**
 *
 * 🔑 Εξαγμένο από το `handleResponse` επειδή εκείνο ήταν **ήδη 46 γραμμές** (όριο 40,
 * N.7.1) και το αρχείο του **477/500**. Εδώ δεν υπάρχει όριο *(`/-types\.tsx?$/`)*, άρα
 * η αιτιολόγηση ζει **δίπλα στην απόφαση** αντί να συμπιεστεί σε μονόγραμμο σχόλιο.
 *
 * ⚠️ **Το `||` και το `as string` διατηρούνται όπως ήταν**, επίτηδες: αλλαγή τους θα
 * μετακινούσε τη σημασιολογία του `message`/`errorCode` που **33 σημεία** διαβάζουν —
 * μηδέν νέα δυνατότητα, μέγιστη ακτίνα. Το ελάττωμα δεν ήταν εδώ.
 */
export function errorFieldsFrom(body: unknown): ErrorFields {
  if (body === null || typeof body !== 'object') return {};

  const record = body as Record<string, unknown>;
  return {
    message: (record.error as string) || undefined,
    errorCode: (record.errorCode as string) || undefined,
    details: record.details as string | undefined,
  };
}

/**
 * **Το σώμα της άρνησης, αν όντως απάντησε ο διακομιστής μας.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΕΝΑΣ ΚΡΙΤΗΣ ΠΟΥ ΕΛΕΙΠΕ — ΚΑΙ ΤΟΝ ΠΑΡΕΚΑΜΠΤΑΝ **ΚΑΙ ΟΙ ΤΡΕΙΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τρεις αναγνώστες έγραφαν ο καθένας το δικό του `(cause as { data?: … })?.data`. Αυτό
 * το δομικό cast είναι **ταυτόχρονα ελλιπές και υπερβολικά επιτρεπτικό**: δεν έβρισκε
 * ποτέ το σώμα *(δεν υπήρχε πεδίο `data`)*, αλλά θα ταίριαζε σε **οποιοδήποτε**
 * throwable με πεδίο `data` — π.χ. σφάλμα Firebase. Το ένα λάθος **έκρυβε** το άλλο:
 * όσο δεν πυροδοτούσε ποτέ, κανείς δεν έβλεπε πόσο πλατύ ήταν.
 *
 * 🔑 Εδώ η ερώτηση γίνεται **μία και ρητή**: *«είναι σφάλμα του ΔΙΚΟΥ ΜΑΣ client, και
 * κουβαλά αντικείμενο;»*. Το `isApiClientError` είναι το SSoT του έργου με 20+ σημεία
 * κλήσης — δεν γεννιέται νέος μηχανισμός, **ζητείται ο υπάρχων**.
 *
 * ⚠️ **Επίτηδες ΣΤΕΝΟΣ.** Δεν δέχεται όνομα πεδίου ούτε φρουρό: τα δύο σχήματα του
 * τομέα διαφωνούν για το **ποιο** πεδίο φέρει τον λόγο *(`error` έναντι `reason` πίσω
 * από τον διακριτή `DECISION_REFUSED`)*, και η διαφορά είναι **απόφαση ασφαλείας**
 * (ADR-787 Ε-5), όχι ατύχημα. Ένας γενικός `rejectionFrom(cause, field, guard)` θα την
 * **έκρυβε** ακριβώς από τον αναγνώστη που πρέπει να τη δει.
 *
 * ⚠️ Πίνακας ⇒ `null`: κανένα από τα σχήματά μας δεν είναι πίνακας στη ρίζα.
 */
export function apiErrorBodyOf(cause: unknown): Record<string, unknown> | null {
  if (!ApiClientError.isApiClientError(cause)) return null;

  const { errorBody } = cause;
  if (errorBody === null || typeof errorBody !== 'object' || Array.isArray(errorBody)) {
    return null;
  }

  return errorBody as Record<string, unknown>;
}
