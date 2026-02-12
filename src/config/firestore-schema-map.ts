/**
 * =============================================================================
 * FIRESTORE SCHEMA MAP — AI AWARENESS
 * =============================================================================
 *
 * Compressed schema for the top 25 business collections so the AI agent
 * knows which fields exist in each collection, their types, and how
 * collections relate to each other.
 *
 * Injected into the agentic system prompt (~2000 tokens).
 *
 * @module config/firestore-schema-map
 * @see ADR-171 (Autonomous AI Agent)
 * @see config/firestore-collections.ts (Collection name SSoT)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CollectionFieldSchema {
  /** Field type: 'string', 'number', 'boolean', 'Timestamp', or enum like 'active|inactive' */
  type: string;
  /** True if field is optional */
  optional?: boolean;
  /** Brief description (for AI context) */
  desc?: string;
}

export interface CollectionSchema {
  /** Human-readable description (Greek, for the AI) */
  description: string;
  /** Fields with their types */
  fields: Record<string, string>;
  /** Relationships: 'otherCollection.foreignKey' → 'thisCollection.id' */
  relationships?: Record<string, string>;
}

// ============================================================================
// SCHEMA MAP — TOP 25 BUSINESS COLLECTIONS
// ============================================================================

export const FIRESTORE_SCHEMA_MAP: Record<string, CollectionSchema> = {
  projects: {
    description: 'Κατασκευαστικά έργα (projects)',
    fields: {
      name: 'string',
      status: 'planning|in_progress|completed|on_hold|cancelled',
      companyId: 'string',
      description: 'string?',
      budget: 'number?',
      address: 'string?',
      progress: 'number (0-100)',
      type: 'string?',
      createdAt: 'Timestamp',
      updatedAt: 'Timestamp?',
    },
    relationships: {
      'buildings.projectId': 'projects.id',
    },
  },

  buildings: {
    description: 'Κτήρια εντός έργων',
    fields: {
      name: 'string',
      projectId: 'string (->projects)',
      companyId: 'string?',
      address: 'string?',
      floors: 'number?',
      createdAt: 'Timestamp?',
    },
    relationships: {
      'units.buildingId': 'buildings.id',
      'construction_phases.buildingId': 'buildings.id',
    },
  },

  units: {
    description: 'Ακίνητα/μονάδες (διαμερίσματα, καταστήματα, parking κλπ)',
    fields: {
      name: 'string',
      buildingId: 'string (->buildings)',
      companyId: 'string',
      type: 'apartment|studio|office|shop|storage|parking|maisonette|penthouse|loft|other',
      status: 'available|reserved|sold|rented',
      floor: 'number?',
      area: 'number? (τ.μ.)',
      price: 'number?',
      rooms: 'number?',
      bathrooms: 'number?',
      description: 'string?',
    },
    relationships: {
      'contact_links.entityId': 'units.id (buyer/tenant)',
    },
  },

  contacts: {
    description: 'Επαφές (φυσικά πρόσωπα ή εταιρείες)',
    fields: {
      firstName: 'string?',
      lastName: 'string?',
      displayName: 'string',
      email: 'string?',
      phone: 'string?',
      mobile: 'string?',
      contactType: 'individual|company',
      companyId: 'string',
      vatNumber: 'string? (ΑΦΜ)',
      idNumber: 'string? (ΑΔΤ)',
      profession: 'string?',
      fatherName: 'string? (πατρώνυμο)',
      address: 'string?',
      city: 'string?',
      notes: 'string?',
      tags: 'string[]?',
      createdAt: 'Timestamp',
    },
  },

  construction_phases: {
    description: 'Φάσεις κατασκευής (Gantt chart)',
    fields: {
      name: 'string',
      buildingId: 'string (->buildings)',
      companyId: 'string?',
      startDate: 'Timestamp?',
      endDate: 'Timestamp?',
      progress: 'number? (0-100)',
      status: 'pending|in_progress|completed|delayed?',
      order: 'number?',
    },
  },

  construction_tasks: {
    description: 'Εργασίες εντός φάσεων κατασκευής',
    fields: {
      name: 'string',
      phaseId: 'string (->construction_phases)',
      companyId: 'string?',
      status: 'pending|in_progress|completed?',
      assignedTo: 'string?',
      startDate: 'Timestamp?',
      endDate: 'Timestamp?',
    },
  },

  leads: {
    description: 'Leads πωλήσεων (ενδιαφερόμενοι)',
    fields: {
      contactId: 'string? (->contacts)',
      companyId: 'string',
      status: 'new|contacted|qualified|proposal|negotiation|won|lost',
      source: 'string?',
      assignedTo: 'string?',
      value: 'number?',
      notes: 'string?',
      createdAt: 'Timestamp',
    },
  },

  opportunities: {
    description: 'Ευκαιρίες πώλησης',
    fields: {
      name: 'string',
      contactId: 'string? (->contacts)',
      companyId: 'string',
      unitId: 'string? (->units)',
      status: 'string?',
      value: 'number?',
      probability: 'number?',
      createdAt: 'Timestamp',
    },
  },

  appointments: {
    description: 'Ραντεβού και συναντήσεις',
    fields: {
      title: 'string',
      companyId: 'string',
      contactId: 'string? (->contacts)',
      date: 'Timestamp',
      time: 'string?',
      location: 'string?',
      status: 'scheduled|completed|cancelled?',
      notes: 'string?',
      createdBy: 'string?',
    },
  },

  tasks: {
    description: 'Εργασίες και υποχρεώσεις',
    fields: {
      title: 'string',
      companyId: 'string',
      assignedTo: 'string?',
      status: 'pending|in_progress|completed?',
      priority: 'low|medium|high|critical?',
      dueDate: 'Timestamp?',
      description: 'string?',
      projectId: 'string? (->projects)',
    },
  },

  obligations: {
    description: 'Υποχρεώσεις πελατών (δόσεις, πληρωμές)',
    fields: {
      contactId: 'string (->contacts)',
      companyId: 'string',
      unitId: 'string? (->units)',
      amount: 'number',
      status: 'pending|paid|overdue?',
      dueDate: 'Timestamp?',
      description: 'string?',
    },
  },

  obligation_transmittals: {
    description: 'Transmittal records για issued obligations PDFs',
    fields: {
      obligationId: 'string (->obligations)',
      companyId: 'string',
      projectId: 'string? (->projects)',
      buildingId: 'string? (->buildings)',
      docNumber: 'string',
      revision: 'number',
      issuedAt: 'Timestamp',
      issuedBy: 'string',
      recipients: 'array',
      deliveryProof: 'array',
      issueProof: 'object (algorithm, pdfSha256, generatedAt, fileName, byteSize)',
      createdAt: 'Timestamp',
      updatedAt: 'Timestamp',
    },
  },

  messages: {
    description: 'Μηνύματα AI pipeline (email, telegram κλπ)',
    fields: {
      channel: 'email|telegram|in_app',
      companyId: 'string',
      senderName: 'string?',
      senderEmail: 'string?',
      subject: 'string?',
      body: 'string',
      status: 'pending|processed|replied?',
      intent: 'string?',
      createdAt: 'Timestamp',
    },
  },

  communications: {
    description: 'Ιστορικό επικοινωνίας (Telegram, email)',
    fields: {
      contactId: 'string?',
      companyId: 'string?',
      channel: 'string',
      direction: 'inbound|outbound',
      content: 'string',
      senderName: 'string?',
      timestamp: 'Timestamp',
    },
  },

  invoices: {
    description: 'Τιμολόγια',
    fields: {
      number: 'string',
      companyId: 'string',
      contactId: 'string? (->contacts)',
      amount: 'number',
      status: 'draft|sent|paid|overdue|cancelled?',
      issueDate: 'Timestamp?',
      dueDate: 'Timestamp?',
      description: 'string?',
    },
  },

  payments: {
    description: 'Πληρωμές',
    fields: {
      companyId: 'string',
      contactId: 'string? (->contacts)',
      amount: 'number',
      method: 'string?',
      date: 'Timestamp?',
      invoiceId: 'string? (->invoices)',
      notes: 'string?',
    },
  },

  contact_links: {
    description: 'Συνδέσεις επαφών με entities (μονάδες, έργα)',
    fields: {
      contactId: 'string (->contacts)',
      entityType: 'unit|project|building',
      entityId: 'string',
      role: 'buyer|tenant|owner|contractor|architect|engineer?',
      companyId: 'string',
      createdAt: 'Timestamp?',
    },
  },

  employment_records: {
    description: 'Εγγραφές εργαζομένων (ΕΦΚΑ)',
    fields: {
      contactId: 'string (->contacts)',
      companyId: 'string',
      position: 'string?',
      startDate: 'Timestamp?',
      endDate: 'Timestamp?',
      status: 'active|inactive?',
      salary: 'number?',
    },
  },

  attendance_events: {
    description: 'Παρουσίες εργαζομένων (check-in/out)',
    fields: {
      employeeId: 'string (->contacts)',
      companyId: 'string',
      type: 'check_in|check_out',
      timestamp: 'Timestamp',
      location: 'string?',
      method: 'qr|gps|manual?',
    },
  },

  conversations: {
    description: 'Omnichannel συνομιλίες',
    fields: {
      contactId: 'string? (->contacts)',
      companyId: 'string',
      channel: 'telegram|email|messenger|sms',
      status: 'active|closed?',
      lastMessageAt: 'Timestamp?',
      assignedTo: 'string?',
    },
  },

  activities: {
    description: 'Δραστηριότητες CRM (κλήσεις, σημειώσεις)',
    fields: {
      type: 'call|meeting|note|email|task',
      contactId: 'string? (->contacts)',
      companyId: 'string',
      description: 'string',
      date: 'Timestamp',
      createdBy: 'string?',
    },
  },

  documents: {
    description: 'Έγγραφα και αρχεία',
    fields: {
      name: 'string',
      companyId: 'string',
      type: 'string?',
      url: 'string?',
      projectId: 'string? (->projects)',
      contactId: 'string? (->contacts)',
      createdAt: 'Timestamp?',
    },
  },

  parking_spots: {
    description: 'Θέσεις στάθμευσης',
    fields: {
      name: 'string',
      buildingId: 'string (->buildings)',
      companyId: 'string',
      status: 'available|reserved|sold?',
      price: 'number?',
      area: 'number?',
    },
  },

  accounting_invoices: {
    description: 'Λογιστικά παραστατικά (subapp)',
    fields: {
      companyId: 'string',
      invoiceNumber: 'string',
      type: 'income|expense',
      amount: 'number',
      vatAmount: 'number?',
      contactId: 'string? (->contacts)',
      issueDate: 'Timestamp',
      status: 'draft|issued|paid|cancelled?',
    },
  },

  accounting_bank_transactions: {
    description: 'Τραπεζικές κινήσεις (subapp)',
    fields: {
      companyId: 'string',
      bankAccountId: 'string',
      amount: 'number',
      type: 'credit|debit',
      description: 'string?',
      date: 'Timestamp',
      reconciled: 'boolean?',
    },
  },

  floors: {
    description: 'Όροφοι κτηρίων',
    fields: {
      name: 'string',
      buildingId: 'string (->buildings)',
      number: 'number',
      companyId: 'string?',
    },
  },

  boq_items: {
    description: 'Επιμετρήσεις BOQ (Quantity Surveying) — εργασίες/υλικά ανά κτίριο ή μονάδα',
    fields: {
      companyId: 'string',
      projectId: 'string (->projects)',
      buildingId: 'string (->buildings)',
      scope: 'building|unit',
      linkedUnitId: 'string? (->units)',
      categoryCode: 'string (ΑΤΟΕ κωδικός, π.χ. OIK-2)',
      title: 'string',
      unit: 'm|m2|m3|kg|ton|pcs|lt|set|hr|day|lump',
      estimatedQuantity: 'number',
      actualQuantity: 'number?',
      wasteFactor: 'number (0.08=8%)',
      materialUnitCost: 'number (€/μονάδα)',
      laborUnitCost: 'number (€/μονάδα)',
      equipmentUnitCost: 'number (€/μονάδα)',
      status: 'draft|submitted|approved|certified|locked',
      source: 'manual|template|dxf_auto|dxf_verified|imported|duplicate',
      linkedPhaseId: 'string? (->construction_phases)',
    },
    relationships: {
      'boq_items.buildingId': 'buildings.id',
      'boq_items.projectId': 'projects.id',
      'boq_items.linkedPhaseId': 'construction_phases.id',
    },
  },

  boq_categories: {
    description: 'Κατηγορίες ΑΤΟΕ (Αναλυτικό Τιμολόγιο Οικοδομικών Εργών)',
    fields: {
      companyId: 'string',
      code: 'string (π.χ. OIK-1)',
      nameEL: 'string (ελληνικά)',
      nameEN: 'string (αγγλικά)',
      level: 'group|subgroup|item',
      sortOrder: 'number',
      defaultWasteFactor: 'number (0.05=5%)',
      allowedUnits: 'string[] (m2, m3, pcs κλπ)',
      isActive: 'boolean',
    },
  },
};

// ============================================================================
// COMPRESSED SCHEMA FOR AI SYSTEM PROMPT
// ============================================================================

/**
 * Generate a compressed schema string for injection into the AI system prompt.
 * Targets ~2000 tokens — compact but informative.
 */
export function getCompressedSchema(): string {
  const lines: string[] = ['FIRESTORE COLLECTIONS:'];

  for (const [collection, schema] of Object.entries(FIRESTORE_SCHEMA_MAP)) {
    const fieldParts = Object.entries(schema.fields)
      .map(([name, type]) => `${name}:${type}`)
      .join(', ');

    lines.push(`- ${collection}: ${schema.description} | ${fieldParts}`);

    if (schema.relationships) {
      const rels = Object.entries(schema.relationships)
        .map(([fk, pk]) => `${fk}->${pk}`)
        .join('; ');
      lines.push(`  relations: ${rels}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get list of all collection names in the schema map
 */
export function getSchemaCollectionNames(): string[] {
  return Object.keys(FIRESTORE_SCHEMA_MAP);
}

/**
 * Get schema for a specific collection
 */
export function getCollectionSchemaInfo(collection: string): CollectionSchema | null {
  return FIRESTORE_SCHEMA_MAP[collection] ?? null;
}
