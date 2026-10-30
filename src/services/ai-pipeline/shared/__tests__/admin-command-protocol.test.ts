/**
 * @fileoverview **ΕΝΑ πρωτόκολλο UC module** (N.0.2 · CHECK 3.28, 2026-10-30).
 * @related services/ai-pipeline/shared/admin-command-protocol.ts
 *
 * 🔴 Πρόταση · επιλογή εγκεκριμένης ενέργειας · επιβεβαίωση ήταν αυτολεξεί ίδια σε 13 modules. Η μόνη πραγματική
 * διαφορά — η **πολιτική έγκρισης** (εντολή διαχειριστή ⇒ αυτόματη · αίτημα πελάτη ⇒ ΠΟΤΕ αυτόματη) — δηλώνεται πλέον
 * στο όνομα της κλήσης, και το Π5 κρατά κάθε module πάνω της.
 *
 * | # | Άγκυρα | Μετάλλαξη που τη ρίχνει |
 * |---|---|---|
 * | Π1 | εντολή διαχειριστή: αυτόματη, 1 ενέργεια, κανάλι στα params | — (παρονομαστής) |
 * | Π2 | αίτημα πελάτη: `salesManager`, ΠΟΤΕ αυτόματο | `humanApprovedProposal` → αυτόματη |
 * | Π3 | εγκεκριμένη ενέργεια: τροποποιημένη > προταθείσα· `[]` ΔΕΝ είναι τροποποίηση | αγνοούνται τα `modifiedActions` · `??` αντί μήκους |
 * | Π4 | επιβεβαίωση: πρόθεμα ‖ `confirm_sent:` | χωρίς `confirm_sent:` |
 * | Π5 | κανένα module δεν ξαναγράφει το πρωτόκολλο· κάθε μη-αυτόματη πρόταση = `humanApprovedProposal` | inline `find` · πελάτης σε `autoApprovedProposal` |
 * | Π6 | ΕΝΑ λεξιλόγιο παρενέργειας απάντησης (`reply_sent:` / `reply_failed:`) | αλλαγή προθέματος |
 * | Π7 | απάντηση εντολής: οι προηγούμενες παρενέργειες κρατιούνται, μπροστά | χάνονται τα `priorEffects` |
 * | Π8 | αποτυχία εκτέλεσης: καταγραφή + `{ success: false }` | — |
 */

jest.mock('../channel-reply-dispatcher', () => ({
  sendChannelReply: jest.fn(),
  extractChannelIds: () => ({ telegramChatId: '42' }),
}));

import * as fs from 'fs';
import * as path from 'path';

import type { PipelineAction, PipelineContext } from '@/types/ai-pipeline';
import { sendChannelReply } from '../channel-reply-dispatcher';
import type { Logger } from '@/lib/telemetry/Logger';
import {
  SALES_MANAGER_APPROVAL,
  failedExecution,
  replySideEffect,
  sendCommandReply,
  acknowledgeBySideEffect,
  approvedAction,
  approvedActions,
  autoApprovedProposal,
  hasModifiedActions,
  humanApprovedProposal,
} from '../admin-command-protocol';

const MODULES = path.resolve(__dirname, '../../modules');

function ctxWith(extra: Partial<PipelineContext> = {}): PipelineContext {
  return {
    intake: { id: 'msg_1', channel: 'telegram', rawPayload: { chatId: '42' } },
    ...extra,
  } as unknown as PipelineContext;
}

const action = (type: string, marker: string): PipelineAction => ({ type, params: { marker } });

describe('Π1/Π2 — πρόταση μίας ενέργειας, πολιτική στο όνομα', () => {
  it('🔑 Π1 εντολή διαχειριστή: αυτόματη, με το κανάλι στα params', () => {
    const p = autoApprovedProposal(ctxWith(), 'admin_reply', { a: 1 }, 'σύνοψη');
    expect(p).toMatchObject({ messageId: 'msg_1', requiredApprovals: [], autoApprovable: true, summary: 'σύνοψη' });
    expect(p.suggestedActions).toEqual([{ type: 'admin_reply', params: { a: 1, channel: 'telegram', telegramChatId: '42' } }]);
  });

  it('🔴 Π2 αίτημα πελάτη: έγκριση από salesManager, ΠΟΤΕ αυτόματο', () => {
    const p = humanApprovedProposal(ctxWith(), 'acknowledge_complaint', { a: 1 }, 'σύνοψη');
    expect(p.requiredApprovals).toEqual(['salesManager']);
    expect(p.autoApprovable).toBe(false);
    expect(p.requiredApprovals).not.toBe(SALES_MANAGER_APPROVAL); // αντίγραφο — καμία πρόταση δεν μεταλλάσσει τη σταθερά
  });
});

describe('Π3 — η εγκεκριμένη ενέργεια', () => {
  const proposal = autoApprovedProposal(ctxWith(), 'x', { marker: 'proposed' }, 's');

  it('🔴 τροποποιημένη > προταθείσα', () => {
    const ctx = ctxWith({ proposal, approval: { modifiedActions: [action('x', 'edited')] } as PipelineContext['approval'] });
    expect(approvedAction(ctx, 'x')?.params.marker).toBe('edited');
    expect(hasModifiedActions(ctx)).toBe(true);
  });

  it('🔴 κενή τροποποίηση ΔΕΝ είναι τροποποίηση (ίδιος ορισμός με το inbox) ⇒ εκτελείται η πρόταση', () => {
    const ctx = ctxWith({ proposal, approval: { modifiedActions: [] } as unknown as PipelineContext['approval'] });
    expect(approvedActions(ctx)).toHaveLength(1);
    expect(approvedAction(ctx, 'x')?.params.marker).toBe('proposed');
    expect(hasModifiedActions(ctx)).toBe(false);
  });

  it('🔑 χωρίς έγκριση ⇒ η πρόταση· χωρίς τίποτα ⇒ undefined', () => {
    expect(approvedAction(ctxWith({ proposal }), 'x')?.params.marker).toBe('proposed');
    expect(approvedAction(ctxWith(), 'x')).toBeUndefined();
  });
});

