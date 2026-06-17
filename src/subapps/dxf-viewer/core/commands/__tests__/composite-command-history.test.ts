/**
 * ADR-459 Φ7 — CompositeCommand + CommandHistory.appendToLast (atomic undo group).
 *
 * Locks the Revit transaction-group invariant: μια ενέργεια χρήστη + η παράγωγη
 * (associative) ενημέρωση = ΕΝΑ undo step. Ένα undo αναιρεί ΚΑΙ ΤΑ ΔΥΟ, σε
 * αντίστροφη σειρά — ο χρήστης ΠΟΤΕ δεν μένει σε ασυνεπή ενδιάμεση κατάσταση.
 */

import { CompositeCommand } from '../CompositeCommand';
import { CommandHistory } from '../CommandHistory';
import { DEFAULT_HISTORY_CONFIG } from '../interfaces';
import type { ICommand, SerializedCommand } from '../interfaces';

const WINDOW = DEFAULT_HISTORY_CONFIG.mergeConfig.mergeTimeWindow;

function fakeCmd(id: string, timestamp: number, log: string[]): ICommand {
  return {
    id,
    name: id,
    type: 'fake',
    timestamp,
    execute: () => log.push(`exec:${id}`),
    undo: () => log.push(`undo:${id}`),
    redo: () => log.push(`redo:${id}`),
    getDescription: () => id,
    getAffectedEntityIds: () => [id],
    serialize: (): SerializedCommand => ({ type: 'fake', id, name: id, timestamp, data: {}, version: 1 }),
  };
}

describe('CompositeCommand', () => {
  it('executes children forward, undoes in REVERSE, redoes forward', () => {
    const log: string[] = [];
    const c = new CompositeCommand([fakeCmd('a', 1, log), fakeCmd('b', 2, log)]);
    c.execute();
    expect(log).toEqual(['exec:a', 'exec:b']);
    log.length = 0;
    c.undo();
    expect(log).toEqual(['undo:b', 'undo:a']); // reverse = nested transaction unwind
    log.length = 0;
    c.redo();
    expect(log).toEqual(['redo:a', 'redo:b']);
  });

  it('append grows the group; size + affected ids reflect all children', () => {
    const log: string[] = [];
    const c = new CompositeCommand([fakeCmd('a', 1, log)]);
    c.add(fakeCmd('b', 2, log));
    expect(c.size()).toBe(2);
    expect(c.getAffectedEntityIds().sort()).toEqual(['a', 'b']);
  });
});

describe('CommandHistory.appendToLast', () => {
  it('groups the derived command with the previous entry into ONE undo step', () => {
    const log: string[] = [];
    const h = new CommandHistory();
    h.execute(fakeCmd('col', 1000, log)); // user edit (e.g. column rotate)
    log.length = 0;
    h.appendToLast(fakeCmd('footing', 1000 + WINDOW - 1, log)); // derived re-derive (within window)

    expect(log).toEqual(['exec:footing']); // appendToLast executes the derived cmd
    expect(h.size()).toBe(1); // ΕΝΑ entry (composite), όχι δύο

    log.length = 0;
    h.undo(); // ΕΝΑ undo → αναιρεί ΚΑΙ ΤΑ ΔΥΟ
    expect(log).toEqual(['undo:footing', 'undo:col']);
    expect(h.canUndo()).toBe(false);

    log.length = 0;
    h.redo();
    expect(log).toEqual(['redo:col', 'redo:footing']);
  });

  it('falls back to a standalone entry when the previous command is outside the window', () => {
    const log: string[] = [];
    const h = new CommandHistory();
    h.execute(fakeCmd('old', 1000, log));
    h.appendToLast(fakeCmd('unrelated', 1000 + WINDOW + 1, log)); // too old → standalone
    expect(h.size()).toBe(2);
  });

  it('falls back to a standalone push when the stack is empty', () => {
    const log: string[] = [];
    const h = new CommandHistory();
    h.appendToLast(fakeCmd('solo', 1, log));
    expect(log).toEqual(['exec:solo']);
    expect(h.size()).toBe(1);
  });

  it('extends an existing composite in place (second derived append)', () => {
    const log: string[] = [];
    const h = new CommandHistory();
    const t = 5000;
    h.execute(fakeCmd('col', t, log));
    h.appendToLast(fakeCmd('f1', t + 1, log));
    h.appendToLast(fakeCmd('f2', t + 2, log)); // last is now a CompositeCommand
    expect(h.size()).toBe(1);
    log.length = 0;
    h.undo();
    expect(log).toEqual(['undo:f2', 'undo:f1', 'undo:col']);
  });
});
