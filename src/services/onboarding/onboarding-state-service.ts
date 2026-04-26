/**
 * Onboarding State Service — ADR-326 Phase 8
 *
 * Reads/writes companies/{companyId}.settings.onboarding.
 * Server-only: uses Admin SDK directly.
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import {
  isRemindEligible,
  type OnboardingState,
  type CompanyOnboardingRecord,
} from './onboarding-types';

export type { OnboardingState, CompanyOnboardingRecord };
export { isRemindEligible };

const logger = createModuleLogger('OnboardingStateService');

// ─── Firestore reads/writes ───────────────────────────────────────────────────

export async function getOnboardingState(companyId: string): Promise<OnboardingState | null> {
  try {
    const snap = await getAdminFirestore()
      .collection(COLLECTIONS.COMPANIES)
      .doc(companyId)
      .get();

    if (!snap.exists) return null;

    const raw = (snap.data() as { settings?: { onboarding?: OnboardingState } })
      .settings?.onboarding ?? null;

    return raw;
  } catch (err) {
    logger.error('getOnboardingState failed', { companyId, err: getErrorMessage(err) });
    return null;
  }
}

export async function markSkipped(companyId: string, userId: string): Promise<void> {
  const skippedAt = nowISO();

  await getAdminFirestore()
    .collection(COLLECTIONS.COMPANIES)
    .doc(companyId)
    .update({
      'settings.onboarding': {
        skippedAt,
        skippedBy: userId,
        completedAt: null,
        completedBy: null,
      },
    });

  // ADR-195 — Entity audit trail (onboarding skipped on companies/{companyId})
  const { EntityAuditService } = await import('@/services/entity-audit.service');
  const { ENTITY_TYPES } = await import('@/config/domain-constants');
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: null,
    action: 'updated',
    changes: [
      { field: 'settings.onboarding.skippedAt', oldValue: null, newValue: skippedAt, label: 'Onboarding Skipped At' },
      { field: 'settings.onboarding.skippedBy', oldValue: null, newValue: userId, label: 'Onboarding Skipped By' },
    ],
    performedBy: userId,
    performedByName: null,
    companyId,
  });

  logger.info('Onboarding skipped', { companyId, userId });
}

export async function markCompleted(companyId: string, userId: string): Promise<void> {
  const completedAt = nowISO();

  await getAdminFirestore()
    .collection(COLLECTIONS.COMPANIES)
    .doc(companyId)
    .update({
      'settings.onboarding.completedAt': completedAt,
      'settings.onboarding.completedBy': userId,
    });

  // ADR-195 — Entity audit trail (onboarding completed on companies/{companyId})
  const { EntityAuditService } = await import('@/services/entity-audit.service');
  const { ENTITY_TYPES } = await import('@/config/domain-constants');
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: null,
    action: 'updated',
    changes: [
      { field: 'settings.onboarding.completedAt', oldValue: null, newValue: completedAt, label: 'Onboarding Completed At' },
      { field: 'settings.onboarding.completedBy', oldValue: null, newValue: userId, label: 'Onboarding Completed By' },
    ],
    performedBy: userId,
    performedByName: null,
    companyId,
  });

  logger.info('Onboarding completed', { companyId, userId });
}

// ─── Cron scanner ────────────────────────────────────────────────────────────

export async function findCompaniesNeedingReminder(): Promise<CompanyOnboardingRecord[]> {
  const db = getAdminFirestore();
  const companiesSnap = await db.collection(COLLECTIONS.COMPANIES).get();

  const eligible: CompanyOnboardingRecord[] = [];

  for (const doc of companiesSnap.docs) {
    const data = doc.data() as { settings?: { onboarding?: OnboardingState } };
    const state = data.settings?.onboarding;

    if (!state?.skippedAt || state.completedAt) continue;
    if (!isRemindEligible(state.skippedAt)) continue;

    const adminEmail = await findCompanyAdminEmail(doc.id);
    if (!adminEmail) continue;

    eligible.push({ companyId: doc.id, adminEmail, skippedAt: state.skippedAt });
  }

  return eligible;
}

async function findCompanyAdminEmail(companyId: string): Promise<string | null> {
  try {
    const usersSnap = await getAdminFirestore()
      .collection(COLLECTIONS.USERS)
      .where('companyId', '==', companyId)
      .where('globalRole', '==', 'company_admin')
      .limit(1)
      .get();

    if (usersSnap.empty) return null;

    const userData = usersSnap.docs[0].data() as { email?: string };
    return userData.email ?? null;
  } catch {
    return null;
  }
}
