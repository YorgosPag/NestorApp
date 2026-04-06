/**
 * =============================================================================
 * UC-016: ADMIN UPDATE CONTACT MODULE — ADR-145 (Secretary Mode)
 * =============================================================================
 *
 * Super admin command: "Πρόσθεσε τηλέφωνο 6971234567 στον Νέστορα"
 * Parses field + value from raw message, resolves contact, updates Firestore.
 *
 * Features:
 * - Keyword-to-field mapping (Greek + English)
 * - Session context: if no name given, uses last created/updated contact
 * - Smart acknowledgment: shows remaining missing fields
 *
 * @module services/ai-pipeline/modules/uc-016-admin-update-contact
 * @see ADR-145 (Super Admin AI Assistant)
 */

import 'server-only';

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  FIELD_KEYWORDS,
  detectRemoveAction,
  detectField,
  extractFieldValue,
  extractContactName,
  type FieldMapping,
  type UpdateAction,
} from './admin-update-contact-helpers';
import {
  findContactByName,
  updateContactField,
  removeContactField,
  getContactById,
  getContactMissingFields,
  emitEntitySyncSignal,
  type ContactNameSearchResult,
} from '../../shared/contact-lookup';
import { sendChannelReply, extractChannelIds } from '../../shared/channel-reply-dispatcher';
import {
  getAdminSession,
  setAdminSession,
  buildAdminIdentifier,
} from '../../shared/admin-session';
import { getErrorMessage } from '@/lib/error-utils';
import { PipelineIntentType } from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

const logger = createModuleLogger('UC_016_ADMIN_UPDATE_CONTACT');

// ============================================================================
// TYPES
// ============================================================================

interface UpdateContactLookupData {
  detectedField: FieldMapping | null;
  detectedValue: string | null;
  action: UpdateAction;
  contactName: string | null;
  resolvedContact: ContactNameSearchResult | null;
  multipleMatches: ContactNameSearchResult[];
  resolvedViaSession: boolean;
  error: string | null;
}

// ============================================================================
// MODULE
// ============================================================================

export class AdminUpdateContactModule implements IUCModule {
  readonly moduleId = 'UC-016';
  readonly displayName = 'Admin: Ενημέρωση Επαφής';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_UPDATE_CONTACT,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const rawMessage = ctx.intake.normalized.contentText ?? '';

    // ── AI tool calling extracts entities semantically — fallback to regex ──
    const aiAction = (ctx.understanding?.entities?.action as string) ?? null;
    const aiFieldName = (ctx.understanding?.entities?.fieldName as string) ?? null;
    const aiFieldValue = (ctx.understanding?.entities?.fieldValue as string) ?? null;
    const aiContactName = (ctx.understanding?.entities?.contactName as string) ?? null;

    // 1. Detect action: AI entity first, then regex fallback
    const action: UpdateAction = aiAction === 'remove'
      ? 'remove'
      : (aiAction === 'set' ? 'set' : (detectRemoveAction(rawMessage) ? 'remove' : 'set'));

    // 2. Detect field: AI entity first, then keyword detection fallback
    const detectedField = aiFieldName
      ? (FIELD_KEYWORDS.find(f => f.field === aiFieldName) ?? detectField(rawMessage))
      : detectField(rawMessage);

    // 3. Extract value: AI entity first, then regex fallback (not needed for REMOVE)
    const detectedValue = (action === 'set' && detectedField)
      ? (aiFieldValue ?? extractFieldValue(rawMessage, detectedField))
      : null;

    // 4. Extract contact name: AI entity first, then regex fallback
    const contactName = aiContactName ?? extractContactName(rawMessage, detectedField, detectedValue);

    logger.info('UC-016 LOOKUP: Parsed update data', {
      requestId: ctx.requestId,
      action,
      detectedField: detectedField?.field ?? null,
      detectedValue,
      contactName,
      rawMessage,
    });

    // 4. Resolve contact
    let resolvedContact: ContactNameSearchResult | null = null;
    let multipleMatches: ContactNameSearchResult[] = [];
    let resolvedViaSession = false;
    let error: string | null = null;

