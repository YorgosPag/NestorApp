/**
 * @jest-environment node
 *
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ ΧΩΡΩΝ** (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ9) — καθαρές μεταβάσεις + η απάντηση του
 * ανιχνευτή ⇒ πρόταση με οριστικό id που ΔΕΝ αλλάζει σε επανανίχνευση.
 */

import type { PlanDetectResult } from '@/lib/spatial-tour/space-detect/space-detect-plan';
import type { WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';

import {
  INITIAL_SPACE_EDITOR,
  dropProposal,
  putProposal,
  selectTarget,
  selectionKey,
  setSelectedPoints,
  setTool,
} from '../space-editor-store';
import { applyDetectReply } from '../useSpaceProposals';

const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const ok = (outline = rect(5, -1, 9, -4)): WorkerRpcResult<PlanDetectResult> =>
  ({ kind: 'ok', value: { ok: true, outline, orthogonal: true, areaM2: 12, separation: null } });
const ASKED = { seed: { x: 7, y: -2 }, seedNodeId: 'b', select: true };

describe('applyDetectReply', () => {
  it('νέα πρόταση ⇒ ΝΕΟ οριστικό id + επιλογή · ίδια ερώτηση ξανά ⇒ ΙΔΙΟ id (ποτέ δεύτερο σχήμα)', () => {
    const mint = jest.fn().mockReturnValueOnce('tspc_a').mockReturnValueOnce('tspc_b');
    const once = applyDetectReply(INITIAL_SPACE_EDITOR, ok(), ASKED, mint);
    expect(once.proposals).toHaveLength(1);
    expect(once.proposals[0]).toMatchObject({ key: 'node:b', spaceId: 'tspc_a', source: 'detected', areaM2: 12 });
    expect(once.selection).toEqual({ kind: 'proposal', key: 'node:b' });
    const twice = applyDetectReply(once, ok(rect(5, -1, 9.5, -4)), ASKED, mint);
    expect(twice.proposals).toHaveLength(1);
    expect(twice.proposals[0].spaceId).toBe('tspc_a');
    expect(twice.proposals[0].outline[1]).toEqual({ x: 9.5, y: -1 });
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('άρνηση ⇒ ονομασμένη ειδοποίηση · αποτυχία κάτοψης ⇒ `plan-unavailable` · άλλη ⇒ `failed` · superseded ⇒ τίποτα', () => {
    const mint = () => 'x';
    const refused: WorkerRpcResult<PlanDetectResult> = { kind: 'ok', value: { ok: false, refusal: 'leak' } };
    expect(applyDetectReply(INITIAL_SPACE_EDITOR, refused, ASKED, mint).notice).toBe('leak');
    expect(applyDetectReply(INITIAL_SPACE_EDITOR, { kind: 'failed', error: 'plan-unavailable' }, ASKED, mint).notice).toBe('plan-unavailable');
    expect(applyDetectReply(INITIAL_SPACE_EDITOR, { kind: 'failed', error: 'boom' }, ASKED, mint).notice).toBe('failed');
    expect(applyDetectReply(INITIAL_SPACE_EDITOR, { kind: 'superseded' }, ASKED, mint)).toBe(INITIAL_SPACE_EDITOR);
  });

  it('κλικ χωρίς σημείο ⇒ κλειδί του κλικ · επιτυχία σβήνει την προηγούμενη ειδοποίηση', () => {
    const withNotice = { ...INITIAL_SPACE_EDITOR, notice: 'leak' as const };
    const next = applyDetectReply(withNotice, ok(), { seed: { x: 1.234, y: -2 }, seedNodeId: null, select: false }, () => 'tspc_c');
    expect(next.proposals[0].key).toBe('seed:1.23,-2');
    expect(next.notice).toBeNull();
    expect(next.selection).toBeNull();
  });
});

describe('μεταβάσεις', () => {
  const proposal = applyDetectReply(INITIAL_SPACE_EDITOR, ok(), ASKED, () => 'tspc_a');

  it('γωνίες πρότασης ⇒ ΜΕΣΑ στην πρόταση · γωνίες χώρου ⇒ στο πρόχειρο `edit`', () => {
    const moved = setSelectedPoints(proposal, rect(0, 0, 1, -1));
    expect(moved.proposals[0].outline).toEqual(rect(0, 0, 1, -1));
    expect(moved.edit).toBeNull();
    const space = setSelectedPoints(selectTarget(proposal, { kind: 'space', id: 'S1' }), rect(0, 0, 2, -2));
    expect(space.edit).toEqual({ spaceId: 'S1', points: rect(0, 0, 2, -2) });
  });

  it('άλλη επιλογή ⇒ το πρόχειρο εγκαταλείπεται · ίδια επιλογή ⇒ ίδια κατάσταση', () => {
    const editing = setSelectedPoints(selectTarget(proposal, { kind: 'space', id: 'S1' }), rect(0, 0, 2, -2));
    expect(selectTarget(editing, { kind: 'space', id: 'S1' })).toBe(editing);
    expect(selectTarget(editing, { kind: 'separation', id: 'g' }).edit).toBeNull();
  });

  it('η πρόταση φεύγει μαζί με την επιλογή της · νέο εργαλείο ⇒ η πένα αδειάζει', () => {
    expect(dropProposal(proposal, 'node:b')).toMatchObject({ proposals: [], selection: null });
    const pen = { ...proposal, tool: 'pen' as const, pen: [{ x: 1, y: 1 }] };
    expect(setTool(pen, 'select')).toMatchObject({ tool: 'select', pen: [], penHover: null });
    expect(putProposal(proposal, proposal.proposals[0], false).proposals).toHaveLength(1);
  });

  it('κλειδιά επιλογής — διακριτά ανά είδος', () => {
    expect(selectionKey({ kind: 'proposal', key: 'node:b' })).toBe('proposal:node:b');
    expect(selectionKey({ kind: 'space', id: 'x' })).not.toBe(selectionKey({ kind: 'separation', id: 'x' }));
    expect(selectionKey(null)).toBeNull();
  });
});
