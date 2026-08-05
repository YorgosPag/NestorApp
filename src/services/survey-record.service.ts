/**
 * @related ADR-759 Φ2 — persistence for `survey_records`
 *
 * Goes through the central `firestoreQueryService` (ADR-214) rather than talking to
 * Firestore directly. That is not style: the central path is what applies the tenant
 * filter, and CHECK 3.35 R3 watches exactly this call site for a `tenantOverride:
 * 'skip'` sneaking in. There is no reason for this collection to ever skip it.
 *
 * IDs come from `enterprise-id.service` via the factory (N.6). `addDoc` appears
 * nowhere — `create` is always given a pre-generated `documentId`.
 */
import { where } from 'firebase/firestore';
import { FIELDS } from '@/config/firestore-field-constants';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { SurveyRecord } from '@/types/project-survey-record';

const logger = createModuleLogger('SurveyRecordService');

/**
 * Firestore stores plain data; the domain type is the contract on the way out.
 *
 * Written as a homomorphic mapped type rather than `SurveyRecord & Record<string,
 * unknown>` so it satisfies the service's `T extends Record<string, unknown>` bound
 * structurally — no type assertion anywhere in this file (N.2).
 */
type SurveyRecordDoc = { [K in keyof SurveyRecord]: SurveyRecord[K] };

/**
 * Every survey record of a project, newest first.
 *
 * The company filter is applied by the central service from the auth context — it is
 * deliberately NOT passed here, so there is no way for a caller to widen it.
 */
export async function listSurveyRecords(projectId: string): Promise<readonly SurveyRecord[]> {
  const result = await firestoreQueryService.getAll<SurveyRecordDoc>(
    'SURVEY_RECORDS',
    { constraints: [where(FIELDS.PROJECT_ID, '==', projectId)] }
  );
  return [...result.documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** One record by id, or `null`. */
export async function getSurveyRecord(recordId: string): Promise<SurveyRecord | null> {
  return firestoreQueryService.getById<SurveyRecordDoc>('SURVEY_RECORDS', recordId);
}

/**
 * Persist a brand-new record.
 *
 * `addTimestamps: false` on purpose — the record carries ISO strings in its own
 * `createdAt`/`updatedAt`, and letting the service also write `serverTimestamp()`
 * sentinels into the same keys would give the document two different types for one
 * field depending on who wrote it last.
 */
export async function createSurveyRecord(record: SurveyRecord): Promise<boolean> {
  try {
    await firestoreQueryService.create<SurveyRecordDoc>(
      'SURVEY_RECORDS',
      record,
      { documentId: record.id, addTimestamps: false }
    );
    return true;
  } catch (error) {
    logger.warn('Survey record create failed', { recordId: record.id, error });
    return false;
  }
}

/**
 * Patch an existing record.
 *
 * ⚠️ The rules refuse content changes once `confirmedBy !== null` (firestore.rules,
 * `survey_records`). A caller that ignores that gets a permission error, not a silent
 * no-op — which is the intent: the UI must offer "remove confirmation" instead of
 * quietly editing a record other data was adopted from.
 */
export async function updateSurveyRecord(
  recordId: string,
  patch: Partial<SurveyRecord>
): Promise<boolean> {
  try {
    await firestoreQueryService.update<SurveyRecordDoc>(
      'SURVEY_RECORDS',
      recordId,
      patch,
      { touchUpdatedAt: false }
    );
    return true;
  } catch (error) {
    logger.warn('Survey record update failed', { recordId, error });
    return false;
  }
}

/** Remove a record. Rules restrict this to company admins. */
export async function deleteSurveyRecord(recordId: string): Promise<boolean> {
  try {
    await firestoreQueryService.remove('SURVEY_RECORDS', recordId);
    return true;
  } catch (error) {
    logger.warn('Survey record delete failed', { recordId, error });
    return false;
  }
}
