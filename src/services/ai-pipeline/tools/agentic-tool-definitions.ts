/**
 * =============================================================================
 * AGENTIC TOOL DEFINITIONS — OpenAI Function Calling for Autonomous Agent
 * =============================================================================
 *
 * 8 generic tools that give the AI agent autonomous access to Firestore data.
 * Replaces hardcoded UC modules with generic, composable tools.
 *
 * Format: Chat Completions API tool calling format
 * (wrapped: { type: 'function', function: { name, description, parameters, strict } })
 *
 * @module services/ai-pipeline/tools/agentic-tool-definitions
 * @see ADR-171 (Autonomous AI Agent)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict: boolean;
  };
}

// ============================================================================
// SHARED ENUMS — SSoT for tool definitions + executor validation
// ============================================================================

/** SPEC-257D: Complaint severity levels (SSoT — used in tool def enum + executor validation) */
export const COMPLAINT_SEVERITIES = ['urgent', 'normal', 'low'] as const;
export type ComplaintSeverity = typeof COMPLAINT_SEVERITIES[number];

/** SPEC-257E: Contact field types (SSoT — used in tool def enum + executor validation) */
export const CONTACT_FIELD_TYPES = ['phone', 'email', 'social'] as const;
export type ContactFieldType = typeof CONTACT_FIELD_TYPES[number];

/** Updatable scalar fields on contact documents (SSoT — complete list from contracts.ts) */
export const CONTACT_UPDATABLE_FIELDS = [
  // Personal
  'birthDate', 'birthCountry', 'gender', 'fatherName', 'motherName', 'amka',
  // Identity document
  'documentType', 'documentNumber', 'documentIssuer', 'documentIssueDate', 'documentExpiryDate',
  // Tax & legal
  'vatNumber', 'taxOffice', 'registrationNumber', 'legalForm',
  // Professional
  'profession', 'employer', 'position',
  // Other
  'address', 'idNumber',
] as const;
export type ContactUpdatableField = typeof CONTACT_UPDATABLE_FIELDS[number];

/** SPEC-257F: File source types (SSoT — used in tool def enum + executor validation) */
export const FILE_SOURCE_TYPES = ['unit_photo', 'file', 'floorplan'] as const;
export type FileSourceType = typeof FILE_SOURCE_TYPES[number];

/** Contact types for create_contact tool (SSoT — used in tool def enum + executor validation) */
export const CONTACT_TYPES = ['individual', 'company'] as const;
export type ContactTypeEnum = typeof CONTACT_TYPES[number];

// ============================================================================
// AGENTIC TOOL DEFINITIONS (Chat Completions API format)
// ============================================================================

