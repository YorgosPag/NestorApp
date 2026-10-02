/**
 * ADR-898 Φ3β-2 — η σειριακή ουρά μερικών διορθώσεων: ένα αίτημα στον αέρα · συγχώνευση στο μεταξύ · επικάλυψη που
 * σβήνει μόνο όταν ο αναγνώστης φέρει την αλήθεια · επαναφορά σε αποτυχία.
 */

import { createFieldPatchQueue, type FieldPatchOutcome } from '../field-patch-queue';

type Patch = Partial<{ a: number; b: number; c: number }>;

/** Ένας server που απαντά όταν του πούμε — για να ελέγξουμε τη σειρά. */
function controllableServer() {
  const calls: { patch: Patch; answer: (outcome: FieldPatchOutcome<string>) => void }[] = [];
  const send = (patch: Patch) =>
    new Promise<FieldPatchOutcome<string>>((resolve) => {
      calls.push({ patch, answer: resolve });
    });
  return { calls, send };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createFieldPatchQueue', () => {
  it('ΕΝΑ αίτημα στον αέρα· όσα έρθουν στο μεταξύ φεύγουν ΣΥΓΧΩΝΕΥΜΕΝΑ σε ένα επόμενο (τελευταίο ανά πεδίο)', async () => {
    const server = controllableServer();
    const queue = createFieldPatchQueue<Patch, string>(server.send);
    queue.enqueue({ a: 1 });
    queue.enqueue({ b: 2 });
    queue.enqueue({ b: 3, c: 4 });
    expect(server.calls.map((call) => call.patch)).toEqual([{ a: 1 }]);
    server.calls[0]?.answer({ kind: 'saved' });
    await flush();
    expect(server.calls.map((call) => call.patch)).toEqual([{ a: 1 }, { b: 3, c: 4 }]);
  });

  it('επικάλυψη = ό,τι δεν έφερε ο αναγνώστης: μένει μετά το «ναι» του server, σβήνει με τη νέα αλήθεια', async () => {
    const server = controllableServer();
    const queue = createFieldPatchQueue<Patch, string>(server.send);
    queue.enqueue({ a: 1 });
    expect(queue.getSnapshot()).toMatchObject({ overlay: { a: 1 }, status: 'saving' });
    server.calls[0]?.answer({ kind: 'saved' });
    await flush();
    expect(queue.getSnapshot()).toMatchObject({ overlay: { a: 1 }, status: 'success' });
    queue.sourceChanged();
    expect(queue.getSnapshot().overlay).toBeNull();
  });

  it('η νέα αλήθεια ΔΕΝ σβήνει ό,τι είναι ακόμη στον αέρα ή στην ουρά', async () => {
    const server = controllableServer();
    const queue = createFieldPatchQueue<Patch, string>(server.send);
    queue.enqueue({ a: 1 });
    queue.enqueue({ b: 2 });
    queue.sourceChanged();
    expect(queue.getSnapshot().overlay).toEqual({ a: 1, b: 2 });
  });

  it('αποτυχία ⇒ το κομμάτι φεύγει από την επικάλυψη (επαναφορά) και μένει ως `failure`· η επανάληψη το ξαναστέλνει', async () => {
    const server = controllableServer();
    const queue = createFieldPatchQueue<Patch, string>(server.send);
    queue.enqueue({ a: 1 });
    server.calls[0]?.answer({ kind: 'failed' });
    await flush();
    expect(queue.getSnapshot()).toMatchObject({ overlay: null, status: 'error', failure: { patch: { a: 1 } } });
    queue.retry();
    expect(server.calls.map((call) => call.patch)).toEqual([{ a: 1 }, { a: 1 }]);
    expect(queue.getSnapshot().failure).toBeNull();
  });

  it('άρνηση με κωδικούς ⇒ καμία επανάληψη (δεν θα βοηθούσε)', async () => {
    const server = controllableServer();
    const queue = createFieldPatchQueue<Patch, string>(server.send);
    queue.enqueue({ a: 1 });
    server.calls[0]?.answer({ kind: 'rejected', reasons: ['permitDateInFuture'] });
    await flush();
    expect(queue.getSnapshot().failure).toEqual({ patch: { a: 1 }, outcome: { kind: 'rejected', reasons: ['permitDateInFuture'] } });
    queue.retry();
    expect(server.calls).toHaveLength(1);
  });

  it('νεότερη απάντηση στο ίδιο πεδίο αποσύρει την αποτυχία του· στην επανάληψη νικά η νεότερη', async () => {
    const server = controllableServer();
    const queue = createFieldPatchQueue<Patch, string>(server.send);
    queue.enqueue({ a: 1, b: 1 });
    server.calls[0]?.answer({ kind: 'failed' });
    await flush();
    queue.enqueue({ a: 9 });
    expect(queue.getSnapshot().failure).toMatchObject({ patch: { b: 1 } });
    queue.retry();
    server.calls[1]?.answer({ kind: 'saved' });
    await flush();
    expect(server.calls.map((call) => call.patch)).toEqual([{ a: 1, b: 1 }, { a: 9 }, { b: 1 }]);
  });

  it('`send` που ρίχνει μετρά ως `failed` — η ουρά δεν κολλά', async () => {
    const queue = createFieldPatchQueue<Patch, string>(() => Promise.reject(new Error('δίκτυο')));
    queue.enqueue({ a: 1 });
    await flush();
    expect(queue.getSnapshot()).toMatchObject({ status: 'error', failure: { outcome: { kind: 'failed' } } });
    expect(queue.isBusy()).toBe(false);
  });

  it('ειδοποιεί τους συνδρομητές και κρατά σταθερό στιγμιότυπο ανάμεσα στις αλλαγές (useSyncExternalStore)', () => {
    const queue = createFieldPatchQueue<Patch, string>(controllableServer().send);
    const listener = jest.fn();
    const unsubscribe = queue.subscribe(listener);
    const before = queue.getSnapshot();
    expect(queue.getSnapshot()).toBe(before);
    queue.enqueue({ a: 1 });
    expect(listener).toHaveBeenCalled();
    expect(queue.getSnapshot()).not.toBe(before);
    unsubscribe();
  });
});
