/**
 * Firestore Rules Test Harness — Messaging Document Seeders
 *
 * Seeders for the messaging-domain collections: `conversations` and
 * `external_identities`. Extracted into a dedicated module because
 * `seed-helpers.ts` is at the 500-line Google SRP limit (ADR-298 Phase B.5,
 * 2026-04-13).
 *
 * Contract: every seeder defaults `createdBy` to `same_tenant_user.uid` so
 * that `same_tenant_user × update/delete` cells can exercise the
 * `createdBy == request.auth.uid` path without a per-cell seed override.
 * This mirrors the `CrmSeedOptions` pattern used in `seed-helpers.ts`.
 *
 * See ADR-298 §4 Phase B.5.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-messaging
 * @since 2026-04-13 (ADR-298 Phase B.5)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { SeedOptions } from './seed-helpers';

const DEFAULT_CREATED_BY = 'seed-system';

/** Seed options for messaging collections that carry a `createdBy` field. */
export interface MessagingSeedOptions extends SeedOptions {
  /** uid stored in `createdBy`. Defaults to `same_tenant_user.uid`. */
  readonly createdByUid?: string;
}

/**
 * Seed a `conversations` document.
 *
 * The create rule (firestore.rules:1726) requires `isValidConversationData`,
 * which mandates `channel` and `status` with valid enum values:
 *   - channel: 'telegram' | 'email' | 'whatsapp' | 'sms'
 *   - status:  'active' | 'archived' | 'closed' | 'spam'
 *
 * The update rule also validates via `isValidConversationData(request.resource.data)`.
 * Since Firestore update() merges with the existing doc, keeping `channel` and
 * `status` in the seed means the merged doc satisfies the validator even when
 * the update delta only touches `status`.
 *
 * Default `createdBy = same_tenant_user.uid` exercises the `createdBy == uid`
 * update/delete path for same_tenant_user.
 */
export async function seedConversation(
  env: RulesTestEnvironment,
  convId: string,
  opts?: MessagingSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('conversations').doc(convId).set({
      channel: 'email',
      status: 'active',
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed an `external_identities` document.
 *
 * Maps an external platform id (e.g. Telegram chatId) to an internal contact.
 * Create rule requires `companyId == getUserCompanyId()` and `resource == null`.
 * Update rule checks `createdBy == uid || isCompanyAdminOfCompany || isSuperAdminOnly`
 * plus companyId immutability.
 *
 * Default `createdBy = same_tenant_user.uid` exercises the `createdBy == uid`
 * update/delete path for same_tenant_user.
 */
export async function seedExternalIdentity(
  env: RulesTestEnvironment,
  identityId: string,
  opts?: MessagingSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('external_identities').doc(identityId).set({
      platform: 'telegram',
      externalId: `ext-${identityId}`,
      contactId: `contact-${identityId}`,
      companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
      createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      createdAt: new Date(),
      ...opts?.overrides,
    });
  });
}