export const AGENTIC_TOOL_DEFINITIONS: AgenticToolDefinition[] = [
  // ── 1. firestore_query: Query any collection ──
  {
    type: 'function',
    function: {
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
            description: 'Array of filter conditions.',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', description: 'Firestore field name' },
                operator: {
                  type: 'string',
                  description: 'Comparison operator',
                  enum: ['==', '!=', '<', '<=', '>', '>=', 'in', 'array-contains'],
                },
                value: { type: 'string', description: 'Value to compare (numbers as strings, e.g. "42")' },
              },
              required: ['field', 'operator', 'value'],
              additionalProperties: false,
            },
          },
          orderBy: {
            type: ['string', 'null'],
            description: 'Field to order results by (e.g. "createdAt", "name")',
          },
          orderDirection: {
            type: ['string', 'null'],
            description: 'Order direction',
            enum: ['asc', 'desc', null],
          },
          limit: {
            type: ['number', 'null'],
            description: 'Max results to return (default 20, max 50)',
          },
          tabFilter: {
            type: ['string', 'null'],
            description: 'For contacts collection ONLY: filter results to show ONLY fields from this tab. Use when user asks for a specific tab (e.g. "βασικά στοιχεία" → "basicInfo", "ταυτότητα" → "identity", "επικοινωνία" → "communication", "επαγγελματικά" → "professional", "διεύθυνση" → "address"). Pass null when no specific tab is requested.',
          },
        },
        required: ['collection', 'filters', 'orderBy', 'orderDirection', 'limit', 'tabFilter'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 2. firestore_get_document: Get single document by ID ──
  {
    type: 'function',
    function: {
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
          tabFilter: {
            type: ['string', 'null'],
            description: 'For contacts collection ONLY: filter results to show ONLY fields from this tab (e.g. "basicInfo", "identity", "communication"). Pass null when no specific tab is requested.',
          },
        },
        required: ['collection', 'documentId', 'tabFilter'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 3. firestore_count: Count documents matching criteria ──
  {
    type: 'function',
    function: {
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
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', description: 'Firestore field name' },
                operator: {
                  type: 'string',
                  description: 'Comparison operator',
                  enum: ['==', '!=', '<', '<=', '>', '>=', 'in', 'array-contains'],
                },
                value: { type: 'string', description: 'Value to compare' },
              },
              required: ['field', 'operator', 'value'],
              additionalProperties: false,
            },
          },
        },
        required: ['collection', 'filters'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 4. firestore_write: Create or update a document (admin only) ──
  {
    type: 'function',
    function: {
      name: 'firestore_write',
      description: 'Create or update a Firestore document. ONLY for admin use. Always include companyId. Use mode "create" for new documents, "update" for existing. Pass data as a JSON string. IMPORTANT: For contacts, use update_contact_field (scalar fields) or append_contact_info (phone/email). For creating contacts, use create_contact. IMPORTANT: For profession/skills, ALWAYS call search_esco_occupations/search_esco_skills FIRST — never write profession or escoSkills without searching ESCO.',
      parameters: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Collection name',
          },
          documentId: {
            type: ['string', 'null'],
            description: 'Document ID (null for auto-generate on create)',
          },
          mode: {
            type: 'string',
            description: 'Write mode',
            enum: ['create', 'update'],
          },
          data: {
            type: 'string',
            description: 'JSON string of fields to write/update. E.g. {"name":"Test","status":"active"}',
          },
        },
        required: ['collection', 'documentId', 'mode', 'data'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 5. send_email_to_contact: Send email via Mailgun (with optional attachments) ──
  {
    type: 'function',
    function: {
      name: 'send_email_to_contact',
      description: 'Send an email to a contact. Searches for the contact by name, then sends email to their registered address. Can include file attachments from Firebase Storage.',
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
          attachmentPaths: {
            type: ['array', 'null'],
            items: { type: 'string' },
            description: 'Firebase Storage paths to attach. Use null if no attachments.',
          },
        },
        required: ['contactName', 'subject', 'body', 'attachmentPaths'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 6. send_telegram_message: Send Telegram message ──
  {
    type: 'function',
    function: {
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
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 7. send_messenger_message: Send Messenger message to contact ──
  {
    type: 'function',
    function: {
      name: 'send_messenger_message',
      description: 'Send a Facebook Messenger message to a contact. Searches for the contact by name, finds their Messenger PSID from external_identities, and sends the message. The contact must have previously messaged the Facebook Page.',
      parameters: {
        type: 'object',
        properties: {
          contactName: {
            type: 'string',
            description: 'Contact name to search for',
          },
          text: {
            type: 'string',
            description: 'Message text to send',
          },
        },
        required: ['contactName', 'text'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 8. send_instagram_message: Send Instagram DM to contact ──
  {
    type: 'function',
    function: {
      name: 'send_instagram_message',
      description: 'Send an Instagram Direct Message to a contact. Searches for the contact by name, finds their Instagram IGSID from external_identities, and sends the message. The contact must have previously messaged the Instagram Business account.',
      parameters: {
        type: 'object',
        properties: {
          contactName: {
            type: 'string',
            description: 'Contact name to search for',
          },
          text: {
            type: 'string',
            description: 'Message text to send',
          },
        },
        required: ['contactName', 'text'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 9. get_collection_schema: Get schema info about a collection ──
  {
    type: 'function',
    function: {
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
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 8. search_text: Full-text search across collections ──
  {
    type: 'function',
    function: {
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
            type: ['number', 'null'],
            description: 'Max results per collection (default 10)',
          },
          tabFilter: {
            type: ['string', 'null'],
            description: 'For contacts: filter results to ONLY fields from this tab (e.g. "basicInfo", "identity", "communication"). Pass null when no specific tab is requested.',
          },
        },
        required: ['searchTerm', 'collections', 'limit', 'tabFilter'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 9. create_complaint_task: Customer complaint triage (SPEC-257D) ──
  {
    type: 'function' as const,
    function: {
      name: 'create_complaint_task',
      description: 'Customer (buyer/owner/tenant) reports a problem with their unit. Creates a task and notifies admin for urgent issues. Use ONLY when a linked customer reports an issue with their property.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short complaint title in Greek, e.g. "Υγρασία στο μπάνιο"',
          },
          description: {
            type: 'string',
            description: 'Full complaint description from the customer message',
          },
          severity: {
            type: 'string',
            description: 'Complaint severity: urgent (structural/safety), normal (wear/material), low (aesthetic/neighbour)',
            enum: [...COMPLAINT_SEVERITIES],
          },
          unitId: {
            type: 'string',
            description: 'The unit ID this complaint is about (must be from customer linked units)',
          },
        },
        required: ['title', 'description', 'severity', 'unitId'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 10. append_contact_info: Customer append-only contact update (SPEC-257E) ──
  {
    type: 'function' as const,
    function: {
      name: 'append_contact_info',
      description: 'Add new phone, email, or social media to a contact record. APPEND ONLY — cannot delete or modify existing entries. Admin: provide contactId to append to any contact. Customer: appends to own contact automatically.',
      parameters: {
        type: 'object',
        properties: {
          contactId: {
            type: ['string', 'null'],
            description: 'Contact document ID (required for admin, ignored for customers who auto-use their own contact)',
          },
          fieldType: {
            type: 'string',
            description: 'Type of contact info to add',
            enum: [...CONTACT_FIELD_TYPES],
          },
          value: {
            type: 'string',
            description: 'The value: phone number (e.g. 6974050025), email address (e.g. user@mail.com), or social media username/URL',
          },
          label: {
            type: 'string',
            description: 'Label for the entry. Phone: εργασία/σπίτι/κινητό. Email: εργασία/προσωπικό. Social: platform name (facebook/instagram/linkedin/twitter)',
          },
        },
        required: ['contactId', 'fieldType', 'value', 'label'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 11. deliver_file_to_chat: Send photo/floorplan/document to customer (SPEC-257F) ──
  {
    type: 'function' as const,
    function: {
      name: 'deliver_file_to_chat',
      description: 'Send a photo, floorplan, or document to the current chat. The file is fetched server-side and sent via the active channel (Telegram/Email/etc). Use when a customer asks to see photos, floorplans, or receive documents.',
      parameters: {
        type: 'object',
        properties: {
          sourceType: {
            type: 'string',
            description: 'Source type: unit_photo (photos from unit), file (document from files collection), floorplan (floor plan from floorplans collection)',
            enum: [...FILE_SOURCE_TYPES],
          },
          sourceId: {
            type: 'string',
            description: 'Entity ID: unitId for unit_photo, fileId for file, floorplanId for floorplan',
          },
          caption: {
            type: ['string', 'null'],
            description: 'Optional caption for the sent file. Null for auto-generated caption.',
          },
        },
        required: ['sourceType', 'sourceId', 'caption'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 12. search_knowledge_base: Legal procedures & required documents (SPEC-257G) ──
  {
    type: 'function' as const,
    function: {
      name: 'search_knowledge_base',
      description: 'Search the knowledge base for real estate procedures and required documents. Use when a buyer/owner asks about required documents, notary procedures, bank loans, property transfer, or any legal process. Returns the procedure details, required documents, and which documents are already available in the system.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query in Greek, e.g. "συμβολαιογράφος", "δάνειο τράπεζα", "μεταβίβαση", "τι χρειάζομαι"',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 13. create_contact: Dedicated contact creation with Google-level duplicate detection ──
  {
    type: 'function' as const,
    function: {
      name: 'create_contact',
      description: [
        'Create a new contact (individual person or company). Admin only.',
        'CRITICAL: When the user asks to create a contact, ALWAYS call this tool directly. Do NOT pre-check with firestore_query first — this tool handles duplicate detection automatically.',
        'Validates fields, generates enterprise ID (cont_ for individuals, comp_ for companies).',
        'DUPLICATE DETECTION: Automatically checks for duplicates by email (exact), phone (exact), and name (fuzzy).',
        'If duplicates are found, returns duplicateDetected:true with match details instead of creating.',
        'In that case, describe the duplicates found to the user. Do NOT present numbered options — action buttons will be sent automatically via Telegram inline keyboard.',
        'If user confirms creation despite duplicates, call again with skipDuplicateCheck:true.',
        'Use this INSTEAD of firestore_write for contacts collection.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          contactType: {
            type: 'string',
            description: 'Contact type: individual (physical person) or company',
            enum: [...CONTACT_TYPES],
          },
          firstName: {
            type: 'string',
            description: 'First name (required for individuals, can be representative name for companies)',
          },
          lastName: {
            type: 'string',
            description: 'Last name (required for individuals, can be representative surname for companies)',
          },
          companyName: {
            type: ['string', 'null'],
            description: 'Company name (required for company type, null for individuals)',
          },
          email: {
            type: ['string', 'null'],
            description: 'Primary email address (null if not provided)',
          },
          phone: {
            type: ['string', 'null'],
            description: 'Primary phone number (null if not provided)',
          },
          skipDuplicateCheck: {
            type: 'boolean',
            description: 'Set to true ONLY after user explicitly confirmed they want to create despite duplicates. Default false.',
          },
        },
        required: ['contactType', 'firstName', 'lastName', 'companyName', 'email', 'phone', 'skipDuplicateCheck'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  // ── 15. update_contact_field: Update a scalar field on an existing contact (admin only) ──
  {
    type: 'function' as const,
    function: {
      name: 'update_contact_field',
      description: [
        'Update a single field on an existing contact. Admin only.',
        'Use for ALL scalar fields: vatNumber, profession, address, birthDate, documentIssueDate, documentExpiryDate, documentType, documentNumber, documentIssuer, taxOffice, gender, amka, etc.',
        'For phone/email/social use append_contact_info instead.',
        'IMPORTANT for taxOffice: ALWAYS call lookup_doy_code first to get the 4-digit code.',
        'IMPORTANT for profession: ALWAYS call search_esco_occupations first. Show matches to user. If no ESCO match, ask user before adding free text.',
        'IMPORTANT for dates (birthDate, documentIssueDate, documentExpiryDate): ALWAYS use DD/MM/YYYY format (e.g. "25/01/2027").',
        'IMPORTANT for documentType: ONLY values "identity_card", "passport", "drivers_license", "other".',
        'Pass the contact document ID (e.g. cont_xxx) and the field+value to update.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          contactId: {
            type: 'string',
            description: 'Firestore document ID of the contact (e.g. cont_cacb3149-...)',
          },
          field: {
            type: 'string',
            description: 'Field name to update',
            enum: [...CONTACT_UPDATABLE_FIELDS],
          },
          value: {
            type: 'string',
            description: 'New value for the field. Use empty string to clear.',
          },
        },
        required: ['contactId', 'field', 'value'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 16. set_contact_esco: Write ESCO occupation and/or skills to contact ──
  {
    type: 'function' as const,
    function: {
      name: 'set_contact_esco',
      description: [
        'Set ESCO occupation and/or skills on a contact. Admin only.',
        'CRITICAL: ALWAYS call search_esco_occupations/search_esco_skills FIRST to get the correct URI, label, and ISCO code.',
        'CRITICAL: If ESCO search returns MORE THAN 1 result → show matches to user, ask which one. The server BLOCKS writes with >1 matches unless disambiguated=true. After user confirms, call set_contact_esco with the chosen URI and disambiguated=true.',
        'For occupation: pass profession (label), escoUri, escoLabel, iscoCode from search results.',
        'For skills: pass skills array with uri+label from search results. New skills are MERGED with existing (not replaced). Pass null to skip skills update (do NOT pass empty array).',
        'Can set occupation only, skills only, or both in one call.',
        'For free-text (not in ESCO): pass empty string for uri/escoUri/iscoCode.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          contactId: {
            type: 'string',
            description: 'Contact document ID (e.g. cont_xxx)',
          },
          profession: {
            type: ['string', 'null'],
            description: 'Occupation label in Greek (e.g. "Αρχιτέκτονας"). Null to skip occupation update.',
          },
          escoUri: {
            type: ['string', 'null'],
            description: 'ESCO occupation URI from search results. Empty string for free-text.',
          },
          escoLabel: {
            type: ['string', 'null'],
            description: 'ESCO preferred label from search results. Empty string for free-text.',
          },
          iscoCode: {
            type: ['string', 'null'],
            description: 'ISCO-08 4-digit code from search results (e.g. "2161"). Empty string for free-text.',
          },
          skills: {
            type: ['array', 'null'],
            description: 'Array of skills to ADD (merged with existing, deduplicated by URI). Each item: {uri: string, label: string}. Null to skip skills update.',
            items: {
              type: 'object',
              properties: {
                uri: { type: 'string', description: 'ESCO skill URI (empty string for free-text skill)' },
                label: { type: 'string', description: 'Skill label in Greek' },
              },
              required: ['uri', 'label'],
              additionalProperties: false,
            },
          },
          disambiguated: {
            type: ['boolean', 'null'],
            description: 'Set to true ONLY after the user explicitly chose from multiple ESCO matches. The server BLOCKS writes with >1 ESCO matches unless this is true. NEVER set true without user confirmation.',
          },
        },
        required: ['contactId', 'profession', 'escoUri', 'escoLabel', 'iscoCode', 'skills', 'disambiguated'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 17. search_esco_occupations: Search ESCO occupations database ──
  {
    type: 'function' as const,
    function: {
      name: 'search_esco_occupations',
      description: [
        'Search the ESCO occupations database (2,942 EU-standardized occupations).',
        'CRITICAL RULE: ALWAYS call this BEFORE writing profession/escoUri/iscoCode to a contact.',
        'If MULTIPLE results found → ALWAYS show ALL matches to user with their ISCO codes and ask "Ποιο εννοείς;". NEVER auto-select.',
        'If EXACTLY 1 result → confirm with user: "Βρήκα: [label] (ISCO: [code]). Να το προσθέσω;"',
        'If NO results → tell user "Δεν βρέθηκε στα ESCO. Θέλεις να το προσθέσω ως ελεύθερο κείμενο;"',
        'NEVER write profession without searching ESCO first.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Occupation name to search for in Greek (e.g. "αρχιτέκτονας", "μηχανικός", "δικηγόρος")',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 17. search_esco_skills: Search ESCO skills database ──
  {
    type: 'function' as const,
    function: {
      name: 'search_esco_skills',
      description: [
        'Search the ESCO skills database (13,485 EU-standardized skills).',
        'CRITICAL RULE: ALWAYS call this BEFORE writing skills/escoSkills to a contact.',
        'If MULTIPLE results found → show ALL matches to user, ask which one(s) to add. NEVER auto-select.',
        'If EXACTLY 1 result → confirm with user before adding.',
        'If NO results → tell user "Δεν βρέθηκε στα ESCO. Θέλεις να το προσθέσω ως ελεύθερο κείμενο;"',
        'NEVER write skills without searching ESCO first.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Skill name to search for in Greek (e.g. "διοίκηση επιχειρήσεων", "αυτοκάδ", "μαθηματικά")',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      strict: true,
    },
  },

  // ── 18. lookup_doy_code: Find Greek Tax Office (ΔΟΥ) code by name ──
  {
    type: 'function',
    function: {
      name: 'lookup_doy_code',
      description: [
        'Look up Greek Tax Office (ΔΟΥ/DOY) code by name or keyword.',
        'CRITICAL: ALWAYS use this tool before writing taxOffice to a contact.',
        'taxOffice field stores the 4-digit CODE (e.g. "1317"), NOT the name.',
        'Pass the user\'s description (e.g. "Ιωνία Θεσσαλονίκης", "Καλλιθέα", "Α Αθηνών") and get back the correct code.',
        'Returns matching tax offices with code, name, and region.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — name or part of name of the tax office (e.g. "Ιωνία", "Καλλιθέα", "Θεσσαλονίκη", "Α Αθηνών")',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

/**
 * Get tool definitions as a readonly array (for OpenAI API)
 */
export function getAgenticToolDefinitions(): ReadonlyArray<AgenticToolDefinition> {
  return AGENTIC_TOOL_DEFINITIONS;
}
