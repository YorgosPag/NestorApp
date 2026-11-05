import 'server-only';

/**
 * **Ο ένας αναγνώστης και ο ένας γραφέας** της επεξεργασίας AI ανά εταιρεία (ADR-929 Δ15 #1).
 *
 * Αποθήκευση: `companies/{companyId}.settings.aiProcessing.<σκοπός>` (Admin SDK, το ίδιο σχήμα με το
 * `settings.orgStructure` του ADR-326). Η εξουσιοδότηση κρίνεται στη διαδρομή (`ADMINISTRATIVE_ROLES`, ADR-801).
 *
 * 🔑 Η ενεργή κατάσταση ενός σκοπού = επιλογή (εταιρείας ή προεπιλογή πλατφόρμας) **και** νομική γνωστοποίηση σε ισχύ.
 * 🔑 Αδυναμία ανάγνωσης ⇒ **throw**: ο καλών αποφασίζει fail-closed (η ροή της κάτοψης ⇒ καμία κλήση, Δ16).
 * 🔑 Ιδεμποτικό: ίδια κατάσταση ⇒ καμία εγγραφή και **καμία** γραμμή ιστορικού.
 *
 * @module server/company/company-ai-processing.server
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import { calendarDayOf, type CalendarDay } from '@/constants/platform-operator';
import { legalDocumentInForce } from '@/lib/legal/legal-document-versions';
import { clauseIdsOf } from '@/lib/legal/legal-clauses';
import {
  AI_PROCESSING_LEGAL_CLAUSE,
  AI_PROCESSING_PLATFORM_DEFAULT,
  AI_PROCESSING_PURPOSES,
  isAiProcessingState,
  type AiProcessingDecision,
  type AiProcessingLegalStatus,
  type AiProcessingPurpose,
  type AiProcessingState,
  type AiPurposeStatus,
  type CompanyAiProcessingSettings,
} from '@/types/company-ai-processing';

const logger = createModuleLogger('CompanyAiProcessing');

/** Οι όροι της πολιτικής απορρήτου σε ισχύ μια μέρα. Καμία έκδοση σε ισχύ ⇒ κανένας όρος. */
export type InForceClauses = (day: CalendarDay) => readonly string[];

export const privacyPolicyClausesInForce: InForceClauses = (day) => {
  const lookup = legalDocumentInForce('privacy-policy', day);
  return lookup.kind === 'in-force' ? clauseIdsOf(lookup.version.frozen) : [];
};

function decisionFrom(raw: unknown): AiProcessingDecision | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isAiProcessingState(r.state) || typeof r.decidedBy !== 'string' || typeof r.decidedAt !== 'string') return null;
  return { state: r.state, decidedBy: r.decidedBy, decidedAt: r.decidedAt };
}

/** Στενεύει ό,τι διαβάστηκε από το έγγραφο: άκυρη εγγραφή = σαν να μην αποφασίστηκε (λέγεται στο log). */
function settingsFrom(raw: unknown, companyId: string): CompanyAiProcessingSettings {
  const out: Partial<Record<AiProcessingPurpose, AiProcessingDecision>> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const purpose of AI_PROCESSING_PURPOSES) {
    const value = (raw as Record<string, unknown>)[purpose];
    if (value === undefined) continue;
    const decision = decisionFrom(value);
    if (decision) out[purpose] = decision;
    else logger.warn('malformed ai-processing decision ignored', { companyId, purpose });
  }
  return out;
}

/** Καθαρή: η ενεργή κατάσταση ενός σκοπού. */
export function resolveAiPurposeStatus(
  settings: CompanyAiProcessingSettings,
  purpose: AiProcessingPurpose,
  clauses: readonly string[],
): AiPurposeStatus {
  const decision = settings[purpose] ?? null;
  const state = decision?.state ?? AI_PROCESSING_PLATFORM_DEFAULT[purpose];
  const legal: AiProcessingLegalStatus = clauses.includes(AI_PROCESSING_LEGAL_CLAUSE[purpose]) ? 'disclosed' : 'pending';
  return {
    purpose,
    state,
    source: decision ? 'company' : 'platform-default',
    decision,
    legal,
    effective: state === 'enabled' && legal === 'disclosed',
  };
}

