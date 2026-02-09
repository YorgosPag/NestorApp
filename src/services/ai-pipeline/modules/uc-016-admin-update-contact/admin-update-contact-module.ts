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
  findContactByName,
  updateContactField,
  getContactById,
  getContactMissingFields,
  type ContactNameSearchResult,
} from '../../shared/contact-lookup';
import { sendChannelReply } from '../../shared/channel-reply-dispatcher';
import {
  getAdminSession,
  setAdminSession,
  buildAdminIdentifier,
} from '../../shared/admin-session';
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
// FIELD KEYWORD MAPPING
// ============================================================================

interface FieldMapping {
  field: string;
  firestoreField: string;
  greekLabel: string;
  keywords: readonly string[];
}

const FIELD_KEYWORDS: readonly FieldMapping[] = [
  { field: 'phone', firestoreField: 'phone', greekLabel: 'Τηλέφωνο', keywords: ['τηλεφωνο', 'τηλ', 'κινητο', 'phone', 'tel', 'mobile'] },
  { field: 'email', firestoreField: 'email', greekLabel: 'Email', keywords: ['email', 'mail', 'ηλεκτρονικο', 'μειλ'] },
  { field: 'vatNumber', firestoreField: 'vatNumber', greekLabel: 'ΑΦΜ', keywords: ['αφμ', 'afm', 'vat', 'α.φ.μ.'] },
  { field: 'profession', firestoreField: 'profession', greekLabel: 'Επάγγελμα', keywords: ['επαγγελμα', 'δουλεια', 'profession', 'εργασια'] },
  { field: 'birthDate', firestoreField: 'birthDate', greekLabel: 'Ημερομηνία γέννησης', keywords: ['γεννηση', 'ημερομηνια γεννησης', 'birthday', 'birth'] },
  { field: 'fatherName', firestoreField: 'fatherName', greekLabel: 'Πατρώνυμο', keywords: ['πατρωνυμο', 'ονομα πατερα', 'πατερας'] },
  { field: 'taxOffice', firestoreField: 'taxOffice', greekLabel: 'ΔΟΥ', keywords: ['δου', 'εφορια', 'δ.ο.υ.', 'tax office'] },
  { field: 'address', firestoreField: 'address', greekLabel: 'Διεύθυνση', keywords: ['διευθυνση', 'address', 'οδος', 'δρομος'] },
  { field: 'registrationNumber', firestoreField: 'registrationNumber', greekLabel: 'Αριθμός ΓΕΜΗ', keywords: ['γεμη', 'αριθμος μητρωου', 'registration'] },
  { field: 'legalForm', firestoreField: 'legalForm', greekLabel: 'Νομική μορφή', keywords: ['νομικη μορφη', 'legal form', 'μορφη'] },
  { field: 'employer', firestoreField: 'employer', greekLabel: 'Εργοδότης', keywords: ['εργοδοτης', 'employer'] },
  { field: 'position', firestoreField: 'position', greekLabel: 'Θέση', keywords: ['θεση', 'ρολος', 'position', 'role'] },
] as const;

// ============================================================================
// TYPES
// ============================================================================

interface UpdateContactLookupData {
  detectedField: FieldMapping | null;
  detectedValue: string | null;
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

    // 1. Detect field from message
    const detectedField = detectField(rawMessage);

    // 2. Extract value for the detected field
    const detectedValue = detectedField
      ? extractFieldValue(rawMessage, detectedField)
      : null;

    // 3. Extract contact name from message
    const contactName = extractContactName(rawMessage, detectedField, detectedValue);

