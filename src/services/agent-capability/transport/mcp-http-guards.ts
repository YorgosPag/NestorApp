/**
 * Φύλακες HTTP του Streamable HTTP transport (ADR-734 Φάση 3β)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΡΕΙΣ ΕΛΕΓΧΟΙ, ΟΛΟΙ ΚΑΝΟΝΙΣΤΙΚΟΙ — ΟΧΙ ΠΡΟΤΙΜΗΣΕΙΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Πηγή: `modelcontextprotocol.io/specification/2025-11-25/basic/transports`
 *
 * 1. **`Origin` MUST** επικυρώνεται· άκυρο ⇒ **403**. Άμυνα σε DNS rebinding.
 * 2. Ο client **MUST** στέλνει `MCP-Protocol-Version` μετά την αρχικοποίηση·
 *    άγνωστη έκδοση ⇒ **400**· **απουσία** ⇒ ο server **SHOULD** υποθέσει
 *    `2025-03-26` (συμβατότητα με clients πριν το header).
 * 3. Το endpoint **MUST** δέχεται `POST` **και** `GET` στο **ίδιο** path· ο
 *    `GET` επιτρέπεται ρητά να απαντά **405** όταν δεν προσφέρεται SSE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΛΕΠΤΟ ΣΗΜΕΙΟ ΤΟΥ `Origin`
 * ─────────────────────────────────────────────────────────────────────────────
 * Η **απουσία** του header **δεν** είναι αποτυχία. Το `Origin` το βάζει ο
 * browser· ο Claude Desktop, ο Cursor και το `curl` δεν στέλνουν κανένα. Ένας
 * έλεγχος «πρέπει να υπάρχει και να ταιριάζει» θα ήταν αυστηρότερος από το
 * πρότυπο και θα απέκλειε **ακριβώς τους clients για τους οποίους γράφτηκε το
 * endpoint** — ενώ το DNS rebinding, που είναι ο λόγος ύπαρξης του ελέγχου,
 * είναι επίθεση **αποκλειστικά** μέσω browser. Άρα: αν υπάρχει, ελέγχεται
 * αυστηρά· αν λείπει, δεν πρόκειται για browser και ο κίνδυνος δεν υφίσταται.
 *
 * @module services/agent-capability/transport/mcp-http-guards
 * @see ADR-734 §10.2
 */

import { MCP_PROTOCOL_VERSION } from '../adapters/mcp-protocol-types';

// ============================================================================
// ΕΚΔΟΣΕΙΣ
// ============================================================================

/**
 * Εκδόσεις που δεχόμαστε στο `MCP-Protocol-Version`.
 *
 * Η `2025-03-26` υπάρχει επειδή το πρότυπο την ορίζει ως **υπονοούμενη** όταν
 * ο header λείπει· την ανακοινώνουμε ως αποδεκτή για να είναι συνεπής ο
 * ρητός με τον σιωπηρό δρόμο.
 */
export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
  MCP_PROTOCOL_VERSION,
  '2025-06-18',
  '2025-03-26',
];

/** Η έκδοση που υπονοείται όταν ο client δεν στέλνει header. */
export const ASSUMED_PROTOCOL_VERSION = '2025-03-26';

export const MCP_HEADERS = {
  PROTOCOL_VERSION: 'mcp-protocol-version',
  ORIGIN: 'origin',
} as const;

// ============================================================================
// ΑΠΟΤΕΛΕΣΜΑΤΑ
// ============================================================================

export type GuardFailure =
  | { readonly kind: 'origin_forbidden'; readonly status: 403 }
  | { readonly kind: 'unsupported_protocol_version'; readonly status: 400; readonly received: string };

export type GuardOutcome =
  | { readonly ok: true; readonly protocolVersion: string }
  | { readonly ok: false; readonly failure: GuardFailure };

// ============================================================================
// ΕΛΕΓΧΟΙ
// ============================================================================

/**
 * `true` αν το `Origin` είναι αποδεκτό.
 *
 * Δεκτά: απουσία (μη-browser client) ή ακριβής ταύτιση με το origin της
 * εφαρμογής. Καμία υποαντιστοίχιση, κανένα wildcard: το `startsWith` σε origins
 * είναι κλασική τρύπα — `https://nestorconstruct.gr.evil.example` ξεκινά με το
 * νόμιμο origin.
 */
export function isAcceptableOrigin(
  origin: string | null,
  allowedOrigins: readonly string[],
): boolean {
  if (origin === null || origin === '') return true;
  return allowedOrigins.includes(origin);
}

/**
 * Επικυρώνει την έκδοση πρωτοκόλλου.
 *
 * Απουσία ⇒ υπονοούμενη `2025-03-26` (SHOULD του προτύπου), όχι σφάλμα.
 */
export function resolveProtocolVersion(
  header: string | null,
): { readonly ok: true; readonly version: string } | { readonly ok: false; readonly received: string } {
  if (header === null || header === '') {
    return { ok: true, version: ASSUMED_PROTOCOL_VERSION };
  }
  if (SUPPORTED_PROTOCOL_VERSIONS.includes(header)) {
    return { ok: true, version: header };
  }
  return { ok: false, received: header };
}

/**
 * Και οι δύο έλεγχοι, με τη σειρά που τους θέλει το πρότυπο.
 *
 * Το `Origin` προηγείται σκόπιμα: είναι έλεγχος **προέλευσης**, δηλαδή «έχεις
 * δικαίωμα να μου μιλάς καθόλου». Το να απαντούσαμε πρώτα `400` για έκδοση σε
 * αίτημα από κακόβουλη σελίδα θα επιβεβαίωνε την ύπαρξη του endpoint και θα
 * έδινε πληροφορία για τις εκδόσεις που δεχόμαστε.
 */
export function checkTransportHeaders(
  headers: Headers,
  allowedOrigins: readonly string[],
): GuardOutcome {
  if (!isAcceptableOrigin(headers.get(MCP_HEADERS.ORIGIN), allowedOrigins)) {
    return { ok: false, failure: { kind: 'origin_forbidden', status: 403 } };
  }

  const version = resolveProtocolVersion(headers.get(MCP_HEADERS.PROTOCOL_VERSION));
  if (!version.ok) {
    return {
      ok: false,
      failure: {
        kind: 'unsupported_protocol_version',
        status: 400,
        received: version.received,
      },
    };
  }

  return { ok: true, protocolVersion: version.version };
}