function companyRef(companyId: string) {
  return getAdminFirestore().collection(COLLECTIONS.COMPANIES).doc(companyId);
}

/** Διαβάζει τις αποφάσεις της εταιρείας. **Throw** σε αποτυχία ανάγνωσης (ο καλών κρίνει fail-closed). */
export async function readCompanyAiProcessing(companyId: string): Promise<CompanyAiProcessingSettings> {
  const snap = await companyRef(companyId).get();
  const settings = (snap.data() as { settings?: { aiProcessing?: unknown } } | undefined)?.settings;
  return settingsFrom(settings?.aiProcessing, companyId);
}

/** Η ενεργή κατάσταση **όλων** των σκοπών μιας εταιρείας, σήμερα. */
export async function readAiPurposeStatuses(
  companyId: string,
  clausesInForce: InForceClauses = privacyPolicyClausesInForce,
  now: Date = new Date(),
): Promise<readonly AiPurposeStatus[]> {
  const settings = await readCompanyAiProcessing(companyId);
  const clauses = clausesInForce(calendarDayOf(now));
  return AI_PROCESSING_PURPOSES.map((purpose) => resolveAiPurposeStatus(settings, purpose, clauses));
}

/** Η ενεργή κατάσταση **ενός** σκοπού — για τη ροή που θα στείλει δεδομένα. */
export async function readAiPurposeStatus(
  companyId: string,
  purpose: AiProcessingPurpose,
  clausesInForce: InForceClauses = privacyPolicyClausesInForce,
  now: Date = new Date(),
): Promise<AiPurposeStatus> {
  const settings = await readCompanyAiProcessing(companyId);
  return resolveAiPurposeStatus(settings, purpose, clausesInForce(calendarDayOf(now)));
}

export interface AiProcessingActor {
  readonly uid: string;
  readonly displayName: string | null;
}

/** Το «πριν» του ιστορικού: η προηγούμενη απόφαση της εταιρείας, ή `null` = «δεν είχε αποφασίσει ποτέ» (ίσχυε η προεπιλογή). */
type PreviousDecision = { readonly old: AiProcessingState | null };

/**
 * Γράφει την απόφαση του διαχειριστή. Ανάγνωση + εγγραφή σε **μία** συναλλαγή, ώστε το «πριν» του ιστορικού
 * να είναι αυτό που πραγματικά αντικαταστάθηκε. Ίδια απόφαση με την ήδη αποθηκευμένη ⇒ no-op. Η πρώτη επιβεβαίωση
 * της προεπιλογής **είναι** απόφαση: καταγράφει ποιος την επέλεξε (`null → enabled`).
 */
export async function setCompanyAiPurpose(
  companyId: string,
  purpose: AiProcessingPurpose,
  state: AiProcessingState,
  actor: AiProcessingActor,
  now: Date = new Date(),
): Promise<{ readonly changed: boolean }> {
  const ref = companyRef(companyId);
  const decision: AiProcessingDecision = { state, decidedBy: actor.uid, decidedAt: now.toISOString() };
  const before = await getAdminFirestore().runTransaction(async (tx): Promise<PreviousDecision | null> => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('company not found');
    const raw = (snap.data() as { settings?: { aiProcessing?: unknown } }).settings?.aiProcessing;
    const previous = settingsFrom(raw, companyId)[purpose]?.state ?? null;
    if (previous === state) return null;
    tx.update(ref, { [`settings.aiProcessing.${purpose}`]: decision });
    return { old: previous };
  });
  if (before === null) return { changed: false };
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: null,
    action: 'updated',
    changes: [{ field: `settings.aiProcessing.${purpose}`, oldValue: before.old, newValue: state, label: 'AI processing' }],
    performedBy: actor.uid,
    performedByName: actor.displayName,
    companyId,
  });
  logger.info('ai-processing decision saved', { companyId, purpose, state });
  return { changed: true };
}
