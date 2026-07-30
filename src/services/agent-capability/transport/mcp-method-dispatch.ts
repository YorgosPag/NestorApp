/**
 * Οι τρεις μέθοδοι MCP — `initialize`, `tools/list`, `tools/call`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο ΡΟΛΟΣ: ΜΕΤΑΦΟΡΕΑΣ, ΟΧΙ ΑΠΟΦΑΣΙΖΩΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * Καμία πολιτική δεν ζει εδώ. Ο έλεγχος ονόματος, ταυτότητας, δικαιώματος και
 * ορισμάτων γίνεται **αποκλειστικά** μέσα στο `registry.invoke()`, με τη σειρά
 * `NOT_FOUND → UNAUTHENTICATED → PERMISSION_DENIED → INVALID_ARGUMENT →
 * handler` (ADR-734 §5.2). Αυτό το module παίρνει το αποτέλεσμα και το ντύνει
 * σε JSON-RPC.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΑΣΤΟΧΙΑ ΕΡΓΑΛΕΙΟΥ ≠ ΣΦΑΛΜΑ JSON-RPC
 * ─────────────────────────────────────────────────────────────────────────────
 * Αν το εργαλείο τρέξει και αποτύχει (δεν βρέθηκε κτίριο, λάθος όρισμα), η
 * απάντηση είναι **επιτυχής** JSON-RPC με `CallToolResult { isError: true }`.
 * Το μοντέλο **βλέπει** το μήνυμα και διορθώνει την κλήση του.
 *
 * Σφάλμα JSON-RPC επιστρέφεται **μόνο** για αστοχία πρωτοκόλλου:
 * κακοσχηματισμένο αίτημα, άγνωστη μέθοδος, `params` που δεν είναι αντικείμενο.
 * Εκεί ο client το χειρίζεται και το μοντέλο συνήθως δεν μαθαίνει ποτέ τι έγινε
 * — γι' αυτό η διάκριση δεν είναι κοσμητική.
 *
 * @module services/agent-capability/transport/mcp-method-dispatch
 * @see ADR-734 §8.4
 */

