/**
 * ACTIVITY HANDLER — Manage KAD business activity codes on contacts via AI agent.
 * Operations: add, list, remove, set_primary.
 * Validates KAD codes against the official Greek registry (10521 NACE Rev.2 codes).
 *
 * @module services/ai-pipeline/tools/handlers/activity-handler
 * @see ADR-171 (Autonomous AI Agent)
 */

import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  auditWrite,
  logger,
} from '../executor-shared';
import { aiAgentAuditActor, aiAgentStamp } from '../../shared/ai-performer';
import { loadAgentContact } from './agent-contact-doc';

/** ADR-195: local wrapper that records a CONTACT entity audit entry (SSoT). */
async function recordContactAudit(
  ctx: AgenticContext,
  contactId: string,
  entityName: string | null,
  action: AuditAction,
  changes: AuditFieldChange[],
): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: contactId,
    entityName,
    action,
    changes,
    ...aiAgentAuditActor(ctx),
    companyId: ctx.companyId,
  });
}

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
    const kadCode = requiredKadCode(args, 'add');
    if (typeof kadCode !== 'string') return kadCode;

    // Validate KAD code
    const validCodes = await loadKadCodes();
    if (!validCodes.has(kadCode)) {
      return { success: false, error: `Ο κωδικός ΚΑΔ "${kadCode}" δεν υπάρχει στο μητρώο. Χρησιμοποίησε έγκυρο ΚΑΔ.` };
    }

    const description = await lookupKadDescription(kadCode);
    const activityType = String(args.activityType ?? 'secondary') as 'primary' | 'secondary';

    const contact = await loadAgentContact(contactId);
    if (!contact.found) return contact.result;
    if (contact.data.type !== 'company') {
      return { success: false, error: 'Οι δραστηριότητες ΚΑΔ αφορούν μόνο εταιρείες, όχι φυσικά πρόσωπα.' };
    }

    const activities = activitiesOf(contact.data);

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

    activities.push({ code: kadCode, description: description ?? kadCode, type: activityType });

    await writeActivities(ctx, contactId, contact, activities, { action: 'add_activity', kadCode, activityType },
      { field: 'activities', oldValue: null, newValue: `+${kadCode} (${activityType})`, label: 'Δραστηριότητα ΚΑΔ' });

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
    const contact = await loadAgentContact(contactId);
    if (!contact.found) return contact.result;
    const activities = activitiesOf(contact.data);
    return { success: true, data: activities, count: activities.length };
  }

  // ── REMOVE ──

  private async handleRemove(
    args: Record<string, unknown>,
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const kadCode = requiredKadCode(args, 'remove');
    if (typeof kadCode !== 'string') return kadCode;

    const contact = await loadAgentContact(contactId);
    if (!contact.found) return contact.result;
    const activities = activitiesOf(contact.data);
    const filtered = activities.filter(a => a.code !== kadCode);

    if (filtered.length === activities.length) {
      return { success: false, error: `Ο ΚΑΔ ${kadCode} δεν βρέθηκε στις δραστηριότητες.` };
    }

    await writeActivities(ctx, contactId, contact, filtered, { action: 'remove_activity', kadCode },
      { field: 'activities', oldValue: kadCode, newValue: null, label: 'Δραστηριότητα ΚΑΔ' });

    return { success: true, data: { contactId, removedCode: kadCode, remaining: filtered.length } };
  }

  // ── SET PRIMARY ──

  private async handleSetPrimary(
    args: Record<string, unknown>,
    contactId: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const kadCode = requiredKadCode(args, 'set_primary');
    if (typeof kadCode !== 'string') return kadCode;

    const contact = await loadAgentContact(contactId);
    if (!contact.found) return contact.result;
    const activities = activitiesOf(contact.data);

    if (!activities.some(a => a.code === kadCode)) {
      return { success: false, error: `Ο ΚΑΔ ${kadCode} δεν βρέθηκε. Πρόσθεσέ τον πρώτα.` };
    }

    // Demote all to secondary, promote target to primary
    for (const a of activities) {
      a.type = a.code === kadCode ? 'primary' : 'secondary';
    }

    await writeActivities(ctx, contactId, contact, activities, { action: 'set_primary_activity', kadCode },
      { field: 'activities', oldValue: null, newValue: `primary=${kadCode}`, label: 'Κύρια δραστηριότητα' });

    return { success: true, data: { contactId, primaryCode: kadCode, totalActivities: activities.length } };
  }
}

// ============================================================================
// SHARED STEPS (ήταν τριπλά αντίγραφα — CHECK 3.28)
// ============================================================================

/** Ο κωδικός ΚΑΔ του ορίσματος — ή η άρνηση που επιστρέφεται αυτούσια. */
function requiredKadCode(args: Record<string, unknown>, operation: string): string | ToolResult {
  const kadCode = String(args.kadCode ?? '').trim();
  return kadCode || { success: false, error: `kadCode is required for ${operation}.` };
}

function activitiesOf(data: Record<string, unknown>): KadActivity[] {
  return (Array.isArray(data.activities) ? data.activities : []) as KadActivity[];
}

/** ΜΙΑ εγγραφή του πίνακα δραστηριοτήτων: έγγραφο (με σφραγίδα φορέα) + ίχνος AI + Ιστορικό. */
async function writeActivities(
  ctx: AgenticContext,
  contactId: string,
  contact: { readonly ref: DocumentReference; readonly data: Record<string, unknown> },
  activities: KadActivity[],
  trace: Record<string, unknown>,
  change: AuditFieldChange,
): Promise<void> {
  await contact.ref.update({
    activities,
    updatedAt: FieldValue.serverTimestamp(),
    // ADR-195 — η σφραγίδα που διαβάζει ο CDC (`shared/ai-performer`).
    ...aiAgentStamp(ctx),
  });
  await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'update', trace);
  await recordContactAudit(ctx, contactId, String(contact.data.displayName ?? null) || null, 'updated', [change]);
}
