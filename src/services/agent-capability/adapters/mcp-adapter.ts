/**
 * MCP adapter — παράγει `Tool` και `CallToolResult` **από** το registry (L3)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΚΑΝΕΙ ΚΑΙ ΤΙ ΔΕΝ ΚΑΝΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Είναι **αδελφός** του `openai-adapter.ts`, όχι αντικαταστάτης: ίδιος ορισμός
 * δυνατότητας, δεύτερη μορφή έκθεσης. Καμία γραμμή πολιτικής, ελέγχου ορισμάτων
 * ή tenant isolation δεν ζει εδώ — όλα αυτά τα κάνει το `registry.invoke()`, που
 * παραμένει η **μοναδική** πύλη εκτέλεσης (ADR-734 §5.2). Ο adapter *μεταφράζει*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΤΟ `outputSchema` ΕΙΝΑΙ ΤΟ ΣΗΜΕΙΟ ΥΠΕΡΟΧΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο Revit Public MCP Server και το Figma MCP επιστρέφουν *δεδομένα μοντέλου*
 * χωρίς προέλευση. Εδώ το `structuredContent` είναι **πάντα** φάκελος VQE
 * (βάση μέτρησης + προέλευση + κατάσταση έγκρισης + αποτύπωμα μηχανής), και το
 * `outputSchema` τον δηλώνει ώστε ο client να μπορεί να τον **επικυρώσει**.
 * Δηλαδή ο παραλήπτης δεν χρειάζεται να εμπιστευτεί τον server στα λόγια — έχει
 * σχήμα να ελέγξει (ADR-734 §6.1).
 *
 * Το σχήμα δεν γράφεται εδώ: το `capabilityOutputSchema()` τυλίγει αυτόματα το
 * `valueSchema` κάθε δυνατότητας. Χειρόγραφο σχήμα φακέλου θα ήταν τρίτη πηγή
 * αλήθειας και θα απέκλινε στην πρώτη αλλαγή του VQE.
 *
 * @module services/agent-capability/adapters/mcp-adapter
 * @see ADR-734 §5.1 (L3), §5.4 (annotations ≠ ασφάλεια), §6 (VQE)
 */

import type { VerifiableQuantityEnvelope } from '@/types/vqe';
import {
  type AnyCapability,
  type CapabilityError,
  type CapabilityOutcome,
  capabilityInputSchema,
  capabilityOutputSchema,
} from '../registry';
import type { McpCallToolResult, McpTool } from './mcp-protocol-types';

// ============================================================================
// ΟΡΙΣΜΟΣ ΕΡΓΑΛΕΙΟΥ (tools/list)
// ============================================================================

/**
 * Ένας ορισμός εργαλείου MCP από έναν ορισμό δυνατότητας.
 *
 * ⚠️ Το `destructiveHint` δηλώνεται **ρητά `false`** αντί να παραλείπεται. Η
 * προεπιλογή του προτύπου για εργαλεία **μη** μόνο-ανάγνωσης είναι `true`, και
 * μια σιωπηλή παράλειψη σε μελλοντικό εργαλείο εγγραφής θα το εμφάνιζε ως
 * καταστροφικό — ή, χειρότερα, μια αλλαγή προεπιλογής του προτύπου θα άλλαζε τη
 * συμπεριφορά του client χωρίς αλλαγή στον κώδικά μας. Ρητό ⇒ σταθερό.
 */
export function toMcpTool(capability: AnyCapability): McpTool {
  return {
    name: capability.name,
    title: capability.title,
    description: capability.description,
    inputSchema: capabilityInputSchema(capability),
    outputSchema: capabilityOutputSchema(capability),
    annotations: {
      title: capability.title,
      readOnlyHint: capability.annotations.readOnlyHint,
      destructiveHint: !capability.annotations.readOnlyHint,
      idempotentHint: capability.annotations.idempotentHint,
      openWorldHint: capability.annotations.openWorldHint,
    },
  };
}

/**
 * Οι ορισμοί ενός καταλόγου δυνατοτήτων.
 *
 * Η σειρά είναι αυτή του `registry.list()` — ταξινομημένη κατά όνομα, άρα
 * σταθερή μεταξύ εκτελέσεων. Σταθερή σειρά ⇒ σταθερό prompt prefix ⇒ το prompt
 * caching του client δουλεύει αντί να ακυρώνεται σε κάθε αναδιάταξη.
 */
export function toMcpTools(capabilities: readonly AnyCapability[]): McpTool[] {
  return capabilities.map(toMcpTool);
}

// ============================================================================
// ΑΠΟΤΕΛΕΣΜΑ ΚΛΗΣΗΣ (tools/call)
// ============================================================================

/**
 * Αποτέλεσμα δυνατότητας → αποτέλεσμα MCP.
 *
 * Επιτυχία ⇒ `structuredContent` = ο φάκελος **αυτούσιος** (συμμορφώνεται με το
 * δηλωμένο `outputSchema`) + `content` = μία γραμμή περίληψης.
 * Αστοχία ⇒ `isError: true` + κωδικός και μήνυμα σε κείμενο, **χωρίς**
 * `structuredContent`: φάκελος που δεν χτίστηκε δεν επιτρέπεται να προσποιηθεί
 * ότι υπάρχει.
 */
export function toMcpCallToolResult(outcome: CapabilityOutcome<unknown>): McpCallToolResult {
  if (!outcome.ok) {
    return {
      content: [{ type: 'text', text: formatError(outcome.error) }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: summarizeEnvelope(outcome.envelope) }],
    structuredContent: outcome.envelope,
  };
}

/**
 * Η μία γραμμή κειμένου που συνοδεύει τον φάκελο.
 *
 * ⚠️ Σκόπιμα **περίληψη και όχι επανάληψη**: αν το `content` περιείχε ολόκληρο
 * τον φάκελο σε πρόζα, κάθε απόκριση θα κόστιζε διπλά tokens για μηδέν
 * πληροφορία (ADR-734 §6.4). Ο client που θέλει λεπτομέρεια διαβάζει το
 * `structuredContent` — γι' αυτό υπάρχει.
 *
 * Δηλώνει τα τρία που ένας άνθρωπος θα ρωτούσε αμέσως: πόσες γραμμές το
 * στηρίζουν, ποια είναι η **χαμηλότερη** κατάσταση έγκρισης του συνόλου, και αν
 * είναι υπογράψιμο.
 */
function summarizeEnvelope(envelope: VerifiableQuantityEnvelope<unknown>): string {
  const { provenance, governance, integrity } = envelope;
  const parts = [
    `value=${envelope.value === null ? 'null' : 'present'}`,
    `sources=${provenance.sourceItemIds.length}`,
    `status=${governance.effectiveStatus}`,
    `signable=${governance.isSignable}`,
    `engine=${integrity.engineVersion}`,
  ];

  if (provenance.warnings.length > 0) {
    parts.push(`warnings=${provenance.warnings.length}`);
  }

  return parts.join(' ');
}

/** Σφάλμα → κείμενο που **βλέπει το μοντέλο** και μπορεί να διορθώσει την κλήση. */
function formatError(error: CapabilityError): string {
  const details = error.details;
  if (details === undefined) return `${error.code}: ${error.message}`;

  const rendered = Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

  return `${error.code}: ${error.message} (${rendered})`;
}
