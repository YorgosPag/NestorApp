/**
 * Firestore Rules — `messages` collection
 *
 * Pattern: tenant_direct. The messaging pipeline is a high-volume, multi-
 * channel collection (email, telegram, viber) driven by Mailgun webhooks
 * and the AI inbox. Tenant isolation here is load-bearing for every
 * customer conversation.
 *
 * Extra invariants beyond the baseline matrix: channel + direction enum
 * values must match the allowlist declared in the rule body.
 *
 * See ADR-298 §3.3.
 *
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedMessage } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'messages',
)!;

describe('messages.rules — tenant_direct pattern (critical messaging path)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'msg-same-tenant';
        await seedMessage(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'messages',
          docId,
          // Update payload — isValidMessageData (firestore.rules:3268)
          // requires conversationId, direction, channel, content.text. The
          // seed already sets these; include them here so the merged doc
          // remains valid against the rule.
          data: {
            conversationId: `conv-${docId}`,
            channel: 'email',
            direction: 'inbound',
            content: { text: 'Mutated body' },
            status: 'read',
            subject: 'Mutated subject',
            companyId: SAME_TENANT_COMPANY_ID,
          },
          // Fresh-doc create payload — must independently satisfy
          // isValidMessageData plus companyId matching user claims.
          createData: {
            conversationId: 'conv-new',
            channel: 'email',
            direction: 'inbound',
            content: { text: 'Created body' },
            status: 'received',
            subject: 'Created subject',
            companyId: SAME_TENANT_COMPANY_ID,
          },
          listFilter: {
            field: 'companyId',
            op: '==',
            value: SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
