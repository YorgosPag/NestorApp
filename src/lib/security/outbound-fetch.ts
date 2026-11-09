/**
 * Outbound Fetch — η **μεταφορά** από URL που δίνει τρίτος (ADR-738 · ADR-835 §22 · ADR-934 Μ-β1)
 *
 * Η κρίση της διεύθυνσης ζει στο `outbound-url-guard.ts`· εδώ ζει το **πώς** κατεβαίνει κάτι, με **κάθε** άλμα
 * (αρχικό URL + κάθε ανακατεύθυνση) να περνά ξανά από το `validateOutboundUrl` (συντακτικό + DNS όλων των διευθύνσεων).
 *
 * 🔑 **Ένας πυρήνας αλμάτων** (`openGuarded`) για κείμενο, έγγραφο και ροή bytes — δεν υπάρχουν τρεις βρόχοι ανακατεύθυνσης.
 * 🔑 **Ένας αναγνώστης με όριο σε ροή** (`boundedBody`): μετρά τα bytes **καθώς έρχονται** και κόβει τη σύνδεση μόλις
 *    ξεπεραστεί το όριο. Το `content-length` είναι μόνο πρόωρη άρνηση — ο τρίτος μπορεί να το δηλώσει ψευδώς ή να μην
 *    το δηλώσει καθόλου, και ένα «διάβασε όλο, μέτρα μετά» αφήνει τη μνήμη στο έλεος του τρίτου.
 * 🔑 **Αναβάθμιση http → https** (`scheme: 'https-upgrade'`, μόνο για όποιον τη ζητήσει): πρώτα https στο ίδιο host και
 *    διαδρομή, με γρήγορο όριο κεφαλίδων· αποτυχία ⇒ το αρχικό http, με `transport: 'insecure'` που ο καταναλωτής
 *    **δείχνει** (πρότυπο Chrome HTTPS-Upgrades, 2023). Υποβάθμιση σε http μέσω ανακατεύθυνσης ⇒ επίσης `insecure`.
 *
 * ⚠️ Το υπόλοιπο TOCTOU (DNS rebinding) του φρουρού ισχύει αυτούσιο — βλ. κεφαλίδα του `outbound-url-guard.ts`.
 *
 * @module lib/security/outbound-fetch
 */

import 'server-only';

import { OUTBOUND_FETCH_LIMITS, validateOutboundUrl, type OutboundUrlRejection } from './outbound-url-guard';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

export type GuardedFetchRejection = OutboundUrlRejection | 'http_error' | 'too_large' | 'timeout' | 'too_many_redirects';

/** `secure` = κάθε άλμα έγινε με https· `insecure` = τουλάχιστον ένα άλμα έγινε με απλό http. */
export type OutboundTransport = 'secure' | 'insecure';

/** `https-only` = η αυστηρή συμπεριφορά (προεπιλογή)· `https-upgrade` = http γίνεται δεκτό μόνο μετά από αποτυχημένη αναβάθμιση. */
export type OutboundScheme = 'https-only' | 'https-upgrade';

export type GuardedFetchResult =
  | { readonly ok: true; readonly body: string; readonly contentType: string; readonly cacheControl: string }
  | { readonly ok: false; readonly rejection: GuardedFetchRejection };

/**
 * Ό,τι διαφέρει από τον καταναλωτή του CIMD. **Ίδιος φρουρός**, άλλα όρια: ένα ημερολόγιο καναλιού είναι εκατοντάδες KB
 * και τα OTA είναι αργά (5s/64KB θα έκοβε νόμιμα feeds), και η δημοσκόπηση θέλει **conditional GET**.
 */
export interface GuardedFetchOptions {
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly accept?: string;
  readonly ifNoneMatch?: string | null;
  readonly ifModifiedSince?: string | null;
  /** Πόσες ανακατευθύνσεις ακολουθούνται — **με πλήρη επανέλεγχο κάθε άλματος** (προεπιλογή `0`, η αυστηρή του CIMD). */
  readonly maxRedirects?: number;
}

