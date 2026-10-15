/**
 * =============================================================================
 * Ειδοποιήσεις του μητρώου λήξεων — η ΣΑΡΩΣΗ (ADR-915 Φ5α · §12)
 * =============================================================================
 *
 * Μία φορά τη μέρα, για κάθε γραφείο: το μητρώο ξαναπαράγεται από τα αρχεία (`readDocumentRegistry` — ο ΙΔΙΟΣ
 * αναγνώστης με τη σελίδα, καμία δεύτερη πηγή), κόβεται σε στάδια, συγκρίνεται με το ημερολόγιο ακμών, και **μόνο** οι
 * γραμμές που πέρασαν σε νέο στάδιο φεύγουν — μία σύνοψη ανά παραλήπτη.
 *
 * | Περίπτωση | Ημερολόγιο |
 * |---|---|
 * | καμία ακμή | γράφεται **μόνο** αν άλλαξε (π.χ. ανανέωση που έβγαλε γραμμή από στάδιο) |
 * | ακμές, όλοι ειδοποιήθηκαν | προχωρά |
 * | ακμές, **κανένας** παραλήπτης | **ΔΕΝ** προχωρά — δεν το έμαθε κανείς, θα ειπωθεί όταν υπάρξει διαχειριστής |
 * | ακμές, κάποια αποστολή **απέτυχε** | **ΔΕΝ** προχωρά — αύριο ξαναδοκιμάζει· το `eventId` κρατά τους υπόλοιπους σιωπηλούς |
 * | μητρώο **κομμένο** (`truncated`) | συγχώνευση, ποτέ «ξέχασε ό,τι δεν διάβασα» |
 *
 * 🔑 Αποτυχία ενός γραφείου **δεν** σταματά τα υπόλοιπα.
 *
 * @module services/document-registry/registry-expiry-alerts.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { registryRowIdOf } from '@/lib/document-validity/document-registry';
import {
  advancedExpiryAlerts,
  alertLedgersEqual,
  currentExpiryAlerts,
  expiryAlertLandingView,
  nextAlertLedger,
  type ExpiryAlert,
} from '@/lib/document-validity/expiry-alert-stage';
import { createModuleLogger } from '@/lib/telemetry';
import { activeWorkspaceAdministrators } from '@/lib/workspace/workspace-administrators';
import { readDocumentRegistry } from './document-registry.service';
import type { DocumentRegistryResponse } from './document-registry.types';
import { readAlertLedger, writeAlertLedger } from './registry-alert-ledger.server';
import { announceRegistryExpiry } from './registry-expiry-notifier';

const logger = createModuleLogger('registry-expiry-alerts');

/** Φραγμένη σάρωση γραφείων: περισσότερα ⇒ `truncated` στην αναφορά (ποτέ σιωπηλά). */
export const REGISTRY_ALERT_COMPANY_LIMIT = 200;

export interface RegistryExpirySweepReport {
  readonly considered: number;
  readonly notified: number;
  readonly skipped: number;
  readonly failed: number;
  /** Περισσότερα γραφεία από το όριο. */
  readonly truncated: boolean;
  /** Γραφεία με **κομμένο** μητρώο — η σύνοψή τους μπορεί να μην είναι πλήρης. */
  readonly incomplete: number;
}

type CompanyOutcome =
  | { readonly kind: 'notified'; readonly sent: number; readonly incomplete: boolean }
  | { readonly kind: 'quiet'; readonly incomplete: boolean }
  | { readonly kind: 'skipped'; readonly incomplete: boolean }
  | { readonly kind: 'failed'; readonly incomplete: boolean };

interface CompanyContext {
  readonly db: Firestore;
  readonly companyId: string;
  readonly registry: DocumentRegistryResponse;
}

/** Στέλνει τις ακμές· `null` = κανένας παραλήπτης. */
async function deliver(context: CompanyContext, fresh: readonly ExpiryAlert[]): Promise<readonly string[] | null> {
  const recipients = await activeWorkspaceAdministrators(context.db, context.companyId);
  if (recipients.length === 0) return null;
  const freshIds = new Set(fresh.map((alert) => alert.rowId));
  const rows = context.registry.rows.filter((row) => freshIds.has(registryRowIdOf(row)));
  const view = expiryAlertLandingView(rows, context.registry.asOf);
  return Promise.all(recipients.map((recipientUid) =>
    announceRegistryExpiry({ companyId: context.companyId, recipientUid, alerts: fresh, view })));
}

async function sweepCompany(db: Firestore, companyId: string, nowMs: number): Promise<CompanyOutcome> {
  const registry = await readDocumentRegistry(db, companyId, new Date(nowMs));
  const incomplete = registry.truncated;
  const current = currentExpiryAlerts(registry.rows, registry.asOf);
  const ledger = await readAlertLedger(db, companyId);
  const fresh = advancedExpiryAlerts(current, ledger);
  const next = nextAlertLedger(current, ledger, !incomplete);
  if (fresh.length === 0) {
    if (!alertLedgersEqual(next, ledger)) await writeAlertLedger(db, companyId, next, registry.asOf, nowMs);
    return { kind: 'quiet', incomplete };
  }
  const deliveries = await deliver({ db, companyId, registry }, fresh);
  if (deliveries === null) return { kind: 'skipped', incomplete };
  if (deliveries.includes('failed')) return { kind: 'failed', incomplete };
  await writeAlertLedger(db, companyId, next, registry.asOf, nowMs);
  return { kind: 'notified', sent: deliveries.filter((delivery) => delivery === 'sent').length, incomplete };
}

async function companyIdsToSweep(db: Firestore): Promise<{ readonly ids: readonly string[]; readonly truncated: boolean }> {
  // tenant-scope-exempt: cron μηχανής→μηχανής που σαρώνει ΟΛΑ τα γραφεία εκ σχεδιασμού (καμία τιμή από αίτημα
  // χρήστη). Κάθε ανάγνωση και κάθε ειδοποίηση μετά από εδώ δένεται στο `companyId` ΤΟΥ γραφείου.
  const snapshot = await db.collection(COLLECTIONS.COMPANIES).limit(REGISTRY_ALERT_COMPANY_LIMIT + 1).get();
  const ids = snapshot.docs.slice(0, REGISTRY_ALERT_COMPANY_LIMIT).map((doc) => doc.id);
  return { ids, truncated: snapshot.docs.length > REGISTRY_ALERT_COMPANY_LIMIT };
}

async function outcomeOf(db: Firestore, companyId: string, nowMs: number): Promise<CompanyOutcome> {
  try {
    return await sweepCompany(db, companyId, nowMs);
  } catch (error) {
    logger.error('Η σάρωση του μητρώου λήξεων απέτυχε για γραφείο', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed', incomplete: false };
  }
}

export async function sweepRegistryExpiryAlerts(db: Firestore, nowMs: number): Promise<RegistryExpirySweepReport> {
  const { ids, truncated } = await companyIdsToSweep(db);
  let notified = 0;
  let skipped = 0;
  let failed = 0;
  let incomplete = 0;
  for (const companyId of ids) {
    const outcome = await outcomeOf(db, companyId, nowMs);
    if (outcome.kind === 'notified') notified += outcome.sent;
    else if (outcome.kind === 'skipped') skipped += 1;
    else if (outcome.kind === 'failed') failed += 1;
    if (outcome.incomplete) incomplete += 1;
  }
  return { considered: ids.length, notified, skipped, failed, truncated, incomplete };
}
