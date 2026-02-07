/**
 * =============================================================================
 * 🏢 ENTERPRISE: UC-001 APPOINTMENT REQUEST MODULE
 * =============================================================================
 *
 * First UC module for the Universal AI Pipeline.
 * Handles `appointment_request` intents — customers requesting meetings.
 *
 * Pipeline steps implemented:
 *   Step 3 LOOKUP  → Find sender in contacts, extract date/time from AI entities
 *   Step 4 PROPOSE → Suggest appointment creation for operator approval
 *   Step 6 EXECUTE → Create appointment document in Firestore
 *   Step 7 ACKNOWLEDGE → Log confirmation (Phase 2: real email)
 *
 * @module services/ai-pipeline/modules/uc-001-appointment
 * @see UC-001 (docs/centralized-systems/ai/use-cases/UC-001-appointment.md)
 * @see ADR-080 (Pipeline Implementation)
 * @see IUCModule interface (src/types/ai-pipeline.ts)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  PipelineIntentType,
  PipelineChannel,
} from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
  PipelineChannelValue,
} from '@/types/ai-pipeline';
import type { AppointmentDocument, AppointmentStatus } from '@/types/appointment';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('UC_001_APPOINTMENT');

// ============================================================================
// LOOKUP TYPES
// ============================================================================

interface ContactMatch {
  contactId: string;
  name: string;
}

interface AppointmentLookupData {
  senderEmail: string;
  senderName: string;
  senderContact: ContactMatch | null;
  isKnownContact: boolean;
  requestedDate: string | undefined;
  requestedTime: string | undefined;
  originalSubject: string;
  companyId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Server-side contact lookup by email using Admin SDK.
 *
 * MVP: Scans contacts for email match (limited to 50 docs per company).
 * Phase 2: Use flat `primaryEmail` field for direct indexed query.
 */
async function findContactByEmail(
  email: string,
  companyId: string
): Promise<ContactMatch | null> {
  const adminDb = getAdminFirestore();

  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .where('companyId', '==', companyId)
    .limit(50)
    .get();

  const normalizedEmail = email.toLowerCase().trim();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Check emails array (common pattern: [{ email: "...", label: "work" }])
    const emails = data.emails as Array<{ email?: string }> | undefined;
    if (emails?.some(e => e.email?.toLowerCase().trim() === normalizedEmail)) {
      return {
        contactId: doc.id,
        name: (data.displayName ?? data.firstName ?? data.companyName ?? 'Unknown') as string,
      };
    }

    // Check flat email field
    const flatEmail = data.email as string | undefined;
    if (flatEmail?.toLowerCase().trim() === normalizedEmail) {
      return {
        contactId: doc.id,
        name: (data.displayName ?? data.firstName ?? data.companyName ?? 'Unknown') as string,
      };
    }
  }

  return null;
}

/**
 * Extract date/time from AI understanding entities.
 *
 * The AI provider may return entities with various key names:
 * eventDate, requestedDate, date, appointmentDate, etc.
 */
function extractDateTimeFromEntities(
  entities?: Record<string, string | undefined>
): { date: string | undefined; time: string | undefined } {
  if (!entities) {
    return { date: undefined, time: undefined };
  }

  const dateKeys = ['eventDate', 'requestedDate', 'date', 'appointmentDate', 'preferredDate'];
  const timeKeys = ['requestedTime', 'time', 'appointmentTime', 'preferredTime', 'eventTime'];

  let date: string | undefined;
  let time: string | undefined;

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

    // Find sender in contacts collection
    let senderContact: ContactMatch | null = null;
    if (senderEmail) {
      try {
        senderContact = await findContactByEmail(senderEmail, ctx.companyId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
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

    const lookupData: AppointmentLookupData = {
      senderEmail,
      senderName,
      senderContact,
      isKnownContact: senderContact !== null,
      requestedDate,
      requestedTime,
      originalSubject: ctx.intake.normalized.subject ?? '',
      companyId: ctx.companyId,
    };

    logger.info('UC-001 LOOKUP: Complete', {
      requestId: ctx.requestId,
      isKnownContact: lookupData.isKnownContact,
      contactId: senderContact?.contactId,
      requestedDate,
      requestedTime,
    });

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ─────────────────────────────────────────────────────

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as AppointmentLookupData | undefined;

    const senderDisplay = lookup?.senderName ?? lookup?.senderEmail ?? 'Άγνωστος αποστολέας';
    const dateDisplay = lookup?.requestedDate ?? 'χωρίς ημερομηνία';
    const timeDisplay = lookup?.requestedTime ?? 'χωρίς ώρα';

    const summary = `Αίτημα ραντεβού από ${senderDisplay} για ${dateDisplay} ${timeDisplay}`;

    logger.info('UC-001 PROPOSE: Generating proposal', {
      requestId: ctx.requestId,
      summary,
    });

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'create_appointment',
          params: {
            senderEmail: lookup?.senderEmail,
            senderName: lookup?.senderName,
            contactId: lookup?.senderContact?.contactId,
            isKnownContact: lookup?.isKnownContact ?? false,
            requestedDate: lookup?.requestedDate,
            requestedTime: lookup?.requestedTime,
            description: lookup?.originalSubject || ctx.intake.normalized.contentText?.slice(0, 500) || summary,
            companyId: ctx.companyId,
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
    logger.info('UC-001 EXECUTE: Creating appointment', {
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

      const appointmentDoc: Omit<AppointmentDocument, 'id'> = {
        companyId: (params.companyId as string) || ctx.companyId,
        pipelineRequestId: ctx.requestId,
        source: {
          channel: ctx.intake.channel,
          messageId: ctx.intake.id,
        },
        requester: {
          email: params.senderEmail as string | undefined,
          name: params.senderName as string | undefined,
          contactId: params.contactId as string | undefined,
          isKnownContact: (params.isKnownContact as boolean) ?? false,
        },
        appointment: {
          requestedDate: params.requestedDate as string | undefined,
          requestedTime: params.requestedTime as string | undefined,
          description: (params.description as string) || 'Αίτημα ραντεβού',
        },
        assignedRole: 'salesManager',
        status: 'approved' as AppointmentStatus,
        createdAt: now,
        updatedAt: now,
        approvedBy: ctx.approval?.approvedBy,
        approvedAt: ctx.approval?.decidedAt,
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

      return {
        success: true,
        sideEffects: [`appointment_created:${docRef.id}`],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

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
    // MVP: Log that confirmation would be sent
    // Phase 2: Send real email via Mailgun
    const channel = (ctx.intake.channel ?? PipelineChannel.EMAIL) as PipelineChannelValue;

    logger.info('UC-001 ACKNOWLEDGE: Confirmation pending (Phase 2: email sending)', {
      requestId: ctx.requestId,
      channel,
      senderEmail: ctx.intake.normalized.sender.email,
    });

    return {
      sent: false,
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
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('UC-001 HEALTH CHECK: Failed', { error: msg });
      return false;
    }
  }
}
