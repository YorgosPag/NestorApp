/**
 * 🧩 Τα κοινά βήματα ενός **UC module αιτήματος πελάτη** (UC-001/003/004/005/006) — ΕΝΑ σημείο (SSoT).
 *
 * Αναζήτηση αποστολέα · εμφανιζόμενο όνομα · στοιχεία αιτούντα · στοιχεία έγκρισης · εγγραφή στο audit trail ·
 * επιβεβαίωση παράδοσης · έλεγχος υγείας συλλογής. Ήταν αυτολεξεί ίδια σε 5 modules· το CHECK 3.28 (jscpd) τα
 * μέτρησε ως κλώνους όταν αγγίχτηκαν τα modules και πέρασαν εδώ 2026-10-30.
 *
 * 🔑 Ο logger περνά ως παράμετρος ώστε τα logs να μένουν στο κανάλι του κάθε module (`UC_004_COMPLAINT` κ.λπ.).
 * Η πολιτική έγκρισης/πρότασης ζει στο {@link ./admin-command-protocol}· εδώ μένουν μόνο τα βήματα του αιτήματος πελάτη.
 *
 * @module services/ai-pipeline/shared/customer-request-protocol
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generatePipelineAuditId } from '@/services/enterprise-id.service';
import type { Logger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import type { AcknowledgmentResult, PipelineContext } from '@/types/ai-pipeline';
import { findContactByEmail, type ContactMatch } from './contact-lookup';
import { getSenderHistory, type SenderHistoryResult } from './sender-history';
import { sendChannelReply, extractChannelIds } from './channel-reply-dispatcher';
import { acknowledgeBySideEffect, replySideEffect } from './admin-command-protocol';

/** Ο αποστολέας όπως τον βρίσκει το LOOKUP. */
export interface SenderLookup {
  senderEmail: string;
  senderName: string;
  senderContact: ContactMatch | null;
}

/** Ο αιτών όπως γράφεται στο audit trail. */
export interface RequesterRecord {
  email: string | null;
  name: string | null;
  contactId: string | null;
  isKnownContact: boolean;
}

/** Ποιος ενέκρινε και πότε (στο audit trail). */
export interface ApprovalRecord {
  approvedBy: string | null;
  approvedAt: string | null;
}

/** Το email του αποστολέα (κενό αν λείπει). */
export function senderEmailOf(ctx: PipelineContext): string {
  return ctx.intake.normalized.sender.email ?? '';
}

/** Βρες τον αποστολέα στις επαφές — αποτυχία δεν είναι μοιραία (`null`). */
export async function findSenderContact(
  ctx: PipelineContext,
  moduleId: string,
  logger: Logger,
  senderEmail: string,
): Promise<ContactMatch | null> {
  if (!senderEmail) return null;
  try {
    return await findContactByEmail(senderEmail, ctx.companyId);
  } catch (error) {
    logger.warn(`${moduleId} LOOKUP: Contact search failed (non-fatal)`, {
      requestId: ctx.requestId,
      error: getErrorMessage(error),
    });
    return null;
  }
}

/** Πρόλογος LOOKUP: αποστολέας + επαφή, με το log της αναζήτησης. */
export async function lookupSender(
  ctx: PipelineContext,
  moduleId: string,
  logger: Logger,
): Promise<SenderLookup> {
  const senderEmail = senderEmailOf(ctx);
  const senderName = ctx.intake.normalized.sender.name ?? senderEmail;

  logger.info(`${moduleId} LOOKUP: Searching for sender contact`, {
    requestId: ctx.requestId,
    senderEmail,
    companyId: ctx.companyId,
  });

  const senderContact = await findSenderContact(ctx, moduleId, logger, senderEmail);
  return { senderEmail, senderName, senderContact };
}

/** Ιστορικό του αποστολέα — αποτυχία δεν είναι μοιραία (`null`). */
export async function querySenderHistory(
  ctx: PipelineContext,
  moduleId: string,
  logger: Logger,
  senderEmail: string,
): Promise<SenderHistoryResult | null> {
  try {
    return await getSenderHistory(senderEmail, ctx.companyId, ctx.intake.id);
  } catch (error) {
    logger.warn(`${moduleId} LOOKUP: Sender history query failed (non-fatal)`, {
      requestId: ctx.requestId,
      error: getErrorMessage(error),
    });
    return null;
  }
}

/** Το κλείσιμο του LOOKUP: επαφή + ιστορικό (+ πεδία του module) στο log. */
export function logLookupComplete(
  ctx: PipelineContext,
  moduleId: string,
  logger: Logger,
  found: { senderContact: ContactMatch | null; senderHistory: SenderHistoryResult | null },
  extra: Record<string, unknown> = {},
): void {
  logger.info(`${moduleId} LOOKUP: Complete`, {
    requestId: ctx.requestId,
    isKnownContact: found.senderContact !== null,
    contactId: found.senderContact?.contactId,
    ...extra,
    isReturningContact: found.senderHistory?.isReturningContact,
    previousEmails: found.senderHistory?.totalPreviousEmails,
  });
}

/** Το αποτέλεσμα του LOOKUP ως `Record` (το συμβόλαιο του `IUCModule.lookup`). */
export function toLookupRecord(lookupData: object): Record<string, unknown> {
  return lookupData as unknown as Record<string, unknown>;
}

