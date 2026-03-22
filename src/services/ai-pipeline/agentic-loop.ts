/**
 * =============================================================================
 * AGENTIC LOOP — Multi-Step Reasoning Engine (Chat Completions API)
 * =============================================================================
 *
 * Implements the agentic loop: AI calls tools iteratively until it produces
 * a final text answer. Each iteration:
 *   1. Send messages + tools to OpenAI Chat Completions API
 *   2. If AI requests tool calls → execute them, append results
 *   3. If AI returns text → done
 *
 * Uses Chat Completions API (not Responses API) because:
 * - Well-established multi-turn tool calling with tool_call_id tracking
 * - Proper assistant + tool message format for iterative reasoning
 * - Better error handling for complex multi-step flows
 *
 * Safety limits:
 * - maxIterations: 5 (prevent infinite loops)
 * - totalTimeoutMs: 50_000 (within Vercel 60s limit)
 * - perCallTimeoutMs: 15_000 (per OpenAI call)
 * - maxToolResultChars: 8000 (truncate large results)
 *
 * @module services/ai-pipeline/agentic-loop
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { getCompressedSchema } from '@/config/firestore-schema-map';
import { getAgenticToolExecutor } from './tools/agentic-tool-executor';
import type { AgenticContext } from './tools/agentic-tool-executor';
import type { AgenticToolDefinition } from './tools/agentic-tool-definitions';
// ADR-173: Prompt enhancement with learned patterns
import { enhanceSystemPrompt } from './prompt-enhancer';
import { safeJsonParse } from '@/lib/json-utils';
import { isNonEmptyString } from '@/lib/type-guards';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('AGENTIC_LOOP');

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticLoopConfig {
  maxIterations: number;
  totalTimeoutMs: number;
  perCallTimeoutMs: number;
  maxToolResultChars: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    name: string;
    args: string;
    result: string;
  }>;
}

export interface AgenticResult {
  answer: string;
  suggestions: string[];
  toolCalls: Array<{
    name: string;
    args: string;
    result: string;
  }>;
  iterations: number;
  totalDurationMs: number;
}

// ── Chat Completions API types ──

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Only for assistant messages with tool calls */
  tool_calls?: ChatCompletionToolCall[];
  /** Only for tool result messages */
  tool_call_id?: string;
}

interface ChatCompletionToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionChoice {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ChatCompletionToolCall[];
  };
  finish_reason: string;
}

const DEFAULT_CONFIG: AgenticLoopConfig = {
  maxIterations: 15,
  // 55s for Vercel (60s limit), but localhost has no limit
  totalTimeoutMs: process.env.NODE_ENV === 'production' ? 55_000 : 120_000,
  perCallTimeoutMs: 30_000,
  maxToolResultChars: 12_000,
};

// ============================================================================
// AGENTIC SYSTEM PROMPT BUILDER
// ============================================================================