    if (contactName && contactName.trim().length > 0) {
      // Search by name
      const results = await findContactByName(contactName, ctx.companyId, 5);

      if (results.length === 0) {
        error = `Δεν βρέθηκε επαφή με το όνομα "${contactName}".`;
      } else if (results.length === 1) {
        resolvedContact = results[0];
      } else {
        multipleMatches = results;
        error = null; // Will ask for disambiguation
      }
    } else {
      // No name → try session context
      const adminIdentifier = buildAdminIdentifier(
        ctx.intake.channel,
        ctx.intake.normalized.sender
      );
      const session = await getAdminSession(adminIdentifier);

      if (session?.lastAction) {
        resolvedContact = await getContactById(session.lastAction.contactId);
        resolvedViaSession = true;

        if (!resolvedContact) {
          error = 'Η τελευταία επαφή δεν βρέθηκε στο σύστημα.';
        }
      } else {
        error = 'Δεν αναγνωρίστηκε όνομα επαφής και δεν υπάρχει πρόσφατη ενέργεια. Παρακαλώ δώστε το όνομα της επαφής.';
      }
    }

    if (!detectedField) {
      error = 'Δεν αναγνωρίστηκε ποιο πεδίο θέλετε να ενημερώσετε.';
    }

    // Only require value for SET action (not for REMOVE)
    if (action === 'set' && !detectedValue && detectedField) {
      error = `Δεν αναγνωρίστηκε η τιμή για "${detectedField.greekLabel}".`;
    }

    const lookupData: UpdateContactLookupData = {
      detectedField,
      detectedValue,
      action,
      contactName,
      resolvedContact,
      multipleMatches,
      resolvedViaSession,
      error,
    };

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as UpdateContactLookupData | undefined;
    const hasError = !!lookup?.error && !lookup.resolvedContact;
    const hasMultiple = (lookup?.multipleMatches?.length ?? 0) > 1;

    let summary: string;

