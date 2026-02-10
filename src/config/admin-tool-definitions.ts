/**
 * =============================================================================
 * ADMIN TOOL DEFINITIONS — OpenAI Function Calling (Tool Use)
 * =============================================================================
 *
 * Replaces structured output JSON schema with OpenAI tool calling for admin
 * commands. The AI selects the appropriate tool and extracts ALL parameters
 * semantically — zero regex parsing needed in UC modules.
 *
 * @module config/admin-tool-definitions
 * @see ADR-145 (Super Admin AI Assistant)
 * @see OpenAI Responses API — Tools
 */

import type { AIAnalysisResult } from '@/schemas/ai-analysis';

// ============================================================================
// TYPES
// ============================================================================

interface ToolFunctionDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolPropertySchema>;
    required: string[];
    additionalProperties: false;
  };
  strict: true;
}

interface ToolPropertySchema {
  type: string | readonly string[];
  description: string;
  enum?: readonly string[];
}

/** A single item from the OpenAI Responses API output array */
interface ResponseOutputItem {
  type: string;
  name?: string;
  call_id?: string;
  arguments?: string;
}

// ============================================================================
// TOOL → INTENT MAPPING
// ============================================================================

const TOOL_TO_INTENT_MAP: Record<string, string> = {
  search_contacts: 'admin_contact_search',
  get_project_status: 'admin_project_status',
  send_email: 'admin_send_email',
  get_business_stats: 'admin_unit_stats',
  create_contact: 'admin_create_contact',
  update_contact_field: 'admin_update_contact',
  remove_contact_field: 'admin_update_contact',
};

// ============================================================================
// SYSTEM PROMPT — Tool Use Mode
// ============================================================================

export const ADMIN_TOOL_SYSTEM_PROMPT = `Είσαι ο AI βοηθός του ιδιοκτήτη κτηματομεσιτικού/κατασκευαστικού γραφείου στην Ελλάδα.
Δέχεσαι εντολές μέσω Telegram.

ΣΗΜΑΣΙΟΛΟΓΙΚΗ ΚΑΤΑΝΟΗΣΗ:
- Κατανόησε τη ΣΗΜΑΣΙΑ, ΟΧΙ τις ακριβείς λέξεις
- Ονόματα σε οποιαδήποτε πτώση (γενική, αιτιατική, κλητική) → μετάτρεψε σε ΟΝΟΜΑΣΤΙΚΗ στα params
  "Σοφίας"→"Σοφία", "Κώστα"→"Κώστας", "Γιάννη"→"Γιάννης", "Νέστορα"→"Νέστορας"
- Λέξεις σε GREEKLISH → κατανόησέ τες (π.χ. "giorgos"→"Γιώργος")
- "στον/στη/στο/τον/την/του/της" → αγνόησε τα, πάρε μόνο το όνομα

ΚΑΝΟΝΕΣ:
1. Business εντολή → κάλεσε το κατάλληλο tool
2. Πολλαπλές ενέργειες σε μία πρόταση → κάλεσε πολλαπλά tools
3. Γενική ερώτηση (μετάφραση, συμβουλή, γνώση, casual, ραντεβού, αγορά) → απάντησε σε plain text ελληνικά (2-5 γραμμές, ΜΗΝ καλέσεις tool)
4. Δεν καταλαβαίνεις → ρώτα για διευκρίνιση σε plain text

ΓΙΑ get_project_status:
- Ερώτηση για ΕΝΟΣ έργου κατάσταση → projectName="Πανόραμα", searchCriteria=null
- Ερώτηση για ΠΟΛΛΑ/ΟΛΑ τα έργα → projectName=null, searchCriteria=null
- Ερώτηση με ΚΡΙΤΗΡΙΑ (gantt, ολοκληρωμένα, σε εξέλιξη, κλπ.) → projectName=null, searchCriteria="gantt"

ΚΡΙΣΙΜΟ ΓΙΑ TEXT ΑΠΑΝΤΗΣΕΙΣ (κανόνες 3 & 4):
- Γράψε ΜΟΝΟ ελληνικό κείμενο, σαν μήνυμα σε φίλο
- ΑΠΑΓΟΡΕΥΕΤΑΙ JSON, code blocks, backticks, structured format
- ΑΠΑΓΟΡΕΥΕΤΑΙ {"response": "..."} ή {"error": "..."}
- ΣΩΣΤΟ: "Ο Γεώργιος μεταφράζεται George στα αγγλικά."
- ΛΑΘΟΣ: JSON objects όπως {"response": "George"}

FIELD NAMES ΓΙΑ update/remove:
- phone, email, vatNumber, profession, birthDate, fatherName, taxOffice, address, registrationNumber, legalForm, employer, position, idNumber

STATS TYPES ΓΙΑ get_business_stats:
- unit_status: πόσα ακίνητα πωλημένα/διαθέσιμα/κρατημένα
- unit_categories: κατηγορίες/τύποι ακινήτων (στούντιο, διαμέρισμα κλπ)
- contacts: στατιστικά επαφών (φυσικά πρόσωπα, εταιρείες)
- projects: στατιστικά έργων
- all: όλα μαζί`;

