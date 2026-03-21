/**
 * =============================================================================
 * 🏢 ENTERPRISE: UC-001 APPOINTMENT REQUEST MODULE
 * =============================================================================
 *
 * Handles `appointment_request` intents — customers requesting meetings.
 *
 * Pipeline steps implemented:
 *   Step 3 LOOKUP      → Find sender in contacts, extract date/time from AI entities
 *   Step 4 PROPOSE     → Suggest appointment + draft confirmation email for operator approval
 *   Step 6 EXECUTE     → Create appointment in Firestore + send confirmation email via Mailgun
 *   Step 7 ACKNOWLEDGE → Verify email delivery status
 *
 * @module services/ai-pipeline/modules/uc-001-appointment
 * @see UC-001 (docs/centralized-systems/ai/use-cases/UC-001-appointment.md)
 * @see ADR-080 (Pipeline Implementation)
 * @see IUCModule interface (src/types/ai-pipeline.ts)
 */

import 'server-only';

import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { findContactByEmail, type ContactMatch } from '../../shared/contact-lookup';
import { sendChannelReply, extractChannelIds } from '../../shared/channel-reply-dispatcher';
import { checkAvailability, type AvailabilityResult } from '../../shared/availability-check';
import { generateAIReply } from '../../shared/ai-reply-generator';
import { getSenderHistory, type SenderHistoryResult } from '../../shared/sender-history';
import {
  PipelineIntentType,
} from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';
import type { AppointmentDocument, AppointmentStatus } from '@/types/appointment';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('UC_001_APPOINTMENT');

// ============================================================================
// LOOKUP TYPES
// ============================================================================

interface AppointmentLookupData {
  senderEmail: string;
  senderName: string;
  senderContact: ContactMatch | null;
  isKnownContact: boolean;
  requestedDate: string | null;
  requestedTime: string | null;
  originalSubject: string;
  companyId: string;
  /** Calendar availability check result */
  availability: AvailabilityResult | null;
  /** Previous emails from same sender */
  senderHistory: SenderHistoryResult | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract date/time from AI understanding entities.
 *
 * The AI provider may return entities with various key names:
 * eventDate, requestedDate, date, appointmentDate, etc.
 */
function extractDateTimeFromEntities(
  entities?: Record<string, string | undefined>
): { date: string | null; time: string | null } {
  if (!entities) {
    return { date: null, time: null };
  }

  const dateKeys = ['eventDate', 'requestedDate', 'date', 'appointmentDate', 'preferredDate'];
  const timeKeys = ['requestedTime', 'time', 'appointmentTime', 'preferredTime', 'eventTime'];

  let date: string | null = null;
  let time: string | null = null;

  for (const key of dateKeys) {
    if (entities[key]) {
      date = entities[key];
      break;
    }
  }

  for (const key of timeKeys) {
    if (entities[key]) {
      time = entities[key];
      break;
    }
  }

  return { date, time };
}

/**
 * Build a confirmation email for an approved appointment request.
 *
 * Template in Greek — follows the same pattern as UC-003 buildDraftReply.
 * Adapts content based on available date/time information.
 */
function buildAppointmentReply(params: {
  senderName: string;
  requestedDate: string | null;
  requestedTime: string | null;
  description: string;
}): string {
  const { senderName, requestedDate, requestedTime, description } = params;

  const greeting = `Αγαπητέ/ή ${senderName},`;
  const thanks = 'Σας ευχαριστούμε για το ενδιαφέρον σας και το αίτημα ραντεβού.';

  // Build date/time display
  const hasDate = requestedDate !== null;
  const hasTime = requestedTime !== null;

  let dateTimeText: string;
  if (hasDate && hasTime) {
    dateTimeText = `Το ραντεβού σας έχει εγκριθεί για ${requestedDate} στις ${requestedTime}.`;
  } else if (hasDate) {
    dateTimeText = `Το ραντεβού σας έχει εγκριθεί για ${requestedDate}. Θα σας ενημερώσουμε για την ακριβή ώρα.`;
  } else if (hasTime) {
    dateTimeText = `Λάβαμε την προτίμησή σας για ώρα ${requestedTime}. Θα σας ενημερώσουμε για την ακριβή ημερομηνία.`;
  } else {
    dateTimeText = 'Το αίτημά σας για ραντεβού έχει εγκριθεί. Θα επικοινωνήσουμε μαζί σας σύντομα για τον καθορισμό ημερομηνίας και ώρας.';
  }

  // Build description line (only if meaningful and not duplicate of subject)
  const descriptionLine = description && description.length > 10
    ? `Θέμα: ${description}`
    : '';

  const lines = [
    greeting,
    '',
    thanks,
    '',
    dateTimeText,
    '',
  ];

  if (descriptionLine) {
    lines.push(descriptionLine, '');
  }

  lines.push(
    'Σε περίπτωση που χρειαστεί αλλαγή ή ακύρωση, παρακαλούμε ενημερώστε μας εγκαίρως.',
    '',
    'Με εκτίμηση,',
  );

  return lines.join('\n');
}

// ============================================================================
// UC-001 MODULE
// ============================================================================

export class AppointmentModule implements IUCModule {
  readonly moduleId = 'UC-001';
  readonly displayName = 'Αίτημα Ραντεβού';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.APPOINTMENT_REQUEST,
  ];
  readonly requiredRoles: readonly string[] = ['salesManager'];