describe('Π4 — επιβεβαίωση από παρενέργειες', () => {
  const ack = (sideEffects: string[]) =>
    acknowledgeBySideEffect(ctxWith({ executionResult: { success: true, sideEffects } } as Partial<PipelineContext>), 'reply_sent:');

  it('🔑 πρόθεμα επιτυχίας ή `confirm_sent:` ⇒ στάλθηκε', () => {
    expect(ack(['reply_sent:m1'])).toEqual({ sent: true, channel: 'telegram' });
    expect(ack(['confirm_sent:m1']).sent).toBe(true);
  });

  it('🔴 καμία από τις δύο ⇒ ΔΕΝ στάλθηκε', () => {
    expect(ack(['email_sent:x']).sent).toBe(false);
    expect(ack([]).sent).toBe(false);
  });
});

describe('Π5 — κανένα module δεν ξαναγράφει το πρωτόκολλο', () => {
  const sources = fs.readdirSync(MODULES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => fs.readdirSync(path.join(MODULES, d.name))
      .filter((f) => /-module\.ts$/.test(f))
      .map((f) => [`${d.name}/${f}`, fs.readFileSync(path.join(MODULES, d.name, f), 'utf8')] as const));

  it('🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ — 13 modules εισάγουν το πρωτόκολλο (αλλιώς το πράσινο θα σήμαινε «δεν κοίταξα»)', () => {
    const users = sources.filter(([, text]) => text.includes("from '../../shared/admin-command-protocol'"));
    expect(users.length).toBeGreaterThanOrEqual(13);
  });

  it('🔴 καμία επιλογή ενέργειας ή επιβεβαίωση γραμμένη με το χέρι', () => {
    const inline = sources
      .filter(([, text]) => /modifiedActions\s*\?\?|sideEffects\?\.some\(|suggestedActions:\s*\[/.test(text))
      .map(([file]) => file);
    expect(inline).toEqual([]);
  });

  it('🔴 κάθε αίτημα πελάτη (UC-001…009) περνά από `humanApprovedProposal` — ΠΟΤΕ αυτόματο', () => {
    const customer = sources.filter(([file]) => /^uc-00\d-/.test(file) && /\bpropose\(/.test(fs.readFileSync(path.join(MODULES, file), 'utf8')));
    expect(customer.length).toBeGreaterThanOrEqual(5);
    const auto = customer.filter(([, text]) => !text.includes('humanApprovedProposal(') || text.includes('autoApprovedProposal(')).map(([f]) => f);
    expect(auto).toEqual([]);
  });
});

describe('Π6–Π8 — απάντηση και αποτυχία εντολής', () => {
  const send = sendChannelReply as jest.MockedFunction<typeof sendChannelReply>;

  it('🔑 Π6 ΕΝΑ λεξιλόγιο παρενέργειας απάντησης', () => {
    expect(replySideEffect({ success: true, messageId: 'm1' })).toBe('reply_sent:m1');
    expect(replySideEffect({ success: false, error: 'down' })).toBe('reply_failed:down');
    expect(replySideEffect({ success: true })).toBe('reply_sent:unknown');
  });

  it('🔴 Π7 οι προηγούμενες παρενέργειες κρατιούνται, μπροστά από την απάντηση', async () => {
    send.mockResolvedValueOnce({ success: true, messageId: 'm2' } as Awaited<ReturnType<typeof sendChannelReply>>);
    const result = await sendCommandReply(ctxWith({ requestId: 'r1' } as Partial<PipelineContext>), 'Θέμα', 'κείμενο', ['ai_conversational:5ms']);
    expect(result).toEqual({ success: true, sideEffects: ['ai_conversational:5ms', 'reply_sent:m2'] });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Θέμα', textBody: 'κείμενο', telegramChatId: '42' }));
  });

  it('🔑 Π8 αποτυχία εκτέλεσης: καταγραφή στο κανάλι του module, χωρίς παρενέργειες', () => {
    const logger = { error: jest.fn() } as unknown as Logger;
    expect(failedExecution(ctxWith({ requestId: 'r1' } as Partial<PipelineContext>), 'UC-014', logger, new Error('boom')))
      .toEqual({ success: false, sideEffects: [], error: 'boom' });
    expect(logger.error).toHaveBeenCalledWith('UC-014 EXECUTE: Failed', { requestId: 'r1', error: 'boom' });
  });

  it('🔴 Π5β κάθε `return … sendCommandReply(` μέσα σε `try` έχει `await` (αλλιώς η αποτυχία αποστολής ξεφεύγει από το `catch`)', () => {
    const dir = path.resolve(__dirname, '../../modules');
    const bare = fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => /-module\.ts$/.test(f))
      .filter((f) => /return sendCommandReply\(/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(bare).toEqual([]);
  });
});
