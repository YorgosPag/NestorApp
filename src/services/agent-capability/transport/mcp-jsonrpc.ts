/**
 * JSON-RPC 2.0 — ανάλυση μηνυμάτων και κατασκευή αποκρίσεων
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΧΕΙΡΟΓΡΑΦΟ ΚΑΙ ΟΧΙ ΤΟ `@modelcontextprotocol/sdk`
 * ─────────────────────────────────────────────────────────────────────────────
 * Το §8.3.3 του ADR-734 άφησε την πόρτα ανοιχτή: «όταν χρειαστεί πλήρης server
 * (Φάση 3β) το SDK μπαίνει **εκεί**». Μπήκε η στιγμή, και η απάντηση είναι όχι
 * — με λόγο, όχι σιωπηλά.
 *
 * Το `StreamableHTTPServerTransport` του SDK γράφτηκε για Node `http`
 * (`IncomingMessage`/`ServerResponse`, Express-style). Ο App Router του Next.js
 * δίνει Web `Request`/`Response`. Η γεφύρωση απαιτεί προσαρμογή ροών και
 * headers και στις δύο κατευθύνσεις — περισσότερος κώδικας, και **πιο δύσκολα
 * ελέγξιμος**, από τις ~120 γραμμές καθαρού JSON-RPC που χρειάζεται ένας
 * stateless server με **τρεις** μεθόδους. Επιπλέον το SDK φέρνει διαχείριση
 * συνεδρίας που εδώ είναι ενεργά ανεπιθύμητη (§10.2: stateless).
 *
 * Οι συναρτήσεις εδώ είναι **καθαρές**: καμία Firestore, κανένα δίκτυο, κανένα
 * `Date.now()`. Άρα ελέγχονται εξαντλητικά χωρίς mocks.
 *
 * @module services/agent-capability/transport/mcp-jsonrpc
 * @see ADR-734 §8.4
 */

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export interface JsonRpcErrorBody {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcSuccessResponse {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly result: unknown;
}

export interface JsonRpcErrorResponse {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId | null;
  readonly error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/**
 * Τι ήταν το εισερχόμενο σώμα.
 *
 * Η διάκριση `request` / `notification` **καθορίζει τον κωδικό HTTP**: αίτημα
 * ⇒ σώμα με απόκριση· ειδοποίηση ή απόκριση ⇒ **202 χωρίς σώμα**, κατά το
 * πρότυπο. Γι' αυτό η ανάλυση την επιστρέφει ρητά αντί να την υπονοεί.
 */
export type ParsedMessage =
  | { readonly kind: 'request'; readonly request: JsonRpcRequest }
  | { readonly kind: 'notification'; readonly notification: JsonRpcNotification }
  | { readonly kind: 'acknowledgeable' }
  | { readonly kind: 'invalid'; readonly error: JsonRpcErrorBody; readonly id: JsonRpcId | null };

// ============================================================================
// ΚΩΔΙΚΟΙ ΣΦΑΛΜΑΤΩΝ (JSON-RPC 2.0 §5.1)
// ============================================================================

export const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ============================================================================
// ΑΝΑΛΥΣΗ
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidId(value: unknown): value is JsonRpcId {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * Ωμό σώμα → ταξινομημένο μήνυμα.
 *
 * ⚠️ Ένα σώμα με `result` ή `error` είναι **απόκριση** του client προς εμάς,
 * όχι αίτημα. Το πρότυπο το βάζει στην ίδια κατηγορία με τις ειδοποιήσεις:
 * `202 Accepted`, χωρίς σώμα. Χωρίς αυτή τη διάκριση θα απαντούσαμε
 * `METHOD_NOT_FOUND` σε κάτι που δεν ήταν ποτέ κλήση μεθόδου, και ο client θα
 * έβλεπε σφάλμα εκεί που ακολούθησε το πρωτόκολλο.
 */
export function parseJsonRpcMessage(raw: unknown): ParsedMessage {
  if (!isPlainObject(raw)) {
    return {
      kind: 'invalid',
      id: null,
      error: { code: JSON_RPC_ERROR.INVALID_REQUEST, message: 'Request body must be a JSON object' },
    };
  }

  if (raw.jsonrpc !== '2.0') {
    return {
      kind: 'invalid',
      id: isValidId(raw.id) ? raw.id : null,
      error: { code: JSON_RPC_ERROR.INVALID_REQUEST, message: 'jsonrpc must be "2.0"' },
    };
  }

  if ('result' in raw || 'error' in raw) return { kind: 'acknowledgeable' };

  if (typeof raw.method !== 'string' || raw.method === '') {
    return {
      kind: 'invalid',
      id: isValidId(raw.id) ? raw.id : null,
      error: { code: JSON_RPC_ERROR.INVALID_REQUEST, message: 'method must be a non-empty string' },
    };
  }

  const params = isPlainObject(raw.params) ? raw.params : undefined;

  if (!('id' in raw) || raw.id === null) {
    return { kind: 'notification', notification: { jsonrpc: '2.0', method: raw.method, params } };
  }

  if (!isValidId(raw.id)) {
    return {
      kind: 'invalid',
      id: null,
      error: { code: JSON_RPC_ERROR.INVALID_REQUEST, message: 'id must be a string or number' },
    };
  }

  return { kind: 'request', request: { jsonrpc: '2.0', id: raw.id, method: raw.method, params } };
}

// ============================================================================
// ΚΑΤΑΣΚΕΥΗ ΑΠΟΚΡΙΣΕΩΝ
// ============================================================================

export function jsonRpcSuccess(id: JsonRpcId, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: '2.0', id, result };
}

export function jsonRpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  return { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } };
}