export type GuardedDocumentResult =
  | {
      readonly ok: true;
      readonly notModified: false;
      readonly status: number;
      readonly body: string;
      readonly contentType: string;
      readonly cacheControl: string;
      readonly etag: string | null;
      readonly lastModified: string | null;
    }
  | { readonly ok: true; readonly notModified: true; readonly status: 304 }
  | {
      readonly ok: false;
      readonly rejection: GuardedFetchRejection;
      /** Ο κωδικός HTTP όταν υπήρξε απάντηση — «404» και «500» ζητούν **άλλη** πράξη. */
      readonly status: number | null;
    };

/** Η ροή bytes: το όριο είναι **υποχρεωτικό** — κανείς δεν κατεβάζει δυαδικό χωρίς να πει πόσο. */
export interface GuardedStreamOptions extends Omit<GuardedFetchOptions, 'maxBytes'> {
  readonly maxBytes: number;
  readonly idleTimeoutMs?: number;
  readonly scheme?: OutboundScheme;
}

export type GuardedStreamResult =
  | {
      readonly ok: true;
      readonly notModified: false;
      readonly status: number;
      readonly contentType: string;
      readonly etag: string | null;
      readonly lastModified: string | null;
      readonly transport: OutboundTransport;
      /** Τα bytes, με το όριο **μέσα** στη ροή: η ανάγνωση πετά {@link OutboundBodyError} μόλις ξεπεραστεί. */
      readonly body: ReadableStream<Uint8Array>;
    }
  | { readonly ok: true; readonly notModified: true; readonly status: 304; readonly transport: OutboundTransport }
  | { readonly ok: false; readonly rejection: GuardedFetchRejection; readonly status: number | null };

/** Αποτυχία **κατά την ανάγνωση** του σώματος — μετά τις κεφαλίδες, άρα δεν χωρά στο αποτέλεσμα του `fetch`. */
export class OutboundBodyError extends Error {
  constructor(readonly code: 'too_large' | 'timeout') {
    super(`Outbound body ${code}`);
    this.name = 'OutboundBodyError';
  }
}

// ============================================================================
// ΠΥΡΗΝΑΣ ΑΛΜΑΤΩΝ
// ============================================================================

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

interface HopRequest {
  readonly headers: Readonly<Record<string, string>>;
  readonly maxRedirects: number;
  /** Όλη η πράξη, κεφαλίδες **και** σώμα. */
  readonly deadlineMs: number;
  /** Μόνο ως τις κεφαλίδες (η αναβάθμιση θέλει γρήγορη επιστροφή). */
  readonly headersTimeoutMs: number;
  readonly allowHttp: boolean;
}

interface OpenResponse {
  readonly kind: 'response';
  readonly response: Response;
  readonly insecure: boolean;
  readonly abort: AbortController;
  /** Σβήνει το χρονόμετρο της πράξης — **πάντα** μόλις τελειώσει η ανάγνωση ή εγκαταλειφθεί. */
  readonly release: () => void;
}

type HopOutcome =
  | OpenResponse
  | { readonly kind: 'notModified'; readonly insecure: boolean }
  | { readonly kind: 'failed'; readonly rejection: GuardedFetchRejection; readonly status: number | null };

const failed = (rejection: GuardedFetchRejection, status: number | null): HopOutcome => ({ kind: 'failed', rejection, status });

const isAbort = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { readonly name?: unknown }).name === 'AbortError';

function headersFor(options: GuardedFetchOptions): Record<string, string> {
  const headers: Record<string, string> = { accept: options.accept ?? '*/*' };
  if (options.ifNoneMatch !== null && options.ifNoneMatch !== undefined) headers['if-none-match'] = options.ifNoneMatch;
  if (options.ifModifiedSince !== null && options.ifModifiedSince !== undefined) {
    headers['if-modified-since'] = options.ifModifiedSince;
  }
  return headers;
}

