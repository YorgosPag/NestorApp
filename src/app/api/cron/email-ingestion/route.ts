/**
 * 🏢 ENTERPRISE EMAIL INGESTION CRON ENDPOINT
 *
 * ADR-071: Enterprise Email Webhook Queue System
 *
 * **Πυροκροτητής, όχι λογική** — η επεξεργασία παρτίδας ζει στο
 * `lib/cron/jobs/email-ingestion.job.ts`. Το route μένει για χειροκίνητη εκτέλεση
 * (GET με εξουσιοδότηση ή POST)· η προγραμματισμένη περνά από το
 * `/api/cron/dispatch` και καλεί τη συνάρτηση απευθείας.
 *
 * ⚠️ Χωρίς εξουσιοδότηση, το GET επιστρέφει **μόνο** liveness probe (υγεία ουράς,
 * χωρίς περιεχόμενο μηνυμάτων) — σκόπιμα, διατηρημένη συμπεριφορά. Το wiring
 * (ποιος περνά, τι βλέπει όποιος δεν περνά) ζει στο `lib/cron/queue-cron-route.ts`,
 * κοινό με το `/api/cron/ai-pipeline`.
 *
 * @module api/cron/email-ingestion
 * @see ADR-739 — το πρόγραμμα ζει στο src/config/cron-schedule.ts (03:00 Europe/Athens)
 */

import 'server-only';

import { runEmailIngestion } from '@/lib/cron/jobs/email-ingestion.job';
import { createQueueCronRoute } from '@/lib/cron/queue-cron-route';
import { getEmailIngestionQueueHealth } from '@/server/comms/workers/email-ingestion-worker';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('EMAIL_INGESTION_CRON');

export const maxDuration = 60;

const route = createQueueCronRoute({
  label: 'Email ingestion',
  service: 'email-ingestion-worker',
  version: 'v2',
  logger,
  run: runEmailIngestion,
  readHealth: getEmailIngestionQueueHealth,
});

export const GET = route.GET;
export const POST = route.POST;
