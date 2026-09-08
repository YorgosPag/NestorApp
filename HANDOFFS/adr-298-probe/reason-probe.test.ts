import { initEmulator, teardownEmulator, resetData } from 'C:/Nestor_Pagonis/tests/firestore-rules/_harness/emulator';
import { getContext } from 'C:/Nestor_Pagonis/tests/firestore-rules/_harness/auth-contexts';
import { seedContact } from 'C:/Nestor_Pagonis/tests/firestore-rules/_harness/seed-helpers';
import { SAME_TENANT_COMPANY_ID } from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await initEmulator(); });
afterAll(async () => { await teardownEmulator(env); });
afterEach(async () => { await resetData(env); });

const PERSONAS = ['anonymous', 'cross_tenant_user', 'cross_tenant_admin', 'external_user'] as const;

it('what does a denial actually carry?', async () => {
  for (const p of PERSONAS) {
    await seedContact(env, 'c1', { companyId: SAME_TENANT_COMPANY_ID });
    const ctx = getContext(env, p);
    try {
      await ctx.firestore().collection('contacts').doc('c1').delete();
      console.log(`[${p}] NO ERROR (allowed)`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      console.log(`[${p}] code=${String(err.code)} message=${String(err.message).replace(/\s+/g, ' ').slice(0, 300)}`);
    }
    await resetData(env);
  }
});
