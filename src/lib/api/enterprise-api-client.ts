/**
 * =============================================================================
 * 🏢 ENTERPRISE AUTHENTICATED API CLIENT - SINGLE SOURCE OF TRUTH
 * =============================================================================
 *
 * Centralized API client for all authenticated requests.
 * Fortune-500 pattern (SAP, Salesforce, Microsoft, Google).
 *
 * Split into SRP modules (ADR-065):
 * - api-client-types.ts — types, error classes, helper functions
 *
 * @module lib/api/enterprise-api-client
 * @see ADR-212 Phase 9 — sleep() centralized
 */

// ⚠️ **Ο ΕΝΑΣ μηχανισμός αναμονής ταυτότητας του έργου** — γεννήθηκε για τη διαδρομή
//    Firestore (`requireAuthContext`) και εδώ αποκτά τον **δεύτερο** καταναλωτή του.
//    ⛔ ΜΗΝ γράψεις δεύτερο· ούτε με `auth.authStateReady()` (ο λόγος είναι γραμμένος εκεί).
import { auth, waitForAuthReady } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { generateRequestId as _generateRequestId } from '@/services/enterprise-id.service';
import { sleep, withTimeout } from '@/lib/async-utils';
// ⚠️ **Οι μηχανικές του καλωδίου, χωρίς κράτος** (ADR-826 §4.3): ήταν ιδιωτικές μέθοδοι
//    αυτής της κλάσης, αλλά **καμία** δεν άγγιζε το `this`. Έφυγαν όταν το φράγμα
//    ετοιμότητας ταυτότητας πέρασε το αρχείο τις 500 γραμμές (N.7.1) — **εξαγωγή, όχι
//    ψαλίδισμα σχολίων**: το όριο ζητά να φύγει ευθύνη.
import { shouldRetry, calculateBackoff, buildUrl, fetchWithTimeout } from './api-client-transport';
import { createModuleLogger } from '@/lib/telemetry';

// Re-export all types for consumers
export type {
  HttpMethod,
  ApiRequestConfig,
  ApiResponse,
  RequestContext,
} from './api-client-types';

export {
  ApiClientError,
  ContractViolationError,
  hasContentTypeHeader,
  isBinaryRequestBody,
  shouldSerializeBodyAsJson,
  // 🔴 ADR-834 §6.5.ε — ο ΕΝΑΣ κριτής του σώματος άρνησης, για τους τρεις αναγνώστες
  //    που τον παρέκαμπταν ο καθένας με δικό του δομικό cast.
  apiErrorBodyOf,
  errorFieldsFrom,
} from './api-client-types';

import type {
  HttpMethod,
  ApiRequestConfig,
  ApiResponse,
  RequestContext,
} from './api-client-types';

import {
  ApiClientError,
  ContractViolationError,
  shouldSerializeBodyAsJson,
  hasContentTypeHeader,
  errorFieldsFrom,
} from './api-client-types';

const logger = createModuleLogger('enterprise-api-client');

/**
 * 🔴 **ΤΟ ΦΡΑΓΜΑ ΤΗΣ ΑΝΑΜΟΝΗΣ ΤΑΥΤΟΤΗΤΑΣ — και γιατί ΑΚΡΙΒΩΣ αυτός ο αριθμός.**
 *
 * **ΔΕΝ είναι διαλεγμένο από το μυαλό κάποιου.** Παράγεται από το φράγμα που το ίδιο το
 * Firebase SDK βάζει στο δίκτυό του: `DEFAULT_API_TIMEOUT_MS = new Delay(30000, 60000)`,
 * και το `Delay.get()` επιστρέφει **30 000 ms** σε desktop web *(60 000 μόνο σε Cordova /
 * React Native)*, ή **5 000** όταν `navigator.onLine === false`.
 *
 * ⇒ **Κάθε τιμή κάτω από 30 000 στοιχηματίζει ότι το SDK είναι γρηγορότερο από ό,τι
 * υπόσχεται** — και όταν χάνει το στοίχημα, ξαναγεννά **ακριβώς** το ελάττωμα που αυτός ο
 * κώδικας διορθώνει, στον πληθυσμό που το υφίσταται περισσότερο *(αργό κρύο ξεκίνημα)*.
 * Τα 5 000 επιπλέον είναι περιθώριο για τα σκέλη που **δεν** είναι δίκτυο (IndexedDB).
 *
 * 🔑 **Γιατί υπάρχει φράγμα, αφού το δίκτυο είναι ήδη φραγμένο**: το SDK **δεν** φράζει
 * κολλημένο persistence *(ιδιωτικό παράθυρο, μπλοκαρισμένο IndexedDB)*. Χωρίς φράγμα, εκεί
 * η οθόνη γυρίζει **για πάντα** — και επειδή τα hooks ζωγραφίζουν το «Δοκιμάστε ξανά»
 * **από τον κλάδο σφάλματος**, χωρίς σφάλμα ο άνθρωπος χάνει και **την παράκαμψη** που τον
 * κρατούσε. Δηλαδή «καμία αναμονή» θα ήταν το **μόνο** σενάριο χειρότερο από το σημερινό.
 */
