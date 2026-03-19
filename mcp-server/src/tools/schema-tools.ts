/**
 * Schema Tools — 2 tools for collection schema introspection
 *
 * - firestore_get_schema
 * - firestore_list_schemas
 *
 * Uses the FIRESTORE_SCHEMA_MAP from firestore-schema-map.ts (hardcoded mirror)
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CollectionSchema } from '../types.js';

// ============================================================================
// SCHEMA MAP (mirror of src/config/firestore-schema-map.ts)
// Kept inline to avoid cross-project imports — this is a standalone MCP server
// ============================================================================

const SCHEMA_MAP: Record<string, CollectionSchema> = {
  projects: {
    description: 'Κατασκευαστικά έργα (projects)',
    fields: {
      name: 'string', status: 'planning|in_progress|completed|on_hold|cancelled',
      companyId: 'string', description: 'string?', budget: 'number?',
      address: 'string?', progress: 'number (0-100)', type: 'string?',
      createdAt: 'Timestamp', updatedAt: 'Timestamp?',
    },
    relationships: { 'buildings.projectId': 'projects.id' },
  },
  buildings: {
    description: 'Κτήρια εντός έργων',
    fields: {
      name: 'string', projectId: 'string (->projects)', companyId: 'string?',
      address: 'string?', floors: 'number?', createdAt: 'Timestamp?',
    },
    relationships: { 'units.buildingId': 'buildings.id', 'construction_phases.buildingId': 'buildings.id' },
  },
  units: {
    description: 'Ακίνητα/μονάδες (διαμερίσματα, καταστήματα, parking κλπ)',
    fields: {
      name: 'string', buildingId: 'string (->buildings)', companyId: 'string',
      type: 'apartment|studio|office|shop|storage|parking|maisonette|penthouse|loft|other',
      status: 'available|reserved|sold|rented', floor: 'number?',
      area: 'number? (τ.μ.)', price: 'number?', rooms: 'number?',
      bathrooms: 'number?', description: 'string?',
    },
    relationships: { 'contact_links.entityId': 'units.id (buyer/tenant)' },
  },
  contacts: {
    description: 'Επαφές (φυσικά πρόσωπα ή εταιρείες)',
    fields: {
      firstName: 'string?', lastName: 'string?', displayName: 'string',
      email: 'string?', phone: 'string?', mobile: 'string?',
      contactType: 'individual|company', companyId: 'string',
      vatNumber: 'string? (ΑΦΜ)', idNumber: 'string? (ΑΔΤ)',
      profession: 'string?', fatherName: 'string? (πατρώνυμο)',
      address: 'string?', city: 'string?', notes: 'string?',
      tags: 'string[]?', createdAt: 'Timestamp',
    },
  },
  construction_phases: {
    description: 'Φάσεις κατασκευής (Gantt chart)',
    fields: {
      name: 'string', buildingId: 'string (->buildings)', companyId: 'string?',
      startDate: 'Timestamp?', endDate: 'Timestamp?',
      progress: 'number? (0-100)', status: 'pending|in_progress|completed|delayed?', order: 'number?',
    },
  },
  leads: {
    description: 'Leads πωλήσεων (ενδιαφερόμενοι)',
    fields: {
      contactId: 'string? (->contacts)', companyId: 'string',
      status: 'new|contacted|qualified|proposal|negotiation|won|lost',
      source: 'string?', assignedTo: 'string?', value: 'number?',
      notes: 'string?', createdAt: 'Timestamp',
    },
  },
  opportunities: {
    description: 'Ευκαιρίες πώλησης',
    fields: {
      name: 'string', contactId: 'string? (->contacts)', companyId: 'string',
      unitId: 'string? (->units)', status: 'string?', value: 'number?',
      probability: 'number?', createdAt: 'Timestamp',
    },
  },
  tasks: {
    description: 'Εργασίες και υποχρεώσεις',
    fields: {
      title: 'string', companyId: 'string', assignedTo: 'string?',
      status: 'pending|in_progress|completed?', priority: 'low|medium|high|critical?',
      dueDate: 'Timestamp?', description: 'string?', projectId: 'string? (->projects)',
    },
  },
  obligations: {
    description: 'Υποχρεώσεις πελατών (δόσεις, πληρωμές)',
    fields: {
      contactId: 'string (->contacts)', companyId: 'string',
      unitId: 'string? (->units)', amount: 'number',
      status: 'pending|paid|overdue?', dueDate: 'Timestamp?', description: 'string?',
    },
  },
  messages: {
    description: 'Μηνύματα AI pipeline (email, telegram κλπ)',
    fields: {
      channel: 'email|telegram|in_app', companyId: 'string',
      senderName: 'string?', senderEmail: 'string?', subject: 'string?',
      body: 'string', status: 'pending|processed|replied?',
      intent: 'string?', createdAt: 'Timestamp',
    },
  },
  invoices: {
    description: 'Τιμολόγια',
    fields: {
      number: 'string', companyId: 'string', contactId: 'string? (->contacts)',
      amount: 'number', status: 'draft|sent|paid|overdue|cancelled?',
      issueDate: 'Timestamp?', dueDate: 'Timestamp?', description: 'string?',
    },
  },
  payments: {
    description: 'Πληρωμές',
    fields: {
      companyId: 'string', contactId: 'string? (->contacts)', amount: 'number',
      method: 'string?', date: 'Timestamp?', invoiceId: 'string? (->invoices)', notes: 'string?',
    },
  },
  contact_links: {
    description: 'Συνδέσεις επαφών με entities (μονάδες, έργα)',
    fields: {
      contactId: 'string (->contacts)', entityType: 'unit|project|building',
      entityId: 'string', role: 'buyer|tenant|owner|contractor|architect|engineer?',
      companyId: 'string', createdAt: 'Timestamp?',
    },
  },
  employment_records: {
    description: 'Εγγραφές εργαζομένων (ΕΦΚΑ)',
    fields: {
      contactId: 'string (->contacts)', companyId: 'string',
      position: 'string?', startDate: 'Timestamp?', endDate: 'Timestamp?',
      status: 'active|inactive?', salary: 'number?',
    },
  },
  conversations: {
    description: 'Omnichannel συνομιλίες',
    fields: {
      contactId: 'string? (->contacts)', companyId: 'string',
      channel: 'telegram|email|messenger|sms', status: 'active|closed?',
      lastMessageAt: 'Timestamp?', assignedTo: 'string?',
    },
  },
  appointments: {
    description: 'Ραντεβού και συναντήσεις',
    fields: {
      title: 'string', companyId: 'string', contactId: 'string? (->contacts)',
      date: 'Timestamp', time: 'string?', location: 'string?',
      status: 'scheduled|completed|cancelled?', notes: 'string?', createdBy: 'string?',
    },
  },
  activities: {
    description: 'Δραστηριότητες CRM (κλήσεις, σημειώσεις)',
    fields: {
      type: 'call|meeting|note|email|task', contactId: 'string? (->contacts)',
      companyId: 'string', description: 'string', date: 'Timestamp', createdBy: 'string?',
    },
  },
  documents: {
    description: 'Έγγραφα και αρχεία',
    fields: {
      name: 'string', companyId: 'string', type: 'string?', url: 'string?',
      projectId: 'string? (->projects)', contactId: 'string? (->contacts)', createdAt: 'Timestamp?',
    },
  },
  boq_items: {
    description: 'Επιμετρήσεις BOQ (Quantity Surveying)',
    fields: {
      companyId: 'string', projectId: 'string (->projects)', buildingId: 'string (->buildings)',
      scope: 'building|unit', categoryCode: 'string', title: 'string',
      unit: 'm|m2|m3|kg|ton|pcs|lt|set|hr|day|lump',
      estimatedQuantity: 'number', actualQuantity: 'number?',
      materialUnitCost: 'number', laborUnitCost: 'number', equipmentUnitCost: 'number',
      status: 'draft|submitted|approved|certified|locked',
    },
  },
  accounting_invoices: {
    description: 'Λογιστικά παραστατικά (subapp)',
    fields: {
      companyId: 'string', invoiceNumber: 'string', type: 'income|expense',
      amount: 'number', vatAmount: 'number?', contactId: 'string? (->contacts)',
      issueDate: 'Timestamp', status: 'draft|issued|paid|cancelled?',
    },
  },
  floors: {
    description: 'Όροφοι κτηρίων',
    fields: {
      name: 'string', buildingId: 'string (->buildings)', number: 'number',
      elevation: 'number?', companyId: 'string?',
    },
  },
};

// ============================================================================
// REGISTER
// ============================================================================

export function registerSchemaTools(server: McpServer): void {
  // ---- GET SCHEMA ----
  server.tool(
    'firestore_get_schema',
    'Get the schema definition for a specific Firestore collection (fields, types, relationships)',
    {
      collection: z.string().describe('Collection name (e.g., "contacts", "projects")'),
    },
    async ({ collection }) => {
      const schema = SCHEMA_MAP[collection];
      if (!schema) {
        const available = Object.keys(SCHEMA_MAP).join(', ');
        return {
          content: [{
            type: 'text' as const,
            text: `No schema defined for "${collection}". Available schemas: ${available}`,
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ collection, ...schema }, null, 2),
        }],
      };
    }
  );

  // ---- LIST SCHEMAS ----
  server.tool(
    'firestore_list_schemas',
    'List all collections that have schema definitions with their descriptions',
    {},
    async () => {
      const summary = Object.entries(SCHEMA_MAP).map(([name, schema]) => ({
        collection: name,
        description: schema.description,
        fieldCount: Object.keys(schema.fields).length,
        hasRelationships: !!schema.relationships,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ schemas: summary, total: summary.length }, null, 2),
        }],
      };
    }
  );
}