function buildAgenticSystemPrompt(ctx: AgenticContext, chatHistory: ChatMessage[], learnedPatterns: string = ''): string {
  const schema = getCompressedSchema();

  // Format recent chat for context
  const historyStr = chatHistory.length > 0
    ? chatHistory
        .slice(-6) // Last 6 messages (3 turns)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 300)}`)
        .join('\n')
    : 'No previous messages.';

  const channelLabel = ctx.channel === 'telegram' ? 'Telegram'
    : ctx.channel === 'whatsapp' ? 'WhatsApp'
    : ctx.channel === 'messenger' ? 'Facebook Messenger'
    : ctx.channel === 'instagram' ? 'Instagram'
    : ctx.channel === 'email' ? 'Email'
    : ctx.channel ?? 'Εφαρμογή';

  // ADR-174: Different persona for admin vs customer
  const roleDescription = ctx.isAdmin
    ? 'Ο χρήστης είναι ο Super Admin. Έχεις ΠΛΗΡΗ πρόσβαση σε ΟΛΑ τα δεδομένα — μπορείς να ΔΙΑΒΑΖΕΙΣ ΚΑΙ ΝΑ ΓΡΑΦΕΙΣ σε ΟΛΑ τα collections (contacts, units, projects, buildings, construction_phases, construction_tasks, appointments, tasks, leads). ΠΟΤΕ μη λες "δεν έχω δικαίωμα" — ΕΧΕΙΣ. Αν κάτι αποτύχει, ΔΟΚΙΜΑΣΕ.'
    : 'Ο χρήστης είναι πελάτης/ενδιαφερόμενος. Βοήθησέ τον ευγενικά με πληροφορίες για ακίνητα, ραντεβού, και γενικές ερωτήσεις. ΜΗΝ αποκαλύπτεις εσωτερικά δεδομένα εταιρείας (κόστη, κέρδη, εσωτερικές σημειώσεις). Μπορείς να ψάχνεις ακίνητα (units) και να δίνεις βασικές πληροφορίες (τ.μ., τιμή, τύπος, διαθεσιμότητα).';

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return `Είσαι ο AI βοηθός του Nestor — μια εφαρμογή διαχείρισης κατασκευαστικών έργων.
${roleDescription}
Κανάλι επικοινωνίας: ${channelLabel}.
Σημερινή ημερομηνία: ${today}

${schema}

ΚΑΝΟΝΕΣ:
1. Μπορείς να κάνεις πολλαπλά tool calls σε σειρά για σύνθετες ερωτήσεις
2. Αν δεν βρεις αποτελέσματα, δοκίμασε εναλλακτική αναζήτηση (π.χ. χωρίς φίλτρα, partial match, different field)
3. Απάντα ΠΑΝΤΑ στα Ελληνικά
4. Μην επιστρέφεις raw JSON — μορφοποίησε ωραία τα αποτελέσματα
5. Αν χρειάζονται πολλά βήματα (π.χ. "βρες κτήριο → βρες τις φάσεις"), κάνε τα βήματα σε σειρά
6. Στο τέλος δώσε σαφή, μορφοποιημένη απάντηση στον χρήστη
7. Για αριθμούς/ποσά/εμβαδά, χρησιμοποίησε μονάδες (€, τ.μ., κλπ)
ΚΡΙΣΙΜΟ ΓΙΑ ΣΥΓΚΡΙΣΕΙΣ: Όταν ρωτάνε "ποιο είναι το μεγαλύτερο/μικρότερο/ακριβότερο/φθηνότερο", ΠΡΕΠΕΙ να ελέγξεις ΟΛΑ τα αποτελέσματα και να συγκρίνεις τους αριθμούς. ΜΗΝ απαντάς βάσει του πρώτου αποτελέσματος — διάβασε ΟΛΑ και βρες min/max.
8. Αν η ερώτηση είναι γενική/casual (π.χ. "γεια σου", "τι ώρα είναι;"), απάντησε σύντομα χωρίς tools — MAX 1-2 προτάσεις
9. Τα values σε φίλτρα ΠΑΝΤΑ ως string (ακόμα και αριθμούς: "42", booleans: "true")
10. ΚΡΙΣΙΜΟ: ΠΑΝΤΑ κάλεσε tools πριν πεις ότι κάτι δεν δουλεύει! Μην παραιτηθείς χωρίς να δοκιμάσεις
ΑΠΑΓΟΡΕΥΕΤΑΙ να ζητάς "περισσότερες πληροφορίες" ή "κωδικό ακινήτου" — ΨΑΞΕ ΠΡΩΤΑ!
ΚΡΙΣΙΜΟ: Αν δεν βρεις κάτι που ζητήθηκε (π.χ. φωτογραφία έργου, αρχείο, έγγραφο), ΕΝΗΜΕΡΩΣΕ τον χρήστη ότι ΔΕΝ υπάρχει — ΜΗΝ στέλνεις κάτι άλλο αντί αυτού. Ο χρήστης πρέπει να ξέρει τι λείπει.
- Αν ρωτήσουν "δείξε μου ακίνητο" χωρίς όνομα → φέρε ΟΛΑ τα ακίνητα και δείξε λίστα
- Αν ρωτήσουν "πες μου για τον Γιάννη" → ψάξε contacts με firstName "Γιάννη"
- ΠΟΤΕ μη λες "χρειάζομαι περισσότερα στοιχεία" — ΨΑΞΕ ΚΑΙ ΒΡΕΣ ΤΑ ΜΟΝΟΣ ΣΟΥ

ΥΠΟΧΡΕΩΤΙΚΑ JOINS — ΣΧΕΣΕΙΣ ΔΕΔΟΜΕΝΩΝ:
Τα δεδομένα είναι οργανωμένα σε ιεραρχία: projects → buildings → construction_phases → construction_tasks.
Όταν επιστρέφεις αποτελέσματα ΑΠΟ ΚΑΤΑΣΚΕΥΑΣΤΙΚΑ COLLECTIONS, ΠΑΝΤΑ κάνε resolve τα parent names:
- construction_phases: πάρε το buildingId → firestore_get_document("buildings", buildingId) → πάρε building.name + building.projectId → firestore_get_document("projects", projectId) → πάρε project.name
- construction_tasks: πάρε phaseId → resolve phase → resolve building → resolve project
- buildings: πάρε projectId → firestore_get_document("projects", projectId) → πάρε project.name
- units: πάρε buildingId → resolve building → resolve project
- Ποτέ μην δείχνεις φάσεις/κτήρια/μονάδες χωρίς να αναφέρεις ΣΕ ΠΟΙΟ ΕΡΓΟ και ΚΤΗΡΙΟ ανήκουν!

COLLECTIONS ΠΟΥ ΔΕΝ ΧΡΕΙΑΖΟΝΤΑΙ JOINS (απάντα κατευθείαν):
- contacts, leads, appointments, tasks, obligations, invoices, payments, messages
- Για αυτά: ΜΙΑ query αρκεί. ΜΗΝ κάνεις get_document για κάθε εγγραφή.
- Παράδειγμα: "ποιες επαφές υπάρχουν" → firestore_query("contacts") → μορφοποίηση → τέλος!

NESTED DATA — ΑΚΟΛΟΥΘΗΣΕ ΑΥΤΑ ΤΑ ΒΗΜΑΤΑ ΑΚΡΙΒΩΣ:

⚠️⚠️⚠️ ΑΠΑΓΟΡΕΥΕΤΑΙ να βάλεις πεδία με ΤΕΛΕΙΑ (.) σε filters! Π.χ. commercial.askingPrice, commercial.paymentSummary.overdueInstallments, areas.gross — ΟΛΕΣ αποτυγχάνουν!

ΑΝΤΙ ΑΥΤΟΥ, ΑΚΟΛΟΥΘΗΣΕ ΑΥΤΟ ΤΟ PATTERN:
1. firestore_query("units") ΧΩΡΙΣ nested filters → παίρνεις ΟΛΑ τα units
2. Διαβάζεις τα nested πεδία ΑΠΟ ΤΑ ΑΠΟΤΕΛΕΣΜΑΤΑ
3. Φιλτράρεις εσύ στην απάντηση

CONCRETE ΠΑΡΑΔΕΙΓΜΑΤΑ:

Ερώτηση: "Ληξιπρόθεσμες δόσεις"
→ firestore_query("units") χωρίς filters σε nested πεδία
→ Κοίτα κάθε unit: αν _installmentsOverdue > 0, συμπερίλαβέ το

Ερώτηση: "Πόσα χρωστάει ο X"
→ firestore_query("units") χωρίς nested filters
→ Κοίτα κάθε unit: βρες αυτό με _buyerName == "X"
→ Διάβασε _paymentRemaining

Ερώτηση: "Τιμή ακινήτου Y"
→ firestore_query("units", filters: [{field: "name", operator: "==", value: "Y"}])
→ Διάβασε _askingPrice από το αποτέλεσμα

Ερώτηση: "Ποιοι πελάτες δεν έχουν πληρώσει" / "εκκρεμείς δόσεις" / "οφειλές"
→ firestore_query("units") ΧΩΡΙΣ filters
→ Κοίτα ΚΑΘΕ unit: αν _paymentPaid == 0 ΚΑΙ _paymentTotal > 0 → δεν έχει πληρώσει τίποτα
→ Κοίτα ΚΑΘΕ unit: αν _installmentsOverdue > 0 → έχει ληξιπρόθεσμες δόσεις
→ Ο _buyerName δείχνει ποιος πελάτης χρωστάει
→ ΔΕΝ υπάρχει collection "payments" ή "invoices" για δόσεις ακινήτων — ΟΛΑ είναι ΜΕΣΑ στα units

Ερώτηση: "Στείλε email σε πελάτες με οφειλές + δημιούργησε task"
→ ΒΗΜΑ 1: firestore_query("units") → βρες units με _installmentsOverdue > 0
→ ΒΗΜΑ 2: Για κάθε unit, πάρε _buyerContactId → firestore_get_document("contacts", _buyerContactId) → πάρε email
→ ΒΗΜΑ 3: send_email_to_contact για κάθε πελάτη
→ ΒΗΜΑ 4: firestore_write("tasks", create) για κάθε πελάτη με dueDate = σήμερα + 3 μέρες

ΣΗΜΑΝΤΙΚΟ — ΠΡΟΓΡΑΜΜΑ ΑΠΟΠΛΗΡΩΜΗΣ (ΔΟΣΕΙΣ ΑΝΑ ΦΑΣΗ):
- Οι δόσεις αποπληρωμής αποθηκεύονται σε SUBCOLLECTION: units/{unitId}/payment_plans
- Για να τις βρεις: firestore_query("units/{unitId}/payment_plans") — αντικατέστησε {unitId} με το πραγματικό ID
- ΠΡΩΤΑ βρες το unitId μέσω firestore_query("units") → πάρε το id
- ΜΕΤΑ κάνε firestore_query("units/{id}/payment_plans")
- Κάθε payment plan έχει installments[] array με: label (φάση), amount, percentage, dueDate, status
- Παράδειγμα labels: "Κράτηση", "Θεμελίωση", "Σκελετός", "Τοιχοποιία", "Δάπεδα", "Κουφώματα", "Αποπεράτωση"

ΣΗΜΑΝΤΙΚΟ: Τα nested πεδία επιστρέφονται FLAT (με prefix _):
- _askingPrice, _finalPrice, _buyerName, _buyerContactId, _reservationDate, _saleDate
- _paymentTotal, _paymentPaid, _paymentRemaining, _paymentPaidPct
- _installmentsTotal, _installmentsPaid, _installmentsOverdue
- _nextInstallmentAmount, _nextInstallmentDate
- _areaGross, _areaNet, _areaBalcony, _areaTerrace, _areaGarden
Αν δεν βλέπεις αυτά τα πεδία, σημαίνει ότι δεν υπάρχουν δεδομένα (ΟΧΙ ότι δεν δουλεύει).

Τα units documents περιέχουν ΜΕΣΑ ΤΟΥΣ:
- commercial.askingPrice, .finalPrice, .buyerContactId, .buyerName, .reservationDate, .saleDate
- commercial.paymentSummary: .totalAmount, .paidAmount, .remainingAmount, .paidPercentage, .totalInstallments, .paidInstallments, .overdueInstallments, .nextInstallmentAmount, .nextInstallmentDate
- areas: .gross, .net, .balcony, .terrace, .garden
ΔΕΝ υπάρχει ξεχωριστό collection για πληρωμές/τιμές!

ΠΟΤΕ ΝΑ ΣΤΑΜΑΤΑΣ ΝΑ ΚΑΛΕΙΣ TOOLS:
- Αν έχεις ΗΔΗ τα δεδομένα που χρειάζεσαι → ΣΤΑΜΑΤΑ, δώσε απάντηση
- Αν μια query επέστρεψε αποτελέσματα → μορφοποίησέ τα αμέσως (εκτός αν χρειάζονται joins)
- ΜΗΝ ξανα-καλείς tool για δεδομένα που ήδη έχεις
- Μέγιστο 2-3 tool calls για απλές ερωτήσεις, 4-5 μόνο για σύνθετες με joins

ΣΗΜΑΝΤΙΚΟ ΓΙΑ DOCUMENT IDs:
- Κάθε αποτέλεσμα query επιστρέφει "id" (document ID)
- ΔΕΝ μπορείς να κάνεις filter where('id', '==', ...) — τα IDs δεν είναι Firestore fields!
- Για να πάρεις document με γνωστό ID χρησιμοποίησε firestore_get_document
- Παράδειγμα: αν πάρεις construction_phase με buildingId: "abc123", κάνε firestore_get_document("buildings", "abc123")

ΣΗΜΑΝΤΙΚΟ ΓΙΑ companyId:
- Το companyId προστίθεται ΑΥΤΟΜΑΤΑ σε κάθε query — ΜΗΝ το βάζεις στα filters
- Για child collections (buildings, construction_phases, construction_tasks, floors) το companyId αγνοείται αυτόματα
- Αυτά τα collections συνδέονται μέσω parent ID (projectId, buildingId, phaseId κλπ)

ΣΗΜΑΝΤΙΚΟ ΓΙΑ ΟΝΟΜΑΤΑ ΕΠΑΦΩΝ:
- Τα ονόματα μπορεί να είναι σε ΛΑΤΙΝΙΚΟΥΣ χαρακτήρες (Georgios Pagonis) ή ΕΛΛΗΝΙΚΟΥΣ (Γεώργιος Παγώνης)
- Αν δεν βρεις με ελληνικό όνομα, ΔΟΚΙΜΑΣΕ ΚΑΙ ΜΕ ΛΑΤΙΝΙΚΟ (π.χ. Γεώργιος→Georgios, Γιάννης→Giannis/Ioannis, Μαρία→Maria)
- Αν δεν βρεις ούτε έτσι, χρησιμοποίησε search_text αντί firestore_query
- ΠΟΤΕ μη λες "δεν βρέθηκε" αν δεν δοκίμασες ΚΑΙ τις δύο γραφές

ΣΤΡΑΤΗΓΙΚΗ ΑΝΑΖΗΤΗΣΗΣ:
- Για "ποια έργα έχουν X": ξεκίνα από projects query
- Για "φάσεις κατασκευής": query construction_phases → για κάθε μοναδικό buildingId κάνε get_document("buildings") → για κάθε projectId κάνε get_document("projects") → παρουσίασε ομαδοποιημένα ανά Έργο > Κτήριο > Φάσεις
- Για "στατιστικά": χρήσε firestore_count αντί πλήρες query
- Αν query επιστρέφει 0 αποτελέσματα, δοκίμασε χωρίς φίλτρα ή με search_text
- ΠΟΤΕ μην δίνεις "δεν βρέθηκαν" αν δεν δοκίμασες τουλάχιστον 2 διαφορετικές αναζητήσεις

ΚΡΙΣΙΜΟ — ΑΠΑΓΟΡΕΥΣΗ HALLUCINATION:
- ΠΟΤΕ μη δίνεις γενικές/εγκυκλοπαιδικές/θεωρητικές απαντήσεις. Αυτός ΔΕΝ είναι γενικός chatbot.
- ΟΛΑ τα δεδομένα πρέπει να προέρχονται ΑΠΟ TOOLS. Αν δεν βρεις δεδομένα, πες "δεν βρήκα δεδομένα" — ΜΗΝ βγάλεις απάντηση από τη φαντασία σου.
- Αν ρωτήσουν "πώς γίνεται X" ή "τι είναι X", ΜΗΝ δίνεις generic Wikipedia απαντήσεις. Ψάξε στα δεδομένα αν υπάρχει σχετική πληροφορία.
- Αν query αποτύχει λόγω "index" ή "permission" error, δοκίμασε χωρίς φίλτρα — ΜΗ λες στον χρήστη για "δείκτες βάσης δεδομένων".
- Κράτα τις απαντήσεις ΣΥΝΤΟΜΕΣ (max 5-6 γραμμές). Μην γράφεις essays.

11. ΜΗΝ τελειώνεις ΠΟΤΕ με "Αν χρειάζεσαι...", "Μη διστάσεις...", "Ενημέρωσέ με", "Πώς μπορώ να σε εξυπηρετήσω" ή παρόμοιες γενικές φράσεις. Δώσε μόνο την ουσιαστική απάντηση.
12. Στο τέλος ΚΑΘΕ απάντησης, πρόσθεσε ένα block [SUGGESTIONS] με 2-3 σύντομες follow-up ερωτήσεις. ΚΡΙΣΙΜΟ: Τα suggestions πρέπει να σχετίζονται ΑΜΕΣΑ με αυτό που ρώτησε ο χρήστης ΚΑΙ τα δεδομένα που βρέθηκαν. ΜΗΝ βάζεις τα ίδια generic suggestions κάθε φορά.
Παραδείγματα ΣΩΣΤΩΝ suggestions:
- Αν ρώτησε για στούντιο 50 τ.μ. → "Τιμή του στούντιο", "Σε ποιο κτήριο ανήκει", "Όροφος και θέση"
- Αν ρώτησε για επαφή Σοφία → "Τηλέφωνο Σοφίας", "Email Σοφίας", "Ενημέρωση στοιχείων"
- Αν ρώτησε για έργο → "Κτήρια του έργου", "Φάσεις κατασκευής", "Πρόοδος εργασιών"
- Αν δεν βρέθηκαν αποτελέσματα → "Λίστα όλων των ακινήτων", "Αναζήτηση με διαφορετικό όρο", "Λίστα έργων"
[SUGGESTIONS]
(2-3 ερωτήσεις εδώ, μία ανά γραμμή, max 40 χαρακτήρες)
[/SUGGESTIONS]
${learnedPatterns}
ΙΣΤΟΡΙΚΟ ΣΥΝΟΜΙΛΙΑΣ:
${historyStr}`;
}

