/**
 * @fileoverview **«ΘΑ ΕΙΣΤΕ ΑΝΟΙΧΤΑ ΣΤΙΣ ΑΡΓΙΕΣ;» — ΠΟΙΟΣ, ΠΟΤΕ, ΜΙΑ ΦΟΡΑ** — η έκδοση της ερώτησης (ADR-841 §7 Α21.21 Φάση Β).
 * @related lib/cron/jobs/holiday-hours-question.job.ts (ο καλών) · lib/calendar/holiday-question.ts (ο πυρήνας) ·
 *   services/mandate/holiday-hours-question-notifier.ts (η αποστολή) · services/mandate/holiday-hours-question-decision.ts
 * @module services/mandate/holiday-hours-question.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΙΔΕΜΠΟΤΕΝΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Ποιες περίοδοι ωρίμασαν** — `dueHolidaySeasons` πάνω στην κάρτα (ο ΕΝΑΣ κριτής, 21/7 ημέρες). Απαντημένο στη φόρμα
 *    **δεν** ωριμάζει ποτέ — γι' αυτό η φόρμα δεν χρειάζεται να «κλείσει» τίποτα.
 * 2. **Μία συναλλαγή ανά (γραφείο, περίοδο)** με κλειδί **ντετερμινιστικό**: δεν υπάρχει ⇒ «ερώτηση»· υπάρχει, ανοιχτή,
 *    ρωτήθηκε **πριν** το παράθυρο υπενθύμισης και δεν υπενθυμίστηκε ⇒ «υπενθύμιση»· αλλιώς **τίποτα**.
 * 3. **ΜΕΤΑ** την εγγραφή, η αποστολή — ιδεμποτενής ανά (ερώτηση, στάδιο, παραλήπτη). Ένα email χωρίς έγγραφο θα ήταν
 *    σύνδεσμος που απαντά «άγνωστη ερώτηση».
 *
 * ⚠️ Κλειστή στο ΓΕΜΗ (Α23) ⇒ **καμία** ερώτηση: η σελίδα της δεν δείχνει καν ωράριο.
 */

import 'server-only';

import type { Firestore as AdminFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { HOLIDAY_QUESTION_POLICY } from '@/config/holiday-question-policy';
import { readShowcase } from '@/lib/agency/showcase-read';
import { registryClosureOf } from '@/lib/agency/showcase-registry-closure';
import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { dueHolidaySeasons, type DueHolidaySeason, type HolidayQuestionStage } from '@/lib/calendar/holiday-question';
import { athensClockAt } from '@/lib/calendar/weekly-hours';
import { createModuleLogger } from '@/lib/telemetry';
import { newTokenNonce } from '@/lib/tokens/signed-token';
import { generateDeterministicHolidayHoursQuestionId } from '@/services/enterprise-id.service';
import { readStoredHolidayQuestionState, type HolidayHoursQuestion, type HolidayHoursQuestionDocument } from '@/types/holiday-hours-question';

import { announceHolidayQuestion } from './holiday-hours-question-notifier';

const logger = createModuleLogger('holiday-hours-question');

/** Η αναφορά του περάσματος — **κάθε** κάδος, και όταν είναι μηδέν. */
export interface HolidayQuestionRunReport {
  readonly considered: number;
  readonly asked: number;
  readonly reminded: number;
  readonly skipped: number;
  readonly failed: number;
}

type MutableReport = { -readonly [K in keyof HolidayQuestionRunReport]: number };

interface SettledSeason {
  readonly question: HolidayHoursQuestion;
  readonly stage: HolidayQuestionStage;
}

/** **Ρωτήθηκε πριν ανοίξει το παράθυρο υπενθύμισης;** — αλλιώς η πρώτη ερώτηση ΗΤΑΝ ήδη η τελευταία ευκαιρία. */
function reminderDue(question: HolidayHoursQuestion, due: DueHolidaySeason, todayKey: string): boolean {
  if (question.state !== 'open' || question.remindedAt !== null || due.stage !== 'reminder') return false;
  const firstPending = addDaysToDateKey(todayKey, due.leadDays);
  const windowStart = firstPending === null ? null : addDaysToDateKey(firstPending, -HOLIDAY_QUESTION_POLICY.reminderLeadDays);
  return windowStart !== null && athensClockAt(new Date(question.askedAt)).dateKey < windowStart;
}

function newQuestion(id: string, companyId: string, due: DueHolidaySeason, nowISO: string): HolidayHoursQuestion {
  return {
    id, companyId, seasonKey: due.season.key, lastDate: due.season.lastDate, items: due.items, nonce: newTokenNonce(),
    state: 'open', createdAt: nowISO, askedAt: nowISO, remindedAt: null, settledAt: null, answers: [], answeredByUid: null,
  };
}

/** Βήμα 2 — **μία συναλλαγή**: δύο περάσματα μαζί γράφουν **μία** ερώτηση και **μία** υπενθύμιση. */
async function settleSeason(adminDb: AdminFirestore, companyId: string, due: DueHolidaySeason, now: Date): Promise<SettledSeason | null> {
  const id = generateDeterministicHolidayHoursQuestionId(companyId, due.season.key);
  const ref = adminDb.collection(COLLECTIONS.HOLIDAY_HOURS_QUESTIONS).doc(id);
  const nowISO = now.toISOString();
  return adminDb.runTransaction(async (tx): Promise<SettledSeason | null> => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      const question = newQuestion(id, companyId, due, nowISO);
      tx.set(ref, question);
      return { question, stage: 'ask' };
    }
    const raw = snapshot.data() as HolidayHoursQuestionDocument;
    const stored: HolidayHoursQuestion = { ...raw, state: readStoredHolidayQuestionState(raw.state) };
    if (!reminderDue(stored, due, athensClockAt(now).dateKey)) return null;
    tx.update(ref, { remindedAt: nowISO, items: due.items });
    return { question: { ...stored, remindedAt: nowISO, items: due.items }, stage: 'reminder' };
  });
}

