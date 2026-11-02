/**
 * 🔐 ΣΗΜΕΙΟ ΕΠΙΒΟΛΗΣ (ADR-257 · OWASP LLM06 «complete mediation»)
 *
 * Το εργαλείο κρίνεται σε ΚΑΘΕ κλήση, έξω από το μοντέλο, με τον ΠΡΑΓΜΑΤΙΚΟ ρόλο και τους ΠΡΑΓΜΑΤΙΚΟΥΣ handlers.
 *
 * @module __tests__/tool-access-enforcement
 */

import './setup';

import { AgenticToolExecutor } from '../agentic-tool-executor';
import { createAdminContext, createCustomerContext } from './test-utils/context-factory';

const DENIED = { success: false, error: 'Δεν έχετε πρόσβαση σε αυτή την ενέργεια.' };

const buyer = () => createCustomerContext({
  _resolvedAccess: jest.requireActual('@/config/ai-role-access-matrix').AI_ROLE_ACCESS_MATRIX.buyer,
});

function spyOnHandlerOf(executor: AgenticToolExecutor, tool: string): jest.SpyInstance {
  const handler = (executor as unknown as { handlerMap: Map<string, { execute: () => unknown }> }).handlerMap.get(tool);
  if (!handler) throw new Error(`no handler for ${tool}`);
  return jest.spyOn(handler, 'execute').mockResolvedValue({ success: true } as never);
}

describe('🔐 σημείο επιβολής', () => {
  it('πελάτης που ζητά διαχειριστικό εργαλείο ⇒ άρνηση χωρίς να αγγιχτεί ο handler', async () => {
    const executor = new AgenticToolExecutor();
    const spy = spyOnHandlerOf(executor, 'send_telegram_message');
    expect(await executor.executeTool('send_telegram_message', {}, buyer())).toEqual(DENIED);
    expect(spy).not.toHaveBeenCalled();
  });

  it('πελάτης + όνομα που δεν υπάρχει ⇒ ίδια άρνηση: δεν μαθαίνει ποια εργαλεία υπάρχουν', async () => {
    expect(await new AgenticToolExecutor().executeTool('made_up_tool', {}, buyer())).toEqual(DENIED);
  });

  it('πελάτης + δικό του εργαλείο ⇒ φτάνει στον handler', async () => {
    const executor = new AgenticToolExecutor();
    const spy = spyOnHandlerOf(executor, 'search_knowledge_base');
    expect((await executor.executeTool('search_knowledge_base', { query: 'x' }, buyer())).success).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('διαχειριστής ⇒ φτάνει στον handler', async () => {
    const executor = new AgenticToolExecutor();
    const spy = spyOnHandlerOf(executor, 'send_telegram_message');
    await executor.executeTool('send_telegram_message', {}, createAdminContext());
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