const AUTH_READY_TIMEOUT_MS = 35_000;

// =============================================================================
// ENTERPRISE API CLIENT CLASS
// =============================================================================

export class EnterpriseApiClient {
  private static instance: EnterpriseApiClient;
  private currentUser: FirebaseUser | null = null;
  private tokenCache: { token: string; expiresAt: number } | null = null;
  private superAdminCompanyId: string | null = null;
  /**
   * Η **αρχική** ετοιμότητα της ταυτότητας — απομνημονευμένη, **τεμπέλικα** δημιουργημένη.
   *
   * 🔑 **Απομνημόνευση**: το `buildHeaders` καλείται **μέσα** στον βρόχο `while` των
   * επαναλήψεων, άρα χωρίς αυτό το πεδίο η αναμονή θα πληρωνόταν έως **τρεις** φορές ανά
   * αίτημα. Απομνημονεύεται η *αρχική* ετοιμότητα, που είναι ακριβώς η σημασία του όρου:
   * *«έμαθα ποιος είναι — ή ότι δεν είναι κανείς»*. Δεν οπλίζεται ξανά σε αποσύνδεση,
   * γιατί τότε το `auth.currentUser` είναι ήδη `null` και η απάντηση πρέπει να είναι
   * **γρήγορο** `401`, όχι νέα αναμονή.
   *
   * 🔴 **ΠΟΤΕ στον constructor.** Το `export const apiClient = …getInstance()` τρέχει στο
   * **import**· δύο σουίτες φορτώνουν τον πραγματικό client με διπλό `auth` που ορίζει
   * μόνο `onAuthStateChanged`. Πρόθυμη δημιουργία θα τις έριχνε **πριν** τρέξει καμία
   * δοκιμή. Και ένα promise που δημιουργείται χωρίς να το περιμένει κανείς μπορεί να
   * γεννήσει `unhandledrejection` → `ErrorTracker` → `apiClient` → πίσω εδώ.
   */
  private authReady: Promise<unknown> | null = null;

  static getInstance(): EnterpriseApiClient {
    if (!EnterpriseApiClient.instance) {
      EnterpriseApiClient.instance = new EnterpriseApiClient();
    }
    return EnterpriseApiClient.instance;
  }

  setSuperAdminCompanyId(id: string | null): void {
    this.superAdminCompanyId = id;
  }