/** Ένα αίτημα, με όριο **κεφαλίδων** πάνω από το όριο της πράξης (ίδιος `AbortController`). */
async function requestHeaders(url: URL, request: HopRequest, abort: AbortController): Promise<Response> {
  const headersTimer = setTimeout(() => abort.abort(), request.headersTimeoutMs);
  try {
    return await fetch(url, { method: 'GET', redirect: 'manual', signal: abort.signal, headers: request.headers });
  } finally {
    clearTimeout(headersTimer);
  }
}

/** Απάντηση που **δεν** θα διαβαστεί: η σύνδεση αφήνεται αμέσως, όχι όταν τη μαζέψει ο συλλέκτης. */
async function discard(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

/** Τι κάνει ο πυρήνας με μία απάντηση: τέλος (304 · σφάλμα · σώμα) ή επόμενο άλμα. */
async function judgeHop(response: Response, url: URL): Promise<{ readonly next: string } | { readonly done: 'body' | HopOutcome }> {
  if (response.status === 304) {
    await discard(response);
    return { done: { kind: 'notModified', insecure: false } };
  }
  if (REDIRECT_CODES.has(response.status)) {
    const location = response.headers.get('location');
    await discard(response);
    return location === null ? { done: failed('http_error', response.status) } : { next: new URL(location, url).toString() };
  }
  if (!response.ok) {
    await discard(response);
    return { done: failed('http_error', response.status) };
  }
  return { done: 'body' };
}

/**
 * **Ανοίγει** την απάντηση ακολουθώντας ως `maxRedirects` ανακατευθύνσεις, με νέο πλήρη έλεγχο σε **κάθε** άλμα — δεν
 * είναι «ακολουθώ ανακατεύθυνση», είναι «κάνω **νέο** φυλαγμένο αίτημα στη νέα διεύθυνση». Το σώμα **δεν** διαβάζεται εδώ.
 */
async function openGuarded(raw: string, request: HopRequest): Promise<HopOutcome> {
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), request.deadlineMs);
  const release = (): void => clearTimeout(deadline);
  let target = raw;
  let insecure = false;
  try {
    for (let hop = 0; hop <= request.maxRedirects; hop += 1) {
      const check = await validateOutboundUrl(target, { allowHttp: request.allowHttp });
      if (!check.ok) {
        release();
        return failed(check.rejection, null);
      }
      insecure = insecure || check.url.protocol === 'http:';
      const response = await requestHeaders(check.url, request, abort);
      const verdict = await judgeHop(response, check.url);
      if ('next' in verdict) {
        target = verdict.next;
        continue;
      }
      if (verdict.done === 'body') return { kind: 'response', response, insecure, abort, release };
      release();
      return verdict.done.kind === 'notModified' ? { kind: 'notModified', insecure } : verdict.done;
    }
    release();
    return failed('too_many_redirects', null);
  } catch (error) {
    release();
    return failed(isAbort(error) ? 'timeout' : 'http_error', null);
  }
}

// ============================================================================
// ΑΝΑΓΝΩΣΤΗΣ ΜΕ ΟΡΙΟ ΣΕ ΡΟΗ
// ============================================================================

/** Πρόωρη άρνηση: ο τρίτος **δηλώνει** περισσότερα από όσα δεχόμαστε. Η απουσία δήλωσης δεν λέει τίποτα. */
function declaresTooMuch(response: Response, maxBytes: number): boolean {
  const declared = Number(response.headers.get('content-length') ?? '');
  return Number.isFinite(declared) && declared > maxBytes;
}

/**
 * Το σώμα ως ροή που **μετρά καθώς διαβάζεται**: ξεπέρασε το όριο ⇒ ακύρωση της σύνδεσης + {@link OutboundBodyError}.
 * Σιωπή πάνω από `idleTimeoutMs` ή λήξη της πράξης ⇒ `timeout`. Το χρονόμετρο της πράξης σβήνει σε κάθε τέλος.
 */
