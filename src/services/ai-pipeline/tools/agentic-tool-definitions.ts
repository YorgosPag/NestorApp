/**
 * =============================================================================
 * AGENTIC TOOL DEFINITIONS — OpenAI Function Calling for Autonomous Agent
 * =============================================================================
 *
 * 8 generic tools that give the AI agent autonomous access to Firestore data.
 * Replaces hardcoded UC modules with generic, composable tools.
 *
 * @module services/ai-pipeline/tools/agentic-tool-definitions
 * @see ADR-171 (Autonomous AI Agent)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AgenticToolProperty>;
    required: string[];
    additionalProperties: false;
  };
  strict: true;
}

interface AgenticToolProperty {
  type: string | readonly string[];
  description: string;
  enum?: readonly string[];
  items?: { type: string };
}

// ============================================================================
// 8 AGENTIC TOOL DEFINITIONS
// ============================================================================

export const AGENTIC_TOOL_DEFINITIONS: AgenticToolDefinition[] = [
  // ── 1. firestore_query: Query any collection ──
  {
    type: 'function',
    name: 'firestore_query',
    description: 'Query a Firestore collection with filters, ordering, and limit. Always include companyId filter for data isolation. Use this for listing, searching, and filtering data.',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'Collection name (e.g. projects, buildings, contacts, units, construction_phases)',
        },
        filters: {
          type: 'array',
          description: 'Array of filter conditions. Each has field, operator, value.',
          items: { type: 'object' },
        },
        orderBy: {
          type: ['string', 'null'] as const,
          description: 'Field to order results by (e.g. "createdAt", "name")',
        },
        orderDirection: {
          type: ['string', 'null'] as const,
          description: 'Order direction',
          enum: ['asc', 'desc'] as const,
        },
        limit: {
          type: ['number', 'null'] as const,
          description: 'Max results to return (default 20, max 50)',
        },
      },
      required: ['collection', 'filters', 'orderBy', 'orderDirection', 'limit'],
      additionalProperties: false as const,
    },
    strict: true,
  },

  // ── 2. firestore_get_document: Get single document by ID ──
  {
    type: 'function',
    name: 'firestore_get_document',
    description: 'Fetch a single Firestore document by its ID. Use when you know the exact document ID.',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'Collection name',
        },
        documentId: {
          type: 'string',
          description: 'The document ID to fetch',
        },
      },
      required: ['collection', 'documentId'],
      additionalProperties: false as const,
    },
    strict: true,
  },

  // ── 3. firestore_count: Count documents matching criteria ──
  {
    type: 'function',
    name: 'firestore_count',
    description: 'Count documents in a collection matching filter criteria. More efficient than query when you only need counts.',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'Collection name',
        },
        filters: {
          type: 'array',
          description: 'Array of filter conditions (same format as firestore_query)',
          items: { type: 'object' },
        },
      },
      required: ['collection', 'filters'],
      additionalProperties: false as const,
    },
    strict: true,
  },

  // ── 4. firestore_write: Create or update a document (admin only) ──
  {
    type: 'function',
    name: 'firestore_write',
    description: 'Create or update a Firestore document. ONLY for admin use. Always include companyId. Use mode "create" for new documents, "update" for existing.',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'Collection name',
        },
        documentId: {
          type: ['string', 'null'] as const,
          description: 'Document ID (null for auto-generate on create)',
        },
        mode: {
          type: 'string',
          description: 'Write mode',
          enum: ['create', 'update'] as const,
        },
        data: {
          type: 'object',
          description: 'Fields to write/update (JSON object)',
        },
      },
      required: ['collection', 'documentId', 'mode', 'data'],
      additionalProperties: false as const,
    },
    strict: true,
  },

  // ── 5. send_email_to_contact: Send email via Mailgun ──
  {
    type: 'function',
    name: 'send_email_to_contact',
    description: 'Send an email to a contact. Searches for the contact by name first, then sends the email to their registered email address.',
    parameters: {
      type: 'object',
      properties: {
        contactName: {
          type: 'string',
          description: 'Contact name to search for (nominative case)',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body text',
        },
      },
      required: ['contactName', 'subject', 'body'],
      additionalProperties: false as const,
    },
    strict: true,
  },

  // ── 6. send_telegram_message: Send Telegram message ──
  {
    type: 'function',
    name: 'send_telegram_message',
    description: 'Send a Telegram message to a specific chat ID. Use this to reply or notify users via Telegram.',
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Telegram chat ID to send to',
        },
        text: {
          type: 'string',
          description: 'Message text to send',
        },
      },
      required: ['chatId', 'text'],
      additionalProperties: false as const,
    },
    strict: true,
  },

  // ── 7. get_collection_schema: Get schema info about a collection ──
  {
    type: 'function',
    name: 'get_collection_schema',
    description: 'Get the field schema and relationships for a Firestore collection. Use this when you need to understand what fields a collection has before querying it.',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'Collection name to get schema for',
        },
      },
      required: ['collection'],
      additionalProperties: false as const,
    },
    strict: true,
  },

  // ── 8. search_text: Full-text search across collections ──
  {
    type: 'function',
    name: 'search_text',
    description: 'Search for text across multiple collections. Searches name, displayName, title, description fields. Returns matches from all searched collections.',
    parameters: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Text to search for (case-insensitive partial match)',
        },
        collections: {
          type: 'array',
          description: 'Collections to search in (e.g. ["contacts", "projects", "buildings"])',
          items: { type: 'string' },
        },
        limit: {
          type: ['number', 'null'] as const,
          description: 'Max results per collection (default 10)',
        },
      },
      required: ['searchTerm', 'collections', 'limit'],
      additionalProperties: false as const,
    },
    strict: true,
  },
];

/**
 * Get tool definitions as a readonly array (for OpenAI API)
 */
export function getAgenticToolDefinitions(): ReadonlyArray<AgenticToolDefinition> {
  return AGENTIC_TOOL_DEFINITIONS;
}
