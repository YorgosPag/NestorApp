/**
 * ACTIVITY HANDLER — Manage KAD business activity codes on contacts via AI agent.
 * Operations: add, list, remove, set_primary.
 * Validates KAD codes against the official ΚΑΔ 2025 catalogue (ΑΑΔΕ Α.1003/2026, Παράρτημα Ι — NACE Rev 2.1),
 * read on the server from the SAME `public/data/kad/kad-2025.json` the UI uses. Accepts dotted (`41.00.11`)
 * or 8-digit ΓΕΜΗ (`41001100`) codes; stores the dotted code + official description + `catalog: 'KAD2025'`.
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
import { loadAgentContact, type AgentContactDoc } from './agent-contact-doc';
import { toKadActivityType, type KadActivity } from '@/types/ContactFormTypes';
import { readKadCatalogOnServer } from '@/services/kad/kad-catalog.reader';
import { isSelectableKad, resolveKad, toKadSelection } from '@/lib/kad/kad-resolve';
import type { KadCatalogEntry } from '@/lib/kad/kad-types';

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

/**
 * ΚΑΔ του ορίσματος → γραμμή του καταλόγου ΚΑΔ 2025, ή η άρνηση που επιστρέφεται αυτούσια.
 * ⚠️ Κατάλογος που δεν διαβάστηκε = «δεν ξέρω» — ποτέ «άκυρος ΚΑΔ».
 */
async function resolveCatalogKad(kadCode: string): Promise<KadCatalogEntry | ToolResult> {
  const catalog = await readKadCatalogOnServer();
  if (catalog === null) {
    return { success: false, error: 'Ο κατάλογος ΚΑΔ 2025 δεν είναι διαθέσιμος αυτή τη στιγμή. Δοκίμασε ξανά.' };
  }
  const entry = resolveKad(catalog, kadCode);
  if (entry === null || !isSelectableKad(entry)) {
    return { success: false, error: `Ο κωδικός ΚΑΔ "${kadCode}" δεν υπάρχει στον κατάλογο ΚΑΔ 2025. Χρησιμοποίησε έγκυρο ΚΑΔ (π.χ. "41.00.11" ή "41001100").` };
  }
  return entry;
}

/**
 * Ο αποθηκευμένος κωδικός που εννοεί το όρισμα: ακριβώς ίδιος, ή (για 8ψήφιο/κωδικό ΚΑΔ 2025) ο
 * κωδικός με τελείες στον οποίο επιλύεται. Οι τιμές ΚΑΔ 2008 ταιριάζουν μόνο αυτούσιες.
 */
async function storedCodeFor(activities: readonly KadActivity[], kadCode: string): Promise<string | null> {
  if (activities.some((a) => a.code === kadCode)) return kadCode;
  const catalog = await readKadCatalogOnServer();
  const entry = catalog === null ? null : resolveKad(catalog, kadCode);
  return entry !== null && activities.some((a) => a.code === entry.code) ? entry.code : null;
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

    const entry = await resolveCatalogKad(kadCode);
    if (!('code' in entry)) return entry;
    const selection = toKadSelection(entry);
    const activityType = toKadActivityType(args.activityType, 'secondary');

    const contact = await loadAgentContact(contactId);
    if (!contact.found) return contact.result;
    if (contact.data.type !== 'company') {
      return { success: false, error: 'Οι δραστηριότητες ΚΑΔ αφορούν μόνο εταιρείες, όχι φυσικά πρόσωπα.' };
    }

    const activities = activitiesOf(contact.data);

    // Check duplicate
    if (activities.some(a => a.code === selection.code)) {
      return { success: true, data: { message: `Ο ΚΑΔ ${selection.code} υπάρχει ήδη.`, activities } };
    }

    appendActivity(activities, { ...selection, type: activityType });

    await writeActivities(ctx, contactId, contact, activities,
      { action: 'add_activity', kadCode: selection.code, activityType },
      { field: 'activities', oldValue: null, newValue: `+${selection.code} (${activityType})`, label: 'Δραστηριότητα ΚΑΔ' });

    logger.info('KAD activity added via AI agent', {
      contactId, kadCode: selection.code, activityType, requestId: ctx.requestId,
    });

    const { code, description, catalog } = selection;
    return { success: true, data: { contactId, kadCode: code, description, catalog, activityType, totalActivities: activities.length } };
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
    const target = await locateStoredActivity(args, contactId, 'remove', 'δεν βρέθηκε στις δραστηριότητες.');
    if ('success' in target) return target;
    const { contact, activities, kadCode } = target;
    const filtered = activities.filter(a => a.code !== kadCode);

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
    const target = await locateStoredActivity(args, contactId, 'set_primary', 'δεν βρέθηκε. Πρόσθεσέ τον πρώτα.');
    if ('success' in target) return target;
    const { contact, activities, kadCode } = target;

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

/** Η δραστηριότητα που ήδη έχει η επαφή και στην οποία στοχεύει μια πράξη (remove · set_primary). */
interface StoredActivityTarget {
  readonly contact: Extract<AgentContactDoc, { found: true }>;
  readonly activities: KadActivity[];
  readonly kadCode: string;
}

/** Όρισμα → επαφή → αποθηκευμένος κωδικός· ή η άρνηση που επιστρέφεται αυτούσια. */
async function locateStoredActivity(
  args: Record<string, unknown>,
  contactId: string,
  operation: string,
  notFound: string,
): Promise<StoredActivityTarget | ToolResult> {
  const requested = requiredKadCode(args, operation);
  if (typeof requested !== 'string') return requested;
  const contact = await loadAgentContact(contactId);
  if (!contact.found) return contact.result;
  const activities = activitiesOf(contact.data);
  const kadCode = await storedCodeFor(activities, requested);
  if (kadCode === null) return { success: false, error: `Ο ΚΑΔ ${requested} ${notFound}` };
  return { contact, activities, kadCode };
}

/** Προσθήκη στο τέλος· νέα ΚΥΡΙΑ ⇒ η προηγούμενη κύρια υποβιβάζεται σε δευτερεύουσα. */
function appendActivity(activities: KadActivity[], activity: KadActivity): void {
  if (activity.type === 'primary') {
    for (const a of activities) {
      if (a.type === 'primary') a.type = 'secondary';
    }
  }
  activities.push(activity);
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