    logger.info('UC-016 LOOKUP: Parsed update data', {
      requestId: ctx.requestId,
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

    if (!detectedValue && detectedField) {
      error = `Δεν αναγνωρίστηκε η τιμή για "${detectedField.greekLabel}".`;
    }

    const lookupData: UpdateContactLookupData = {
      detectedField,
      detectedValue,
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

      const telegramChatId = (params.telegramChatId as string)
        ?? (ctx.intake.rawPayload.chatId as string)
        ?? ctx.intake.normalized.sender.telegramId
        ?? undefined;

      // ── Case 1: Error (no contact, no field, no value) ──
      if (errorMsg && !contactId) {
        await sendChannelReply({
          channel: ctx.intake.channel,
          recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
          telegramChatId: telegramChatId ?? undefined,
          inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
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
          recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
          telegramChatId: telegramChatId ?? undefined,
          inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
          subject: 'Ενημέρωση επαφής',
          textBody: lines.join('\n'),
          requestId: ctx.requestId,
        });
        return { success: true, sideEffects: ['disambiguation_reply_sent'] };
      }

      // ── Case 3: Valid update ──
      if (!contactId || !field || !value) {
        const msg = errorMsg ?? 'Ελλιπή στοιχεία για ενημέρωση.';
        await sendChannelReply({
          channel: ctx.intake.channel,
          recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
          telegramChatId: telegramChatId ?? undefined,
          inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
          subject: 'Ενημέρωση επαφής',
          textBody: msg,
          requestId: ctx.requestId,
        });
        return { success: true, sideEffects: ['error_reply_sent'] };
      }

      const adminName = ctx.adminCommandMeta?.adminIdentity.displayName ?? 'Admin';

      // Perform the update
      await updateContactField(contactId, field, value, adminName);

      const sideEffects: string[] = [`contact_updated:${contactId}:${field}`];

      logger.info('UC-016 EXECUTE: Contact field updated', {
        requestId: ctx.requestId,
        contactId,
        field,
        value,
      });

      // Get remaining missing fields for smart ack
      const contact = await getContactById(contactId);
      const contactType = (contact?.type === 'company') ? 'company' : 'individual';
      const missingFields = await getContactMissingFields(contactId, contactType as 'individual' | 'company');

      const ackLines: string[] = [
        `✅ ${fieldLabel ?? field} "${value}" προστέθηκε στον ${contactName ?? 'επαφή'}.`,
      ];

      if (missingFields.length > 0) {
        ackLines.push('');
        ackLines.push(`📋 Υπόλοιπα ελλιπή: ${missingFields.join(', ')}`);
      } else {
        ackLines.push('');
        ackLines.push('✨ Όλα τα στοιχεία είναι συμπληρωμένα!');
      }

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
        inAppCommandId: (ctx.intake.rawPayload?.commandId as string) ?? undefined,
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
      const errorMessage = error instanceof Error ? error.message : String(error);
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

// ============================================================================
// HELPERS: Field Detection & Value Extraction
// ============================================================================

/**
 * Strip accents from Greek text for keyword matching.
 * Converts: ά→α, έ→ε, ή→η, ί→ι, ό→ο, ύ→υ, ώ→ω
 */
function stripAccents(text: string): string {
  const map: Record<string, string> = {
    'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
    'ΐ': 'ι', 'ΰ': 'υ', 'ϊ': 'ι', 'ϋ': 'υ',
    'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  };
  return text.replace(/[άέήίόύώΐΰϊϋΆΈΉΊΌΎΏ]/g, ch => map[ch] ?? ch);
}

/**
 * Detect which field the admin wants to update based on keywords in the message.
 */
function detectField(message: string): FieldMapping | null {
  const normalized = stripAccents(message.toLowerCase());

  for (const mapping of FIELD_KEYWORDS) {
    for (const keyword of mapping.keywords) {
      const normalizedKeyword = stripAccents(keyword.toLowerCase());
      if (normalized.includes(normalizedKeyword)) {
        return mapping;
      }
    }
  }

  return null;
}

/** Email regex */
const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.\w{2,}/;

/** Greek phone regex */
const PHONE_REGEX = /(?:\+30)?(?:\s?)(?:69\d{8}|2\d{9})/;

/** VAT number regex (9 digits in Greece) */
const VAT_REGEX = /\b\d{9}\b/;

/**
 * Extract the value for a detected field from the raw message.
 * Uses field-specific extraction logic.
 */
function extractFieldValue(message: string, fieldMapping: FieldMapping): string | null {
  const field = fieldMapping.field;

  // Field-specific extractors
  if (field === 'phone') {
    const match = message.match(PHONE_REGEX);
    return match ? match[0].replace(/\s/g, '').trim() : null;
  }

  if (field === 'email') {
    const match = message.match(EMAIL_REGEX);
    return match ? match[0].toLowerCase().trim() : null;
  }

  if (field === 'vatNumber') {
    const match = message.match(VAT_REGEX);
    return match ? match[0] : null;
  }

  // Generic extraction: find value after the keyword or after ':'
  // Pattern: "keyword ... value" or "keyword: value" or "keyword στον X: value"
  return extractGenericValue(message, fieldMapping.keywords);
}

/**
 * Generic value extractor: finds the value that appears after a keyword.
 *
 * Strategies:
 * 1. "keyword: value" → take everything after ':'
 * 2. "keyword Ονομα: value" → take everything after ':'
 * 3. "keyword value στον/στη Ονομα" → take text between keyword and στον/στη
 */
function extractGenericValue(message: string, keywords: readonly string[]): string | null {
  const normalized = stripAccents(message.toLowerCase());

  for (const keyword of keywords) {
    const normalizedKeyword = stripAccents(keyword.toLowerCase());
    const idx = normalized.indexOf(normalizedKeyword);
    if (idx === -1) continue;

    const afterKeyword = message.substring(idx + keyword.length).trim();

    // Strategy 1: "Keyword: value" or "Keyword Ονομα: value"
    const colonIdx = afterKeyword.indexOf(':');
    if (colonIdx !== -1) {
      const value = afterKeyword.substring(colonIdx + 1).trim();
      // Remove trailing contact name references
      const cleanedValue = value
        .replace(/\s+(?:στον|στη|στο|για τον|για τη|του|της)\s+.*$/i, '')
        .trim();
      if (cleanedValue) return cleanedValue;
    }

    // Strategy 2: Take the remaining text, strip contact name patterns
    const cleanedAfter = afterKeyword
      .replace(/^[:\s]+/, '')
      .replace(/\s+(?:στον|στη|στο|για τον|για τη|του|της)\s+.*$/i, '')
      .replace(/[,;]+\s*$/, '')
      .trim();

    if (cleanedAfter) return cleanedAfter;
  }

  return null;
}

/**
 * Extract the contact name from the message.
 * Strips command keywords, field keywords, and the detected value.
 *
 * Common patterns:
 * - "Πρόσθεσε τηλέφωνο 697... στον Νέστορα" → "Νέστορα"
 * - "Βάλε ΑΦΜ 123456789 στον Παγώνη" → "Παγώνη"
 * - "Επάγγελμα Νέστορα: Μηχανικός" → "Νέστορα"
 * - "ΑΦΜ 123456789" → null (will use session)
 */
function extractContactName(
  message: string,
  fieldMapping: FieldMapping | null,
  value: string | null
): string | null {
  // Pattern 1: "... στον/στη/στο [Name]"
  const prepositionMatch = message.match(
    /(?:στον|στη|στο|για τον|για τη|του|της)\s+(.+?)(?:\s*$|[,;.])/i
  );
  if (prepositionMatch) {
    const name = prepositionMatch[1].trim();
    // Strip any trailing value that might have slipped in
    if (name && name.length > 0) return name;
  }

  // Pattern 2: "field Name: value" (e.g., "Επάγγελμα Νέστορα: Μηχανικός")
  if (fieldMapping) {
    for (const keyword of fieldMapping.keywords) {
      const regex = new RegExp(keyword + '\\s+([\\p{L}]+(?:\\s+[\\p{L}]+)?)\\s*:', 'iu');
      const match = message.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
  }

  return null;
}