async function processCompany(adminDb: AdminFirestore, doc: QueryDocumentSnapshot, now: Date, report: MutableReport): Promise<void> {
  const read = readShowcase(doc.data(), doc.id);
  if (read.outcome !== 'showcase' || registryClosureOf(read.showcase) !== null) {
    report.skipped += 1;
    return;
  }
  for (const due of dueHolidaySeasons(read.showcase.locations, now)) {
    const settled = await settleSeason(adminDb, doc.id, due, now);
    if (settled === null) continue;
    const announced = await announceHolidayQuestion(adminDb, settled.question, settled.stage, read.showcase.displayName);
    if (settled.stage === 'ask') report.asked += 1;
    else report.reminded += 1;
    report.failed += announced.failed;
  }
}

/**
 * **Το ημερήσιο πέρασμα.** Αποτυχία ενός γραφείου **δεν** σταματά τα υπόλοιπα: μετριέται, και το πέρασμα συνεχίζει.
 *
 * @param now Η στιγμή — περασμένη, ώστε τα όρια (21/7, περίοδος σε εξέλιξη) να είναι δοκιμάσιμα.
 */
export async function issueDueHolidayQuestions(adminDb: AdminFirestore, now: Date = new Date()): Promise<HolidayQuestionRunReport> {
  const report: MutableReport = { considered: 0, asked: 0, reminded: 0, skipped: 0, failed: 0 };
  // tenant-scope-exempt: σάρωση ΟΛΩΝ των δημοσιευμένων βιτρινών από το cron (καμία ταυτότητα χρήστη) — κάθε εγγραφή
  //   που ακολουθεί γίνεται ανά `companyId` (ντετερμινιστικό κλειδί ερώτησης, υποσυλλογή μελών του ίδιου γραφείου).
  const profiles = await adminDb.collection(COLLECTIONS.AGENCY_PROFILES).get();
  for (const doc of profiles.docs) {
    report.considered += 1;
    try {
      await processCompany(adminDb, doc, now, report);
    } catch (error) {
      report.failed += 1;
      logger.error('[HOLIDAY-HOURS] Το γραφείο δεν επεξεργάστηκε', {
        companyId: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return report;
}
