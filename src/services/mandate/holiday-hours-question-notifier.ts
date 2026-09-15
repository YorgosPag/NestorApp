/**
 * @fileoverview **ΠΟΙΟΣ ΡΩΤΙΕΤΑΙ ΚΑΙ ΠΩΣ** — η ερώτηση αργιών στους διαχειριστές του γραφείου (ADR-841 §7 Α21.21 Φάση Β).
 * @related services/mandate/holiday-hours-question.service.ts (ο καλών) · server/notifications/notification-orchestrator.ts ·
 *   services/mandate/holiday-question-email-texts.ts · lib/agency/showcase-card-destination.ts
 * @module services/mandate/holiday-hours-question-notifier
 *
 * 🔑 **ΑΠΟΦΑΣΗ GIORGIO (2026-09-15): ΔΙΑΧΕΙΡΙΣΤΕΣ ΧΩΡΟΥ** — όπως η Google στέλνει στους κατόχους/διαχειριστές του προφίλ, όχι
 * στο δημόσιο email επικοινωνίας. Ενεργά μέλη με ρόλο διοίκησης (`ADMINISTRATIVE_ROLES` — η **μία** λίστα του έργου).
 *
 * 🔑 **Μέσα από τον αγωγό ειδοποιήσεων, ποτέ απευθείας στον πάροχο**: έτσι ο διακόπτης ανά τύπο, οι ώρες σιωπής, η γλώσσα
 * του παραλήπτη, το List-Unsubscribe (RFC 8058) και η αποδιπλοποίηση (`eventId`) ισχύουν **χωρίς** δεύτερη υλοποίηση.
 * Τα κουμπιά απάντησης ταξιδεύουν ως **γεγονότα** (`emailFacts`) και υπογράφονται τη στιγμή της αποστολής.
 *
 * ⚠️ Αποτυχία ενός παραλήπτη **δεν** σταματά τους υπόλοιπους· μετριέται.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { showcaseCardDestination } from '@/lib/agency/showcase-card-destination';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import type { HolidayQuestionStage } from '@/lib/calendar/holiday-question';
import type { NotificationDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { loadUserNotificationSettingsMany } from '@/server/notifications/user-notification-settings-store';
import type { HolidayHoursQuestion } from '@/types/holiday-hours-question';

import { holidayQuestionBody, holidayQuestionWording } from './holiday-question-email-texts';

const logger = createModuleLogger('holiday-hours-question-notifier');

const ADMIN_ROLES: readonly string[] = ADMINISTRATIVE_ROLES;

export interface HolidayQuestionAnnouncement {
  readonly delivered: number;
  readonly failed: number;
}

/** Ο προορισμός — η κάρτα του γραφείου. Εξάγεται για τον ανιχνευτή απόκλισης. */
export function holidayHoursQuestionDestination(companyId: string): NotificationDestination {
  return showcaseCardDestination(companyId);
}

/** **Οι διαχειριστές του χώρου** — ενεργά μέλη με ρόλο διοίκησης. Υποσυλλογή του γραφείου: η εμβέλεια είναι η διαδρομή. */
async function adminRecipients(adminDb: AdminFirestore, companyId: string): Promise<string[]> {
  const members = await adminDb
    .collection(`${COLLECTIONS.COMPANIES}/${companyId}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`)
    .get();
  return members.docs.flatMap((doc) => {
    const { status, globalRole } = doc.data() as { status?: unknown; globalRole?: unknown };
    return status === 'active' && typeof globalRole === 'string' && ADMIN_ROLES.includes(globalRole) ? [doc.id] : [];
  });
}

async function askOne(
  question: HolidayHoursQuestion,
  stage: HolidayQuestionStage,
  agencyName: string,
  recipientId: string,
  language: unknown,
): Promise<boolean> {
  const wording = holidayQuestionWording(language);
  const result = await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_HOLIDAY_HOURS_QUESTION,
    recipientId,
    tenantId: question.companyId,
    title: stage === 'ask' ? wording.subject(agencyName) : wording.reminderSubject(agencyName),
    body: holidayQuestionBody(language, agencyName, question.items),
    titleKey: stage === 'ask' ? 'holidayHoursQuestion.title' : 'holidayHoursQuestion.reminderTitle',
    eventId: `holiday-hours:${question.id}:${stage}`,
    entityId: question.companyId,
    ...holidayHoursQuestionDestination(question.companyId),
    source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'holiday-hours-question', env: getCurrentEnvironment() },
    emailFacts: { kind: 'holiday-hours-question', questionId: question.id, nonce: question.nonce },
  });
  return result.success;
}

/**
 * **Στείλε την ερώτηση (ή την υπενθύμιση) σε κάθε διαχειριστή.** Ιδεμποτενές ανά (ερώτηση, στάδιο, παραλήπτη) μέσω
 * του `eventId` — ένα δεύτερο πέρασμα του cron την ίδια μέρα δεν γεννά δεύτερο email.
 */
export async function announceHolidayQuestion(
  adminDb: AdminFirestore,
  question: HolidayHoursQuestion,
  stage: HolidayQuestionStage,
  agencyName: string,
): Promise<HolidayQuestionAnnouncement> {
  const recipients = await adminRecipients(adminDb, question.companyId);
  const settings = await loadUserNotificationSettingsMany(recipients);
  let delivered = 0;
  let failed = 0;
  for (const recipientId of recipients) {
    try {
      if (await askOne(question, stage, agencyName, recipientId, settings.get(recipientId)?.language)) delivered += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      logger.error('[HOLIDAY-HOURS] Η ερώτηση προς διαχειριστή απέτυχε', {
        companyId: question.companyId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { delivered, failed };
}