import type { CapabilityContext, CapabilityRegistry } from '../registry';
import { toMcpCallToolResult, toMcpTools } from '../adapters';
import { MCP_PROTOCOL_VERSION } from '../adapters/mcp-protocol-types';
import {
  JSON_RPC_ERROR,
  jsonRpcError,
  jsonRpcSuccess,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './mcp-jsonrpc';

// ============================================================================
// ΤΑΥΤΟΤΗΤΑ SERVER
// ============================================================================

/**
 * Ό,τι βλέπει ο client στο `initialize`.
 *
 * ⚠️ Η `version` είναι η έκδοση **αυτού του transport**, όχι της εφαρμογής
 * Νέστωρ. Ο client τη χρησιμοποιεί για διάγνωση συμβατότητας· δένοντάς την στην
 * έκδοση της εφαρμογής θα άλλαζε σε κάθε άσχετο deploy και θα έπαυε να σημαίνει
 * κάτι.
 */
export const MCP_SERVER_INFO = {
  name: 'nestor-boq',
  title: 'Nestor Construct — Επιμετρήσεις',
  version: '1.0.0',
} as const;

/**
 * Οδηγίες προς το μοντέλο, μία φορά στην αρχικοποίηση.
 *
 * ⚠️ Δεν είναι διαφήμιση: λέει στο μοντέλο **τι σημαίνει** ο φάκελος VQE, ώστε
 * να μην παρουσιάσει ποσότητα χωρίς την κατάσταση έγκρισής της. Χωρίς αυτό, ο
 * πράκτορας μπορεί να διαβάσει σωστά και να **αναφέρει** λάθος — να δώσει
 * αριθμό πρόχειρης επιμέτρησης σαν να ήταν εγκεκριμένος.
 *
 * Εξαιρείται από το i18n (N.11): είναι κείμενο πρωτοκόλλου προς LLM, όχι
 * ετικέτα διεπαφής. Ίδιο σκεπτικό με τα μηνύματα του `capability-errors.ts`.
 */
export const MCP_INSTRUCTIONS = [
  'Every quantity is returned inside a Verifiable Quantity Envelope (VQE).',
  'The envelope carries the measurement basis, provenance (source item ids),',
  'approval status and an engine fingerprint. When you report a number to a',
  'human, also report `governance.effectiveStatus` — a draft quantity and an',
  'approved one must never be presented the same way. Never sum values across',
  'envelopes yourself; ask for the aggregate tool instead.',
].join(' ');

// ============================================================================
// ΕΞΑΡΤΗΣΕΙΣ
// ============================================================================

export interface DispatchDeps {
  readonly registry: CapabilityRegistry;
  readonly context: CapabilityContext;
  /** Η έκδοση που διαπραγματεύτηκε ο φύλακας μεταφοράς. */
  readonly negotiatedProtocolVersion: string;
}

// ============================================================================
// ΜΕΘΟΔΟΙ
// ============================================================================

function handleInitialize(request: JsonRpcRequest, deps: DispatchDeps): JsonRpcResponse {
  return jsonRpcSuccess(request.id, {
    // Απαντάμε με τη **δική μας** έκδοση όταν την υποστηρίζουμε· διαφορετικά με
    // αυτήν που διαπραγματεύτηκε ο φύλακας. Το πρότυπο θέλει ο server να
    // προτείνει, όχι να δέχεται σιωπηλά ό,τι του ζητηθεί.
    protocolVersion: deps.negotiatedProtocolVersion === MCP_PROTOCOL_VERSION
      ? MCP_PROTOCOL_VERSION
      : deps.negotiatedProtocolVersion,
    capabilities: {
      // `listChanged: false` — ο κατάλογος χτίζεται κατά τη φόρτωση από το
      // registry και δεν μεταβάλλεται εν πτήσει. Δηλώνοντας `true` θα
      // υποσχόμασταν ειδοποιήσεις που δεν θα στέλναμε ποτέ.
      tools: { listChanged: false },
    },
    serverInfo: MCP_SERVER_INFO,
    instructions: MCP_INSTRUCTIONS,
  });
}

/**
 * ⚠️ Χωρίς `nextCursor`.
 *
 * Τα εργαλεία είναι επτά και ο κατάλογος είναι σταθερός· σελιδοποίηση θα ήταν
 * μηχανισμός χωρίς περιεχόμενο. Το πεδίο **παραλείπεται** αντί να επιστραφεί
 * κενό: το πρότυπο ορίζει ότι απουσία `nextCursor` σημαίνει «τέλος», ενώ ένα
 * `nextCursor: ""` είναι έγκυρος δείκτης και θα έβαζε τον client σε βρόχο.
 */
function handleToolsList(request: JsonRpcRequest, deps: DispatchDeps): JsonRpcResponse {
  return jsonRpcSuccess(request.id, { tools: toMcpTools(deps.registry.list()) });
}

async function handleToolsCall(
  request: JsonRpcRequest,
  deps: DispatchDeps,
): Promise<JsonRpcResponse> {
  const params = request.params ?? {};
  const name = params.name;

  if (typeof name !== 'string' || name === '') {
    return jsonRpcError(request.id, JSON_RPC_ERROR.INVALID_PARAMS, 'params.name is required');
  }

  const rawArgs = params.arguments;
  if (rawArgs !== undefined && (typeof rawArgs !== 'object' || rawArgs === null || Array.isArray(rawArgs))) {
    return jsonRpcError(request.id, JSON_RPC_ERROR.INVALID_PARAMS, 'params.arguments must be an object');
  }

  const outcome = await deps.registry.invoke(
    name,
    (rawArgs as Record<string, unknown> | undefined) ?? {},
    deps.context,
  );

  return jsonRpcSuccess(request.id, toMcpCallToolResult(outcome));
}

// ============================================================================
// DISPATCH
// ============================================================================

export const MCP_METHODS = {
  INITIALIZE: 'initialize',
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  PING: 'ping',
} as const;

/** Δρομολογεί ένα αίτημα στη μέθοδό του. */
export async function dispatchMcpRequest(
  request: JsonRpcRequest,
  deps: DispatchDeps,
): Promise<JsonRpcResponse> {
  switch (request.method) {
    case MCP_METHODS.INITIALIZE:
      return handleInitialize(request, deps);
    case MCP_METHODS.TOOLS_LIST:
      return handleToolsList(request, deps);
    case MCP_METHODS.TOOLS_CALL:
      return handleToolsCall(request, deps);
    case MCP_METHODS.PING:
      return jsonRpcSuccess(request.id, {});
    default:
      return jsonRpcError(
        request.id,
        JSON_RPC_ERROR.METHOD_NOT_FOUND,
        `Unknown method: ${request.method}`,
      );
  }
}
