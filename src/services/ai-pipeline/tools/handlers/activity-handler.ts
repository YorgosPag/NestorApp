/**
 * ACTIVITY HANDLER — Manage KAD business activity codes on contacts via AI agent.
 * Operations: add, list, remove, set_primary.
 * Validates KAD codes against the official Greek registry (10521 NACE Rev.2 codes).
 *
 * @module services/ai-pipeline/tools/handlers/activity-handler
 * @see ADR-171 (Autonomous AI Agent)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  auditWrite,
  buildAttribution,
  logger,
} from '../executor-shared';

// KAD code validation — lazy-loaded to avoid importing 10K entries at module level
let kadCodeSet: Set<string> | null = null;

async function loadKadCodes(): Promise<Set<string>> {
  if (kadCodeSet) return kadCodeSet;
  const { GREEK_KAD_CODES } = await import('@/subapps/accounting/data/greek-kad-codes');
  kadCodeSet = new Set(GREEK_KAD_CODES.map(k => k.code));
  return kadCodeSet;
}

async function lookupKadDescription(code: string): Promise<string | null> {
  const { GREEK_KAD_CODES } = await import('@/subapps/accounting/data/greek-kad-codes');
  const match = GREEK_KAD_CODES.find(k => k.code === code);
  return match?.description ?? null;
}

interface KadActivity {
  code: string;
  description: string;
  type: 'primary' | 'secondary';
  activeFrom?: string;
}

// ============================================================================
// HANDLER
// ============================================================================

export class ActivityHandler implements ToolHandler {
  readonly toolNames = ['manage_activities'] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (toolName !== 'manage_activities') {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    if (!ctx.isAdmin) {
      return { success: false, error: 'manage_activities is admin-only.' };
    }

    const operation = String(args.operation ?? '');
    if (!['add', 'list', 'remove', 'set_primary'].includes(operation)) {
      return { success: false, error: 'operation must be one of: add, list, remove, set_primary' };
    }

    const contactId = String(args.contactId ?? '').trim();
    if (!contactId) {
      return { success: false, error: 'contactId is required.' };
    }

    switch (operation) {
      case 'add': return this.handleAdd(args, contactId, ctx);
      case 'list': return this.handleList(contactId);
      case 'remove': return this.handleRemove(args, contactId, ctx);
      case 'set_primary': return this.handleSetPrimary(args, contactId, ctx);
      default: return { success: false, error: `Unknown operation: ${operation}` };
    }
  }

  // ── ADD ──

  private async handleAdd(
    args: Record<string, unknown>,
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const kadCode = String(args.kadCode ?? '').trim();
    if (!kadCode) {
      return { success: false, error: 'kadCode is required for add.' };
    }

    // Validate KAD code
    const validCodes = await loadKadCodes();
    if (!validCodes.has(kadCode)) {
      return { success: false, error: `Ο κωδικός ΚΑΔ "${kadCode}" δεν υπάρχει στο μητρώο. Χρησιμοποίησε έγκυρο ΚΑΔ.` };
    }

    const description = await lookupKadDescription(kadCode);
    const activityType = String(args.activityType ?? 'secondary') as 'primary' | 'secondary';

    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` };
    }

    const data = docSnap.data() as Record<string, unknown>;
    if (data.type !== 'company') {
      return { success: false, error: 'Οι δραστηριότητες ΚΑΔ αφορούν μόνο εταιρείες, όχι φυσικά πρόσωπα.' };
    }

    const activities = (Array.isArray(data.activities) ? data.activities : []) as KadActivity[];

    // Check duplicate
    if (activities.some(a => a.code === kadCode)) {
      return { success: true, data: { message: `Ο ΚΑΔ ${kadCode} υπάρχει ήδη.`, activities } };
    }

    // If adding as primary, demote existing primary
    if (activityType === 'primary') {
      for (const a of activities) {
        if (a.type === 'primary') a.type = 'secondary';
      }
    }

    const newActivity: KadActivity = {
      code: kadCode,
      description: description ?? kadCode,
      type: activityType,
    };
    activities.push(newActivity);

    await docRef.update({
      activities,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: buildAttribution(ctx),
    });

    await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'update', {
      action: 'add_activity', kadCode, activityType,
    });

    logger.info('KAD activity added via AI agent', {
      contactId, kadCode, activityType, requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { contactId, kadCode, description, activityType, totalActivities: activities.length },
    };
  }

  // ── LIST ──

  private async handleList(contactId: string): Promise<ToolResult> {
    const db = getAdminFirestore();
    const docSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();

    if (!docSnap.exists) {
      return { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` };
    }

    const data = docSnap.data() as Record<string, unknown>;
    const activities = (Array.isArray(data.activities) ? data.activities : []) as KadActivity[];

    return { success: true, data: activities, count: activities.length };
  }

  // ── REMOVE ──

  private async handleRemove(
    args: Record<string, unknown>,
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const kadCode = String(args.kadCode ?? '').trim();
    if (!kadCode) {
      return { success: false, error: 'kadCode is required for remove.' };
    }

    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` };
    }

    const data = docSnap.data() as Record<string, unknown>;
    const activities = (Array.isArray(data.activities) ? data.activities : []) as KadActivity[];
    const filtered = activities.filter(a => a.code !== kadCode);

    if (filtered.length === activities.length) {
      return { success: false, error: `Ο ΚΑΔ ${kadCode} δεν βρέθηκε στις δραστηριότητες.` };
    }

    await docRef.update({
      activities: filtered,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: buildAttribution(ctx),
    });

    await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'update', {
      action: 'remove_activity', kadCode,
    });

    return { success: true, data: { contactId, removedCode: kadCode, remaining: filtered.length } };
  }

  // ── SET PRIMARY ──

  private async handleSetPrimary(
    args: Record<string, unknown>,
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const kadCode = String(args.kadCode ?? '').trim();
    if (!kadCode) {
      return { success: false, error: 'kadCode is required for set_primary.' };
    }

    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` };
    }

    const data = docSnap.data() as Record<string, unknown>;
    const activities = (Array.isArray(data.activities) ? data.activities : []) as KadActivity[];

    const target = activities.find(a => a.code === kadCode);
    if (!target) {
      return { success: false, error: `Ο ΚΑΔ ${kadCode} δεν βρέθηκε. Πρόσθεσέ τον πρώτα.` };
    }

    // Demote all to secondary, promote target to primary
    for (const a of activities) {
      a.type = a.code === kadCode ? 'primary' : 'secondary';
    }

    await docRef.update({
      activities,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: buildAttribution(ctx),
    });

    await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'update', {
      action: 'set_primary_activity', kadCode,
    });

    return { success: true, data: { contactId, primaryCode: kadCode, totalActivities: activities.length } };
  }
}