// ============================================================================
// OPENAI CHAT COMPLETIONS API CALL
// ============================================================================

async function callChatCompletions(
  messages: ChatCompletionMessage[],
  tools: AgenticToolDefinition[],
  timeoutMs: number
): Promise<{
  message: ChatCompletionChoice['message'];
  finishReason: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;

  const requestBody = {
    model,
    messages,
    tools,
    tool_choice: 'auto' as const,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMsg = `OpenAI error (${response.status})`;
      const errorPayload = safeJsonParse<{ error?: { message?: string } }>(errorText, null as unknown as { error?: { message?: string } });
      if (errorPayload?.error?.message) {
        errorMsg = errorPayload.error.message;
      } else if (errorText.length > 0 && errorText.length < 500) {
        errorMsg += `: ${errorText}`;
      }
      throw new Error(errorMsg);
    }

    const payload = await response.json() as {
      choices?: ChatCompletionChoice[];
    };

    const choice = payload.choices?.[0];
    if (!choice) {
      throw new Error('OpenAI returned no choices');
    }

    return {
      message: choice.message,
      finishReason: choice.finish_reason,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// MAIN AGENTIC LOOP
// ============================================================================

/**
 * Execute the agentic loop — AI reasons with tools iteratively.
 *
 * @param userMessage - The user's message
 * @param chatHistory - Previous conversation messages
 * @param tools - Available tool definitions
 * @param context - Execution context (companyId, permissions, etc.)
 * @param config - Loop configuration overrides
 * @returns Agentic result with answer and tool call history
 */
export async function executeAgenticLoop(
  userMessage: string,
  chatHistory: ChatMessage[],
  tools: AgenticToolDefinition[],
  context: AgenticContext,
  config?: Partial<AgenticLoopConfig>
): Promise<AgenticResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const executor = getAgenticToolExecutor();
  const allToolCalls: AgenticResult['toolCalls'] = [];

  // ADR-173: Fetch learned patterns for dynamic prompt enhancement
  const learnedPatterns = await enhanceSystemPrompt(userMessage);

  // Build message history for OpenAI Chat Completions
  const messages: ChatCompletionMessage[] = [
    {
      role: 'system',
      content: buildAgenticSystemPrompt(context, chatHistory, learnedPatterns),
    },
  ];

  // Add chat history as alternating user/assistant messages
  for (const msg of chatHistory.slice(-6)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  logger.info('Starting agentic loop', {
    requestId: context.requestId,
    messageLength: userMessage.length,
    historyCount: chatHistory.length,
    maxIterations: cfg.maxIterations,
  });

  for (let iteration = 0; iteration < cfg.maxIterations; iteration++) {
    // Check total timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= cfg.totalTimeoutMs) {
      logger.warn('Agentic loop timeout', {
        requestId: context.requestId,
        iteration,
        elapsedMs: elapsed,
      });
      return {
        answer: 'Η αναζήτηση πήρε πολύ χρόνο. Δοκίμασε μια πιο συγκεκριμένη ερώτηση.',
        suggestions: [],
        toolCalls: allToolCalls,
        iterations: iteration + 1,
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Call OpenAI Chat Completions
    const remainingTimeMs = Math.min(
      cfg.perCallTimeoutMs,
      cfg.totalTimeoutMs - elapsed
    );

    const response = await callChatCompletions(messages, tools, remainingTimeMs);

    // Check for tool calls
    const toolCalls = response.message.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // Add the assistant message WITH tool_calls to conversation
      messages.push({
        role: 'assistant',
        content: response.message.content ?? null,
        tool_calls: toolCalls,
      });

      // Execute each tool call and add results
      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        const argsString = tc.function.arguments;
        let toolArgs: Record<string, unknown> = {};

        toolArgs = safeJsonParse<Record<string, unknown>>(argsString, {});

        logger.info('Executing tool call', {
          requestId: context.requestId,
          iteration,
          tool: toolName,
          callId: tc.id,
        });

        const result = await executor.executeTool(toolName, toolArgs, context);

        const resultStr = JSON.stringify(result.data ?? result.error ?? 'no data');
        const truncatedResult = resultStr.length > cfg.maxToolResultChars
          ? resultStr.substring(0, cfg.maxToolResultChars) + '...[truncated]'
          : resultStr;

        allToolCalls.push({
          name: toolName,
          args: argsString,
          result: truncatedResult,
        });

        // Add tool result message with matching tool_call_id
        messages.push({
          role: 'tool',
          content: truncatedResult,
          tool_call_id: tc.id,
        });
      }

      continue; // Next iteration — AI processes tool results
    }

    // No tool calls — AI generated final text answer
    const answer = response.message.content
      ?? 'Δεν μπόρεσα να επεξεργαστώ το αίτημα.';

    // Clean potential JSON wrapping
    const cleanedAnswer = cleanAITextReply(answer);

    // Phase 6B: Extract suggested follow-up actions from AI response
    const { cleanAnswer: finalAnswer, suggestions } = extractSuggestions(cleanedAnswer);

    logger.info('Agentic loop completed', {
      requestId: context.requestId,
      iterations: iteration + 1,
      toolCallsTotal: allToolCalls.length,
      suggestionsCount: suggestions.length,
      totalDurationMs: Date.now() - startTime,
    });

    return {
      answer: finalAnswer,
      suggestions,
      toolCalls: allToolCalls,
      iterations: iteration + 1,
      totalDurationMs: Date.now() - startTime,
    };
  }

  // Max iterations reached — ask AI to summarize what it found so far
  logger.warn('Agentic loop max iterations, requesting summary', {
    requestId: context.requestId,
    iterations: cfg.maxIterations,
    toolCallsTotal: allToolCalls.length,
  });

  // Final attempt: ask AI to answer with whatever data it collected
  try {
    messages.push({
      role: 'user',
      content: 'ΣΤΑΜΑΤΑ τις αναζητήσεις. Με βάση τα δεδομένα που ΕΧΕΙΣ ΗΔΗ συλλέξει, δώσε την καλύτερη δυνατή απάντηση στον χρήστη. Αν δεν βρήκες τίποτα, πες ακριβώς τι δεν μπόρεσες να βρεις.',
    });

    const summaryResponse = await callChatCompletions(messages, [], cfg.perCallTimeoutMs);
    const summaryContent = summaryResponse.message?.content;

    if (summaryContent) {
      const { cleanAnswer: summaryAnswer, suggestions: summarySuggestions } = extractSuggestions(summaryContent);
      return {
        answer: summaryAnswer,
        suggestions: summarySuggestions,
        toolCalls: allToolCalls,
        iterations: cfg.maxIterations,
        totalDurationMs: Date.now() - startTime,
      };
    }
  } catch {
    // Non-fatal — fall through to default message
  }

  return {
    answer: 'Η αναζήτηση ήταν πολύπλοκη αλλά δεν κατάφερα να ολοκληρώσω. Δοκίμασε πιο συγκεκριμένη ερώτηση.',
    suggestions: [],
    toolCalls: allToolCalls,
    iterations: cfg.maxIterations,
    totalDurationMs: Date.now() - startTime,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Phase 6B: Extract [SUGGESTIONS] block from AI response.
 * Returns clean answer (without the block) and parsed suggestion strings.
 *
 * Handles two cases:
 *   1. With closing tag: [SUGGESTIONS]...[/SUGGESTIONS]
 *   2. Without closing tag: [SUGGESTIONS]... (to end of string)
 *
 * Also strips generic filler phrases ("Αν χρειάζεσαι...", "Μη διστάσεις..." etc.)
 */
function extractSuggestions(rawAnswer: string): { cleanAnswer: string; suggestions: string[] } {
  // Try with closing tag first, then without (AI often omits [/SUGGESTIONS])
  const regexClosed = /\[SUGGESTIONS\]\n?([\s\S]*?)\[\/SUGGESTIONS\]/;
  const regexOpen = /\[SUGGESTIONS\]\n?([\s\S]*)$/;

  const match = rawAnswer.match(regexClosed) ?? rawAnswer.match(regexOpen);

  let cleanAnswer: string;
  let suggestions: string[] = [];

  if (match) {
    cleanAnswer = rawAnswer.replace(match[0], '').trim();
    suggestions = match[1]
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 40)
      .slice(0, 3);
  } else {
    cleanAnswer = rawAnswer;
  }

  // Strip generic filler phrases the AI might still produce
  cleanAnswer = stripGenericClosingPhrases(cleanAnswer);

  return { cleanAnswer, suggestions };
}

/** Remove filler phrases like "Αν χρειάζεσαι...", "Μη διστάσεις...", "Ενημέρωσέ με" */
function stripGenericClosingPhrases(text: string): string {
  const fillerPatterns = [
    /\n*Αν χρειάζεσαι[^\n]*/gi,
    /\n*Εάν χρειάζεσαι[^\n]*/gi,
    /\n*Μη διστάσεις[^\n]*/gi,
    /\n*Μην διστάσεις[^\n]*/gi,
    /\n*Ενημέρωσέ με[^\n]*/gi,
    /\n*Αν θέλεις περισσότερ[^\n]*/gi,
    /\n*Εάν θέλεις περισσότερ[^\n]*/gi,
    /\n*Είμαι εδώ για[^\n]*/gi,
    /\n*Πώς μπορώ να σε εξυπηρετήσω[^\n]*/gi,
    /\n*Θα μπορούσες να ελέγξεις[^\n]*/gi,
  ];

  let cleaned = text;
  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Clean AI text reply — strip JSON wrapping if present
 */
function cleanAITextReply(rawText: string): string {
  const trimmed = rawText.trim();

  // Strip markdown code blocks
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  // Try to extract text from JSON wrapper
  if (candidate.startsWith('{')) {
    const parsed = safeJsonParse<Record<string, unknown>>(candidate, null as unknown as Record<string, unknown>);
    if (parsed !== null) {
      const textValue = parsed.response ?? parsed.message ?? parsed.error ?? parsed.text;
      if (isNonEmptyString(textValue)) {
        return textValue;
      }
    }
  }

  return trimmed;
}
