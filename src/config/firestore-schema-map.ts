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
      // ADR-244: Οικοπεδούχοι — αποθηκεύονται ΜΕΣΑ στο project document
      'landowners': 'array? (οικοπεδούχοι — κάθε στοιχείο: {contactId, name, landOwnershipPct, allocatedShares})',
      'bartexPercentage': 'number? (ποσοστό αντιπαροχής %)',
      'landownerContactIds': 'string[]? (IDs οικοπεδούχων για queries)',
      linkedCompanyId: 'string? (ID εταιρείας-εργολάβου)',
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
      commercialStatus: 'available|reserved|sold|unavailable',
      floor: 'number?',
      area: 'number? (τ.μ.)',
      code: 'string? (κωδικός ακινήτου π.χ. A-DI-1.02)',
      rooms: 'number?',
      bathrooms: 'number?',
      description: 'string?',
      // Εμπορικά στοιχεία (nested object)
      'commercial.askingPrice': 'number? (τιμή ζητούμενη σε €)',
      'commercial.finalPrice': 'number? (τελική τιμή πώλησης σε €)',
      'commercial.reservationDeposit': 'number? (προκαταβολή κράτησης σε €)',
      'commercial.buyerContactId': 'string? (->contacts, ID αγοραστή)',
      'commercial.buyerName': 'string? (όνομα αγοραστή)',
      'commercial.reservationDate': 'string? (ISO date κράτησης)',
      'commercial.saleDate': 'string? (ISO date πώλησης)',
      'commercial.listedDate': 'string? (ISO date καταχώρησης)',
      // Σύνοψη πληρωμών (nested object μέσα στο commercial)
      'commercial.paymentSummary.totalAmount': 'number? (συνολικό ποσό σε €)',
      'commercial.paymentSummary.paidAmount': 'number? (πληρωμένο ποσό σε €)',
      'commercial.paymentSummary.remainingAmount': 'number? (υπόλοιπο οφειλής σε €)',
      'commercial.paymentSummary.paidPercentage': 'number? (% αποπληρωμής)',
      'commercial.paymentSummary.totalInstallments': 'number? (αριθμός δόσεων)',
      'commercial.paymentSummary.paidInstallments': 'number? (πληρωμένες δόσεις)',
      'commercial.paymentSummary.overdueInstallments': 'number? (ληξιπρόθεσμες δόσεις)',
      'commercial.paymentSummary.nextInstallmentAmount': 'number? (ποσό επόμενης δόσης σε €)',
      'commercial.paymentSummary.nextInstallmentDate': 'string? (ημ/νία επόμενης δόσης)',
    },
    relationships: {
      'contact_links.entityId': 'units.id (buyer/tenant)',
      'commercial.buyerContactId': 'contacts.id (αγοραστής)',
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
      // Personas: ρόλοι της επαφής (array of objects)
      'personas': 'array of { personaType: client|engineer|lawyer|notary|supplier|real_estate_agent, status: active|inactive, activatedAt: ISO string, deactivatedAt: string|null, notes: string|null, teeRegistryNumber?: string (μόνο engineer), engineerSpecialty?: architect|civil_engineer|mechanical_engineer|electrical_engineer|surveyor|chemical_engineer (μόνο engineer), licenseClass?: string (μόνο engineer) }',
      // Emails & Phones (arrays)
      'emails': 'array of { email: string, type: personal|work, isPrimary: boolean }?',
      'phones': 'array of { number: string, type: mobile|home|work, isPrimary: boolean, countryCode?: string }?',
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
      date: 'Timestamp (ISO ημερομηνία έναρξης)',
      time: 'string? (ώρα έναρξης π.χ. "10:00")',
      endTime: 'string? (ώρα λήξης π.χ. "11:00" — αν δεν δοθεί, default +1 ώρα)',
      durationMinutes: 'number? (διάρκεια σε λεπτά — default 60)',
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
    description: 'Συνδέσεις επαφών με entities (μονάδες, έργα) — RBAC. Χρησιμοποίησε sourceContactId + targetEntityType + targetEntityId + role.',
    fields: {
      sourceContactId: 'string (->contacts, ID επαφής)',
      targetEntityType: 'project|building|unit (τύπος entity)',
      targetEntityId: 'string (ID του project/building/unit)',
      role: 'supervisor|architect|engineer|contractor|buyer|tenant|owner|lawyer|notary|realtor|accountant (ρόλος στο entity)',
      status: 'active|inactive',
      companyId: 'string',
      reason: 'string? (λόγος σύνδεσης)',
      createdAt: 'Timestamp?',
    },
    relationships: {
      'sourceContactId': 'contacts.id',
      'targetEntityId': 'projects.id | buildings.id | units.id',
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

  files: {
    description: 'Αρχεία και κατόψεις (DXF, PDF κλπ) — κάθε αρχείο συνδέεται με entity (floor, unit κλπ)',
    fields: {
      displayName: 'string',
      originalFilename: 'string',
      ext: 'string (dxf, pdf, jpg κλπ)',
      companyId: 'string',
      projectId: 'string (->projects)',
      entityType: 'string (floor, unit, building κλπ)',
      entityId: 'string (->floors, ->units κλπ)',
      domain: 'string (construction, sales κλπ)',
      category: 'string (floorplans, photos κλπ)',
      purpose: 'string (floor-floorplan κλπ)',
      entityLabel: 'string (π.χ. ΣΟΦΙΤΑ, ΙΣΟΓΕΙΟ)',
      status: 'ready|processing|error',
      lifecycleState: 'active|archived|deleted',
      isDeleted: 'boolean',
      sizeBytes: 'number',
      downloadUrl: 'string',
      storagePath: 'string',
      createdBy: 'string (->users)',
      createdAt: 'Timestamp',
    },
    relationships: {
      'projects.id': 'files.projectId',
      'floors.id': 'files.entityId (when entityType=floor)',
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
    description: 'Όροφοι κτηρίων (IFC IfcBuildingStorey)',
    fields: {
      name: 'string',
      buildingId: 'string (->buildings)',
      number: 'number',
      elevation: 'number?',
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
