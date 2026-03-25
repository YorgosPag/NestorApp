/**
 * RELATIONSHIP HANDLER — Manage contact-to-contact relationships via AI agent
 * Uses Admin SDK directly (server-side) for the agentic pipeline.
 * @module services/ai-pipeline/tools/handlers/relationship-handler
 * @see ADR-171 (Autonomous AI Agent), FINDING-006 (contact_links bypass)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateRelationshipId } from '@/services/enterprise-id.service';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  auditWrite,
  buildAttribution,
  logger,
} from '../executor-shared';

// ============================================================================
// CONSTANTS — Allowed relationship types for AI agent (subset of full list)
// ============================================================================

const ALLOWED_RELATIONSHIP_TYPES = [
  // Personal
  'family', 'friend',
  // Professional
  'colleague', 'employee', 'manager', 'director', 'contractor',
  'consultant', 'advisor', 'mentor', 'partner',
  // Corporate
  'shareholder', 'board_member', 'representative', 'client', 'vendor',
  // Property
  'property_buyer', 'property_co_buyer', 'property_landowner',
] as const;

type AllowedRelationshipType = typeof ALLOWED_RELATIONSHIP_TYPES[number];

/** Greek → English relationship type mapping */
const GREEK_RELATIONSHIP_MAP: Record<string, AllowedRelationshipType> = {
  'οικογένεια': 'family', 'σύζυγος': 'family', 'αδερφός': 'family',
  'αδελφός': 'family', 'αδερφή': 'family', 'αδελφή': 'family',
  'γονέας': 'family', 'πατέρας': 'family', 'μητέρα': 'family',
  'παιδί': 'family', 'γιος': 'family', 'κόρη': 'family',
  'φίλος': 'friend', 'φίλη': 'friend',
  'συνάδελφος': 'colleague', 'εργαζόμενος': 'employee',
  'διευθυντής': 'director', 'μέτοχος': 'shareholder',
  'σύμβουλος': 'advisor', 'εργολάβος': 'contractor',
  'πελάτης': 'client', 'προμηθευτής': 'vendor',
  'συνεργάτης': 'partner', 'εκπρόσωπος': 'representative',
  'αγοραστής': 'property_buyer', 'οικοπεδούχος': 'property_landowner',
};

// ============================================================================
// HANDLER
// ============================================================================

export class RelationshipHandler implements ToolHandler {
  readonly toolNames = ['manage_relationship'] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (toolName !== 'manage_relationship') {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    if (!ctx.isAdmin) {
      return { success: false, error: 'manage_relationship is admin-only.' };
    }

    const operation = String(args.operation ?? '');
    if (!['add', 'list', 'remove'].includes(operation)) {
      return { success: false, error: 'operation must be one of: add, list, remove' };
    }

    const sourceContactId = String(args.sourceContactId ?? '').trim();
    if (!sourceContactId) {
      return { success: false, error: 'sourceContactId is required.' };
    }

    switch (operation) {
      case 'add': return this.handleAdd(args, sourceContactId, ctx);
      case 'list': return this.handleList(sourceContactId, ctx);
      case 'remove': return this.handleRemove(args, sourceContactId, ctx);
      default: return { success: false, error: `Unknown operation: ${operation}` };
    }
  }

  // ── ADD ──

  private async handleAdd(
    args: Record<string, unknown>,
    sourceContactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const targetContactId = String(args.targetContactId ?? '').trim();
    if (!targetContactId) {
      return { success: false, error: 'targetContactId is required for add.' };
    }

    if (sourceContactId === targetContactId) {
      return { success: false, error: 'Cannot create relationship with self.' };
    }

    const rawType = String(args.relationshipType ?? '').trim().toLowerCase();
    const relationshipType = this.resolveRelationshipType(rawType);
    if (!relationshipType) {
      return {
        success: false,
        error: `Invalid relationshipType "${rawType}". Valid: ${ALLOWED_RELATIONSHIP_TYPES.join(', ')}`,
      };
    }

    const db = getAdminFirestore();

    // Verify both contacts exist and belong to same company
    const [sourceSnap, targetSnap] = await Promise.all([
      db.collection(COLLECTIONS.CONTACTS).doc(sourceContactId).get(),
      db.collection(COLLECTIONS.CONTACTS).doc(targetContactId).get(),
    ]);

    if (!sourceSnap.exists) {
      return { success: false, error: `Source contact ${sourceContactId} not found.` };
    }
    if (!targetSnap.exists) {
      return { success: false, error: `Target contact ${targetContactId} not found.` };
    }

    // Tenant isolation
    const sourceData = sourceSnap.data();
    if (sourceData?.companyId && sourceData.companyId !== ctx.companyId) {
      return { success: false, error: 'Access denied — source contact.' };
    }

    // Check duplicate
    const existingSnap = await db.collection(COLLECTIONS.CONTACT_RELATIONSHIPS)
      .where('sourceContactId', '==', sourceContactId)
      .where('targetContactId', '==', targetContactId)
      .where('relationshipType', '==', relationshipType)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return {
        success: true,
        data: { message: 'Relationship already exists', id: existingSnap.docs[0].id },
      };
    }

    const relationshipId = generateRelationshipId();
    const note = nullableString(args.note);

    await db.collection(COLLECTIONS.CONTACT_RELATIONSHIPS).doc(relationshipId).set({
      sourceContactId,
      targetContactId,
      relationshipType,
      status: 'active',
      notes: note,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: buildAttribution(ctx),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await auditWrite(ctx, 'contact_relationships', relationshipId, 'create', {
      sourceContactId, targetContactId, relationshipType,
    });

    logger.info('Relationship created via AI agent', {
      relationshipId, sourceContactId, targetContactId, relationshipType,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { relationshipId, sourceContactId, targetContactId, relationshipType },
    };
  }

  // ── LIST ──

  private async handleList(
    sourceContactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const db = getAdminFirestore();

    const snapshot = await db.collection(COLLECTIONS.CONTACT_RELATIONSHIPS)
      .where('sourceContactId', '==', sourceContactId)
      .where('status', '==', 'active')
      .get();

    const relationships = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        targetContactId: String(d.targetContactId ?? ''),
        relationshipType: String(d.relationshipType ?? ''),
        notes: d.notes ?? null,
      };
    });

    return { success: true, data: relationships, count: relationships.length };
  }

  // ── REMOVE ──

  private async handleRemove(
    args: Record<string, unknown>,
    sourceContactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const relationshipId = String(args.relationshipId ?? '').trim();
    if (!relationshipId) {
      return { success: false, error: 'relationshipId is required for remove.' };
    }

    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.CONTACT_RELATIONSHIPS).doc(relationshipId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: 'Relationship not found.' };
    }

    const data = docSnap.data();
    if (data?.sourceContactId !== sourceContactId) {
      return { success: false, error: 'sourceContactId mismatch.' };
    }

    await docRef.update({
      status: 'inactive',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: buildAttribution(ctx),
    });

    await auditWrite(ctx, 'contact_relationships', relationshipId, 'deactivate', {
      sourceContactId,
    });

    return { success: true, data: { relationshipId, status: 'inactive' } };
  }

  // ── HELPERS ──

  private resolveRelationshipType(raw: string): AllowedRelationshipType | null {
    // Direct match
    if (ALLOWED_RELATIONSHIP_TYPES.includes(raw as AllowedRelationshipType)) {
      return raw as AllowedRelationshipType;
    }
    // Greek mapping
    return GREEK_RELATIONSHIP_MAP[raw] ?? null;
  }
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}