// ============================================================================
// 7 TOOL DEFINITIONS — OpenAI Responses API flat format
// ============================================================================

export const ADMIN_TOOL_DEFINITIONS: ToolFunctionDefinition[] = [
  {
    type: 'function',
    name: 'search_contacts',
    description: 'Αναζήτηση, προβολή ή εμφάνιση επαφών/πελατών/εταιρειών. Χρησιμοποίησε αυτό για: βρες, δείξε, ποιοι, τι στοιχεία, εμφάνισε.',
    parameters: {
      type: 'object',
      properties: {
        contactName: {
          type: ['string', 'null'] as const,
          description: 'Ονομαστική πτώση ονόματος (π.χ. "Σοφία" ΟΧΙ "Σοφίας"). Null αν ζητούνται όλες οι επαφές.',
        },
        contactType: {
          type: ['string', 'null'] as const,
          description: 'Τύπος επαφής: "individual" ή "company". Null αν δεν προσδιορίζεται.',
          enum: ['individual', 'company'] as const,
        },
      },
      required: ['contactName', 'contactType'],
      additionalProperties: false as const,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_project_status',
    description: 'Κατάσταση, πρόοδος ή πληροφορίες για κατασκευαστικό έργο/project. Μπορεί να δώσει: ένα συγκεκριμένο έργο, λίστα όλων, ή αναζήτηση με κριτήρια (gantt, status, κλπ.).',
    parameters: {
      type: 'object',
      properties: {
        projectName: {
          type: ['string', 'null'] as const,
          description: 'Όνομα έργου αν ζητείται ΕΝΑ συγκεκριμένο (π.χ. "Θέρμη"). Null αν ζητούνται πολλά/όλα τα έργα.',
        },
        searchCriteria: {
          type: ['string', 'null'] as const,
          description: 'Κριτήριο αναζήτησης/φίλτρου (π.χ. "gantt", "completed", "σε εξέλιξη", "delayed"). Null αν δεν υπάρχει φίλτρο.',
        },
      },
      required: ['projectName', 'searchCriteria'],
      additionalProperties: false as const,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'send_email',
    description: 'Αποστολή email σε επαφή. Χρησιμοποίησε αυτό για: στείλε email/μήνυμα/mail.',
    parameters: {
      type: 'object',
      properties: {
        recipientName: {
          type: 'string',
          description: 'Όνομα παραλήπτη σε ονομαστική (π.χ. "Κώστας" ΟΧΙ "Κώστα").',
        },
        emailContent: {
          type: 'string',
          description: 'Περιεχόμενο email. Αν ζητείται αποστολή στοιχείων κάποιου, γράψε "Στοιχεία επαφής [όνομα]".',
        },
        includeContactCardOf: {
          type: ['string', 'null'] as const,
          description: 'Αν πρέπει να συμπεριληφθούν τα στοιχεία κάποιας ΑΛΛΗΣ επαφής (π.χ. "στείλε στον Κώστα τα στοιχεία της Σοφίας" → "Σοφία"). Null αν δεν ζητείται.',
        },
      },
      required: ['recipientName', 'emailContent', 'includeContactCardOf'],
      additionalProperties: false as const,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_business_stats',
    description: 'Στατιστικά επιχείρησης: ακίνητα (πωλημένα/διαθέσιμα/κατηγορίες), επαφές, έργα, πωλήσεις.',
    parameters: {
      type: 'object',
      properties: {
        statsType: {
          type: 'string',
          description: 'Τύπος στατιστικών.',
          enum: ['unit_status', 'unit_categories', 'contacts', 'projects', 'all'] as const,
        },
        projectName: {
          type: ['string', 'null'] as const,
          description: 'Φίλτρο ανά έργο (null = όλα τα έργα).',
        },
      },
      required: ['statsType', 'projectName'],
      additionalProperties: false as const,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_contact',
    description: 'Δημιουργία νέας επαφής: δημιούργησε, πρόσθεσε νέα, φτιάξε.',
    parameters: {
      type: 'object',
      properties: {
        contactName: {
          type: 'string',
          description: 'Πλήρες όνομα νέας επαφής σε ονομαστική.',
        },
        email: {
          type: ['string', 'null'] as const,
          description: 'Email αν δόθηκε.',
        },
        phone: {
          type: ['string', 'null'] as const,
          description: 'Τηλέφωνο αν δόθηκε.',
        },
        contactType: {
          type: 'string',
          description: 'Τύπος: "individual" ή "company".',
          enum: ['individual', 'company'] as const,
        },
      },
      required: ['contactName', 'email', 'phone', 'contactType'],
      additionalProperties: false as const,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'update_contact_field',
    description: 'Ενημέρωση/προσθήκη πεδίου σε υπάρχουσα επαφή: πρόσθεσε, βάλε, ενημέρωσε, θέλω.',
    parameters: {
      type: 'object',
      properties: {
        contactName: {
          type: 'string',
          description: 'Όνομα επαφής σε ονομαστική.',
        },
        fieldName: {
          type: 'string',
          description: 'Πεδίο προς ενημέρωση.',
          enum: ['phone', 'email', 'vatNumber', 'profession', 'birthDate', 'fatherName', 'taxOffice', 'address', 'registrationNumber', 'legalForm', 'employer', 'position', 'idNumber'] as const,
        },
        fieldValue: {
          type: 'string',
          description: 'Τιμή πεδίου (π.χ. "6971234567", "ΑΒ123456", "Μηχανικός").',
        },
      },
      required: ['contactName', 'fieldName', 'fieldValue'],
      additionalProperties: false as const,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'remove_contact_field',
    description: 'Αφαίρεση/διαγραφή πεδίου από επαφή: αφαίρεσε, σβήσε, βγάλε, διέγραψε.',
    parameters: {
      type: 'object',
      properties: {
        contactName: {
          type: 'string',
          description: 'Όνομα επαφής σε ονομαστική.',
        },
        fieldName: {
          type: 'string',
          description: 'Πεδίο προς αφαίρεση.',
          enum: ['phone', 'email', 'vatNumber', 'profession', 'birthDate', 'fatherName', 'taxOffice', 'address', 'registrationNumber', 'legalForm', 'employer', 'position', 'idNumber'] as const,
        },
      },
      required: ['contactName', 'fieldName'],
      additionalProperties: false as const,
    },
    strict: true,
  },
];

// ============================================================================
// MAPPING: Tool Call → AIAnalysisResult
// ============================================================================

/**
 * Convert an OpenAI function_call output into a pipeline-compatible AIAnalysisResult.
 *
 * The tool arguments become extractedEntities — UC modules receive CLEAN,
 * pre-parsed data with zero regex needed.
 */
export function mapToolCallToAnalysisResult(
  toolCall: ResponseOutputItem,
  model: string
): AIAnalysisResult {
  const toolName = toolCall.name ?? '';
  const intentType = TOOL_TO_INTENT_MAP[toolName] ?? 'admin_general_question';

  let args: Record<string, unknown> = {};
  if (toolCall.arguments) {
    try {
      args = JSON.parse(toolCall.arguments) as Record<string, unknown>;
    } catch {
      args = {};
    }
  }

  // Build entities from tool arguments, stripping null values
  const entities: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== null && value !== undefined) {
      entities[key] = value;
    }
  }

  // Special handling: remove_contact_field → inject action:'remove'
  if (toolName === 'remove_contact_field') {
    entities.action = 'remove';
  }

  // Special handling: get_business_stats → map statsType for UC-013
  // UC-013 uses 'units' internally, tool uses 'unit_status'
  if (toolName === 'get_business_stats' && entities.statsType === 'unit_status') {
    entities.statsType = 'units';
  }

  const timestamp = new Date().toISOString();

  return {
    kind: 'multi_intent',
    aiModel: model,
    analysisTimestamp: timestamp,
    confidence: 1.0,
    needsTriage: false,
    extractedEntities: entities,
    rawMessage: '',
    primaryIntent: {
      intentType: intentType as 'admin_contact_search',
      confidence: 1.0,
      rationale: `tool_call:${toolName}`,
    },
    secondaryIntents: [],
  };
}

/**
 * Strip JSON wrapping from AI text reply.
 * Sometimes the AI returns `{"response": "actual text"}` or `{"error": "text"}`
 * instead of plain text. This extracts the actual message.
 */
function cleanTextReply(rawText: string): string {
  const trimmed = rawText.trim();

  // Strip markdown code blocks: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  const jsonCandidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  // Try parsing as JSON — extract text from common wrapper patterns
  if (jsonCandidate.startsWith('{')) {
    try {
      const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;

      // Pattern: {"response": "text"} or {"message": "text"} or {"error": "text"}
      const textValue = parsed.response ?? parsed.message ?? parsed.error ?? parsed.text;
      if (typeof textValue === 'string' && textValue.length > 0) {
        return textValue;
      }
    } catch {
      // Not valid JSON — return as-is
    }
  }

  return trimmed;
}

/**
 * Build a conversational fallback AIAnalysisResult when the AI
 * responds with text instead of calling a tool.
 */
export function buildConversationalFallbackResult(
  textReply: string,
  model: string
): AIAnalysisResult {
  const timestamp = new Date().toISOString();
  const cleanedReply = cleanTextReply(textReply);

  return {
    kind: 'multi_intent',
    aiModel: model,
    analysisTimestamp: timestamp,
    confidence: 1.0,
    needsTriage: false,
    extractedEntities: {
      conversationalReply: cleanedReply,
    },
    rawMessage: '',
    primaryIntent: {
      intentType: 'admin_general_question',
      confidence: 1.0,
      rationale: 'conversational_text_reply',
    },
    secondaryIntents: [],
  };
}