    if (hasError) {
      summary = lookup?.error ?? 'Σφάλμα';
    } else if (hasMultiple) {
      const names = lookup!.multipleMatches.map((c, i) => `${i + 1}. ${c.name}`).join(', ');
      summary = `Βρέθηκαν πολλαπλές επαφές: ${names}`;
    } else if (lookup?.action === 'remove') {
      summary = `Αφαίρεση: ${lookup?.detectedField?.greekLabel ?? '?'} από ${lookup?.resolvedContact?.name ?? '?'}`;
    } else {
      summary = `Ενημέρωση: +${lookup?.detectedField?.greekLabel ?? '?'} ${lookup?.detectedValue ?? '?'} στον ${lookup?.resolvedContact?.name ?? '?'}`;
    }

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'admin_update_contact_action',
          params: {
            contactId: lookup?.resolvedContact?.contactId ?? null,
            contactName: lookup?.resolvedContact?.name ?? null,
            field: lookup?.detectedField?.firestoreField ?? null,
            fieldLabel: lookup?.detectedField?.greekLabel ?? null,
            value: lookup?.detectedValue ?? null,
            action: lookup?.action ?? 'set',
            resolvedViaSession: lookup?.resolvedViaSession ?? false,
            error: (hasError || hasMultiple)
              ? (lookup?.error ?? null)
              : null,
            multipleMatches: hasMultiple
              ? lookup!.multipleMatches.map(c => ({
                  contactId: c.contactId,
                  name: c.name,
                }))
              : null,
            channel: ctx.intake.channel,
            telegramChatId: (ctx.intake.rawPayload.chatId as string) ?? null,
          },
        },
      ],
      requiredApprovals: [],
      autoApprovable: true,
      summary,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Step 6: EXECUTE ──

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    try {
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const action = actions.find(a => a.type === 'admin_update_contact_action');

      if (!action) {
        return { success: false, sideEffects: [], error: 'No admin_update_contact_action found' };
      }

      const params = action.params;
      const contactId = params.contactId as string | null;
      const contactName = params.contactName as string | null;
      const field = params.field as string | null;
      const fieldLabel = params.fieldLabel as string | null;
      const value = params.value as string | null;
      const errorMsg = params.error as string | null;
      const multipleMatches = params.multipleMatches as Array<{ contactId: string; name: string }> | null;

      // ── Case 1: Error (no contact, no field, no value) ──
      if (errorMsg && !contactId) {
        await sendChannelReply({
          channel: ctx.intake.channel,
          ...extractChannelIds(ctx),
          subject: 'Ενημέρωση επαφής',
          textBody: errorMsg,
          requestId: ctx.requestId,
        });
        return { success: true, sideEffects: ['error_reply_sent'] };
      }

      // ── Case 2: Multiple matches — ask for disambiguation ──
      if (multipleMatches && multipleMatches.length > 1) {
        const lines = ['Βρέθηκαν πολλαπλές επαφές:', ''];
        multipleMatches.forEach((c, i) => {
          lines.push(`  ${i + 1}. ${c.name} (ID: ${c.contactId})`);
        });
        lines.push('');
        lines.push('Παρακαλώ διευκρινίστε ποια επαφή εννοείτε.');

        await sendChannelReply({
          channel: ctx.intake.channel,
          ...extractChannelIds(ctx),
          subject: 'Ενημέρωση επαφής',
          textBody: lines.join('\n'),
          requestId: ctx.requestId,
        });
        return { success: true, sideEffects: ['disambiguation_reply_sent'] };
      }

      // ── Determine action mode ──
      const actionMode = (params.action as string) ?? 'set';

      // ── Case 3: Valid update or remove ──
      if (!contactId || !field) {
        const msg = errorMsg ?? 'Ελλιπή στοιχεία για ενημέρωση.';
        await sendChannelReply({
          channel: ctx.intake.channel,
          ...extractChannelIds(ctx),
          subject: 'Ενημέρωση επαφής',
          textBody: msg,
          requestId: ctx.requestId,
        });
        return { success: true, sideEffects: ['error_reply_sent'] };
      }

      // For SET mode, value is required
      if (actionMode === 'set' && !value) {
        const msg = errorMsg ?? `Δεν αναγνωρίστηκε η τιμή για "${fieldLabel ?? field}".`;
        await sendChannelReply({
          channel: ctx.intake.channel,
          ...extractChannelIds(ctx),
          subject: 'Ενημέρωση επαφής',
          textBody: msg,
          requestId: ctx.requestId,
        });
        return { success: true, sideEffects: ['error_reply_sent'] };
      }

      const adminName = ctx.adminCommandMeta?.adminIdentity.displayName ?? 'Admin';
      const sideEffects: string[] = [];
      const ackLines: string[] = [];

      if (actionMode === 'remove') {
        // ── REMOVE mode ──
        await removeContactField(contactId, field, adminName);
        emitEntitySyncSignal('contacts', 'UPDATED', contactId, ctx.companyId);
        sideEffects.push(`contact_field_removed:${contactId}:${field}`);

        logger.info('UC-016 EXECUTE: Contact field removed', {
          requestId: ctx.requestId,
          contactId,
          field,
        });

        ackLines.push(`Αφαιρέθηκε ${fieldLabel ?? field} από ${contactName ?? 'επαφή'}.`);
      } else {
        // ── SET mode ──
        await updateContactField(contactId, field, value!, adminName);
        emitEntitySyncSignal('contacts', 'UPDATED', contactId, ctx.companyId);
        sideEffects.push(`contact_updated:${contactId}:${field}`);

        logger.info('UC-016 EXECUTE: Contact field updated', {
          requestId: ctx.requestId,
          contactId,
          field,
          value,
        });

        ackLines.push(`${fieldLabel ?? field} "${value}" προστέθηκε στον ${contactName ?? 'επαφή'}.`);
      }

      // Get remaining missing fields for smart ack
      const contact = await getContactById(contactId);
      const contactType = (contact?.type === 'company') ? 'company' : 'individual';
      const missingFields = await getContactMissingFields(contactId, contactType as 'individual' | 'company');

      if (missingFields.length > 0) {
        ackLines.push('');
        ackLines.push(`Υπόλοιπα ελλιπή: ${missingFields.join(', ')}`);
      } else {
        ackLines.push('');
        ackLines.push('Όλα τα στοιχεία είναι συμπληρωμένα!');
      }

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        ...extractChannelIds(ctx),
        subject: 'Ενημέρωση επαφής',
        textBody: ackLines.join('\n'),
        requestId: ctx.requestId,
      });

      if (replyResult.success) {
        sideEffects.push(`confirm_sent:${replyResult.messageId ?? 'unknown'}`);
      }

      // ── Update admin session ──
      const adminIdentifier = buildAdminIdentifier(
        ctx.intake.channel,
        ctx.intake.normalized.sender
      );
      await setAdminSession(adminIdentifier, {
        type: 'update_contact',
        contactId,
        contactName: contactName ?? 'Χωρίς όνομα',
        timestamp: new Date().toISOString(),
      });

      return { success: true, sideEffects };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('UC-016 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });
      return { success: false, sideEffects: [], error: errorMessage };
    }
  }

  // ── Step 7: ACKNOWLEDGE ──

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    const confirmSent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('confirm_sent:') || se.startsWith('contact_updated:')
    ) ?? false;
    return { sent: confirmSent, channel: ctx.intake.channel };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// Helpers extracted to admin-update-contact-helpers.ts (ADR-065 Phase 6)