  // ── Step 3: LOOKUP ──────────────────────────────────────────────────────

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const senderEmail = ctx.intake.normalized.sender.email ?? '';
    const senderName = ctx.intake.normalized.sender.name ?? senderEmail;

    logger.info('UC-001 LOOKUP: Searching for sender contact', {
      requestId: ctx.requestId,
      senderEmail,
      companyId: ctx.companyId,
    });

    // Find sender in contacts collection (centralized utility)
    let senderContact: ContactMatch | null = null;
    if (senderEmail) {
      try {
        senderContact = await findContactByEmail(senderEmail, ctx.companyId);
      } catch (error) {
        const msg = getErrorMessage(error);
        logger.warn('UC-001 LOOKUP: Contact search failed (non-fatal)', {
          requestId: ctx.requestId,
          error: msg,
        });
      }
    }

    // Extract date/time from AI entities
    const { date: requestedDate, time: requestedTime } = extractDateTimeFromEntities(
      ctx.understanding?.entities
    );

    // Check calendar availability for the requested date
    let availability: AvailabilityResult | null = null;
    try {
      availability = await checkAvailability({
        companyId: ctx.companyId,
        requestedDate,
        requestedTime,
        requestId: ctx.requestId,
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      logger.warn('UC-001 LOOKUP: Availability check failed (non-fatal)', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

    // Query sender history (previous emails from same sender)
    let senderHistory: SenderHistoryResult | null = null;
    try {
      senderHistory = await getSenderHistory(
        senderEmail,
        ctx.companyId,
        ctx.intake.id,
      );
    } catch (error) {
      const msg = getErrorMessage(error);
      logger.warn('UC-001 LOOKUP: Sender history query failed (non-fatal)', {
        requestId: ctx.requestId,
        error: msg,
      });
    }

    const lookupData: AppointmentLookupData = {
      senderEmail,
      senderName,
      senderContact,
      isKnownContact: senderContact !== null,
      requestedDate,
      requestedTime,
      originalSubject: ctx.intake.normalized.subject ?? '',
      companyId: ctx.companyId,
      availability,
      senderHistory,
    };

    logger.info('UC-001 LOOKUP: Complete', {
      requestId: ctx.requestId,
      isKnownContact: lookupData.isKnownContact,
      contactId: senderContact?.contactId,
      requestedDate,
      requestedTime,
      isDateFree: availability?.isDateFree,
      hasTimeConflict: availability?.hasTimeConflict,
      isReturningContact: senderHistory?.isReturningContact,
      previousEmails: senderHistory?.totalPreviousEmails,
    });

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ─────────────────────────────────────────────────────

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as AppointmentLookupData | undefined;

    const senderDisplay = lookup?.senderName ?? lookup?.senderEmail ?? 'Άγνωστος αποστολέας';
    const dateDisplay = lookup?.requestedDate ?? 'χωρίς ημερομηνία';
    const timeDisplay = lookup?.requestedTime ?? 'χωρίς ώρα';
    const description = lookup?.originalSubject
      || ctx.intake.normalized.contentText?.slice(0, 500)
      || '';

    const summary = `Αίτημα ραντεβού από ${senderDisplay} για ${dateDisplay} ${timeDisplay}`;

    // Generate dynamic AI reply (falls back to static template on failure)
    const aiReplyResult = await generateAIReply(
      {
        useCase: 'appointment',
        senderName: senderDisplay,
        isKnownContact: lookup?.isKnownContact ?? false,
        originalMessage: ctx.intake.normalized.contentText?.slice(0, 1000) ?? '',
        originalSubject: lookup?.originalSubject ?? '',
        moduleContext: {
          requestedDate: lookup?.requestedDate ?? null,
          requestedTime: lookup?.requestedTime ?? null,
          description: description || null,
        },
        senderHistory: lookup?.senderHistory?.recentEmails,
        isReturningContact: lookup?.senderHistory?.isReturningContact,
      },
      () => buildAppointmentReply({
        senderName: senderDisplay,
        requestedDate: lookup?.requestedDate ?? null,
        requestedTime: lookup?.requestedTime ?? null,
        description,
      }),
      ctx.requestId,
    );

    const draftReply = aiReplyResult.replyText;

    logger.info('UC-001 PROPOSE: Generating proposal', {
      requestId: ctx.requestId,
      summary,
      aiGenerated: aiReplyResult.aiGenerated,
      aiDurationMs: aiReplyResult.durationMs,
    });

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'create_appointment',
          params: {
            senderEmail: lookup?.senderEmail ?? null,
            senderName: lookup?.senderName ?? null,
            contactId: lookup?.senderContact?.contactId ?? null,
            isKnownContact: lookup?.isKnownContact ?? false,
            requestedDate: lookup?.requestedDate ?? null,
            requestedTime: lookup?.requestedTime ?? null,
            description: description || summary,
            companyId: ctx.companyId,
            draftReply,
            aiGenerated: aiReplyResult.aiGenerated,
            operatorBriefing: lookup?.availability?.operatorBriefing ?? null,
            hasTimeConflict: lookup?.availability?.hasTimeConflict ?? false,
          },
        },
      ],
      requiredApprovals: ['salesManager'],
      autoApprovable: false, // ΚΑΝΟΝΑΣ: Ποτέ αυτόματο — πάντα ανθρώπινη έγκριση
      summary,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Step 6: EXECUTE ─────────────────────────────────────────────────────

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-001 EXECUTE: Creating appointment + sending confirmation', {
      requestId: ctx.requestId,
    });

