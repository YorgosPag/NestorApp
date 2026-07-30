/**
 * MCP wire types — το υποσύνολο του πρωτοκόλλου που εκθέτει ο Νέστωρ
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΧΕΙΡΟΓΡΑΦΟΙ ΤΥΠΟΙ ΚΑΙ ΟΧΙ ΤΟ ΕΠΙΣΗΜΟ SDK
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `@modelcontextprotocol/sdk` φέρνει server runtime, transports και
 * διαχείριση συνεδρίας — τίποτα από τα οποία δεν χρειάζεται ένα **adapter**. Ο
 * ρόλος αυτού του στρώματος είναι μία καθαρή μετάφραση: ορισμός δυνατότητας →
 * `Tool`, αποτέλεσμα δυνατότητας → `CallToolResult`. Μια νέα εξάρτηση για ~40
 * γραμμές τύπων θα ήταν κόστος συντήρησης χωρίς αντίκρισμα, και θα έσερνε τη
 * μορφή του SDK μέσα στο L3 (ADR-734 §5.2: ένας ορισμός, adapters που
 * *παράγουν* — όχι adapters που *υιοθετούν* ξένο μοντέλο).
 *
 * Αν χρειαστεί ποτέ πλήρης server (Φάση 3β, transport), το SDK μπαίνει **εκεί**
 * και καταναλώνει αυτούς τους τύπους· δεν τους αντικαθιστά.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΕΚΔΟΣΗ ΠΡΩΤΟΚΟΛΛΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 * Σταθερή: **2025-11-25**. Οι δύο επίσημες μεταφορές είναι `stdio` και
 * **Streamable HTTP**· το `HTTP+SSE` είναι **καταργημένο** από την έκδοση
 * 2024-11-05 (το ADR-734 §10 Q2 το ανέφερε λανθασμένα ως ζωντανή επιλογή —
 * διορθώθηκε στη Φάση 3).
 *
 * Το RC **2026-07-28** ανεβάζει το `outputSchema` σε πλήρες JSON Schema 2020-12
 * και επιτρέπει στο `structuredContent` να είναι οποιαδήποτε τιμή JSON, όχι μόνο
 * αντικείμενο. Ο Νέστωρ επιστρέφει **πάντα** αντικείμενο (φάκελο VQE), οπότε
 * είναι συμβατός και με τις δύο εκδόσεις χωρίς διακλάδωση.
 *
 * @module services/agent-capability/adapters/mcp-protocol-types
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
 * @see ADR-734 §5.1 (L3), §10 Q2
 */

import type { JsonSchema } from '../registry';

/** Η έκδοση πρωτοκόλλου στην οποία δηλώνουμε συμμόρφωση. */
export const MCP_PROTOCOL_VERSION = '2025-11-25';

/**
 * Υποδείξεις συμπεριφοράς εργαλείου.
 *
 * ⚠️ **Καθαρά συμβουλευτικές.** Η επίσημη τεκμηρίωση MCP: «Annotations are not
 * guaranteed to faithfully describe tool behavior» — «an untrusted server can
 * lie». Δηλώνονται για UX του client· η επιβολή είναι το `CapabilityPolicy`
 * server-side (ADR-734 §5.4). Ο Νέστωρ πάει παραπέρα από το πρότυπο: το registry
 * **απορρίπτει κατά την κατασκευή** κάθε `readOnlyHint` που αντιφάσκει με την
 * επιβαλλόμενη πολιτική, ώστε η υπόδειξη να μη *μπορεί* να πει ψέματα εδώ.
 */
export interface McpToolAnnotations {
  readonly title?: string;
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
}

/** Ένα εργαλείο όπως το ανακοινώνει η `tools/list`. */
export interface McpTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  /** Ρίζα `type: "object"` — απαίτηση του πρωτοκόλλου για εισόδους. */
  readonly inputSchema: JsonSchema;
  /** Δηλωμένο ⇒ **κάθε** `structuredContent` οφείλει να συμμορφώνεται. */
  readonly outputSchema?: JsonSchema;
  readonly annotations?: McpToolAnnotations;
}

/** Το ανθρωπο/μοντελο-αναγνώσιμο μέρος της απόκρισης. */
export interface McpTextContent {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Το αποτέλεσμα μιας `tools/call`.
 *
 * ⚠️ Τα `content` και `structuredContent` είναι **συμπληρωματικά, όχι
 * εναλλακτικά**: το πρώτο είναι η αναγνώσιμη εκδοχή για μοντέλο/άνθρωπο, το
 * δεύτερο η επικυρώσιμη εκδοχή για μηχανή. Ένας server που επιστρέφει μόνο
 * `structuredContent` σπάει τους clients που δεν το υποστηρίζουν ακόμη.
 *
 * ⚠️ Τα σφάλματα **εκτέλεσης** επιστρέφονται εδώ με `isError: true` — **δεν**
 * γίνονται σφάλματα JSON-RPC. Το JSON-RPC error προορίζεται για αστοχία
 * πρωτοκόλλου (κακοσχηματισμένο αίτημα), όχι για «το εργαλείο δεν βρήκε τίποτα».
 * Η διάκριση έχει πρακτική συνέπεια: με `isError` το μοντέλο **βλέπει** το
 * μήνυμα και μπορεί να διορθώσει την κλήση του· με JSON-RPC error το χειρίζεται
 * ο client και το μοντέλο συνήθως δεν μαθαίνει ποτέ τι πήγε στραβά.
 */
export interface McpCallToolResult {
  readonly content: readonly McpTextContent[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}
