/**
 * ADR-692 Φ2 — applyDxfMarqueeSelection: το marquee πάνω σε raw DXF οντότητες.
 * Ελέγχει ότι οι αφαιρέσεις γίνονται ΠΡΙΝ τις προσθήκες και ότι το `previousIds`
 * (φωτογραφία πριν την BIM εγγραφή) είναι η βάση του add/subtract.
 */

import { applyDxfMarqueeSelection, type DxfMarqueeSelectionOps } from '../resolve-dxf-marquee-selection';

function createOps(): DxfMarqueeSelectionOps & { added: string[][]; removed: string[] } {
  const added: string[][] = [];
  const removed: string[] = [];
  return {
    added,
    removed,
    add: (ids) => { added.push([...ids]); },
    remove: (id) => { removed.push(id); },
  };
}

describe('applyDxfMarqueeSelection', () => {
  it('replace: σβήνει τα παλιά που δεν ξαναπιάστηκαν και προσθέτει τα hits', () => {
    const ops = createOps();
    applyDxfMarqueeSelection(['a', 'b'], ['b', 'c'], 'replace', ops);
    expect(ops.removed).toEqual(['a']);
    expect(ops.added).toEqual([['b', 'c']]);
  });

  it('replace χωρίς hits: καθαρίζει τα πάντα, καμία προσθήκη', () => {
    const ops = createOps();
    applyDxfMarqueeSelection(['a', 'b'], [], 'replace', ops);
    expect(ops.removed).toEqual(['a', 'b']);
    expect(ops.added).toEqual([]);
  });

  it('add (Shift): κρατά την προηγούμενη επιλογή — καμία αφαίρεση', () => {
    const ops = createOps();
    applyDxfMarqueeSelection(['a'], ['b'], 'add', ops);
    expect(ops.removed).toEqual([]);
    expect(ops.added).toEqual([['a', 'b']]);
  });

  it('subtract (Ctrl): αφαιρεί τα hits, ξαναγράφει τα υπόλοιπα', () => {
    const ops = createOps();
    applyDxfMarqueeSelection(['a', 'b', 'c'], ['b'], 'subtract', ops);
    expect(ops.removed).toEqual(['b']);
    expect(ops.added).toEqual([['a', 'c']]);
  });

  it('κενή προηγούμενη επιλογή + κενά hits: τίποτα δεν συμβαίνει', () => {
    const ops = createOps();
    applyDxfMarqueeSelection([], [], 'replace', ops);
    expect(ops.removed).toEqual([]);
    expect(ops.added).toEqual([]);
  });
});