    try {
      // Use modified actions from operator if available, otherwise use original proposal
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const createAction = actions.find(a => a.type === 'create_appointment');

      if (!createAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No create_appointment action found in approved actions',
        };
      }

      const params = createAction.params;
      const now = new Date().toISOString();

      // ── 1. Create appointment document in Firestore ──
      const appointmentDoc: Omit<AppointmentDocument, 'id'> = {
        companyId: (params.companyId as string) || ctx.companyId,
        pipelineRequestId: ctx.requestId,
        source: {
          channel: ctx.intake.channel,
          messageId: ctx.intake.id,
        },
        requester: {
          email: (params.senderEmail as string) ?? null,
          name: (params.senderName as string) ?? null,
          contactId: (params.contactId as string) ?? null,
          isKnownContact: (params.isKnownContact as boolean) ?? false,
        },
        appointment: {
          requestedDate: (params.requestedDate as string) ?? null,
          requestedTime: (params.requestedTime as string) ?? null,
          description: (params.description as string) || 'Αίτημα ραντεβού',
        },
        assignedRole: 'salesManager',
        status: 'approved' as AppointmentStatus,
        createdAt: now,
        updatedAt: now,
        approvedBy: ctx.approval?.approvedBy ?? null,
        approvedAt: ctx.approval?.decidedAt ?? null,
      };