  private constructor() {
    if (typeof window !== 'undefined' && auth) {
      auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        if (!user) this.tokenCache = null;
      });
    }
  }

  // ===========================================================================
  // CORE HTTP METHODS
  // ===========================================================================

  async get<T = unknown>(url: string, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  async post<T = unknown>(url: string, body?: Record<string, unknown> | unknown, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'POST', body });
  }

  async put<T = unknown>(url: string, body?: Record<string, unknown> | unknown, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'PUT', body });
  }

  async patch<T = unknown>(url: string, body?: Record<string, unknown> | unknown, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'PATCH', body });
  }

  async delete<T = unknown>(url: string, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  // ===========================================================================
  // MAIN REQUEST METHOD
  // ===========================================================================

  async request<T = unknown>(url: string, config: ApiRequestConfig = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      params,
      timeout = 60000,
      retry = true,
      maxRetries = 3,
      skipAuth = false,
      responseType = 'auto',
    } = config;

    const fullUrl = buildUrl(url, params);
    const requestId = _generateRequestId();

    const context: RequestContext = {
      method, url: fullUrl, startTime: Date.now(), requestId,
    };

    let lastError: Error | null = null;
    let attempts = 0;
    let authRefreshed = false;
    let forceTokenRefresh = false;

    while (attempts < (retry ? maxRetries : 1)) {
      attempts++;

      try {
        const requestHeaders = await this.buildHeaders(headers, skipAuth, body, forceTokenRefresh);
        const fetchOptions: RequestInit = { method, headers: requestHeaders };

        if (body !== undefined && body !== null) {
          fetchOptions.body = shouldSerializeBodyAsJson(body)
            ? JSON.stringify(body) : body as BodyInit;
        }

        this.logRequest(context, attempts, maxRetries);
        const response = await fetchWithTimeout(fullUrl, fetchOptions, timeout);
        const result = await this.handleResponse<T>(response, context, responseType);
        this.logSuccess(context, response.status);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 🔐 Stale-token recovery: a 401 means our cached Firebase ID token was
        // rejected server-side (expired / revoked / claims changed) — even though
        // the Firebase SDK itself (e.g. Storage uploads) still works with its own
        // fresh token. Force-refresh the ID token once and retry, independent of
        // the normal retry budget so it also works when retry is disabled.
        // Idempotent: the rejected request never reached the route handler.
        // ⚠️ **«ΑΠΕΡΡΙΨΕ Ο ΔΙΑΚΟΜΙΣΤΗΣ» ≠ «ΔΕΝ ΕΦΥΓΕ ΠΟΤΕ».** Το `getIdToken` πετά κι
        //    αυτό `401` με τον **ίδιο** κωδικό, όταν η ταυτότητα έχει λυθεί και δεν είναι
        //    κανείς συνδεδεμένος — αίτημα που **δεν έφυγε** στο δίκτυο. Ανανέωση token εκεί
        //    είναι εξ ορισμού άσκοπη: ξαναπετά αμέσως, καίγοντας μια επανάληψη. Ο
        //    `ApiClientError` κρατά το `response` **μόνο** όταν προήλθε από απάντηση —
        //    άρα η ίδια η δομή του σφάλματος ξεχωρίζει τα δύο, χωρίς νέο λεξιλόγιο.
        if (
          !skipAuth &&
          !authRefreshed &&
          ApiClientError.isApiClientError(error) &&
          error.statusCode === 401 &&
          error.response !== undefined
        ) {
          authRefreshed = true;
          forceTokenRefresh = true;
          this.tokenCache = null;
          attempts--; // do not consume a normal retry slot for the auth refresh
          continue;
        }

        const shouldRetryNow = shouldRetry(error, attempts, maxRetries, retry);

        if (shouldRetryNow) {
          const delay = calculateBackoff(attempts);
          logger.warn(`[API] Retrying request (${attempts}/${maxRetries}) after ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        this.logError(context, lastError);
        throw lastError;
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  // ===========================================================================
  // AUTHENTICATION
  // ===========================================================================

  private async getIdToken(forceRefresh: boolean = false): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('API client cannot run on server - Firebase auth requires browser environment');
    }

    // 🔴 **Ο ΑΓΩΝΑΣ ΔΡΟΜΟΥ ΤΗΣ ΤΑΥΤΟΤΗΤΑΣ — «ΔΕΝ ΞΕΡΩ ΑΚΟΜΗ» ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΥΠΑΡΧΕΙ».**
    //
    // Ως τις 2026-08-28 η γραμμή παρακάτω πετούσε `401` **συγχρόνως** όταν το Firebase δεν
    // είχε προλάβει να αποκαταστήσει τη συνεδρία, και το `onAuthStateChanged` του
    // constructor **απλώς κατέγραφε** τον χρήστη αργότερα — δεν ξαναζητούσε τίποτα.
    // Μετρημένο ζωντανά: σε φόρτωση σελίδας αναφορών, **0 από 251** αιτήματα έφτασαν στο
    // δίκτυο. Το «Δοκιμάστε ξανά» δούλευε **πάντα**, γιατί ως τότε η ταυτότητα είχε λυθεί.
    //
    // 🔑 **ΕΝΑ σημείο, όχι δέκα.** Πάσχουν **δέκα** hooks με πανομοιότυπο σχήμα
    // (`useEffect(() => { fetchData(); }, [fetchData])` χωρίς καμία αναφορά σε ταυτότητα).
    // Μπάλωμα σε κάθε ένα θα ήταν copy-paste οικογένεια (**N.0.2**, **N.18**) που **δεν**
    // θα προστάτευε το ενδέκατο hook — αυτό που θα γραφτεί αύριο. Η μεταφορά είναι το
    // μόνο σημείο απ' όπου περνούν **όλοι**.
    //
    // 🔑 **ΚΑΙ Ο ΜΗΧΑΝΙΣΜΟΣ ΥΠΗΡΧΕ ΗΔΗ.** Το `waitForAuthReady` δεν γράφτηκε για εδώ: το
    // `requireAuthContext` εφαρμόζει **αυτή ακριβώς** την πύλη — με σχόλιο που περιγράφει
    // το ίδιο ελάττωμα — για τη διαδρομή **Firestore**. Η διαδρομή **HTTP** δεν είχε πάρει
    // ποτέ την ίδια θεραπεία. Δεύτερος **καταναλωτής**, όχι δεύτερος **μηχανισμός**.
    //
    // ⚠️ **«Περίμενε να ΜΑΘΕΙΣ» ≠ «περίμενε να ΣΥΝΔΕΘΕΙ»**: η αναμονή τελειώνει στην πρώτη
    // απάντηση, **και όταν αυτή είναι `null`** — οπότε ο έλεγχος από κάτω πετά κανονικά
    // `401`, **γρήγορα**. Ο αποσυνδεδεμένος δεν κρεμάει ποτέ.
    //
    // ⚠️ **Η πύλη `!auth.currentUser` δεν είναι βελτιστοποίηση, είναι σημασιολογία**: αν
    // ξέρουμε ήδη ποιος ρωτά, δεν υπάρχει τίποτα να περιμένουμε. Κάθε αίτημα μετά το πρώτο
    // κοστίζει **μηδέν** — ούτε `await`, ούτε promise. Ίδιο ιδίωμα με το `requireAuthContext`.
    if (!auth.currentUser) {
      this.authReady ??= withTimeout(waitForAuthReady(), AUTH_READY_TIMEOUT_MS).catch(
        (error: unknown) => {
          // Λήξη ή αστοχία ⇒ **πέφτουμε στη σημερινή συμπεριφορά**: διάβασε ό,τι ξέρεις και
          // πες την αλήθεια. Το φράγμα δεν μπορεί έτσι **ποτέ** να κάνει κάτι χειρότερο από
          // πριν — αλλά **δεν σιωπά**: σιωπηλή πτώση θα ξαναέφτιαχνε ακριβώς το αδιάγνωστο
          // λάθος σφάλμα που μας κόστισε αυτή τη διόρθωση.
          logger.warn('Auth readiness did not settle; proceeding with what is known', {
            timeoutMs: AUTH_READY_TIMEOUT_MS,
            reason: error instanceof Error ? error.message : String(error),
          });
        },
      );
      await this.authReady;
    }

    const user = auth.currentUser || this.currentUser;
    if (!user) {
      throw new ApiClientError('User not authenticated', 401, 'AUTHENTICATION_REQUIRED');
    }

    if (!forceRefresh && this.tokenCache) {
      if (this.tokenCache.expiresAt - Date.now() > 2 * 60 * 1000) {
        return this.tokenCache.token;
      }
    }

    try {
      const token = await user.getIdToken(forceRefresh);
      this.tokenCache = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
      return token;
    } catch (error) {
      logger.error('[API] Failed to get ID token', { error });
      throw new ApiClientError('Failed to get authentication token', 401, 'TOKEN_RETRIEVAL_FAILED');
    }
  }

  private async buildHeaders(
    customHeaders: Record<string, string>,
    skipAuth: boolean,
    body?: unknown,
    forceTokenRefresh: boolean = false,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...customHeaders };

    if (shouldSerializeBodyAsJson(body) && !hasContentTypeHeader(headers)) {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth) {
      const token = await this.getIdToken(forceTokenRefresh);
      headers['Authorization'] = `Bearer ${token}`;
      if (this.superAdminCompanyId) {
        headers['X-Super-Admin-Company-Id'] = this.superAdminCompanyId;
      }
    }

    return headers;
  }

  // ===========================================================================
  // RESPONSE HANDLING
  // ===========================================================================

  private async handleResponse<T>(
    response: Response,
    context: RequestContext,
    responseType: ApiRequestConfig['responseType'] = 'auto'
  ): Promise<T> {
    const { status, statusText } = response;

    if (status >= 200 && status < 300) {
      return this.parseResponseBody<T>(response, context, responseType);
    }

    // 🔴 ADR-834 §6.5.ε — το σώμα **επιβιώνει**. Το `.json()` καταναλώνει το stream μία
    //    φορά· ό,τι δεν κρατηθεί εδώ χάνεται οριστικά (δες `ApiClientError.errorBody`).
    //    `undefined` όταν το σώμα δεν είναι JSON (π.χ. HTML 502 από proxy) — ποτέ `{}`.
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch { /* μη-JSON σώμα: μένει undefined, τα defaults παρακάτω αναλαμβάνουν */ }

    const fields = errorFieldsFrom(errorBody);

    if (status === 401) this.tokenCache = null;

    // ⚠️ **Σειρά ΤΑΥΤΟΣΗΜΗ με πριν, και ο ΕΝΑΣ πίνακας που έφυγε ήταν ΝΕΚΡΟΣ.**
    //    Εδώ ζούσε ένα `ERROR_MAP` με έξι ζεύγη *(401 «Authentication required», 409
    //    «Version conflict», …)*, που διαβαζόταν ως `errorMessage || mapped?.msg` και
    //    `errorCode || mapped?.code`. Και τα δύο αριστερά σκέλη ήταν **πάντα truthy**
    //    (`statusText || 'Request failed'` · `HTTP_${status}`) ⇒ **κανένα** από τα δώδεκα
    //    δεν διαβάστηκε ποτέ. Η αφαίρεσή του είναι **ισοδύναμη** — καμία συμπεριφορά δεν
    //    αλλάζει· απλώς ο κώδικας παύει να υπόσχεται εναλλακτική που δεν είχε (ADR-834 §7).

    throw new ApiClientError(
      fields.message || statusText || 'Request failed',
      status,
      fields.errorCode || `HTTP_${status}`,
      response,
      context.requestId,
      fields.details,
      errorBody
    );
  }

  private async parseResponseBody<T>(
    response: Response,
    context: RequestContext,
    responseType: ApiRequestConfig['responseType'] = 'auto'
  ): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (responseType === 'blob') return response.blob() as Promise<T>;
    if (responseType === 'text') return (await response.text()) as T;
    if (responseType === 'json') return await response.json() as T;
    if (response.status === 204) return undefined as T;

    if (contentType?.includes('application/json')) {
      const json = await response.json();

      if (json && typeof json === 'object') {
        const keys = Object.keys(json);

        if ('success' in json && 'data' in json) {
          const apiResponse = json as ApiResponse<T>;
          if (apiResponse.success !== true) {
            throw new ContractViolationError(
              context.url, response.status, context.requestId, keys,
              '{ success: true, data: T } (success should be true for 2xx status)'
            );
          }
          return apiResponse.data as T;
        }

        // Non-canonical 200 response. This is tracked dev tech-debt (see
        // docs/API_CONTRACT_MIGRATION_PLAN.md), NOT a user-actionable warning — the
        // consumers depend on the raw shape, so it cannot be "fixed" at call time.
        // Logged at DEBUG so it stays available when investigating (LOG_LEVEL=debug)
        // without flooding the browser console on every request (ADR-036: demote, don't suppress).
        logger.debug(`[API Contract] ${context.url} returned 200 but not canonical format. Keys: [${keys.join(', ')}]`);
        return json as T;
      }

      return json as T;
    }

    if (contentType?.includes('text/')) return (await response.text()) as T;

    try { return await response.json(); }
    catch { return (await response.text()) as T; }
  }

  // ===========================================================================
  // LOGGING
  // ===========================================================================

  private logRequest(context: RequestContext, attempt: number, maxRetries: number): void {
    if (process.env.NODE_ENV === 'development') {
      const retryInfo = maxRetries > 1 ? ` (attempt ${attempt}/${maxRetries})` : '';
      logger.debug(`[API] ${context.method} ${context.url}${retryInfo}`);
    }
  }

  private logSuccess(context: RequestContext, status: number): void {
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - context.startTime;
      logger.debug(`[API] ${context.method} ${context.url} - ${status} (${duration}ms)`);
    }
  }

  private logError(context: RequestContext, error: Error): void {
    const duration = Date.now() - context.startTime;
    const isClientError = error instanceof ApiClientError && error.statusCode >= 400 && error.statusCode < 500;
    const logMethod = isClientError ? 'warn' : 'error';
    // Include the server's technical `details` so 500s are diagnosable from the console,
    // not just the generic `error` message.
    const details = error instanceof ApiClientError ? error.details : undefined;
    logger[logMethod](
      `[API] ${context.method} ${context.url} - ${isClientError ? error.statusCode : 'Failed'} (${duration}ms)`,
      { error: error.message, ...(details && { details }) }
    );
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const apiClient = EnterpriseApiClient.getInstance();
export default apiClient;