/** Το αποτέλεσμα του LOOKUP όπως το βρίσκει το PROPOSE. */
export function lookupOf<T extends object>(ctx: PipelineContext): T | undefined {
  return ctx.lookupData as unknown as T | undefined;
}

/** Το όνομα που εμφανίζεται για τον αποστολέα. */
export function senderDisplayOf(
  lookup: { senderName?: string; senderEmail?: string } | undefined,
): string {
  return lookup?.senderName ?? lookup?.senderEmail ?? 'Άγνωστος αποστολέας';
}

/** Ο αιτών από τα `params` της εγκεκριμένης ενέργειας. */
export function requesterOf(params: Record<string, unknown>): RequesterRecord {
  return {
    email: (params.senderEmail as string) ?? null,
    name: (params.senderName as string) ?? null,
    contactId: (params.contactId as string) ?? null,
    isKnownContact: (params.isKnownContact as boolean) ?? false,
  };
}

/** Τα στοιχεία έγκρισης για το audit trail. */
export function approvalOf(ctx: PipelineContext): ApprovalRecord {
  return {
    approvedBy: ctx.approval?.approvedBy ?? null,
    approvedAt: ctx.approval?.decidedAt ?? null,
  };
}

/** Γράψε εγγραφή στο audit trail του pipeline — επιστρέφει το `auditId`. */
export async function recordPipelineAudit(record: Record<string, unknown>): Promise<string> {
  const auditId = generatePipelineAuditId();
  await getAdminFirestore()
    .collection(COLLECTIONS.AI_PIPELINE_AUDIT)
    .doc(auditId)
    .set(record);
  return auditId;
}

/** Βήμα ACKNOWLEDGE: στάλθηκε η απάντηση; (με log). */
export function acknowledgeReply(
  ctx: PipelineContext,
  moduleId: string,
  logger: Logger,
  label: string,
): AcknowledgmentResult {
  const channel = ctx.intake.channel;
  const replySent = acknowledgeBySideEffect(ctx, 'reply_sent:').sent;

  logger.info(`${moduleId} ACKNOWLEDGE: ${label}`, {
    requestId: ctx.requestId,
    channel,
    replySent,
  });

  return { sent: replySent, channel };
}

/** Έλεγχος υγείας: διαβάζεται η συλλογή; */
export async function collectionHealthCheck(
  collectionName: string,
  moduleId: string,
  logger: Logger,
): Promise<boolean> {
  try {
    await getAdminFirestore().collection(collectionName).limit(1).get();
    return true;
  } catch (error) {
    logger.error(`${moduleId} HEALTH CHECK: Failed`, { error: getErrorMessage(error) });
    return false;
  }
}

/** Ρυθμίσεις του βήματος «εγγράφηκε στο audit trail → στείλε απάντηση». */
export interface RecordedReplyOptions {
  ctx: PipelineContext;
  moduleId: string;
  logger: Logger;
  /** Τα `params` της εγκεκριμένης ενέργειας. */
  params: Record<string, unknown>;
  auditId: string;
  /** Θέμα απάντησης όταν το αρχικό μήνυμα δεν έχει θέμα. */
  defaultSubject: string;
  /** Ετικέτα του log εγγραφής, π.χ. `Complaint` ⇒ «Complaint recorded». */
  recordedLabel: string;
  recordedExtra?: Record<string, unknown>;
  /** Παρενέργεια εγγραφής, π.χ. `complaint_recorded:<auditId>`. */
  recordedEffect: string;
  /** Στατικό κείμενο όταν δεν υπάρχει πρόχειρη απάντηση. */
  fallbackReply: (senderName: string) => string;
}

/**
 * Στείλε την απάντηση μετά την εγγραφή· αποτυχία αποστολής ΔΕΝ είναι μοιραία (η εγγραφή είναι η κύρια ενέργεια).
 * Επιστρέφει τις παρενέργειες: `[recordedEffect, reply_sent:… | reply_failed:…]`.
 */
export async function sendRecordedReply(o: RecordedReplyOptions): Promise<string[]> {
  const { ctx, moduleId, logger, params } = o;
  logger.info(`${moduleId} EXECUTE: ${o.recordedLabel} recorded`, {
    requestId: ctx.requestId,
    auditId: o.auditId,
    ...o.recordedExtra,
  });

  const draftReply = (params.draftReply as string) ?? '';
  const senderEmail = (params.senderEmail as string) ?? '';
  const originalSubject = ctx.intake.normalized.subject ?? o.defaultSubject;

  const replyResult = await sendChannelReply({
    channel: ctx.intake.channel,
    ...extractChannelIds(ctx),
    subject: `Re: ${originalSubject}`,
    textBody: draftReply || o.fallbackReply((params.senderName as string) ?? senderEmail),
    requestId: ctx.requestId,
  });

  const sideEffects = [o.recordedEffect, replySideEffect(replyResult)];
  if (replyResult.success) {
    logger.info(`${moduleId} EXECUTE: Reply sent`, {
      requestId: ctx.requestId,
      channel: replyResult.channel,
      messageId: replyResult.messageId,
    });
  } else {
    logger.warn(`${moduleId} EXECUTE: Reply send failed (${o.recordedLabel.toLowerCase()} still recorded)`, {
      requestId: ctx.requestId,
      channel: replyResult.channel,
      error: replyResult.error,
    });
  }
  return sideEffects;
}