function boundedBody(open: OpenResponse, maxBytes: number, idleTimeoutMs: number): ReadableStream<Uint8Array> {
  const reader = open.response.body?.getReader() ?? null;
  let received = 0;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const arm = (): void => {
    clearTimeout(idle);
    idle = setTimeout(() => open.abort.abort(), idleTimeoutMs);
  };
  const finish = (): void => {
    clearTimeout(idle);
    open.release();
  };
  return new ReadableStream<Uint8Array>({
    start: arm,
    async pull(controller) {
      try {
        const next = reader === null ? { done: true as const, value: undefined } : await reader.read();
        if (next.done) {
          finish();
          controller.close();
          return;
        }
        received += next.value.byteLength;
        if (received > maxBytes) {
          finish();
          await reader?.cancel().catch(() => undefined);
          controller.error(new OutboundBodyError('too_large'));
          return;
        }
        arm();
        controller.enqueue(next.value);
      } catch (error) {
        finish();
        controller.error(isAbort(error) ? new OutboundBodyError('timeout') : error);
      }
    },
    async cancel(reason) {
      finish();
      await reader?.cancel(reason).catch(() => undefined);
    },
  });
}

/** Όλα τα bytes μιας ροής με όριο — για τα **μικρά** έγγραφα (CIMD · iCal), ποτέ για μέσα. */
async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) chunks.push(next.value);
  return new Uint8Array(Buffer.concat(chunks));
}

// ============================================================================
// ΕΓΓΡΑΦΟ (κείμενο) — CIMD · iCal
// ============================================================================

/**
 * **Κατεβάζει έγγραφο από URL τρίτου** με όλα τα στρώματα ενεργά, ονομασμένο `304`, και **επανέλεγχο σε κάθε
 * ανακατεύθυνση**. Τα feeds των καναλιών **μετρημένα** ανακατευθύνουν (περιφερειακά domains, κανονικοποίηση διαδρομής)·
 * η άρνηση θα σήμαινε «ο σύνδεσμός σου δεν δουλεύει» για σωστό σύνδεσμο.
 */