      const adminDb = getAdminFirestore();
      const docRef = await adminDb
        .collection(COLLECTIONS.APPOINTMENTS)
        .add(appointmentDoc);

      logger.info('UC-001 EXECUTE: Appointment created', {
        requestId: ctx.requestId,
        appointmentId: docRef.id,
        requesterEmail: params.senderEmail,
      });

      // ── 2. Send confirmation reply via channel dispatcher (ADR-132) ──
      const senderEmail = (params.senderEmail as string) ?? '';
      const draftReply = (params.draftReply as string) ?? '';
      const originalSubject = ctx.intake.normalized.subject ?? 'Αίτημα Ραντεβού';

      const replyText = draftReply || buildAppointmentReply({
        senderName: (params.senderName as string) ?? senderEmail,
        requestedDate: (params.requestedDate as string) ?? null,
        requestedTime: (params.requestedTime as string) ?? null,
        description: (params.description as string) ?? '',
      });

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        ...extractChannelIds(ctx),
        subject: `Re: ${originalSubject}`,
        textBody: replyText,
        requestId: ctx.requestId,
      });

      // Log reply result
      if (replyResult.success) {
        logger.info('UC-001 EXECUTE: Confirmation reply sent', {
          requestId: ctx.requestId,
          appointmentId: docRef.id,
          channel: replyResult.channel,
          messageId: replyResult.messageId,
        });
      } else {
        logger.warn('UC-001 EXECUTE: Reply send failed (appointment still created)', {
          requestId: ctx.requestId,
          appointmentId: docRef.id,
          channel: replyResult.channel,
          error: replyResult.error,
        });
      }

      // Build side effects list
      const sideEffects = [`appointment_created:${docRef.id}`];

      if (replyResult.success) {
        sideEffects.push(`reply_sent:${replyResult.messageId ?? 'unknown'}`);
      } else {
        sideEffects.push(`reply_failed:${replyResult.error ?? 'unknown'}`);
      }

      // Appointment creation is the primary action — email failure is non-fatal
      return {
        success: true,
        sideEffects,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      logger.error('UC-001 EXECUTE: Failed to create appointment', {
        requestId: ctx.requestId,
        error: errorMessage,
      });

      return {
        success: false,
        sideEffects: [],
        error: `Failed to create appointment: ${errorMessage}`,
      };
    }
  }

  // ── Step 7: ACKNOWLEDGE ─────────────────────────────────────────────────

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    const channel = ctx.intake.channel;

    // Check if confirmation reply was sent in EXECUTE step
    const replySent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('reply_sent:')
    ) ?? false;

    logger.info('UC-001 ACKNOWLEDGE: Confirmation delivery status', {
      requestId: ctx.requestId,
      channel,
      replySent,
    });

    return {
      sent: replySent,
      channel,
    };
  }

  // ── Health Check ────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const adminDb = getAdminFirestore();
      // Simple connectivity test — try to access the collection
      await adminDb.collection(COLLECTIONS.APPOINTMENTS).limit(1).get();
      return true;
    } catch (error) {
      const msg = getErrorMessage(error);
      logger.error('UC-001 HEALTH CHECK: Failed', { error: msg });
      return false;
    }
  }
}