export async function fetchGuardedDocument(raw: string, options: GuardedFetchOptions = {}): Promise<GuardedDocumentResult> {
  const maxBytes = options.maxBytes ?? OUTBOUND_FETCH_LIMITS.MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? OUTBOUND_FETCH_LIMITS.TIMEOUT_MS;
  const request: HopRequest = {
    headers: headersFor(options),
    maxRedirects: options.maxRedirects ?? 0,
    deadlineMs: timeoutMs,
    headersTimeoutMs: timeoutMs,
    allowHttp: false,
  };
  const opened = await openGuarded(raw, request);
  if (opened.kind === 'failed') return { ok: false, rejection: opened.rejection, status: opened.status };
  if (opened.kind === 'notModified') return { ok: true, notModified: true, status: 304 };
  const { response } = opened;
  if (declaresTooMuch(response, maxBytes)) {
    opened.release();
    await discard(response);
    return { ok: false, rejection: 'too_large', status: response.status };
  }
  try {
    const bytes = await collect(boundedBody(opened, maxBytes, timeoutMs));
    return {
      ok: true,
      notModified: false,
      status: response.status,
      body: new TextDecoder('utf-8').decode(bytes),
      contentType: response.headers.get('content-type') ?? '',
      cacheControl: response.headers.get('cache-control') ?? '',
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  } catch (error) {
    const rejection = error instanceof OutboundBodyError ? error.code : 'http_error';
    return { ok: false, rejection, status: response.status };
  }
}

/**
 * Κείμενο από URL τρίτου, **χωρίς** ανακατευθύνσεις (CIMD): ακολουθώντας ανακατεύθυνση θα ίσχυαν οι έλεγχοι για το URL
 * που *δώσαμε* και όχι για αυτό που *χτυπήσαμε*. Ένα legitimate metadata document δεν χρειάζεται ανακατεύθυνση.
 */
export async function fetchGuardedText(raw: string): Promise<GuardedFetchResult> {
  const result = await fetchGuardedDocument(raw, { accept: 'application/json' });
  if (!result.ok) return { ok: false, rejection: result.rejection };
  if (result.notModified) return { ok: false, rejection: 'http_error' };
  return { ok: true, body: result.body, contentType: result.contentType, cacheControl: result.cacheControl };
}

// ============================================================================
// ΡΟΗ BYTES — μέσα καταλόγου (ADR-934 Μ-β)
// ============================================================================

/** Η αναβάθμιση δοκιμάζεται μόνο για http· αποτυχία ⇒ γυρίζει στο http **μόνο** όταν φταίει η μεταφορά, όχι η διεύθυνση. */
function upgradeFallsBack(outcome: HopOutcome): boolean {
  return outcome.kind === 'failed' && (outcome.rejection === 'http_error' || outcome.rejection === 'timeout');
}

function httpsVariantOf(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:') return null;
    url.protocol = 'https:';
    if (url.port === '80') url.port = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** http + `https-upgrade` ⇒ πρώτα https με γρήγορο όριο κεφαλίδων, μετά (μόνο σε σφάλμα μεταφοράς) το ίδιο το http. */
async function openWithScheme(raw: string, request: HopRequest, scheme: OutboundScheme): Promise<HopOutcome> {
  const upgraded = scheme === 'https-upgrade' ? httpsVariantOf(raw) : null;
  if (upgraded === null) return openGuarded(raw, request);
  const headersTimeoutMs = Math.min(request.headersTimeoutMs, OUTBOUND_FETCH_LIMITS.UPGRADE_HEADERS_TIMEOUT_MS);
  const attempt = await openGuarded(upgraded, { ...request, headersTimeoutMs });
  return upgradeFallsBack(attempt) ? openGuarded(raw, request) : attempt;
}

/**
 * **Κατεβάζει bytes ως ροή** — το όριο κρίνεται **μέσα** στη ροή, άρα η μνήμη μένει σταθερή όσο μεγάλο κι αν είναι το
 * αρχείο, και ο καλών αποφασίζει πού πάνε τα bytes (π.χ. κατευθείαν σε κάδο). Ο καλών **πρέπει** να διαβάσει ή να ακυρώσει
 * το `body`: μόνο τότε κλείνει η σύνδεση και σβήνει το χρονόμετρο.
 */
export async function fetchGuardedStream(raw: string, options: GuardedStreamOptions): Promise<GuardedStreamResult> {
  const timeoutMs = options.timeoutMs ?? OUTBOUND_FETCH_LIMITS.TIMEOUT_MS;
  const scheme = options.scheme ?? 'https-only';
  const request: HopRequest = {
    headers: headersFor(options),
    maxRedirects: options.maxRedirects ?? 0,
    deadlineMs: timeoutMs,
    headersTimeoutMs: timeoutMs,
    allowHttp: scheme === 'https-upgrade',
  };
  const opened = await openWithScheme(raw, request, scheme);
  if (opened.kind === 'failed') return { ok: false, rejection: opened.rejection, status: opened.status };
  const transport: OutboundTransport = opened.insecure ? 'insecure' : 'secure';
  if (opened.kind === 'notModified') return { ok: true, notModified: true, status: 304, transport };
  const { response } = opened;
  if (declaresTooMuch(response, options.maxBytes)) {
    opened.release();
    await discard(response);
    return { ok: false, rejection: 'too_large', status: response.status };
  }
  return {
    ok: true,
    notModified: false,
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    transport,
    body: boundedBody(opened, options.maxBytes, options.idleTimeoutMs ?? OUTBOUND_FETCH_LIMITS.IDLE_TIMEOUT_MS),
  };
}
