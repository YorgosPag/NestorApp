/**
 * @jest-environment jsdom
 *
 * ADR-911 Φ3β — το πάνελ του βοηθού, πάνω στην ΠΡΑΓΜΑΤΙΚΗ πρόταση του σχεδίου δοκιμής.
 *
 *   · η έγκριση είναι κλειδωμένη όσο εκκρεμεί ομάδα πάχους, και γράφει τον αριθμό·
 *   · κάθε απόφαση φεύγει προς τα πάνω — το πάνελ δεν γράφει τίποτα μόνο του·
 *   · το υπόμνημα δείχνει κάθε κατάσταση με το μοτίβο γραμμής του καμβά·
 *   · κάθε ειδοποίηση έχει δικό της κείμενο (καμία σιωπηλή άρνηση).
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import type { Entity } from '../../../../types/entities';
import type { WallCategory } from '../../../../bim/types/wall-types';
import { computeWallProposal, type WallProposal } from '../../../../bim/model-from-drawing/wall-proposal';
import fixture from '../../../../bim/model-from-drawing/__tests__/fixtures/floor-plan-lines.json';
import { PREVIEW_ZONE_STYLE } from '../../../../systems/region-preview/preview-zone-style';
import { ASSISTANT_STATUS_ORDER, ASSISTANT_STATUS_TONE } from '../../../../systems/model-from-drawing/assistant-status-tone';
import type {
  ModelFromDrawingNotice,
  ModelFromDrawingState,
} from '../../../../systems/model-from-drawing/model-from-drawing-store';
import { ModelFromDrawingPanel, type ModelFromDrawingPanelActions } from '../ModelFromDrawingPanel';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key),
  }),
}));

// Ο φλοιός (συρόμενο FloatingPanel) δεν είναι το αντικείμενο του test.
jest.mock('../../topography/TopoReviewPanel', () => ({
  TopoReviewPanel: ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
    <section data-testid="shell" aria-label={title}>
      <button type="button" data-testid="shell-close" onClick={onClose} />
      {children}
    </section>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <span data-testid="select" data-value={value} onClick={() => onValueChange('partition')}>{children}</span>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

const ENTITIES = fixture.entities as unknown as readonly Entity[];
const colorOf = (e: Entity): string | null => (e as { color?: string }).color?.toLowerCase() ?? null;

function propose(confirmed: ReadonlyMap<number, WallCategory> = new Map()): WallProposal {
  return computeWallProposal({
    entities: ENTITIES, wallColorHex: '#003fff', colorOf, sceneUnits: 'mm', levelId: 'lvl',
    categoryByThicknessMm: confirmed,
  });
}

const UNCONFIRMED = propose();
const ALL_CONFIRMED = propose(new Map(UNCONFIRMED.groups.map((g) => [g.thicknessMm, g.suggestedCategory] as const)));

function stateOf(patch: Partial<ModelFromDrawingState> = {}): ModelFromDrawingState {
  return {
    phase: 'review',
    pendingSample: null,
    wallColorHex: '#003fff',
    acceptedKeys: new Set(),
    categoryByThicknessMm: new Map(),
    proposal: UNCONFIRMED,
    preview: null,
    focusedKey: null,
    notice: null,
    ...patch,
  };
}

function actionsMock(): jest.Mocked<ModelFromDrawingPanelActions> {
  return {
    onClose: jest.fn(), onResample: jest.fn(), onConfirmGroup: jest.fn(),
    onSetUndecided: jest.fn(), onFocus: jest.fn(), onApprove: jest.fn(),
  };
}

function renderPanel(patch: Partial<ModelFromDrawingState> = {}) {
  const actions = actionsMock();
  const view = render(<ModelFromDrawingPanel state={stateOf(patch)} actions={actions} />);
  const q = (testId: string) => view.container.querySelector(`[data-testid="${testId}"]`);
  const all = (testId: string) => [...view.container.querySelectorAll(`[data-testid="${testId}"]`)];
  return { ...view, actions, q, all };
}

describe('ModelFromDrawingPanel — όψεις', () => {
  it('κλειστός βοηθός ⇒ κανένα πάνελ', () => {
    expect(renderPanel({ phase: 'closed' }).q('shell')).toBeNull();
  });

  it('οπλισμένος: μόνο η οδηγία (και ό,τι έχει να πει), καμία έγκριση', () => {
    const { q } = renderPanel({ phase: 'picking', proposal: null, notice: { kind: 'no-line' } });
    expect(q('mfd-pick-instruction')?.textContent).toBe('modelFromDrawing.pick.instruction');
    expect(q('mfd-notice')?.textContent).toBe('modelFromDrawing.notice.no-line');
    expect(q('mfd-approve')).toBeNull();
  });
});

describe('ModelFromDrawingPanel — η ΜΙΑ έγκριση', () => {
  it('κλειδωμένη όσο εκκρεμεί ομάδα πάχους· γράφει τον αριθμό των τοίχων', () => {
    const { q, actions } = renderPanel();
    const approve = q('mfd-approve') as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(approve.textContent).toBe('modelFromDrawing.approve{"count":38}');
    fireEvent.click(approve);
    expect(actions.onApprove).not.toHaveBeenCalled();
  });

  it('ξεκλειδώνει όταν επιβεβαιωθούν ΟΛΕΣ οι ομάδες, και καλεί την έγκριση', () => {
    const { q, actions } = renderPanel({ proposal: ALL_CONFIRMED });
    const approve = q('mfd-approve') as HTMLButtonElement;
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);
    expect(actions.onApprove).toHaveBeenCalledTimes(1);
  });

  it('κλειδωμένη όταν δεν υπάρχει κανένας τοίχος να γραφτεί', () => {
    const empty: WallProposal = { ...ALL_CONFIRMED, walls: [] };
    expect((renderPanel({ proposal: empty }).q('mfd-approve') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ModelFromDrawingPanel — οι αποφάσεις φεύγουν προς τα πάνω', () => {
  it('μία γραμμή ανά ομάδα πάχους, με την κατάσταση επιβεβαίωσής της', () => {
    const { all } = renderPanel();
    expect(all('mfd-group')).toHaveLength(UNCONFIRMED.groups.length);
    expect(all('mfd-group').every((row) => row.getAttribute('data-confirmed') === 'false')).toBe(true);
    const confirmed = renderPanel({ proposal: ALL_CONFIRMED }).all('mfd-group');
    expect(confirmed.every((row) => row.getAttribute('data-confirmed') === 'true')).toBe(true);
  });

  it('το κουμπί «Επιβεβαίωση» υπάρχει ΜΟΝΟ όσο η ομάδα εκκρεμεί', () => {
    // Το Select είναι mock χωρίς <button>: το μόνο κουμπί μιας γραμμής είναι η «Επιβεβαίωση».
    expect(renderPanel().all('mfd-group').every((row) => row.querySelectorAll('button').length === 1)).toBe(true);
    const confirmed = renderPanel({ proposal: ALL_CONFIRMED }).all('mfd-group');
    expect(confirmed.length).toBeGreaterThan(0);
    expect(confirmed.every((row) => row.querySelector('button') === null)).toBe(true);
  });

  it('«Επιβεβαίωση» στέλνει την ΠΡΟΤΕΙΝΟΜΕΝΗ λειτουργία της ομάδας· αλλαγή επιλογής στέλνει τη νέα', () => {
    const { all, actions } = renderPanel();
    const first = UNCONFIRMED.groups[0];
    const row = all('mfd-group')[0];
    fireEvent.click(row.querySelector('button') as HTMLButtonElement);
    expect(actions.onConfirmGroup).toHaveBeenLastCalledWith(first.thicknessMm, first.suggestedCategory);
    fireEvent.click(row.querySelector('[data-testid="select"]') as HTMLElement);
    expect(actions.onConfirmGroup).toHaveBeenLastCalledWith(first.thicknessMm, 'partition');
  });

  it('αμφίσημο ορθογώνιο: «Είναι τοίχος» στέλνει την απόφαση, η εστίαση το κλειδί', () => {
    const { all, actions } = renderPanel();
    const undecided = UNCONFIRMED.items.filter((i) => i.status === 'needs-decision');
    const rows = all('mfd-decision');
    expect(rows).toHaveLength(undecided.length);
    const [focus, isWall] = [...rows[0].querySelectorAll('button')];
    fireEvent.click(isWall);
    expect(actions.onSetUndecided).toHaveBeenCalledWith(undecided[0].key, true);
    fireEvent.click(focus);
    expect(actions.onFocus).toHaveBeenCalledWith(undecided[0].key);
  });

  it('ορθογώνιο που ο άνθρωπος ΔΕΧΤΗΚΕ μένει στη λίστα, ώστε να μπορεί να το πάρει πίσω', () => {
    const undecided = UNCONFIRMED.items.find((i) => i.status === 'needs-decision')!;
    const accepted = new Set([undecided.key]);
    const proposal = computeWallProposal({
      entities: ENTITIES, wallColorHex: '#003fff', colorOf, sceneUnits: 'mm', levelId: 'lvl', acceptedKeys: accepted,
    });
    const { all, actions } = renderPanel({ proposal, acceptedKeys: accepted });
    expect(all('mfd-decision')).toHaveLength(2);
    const pressed = all('mfd-decision').flatMap((r) => [...r.querySelectorAll('button[aria-pressed="true"]')]);
    expect(pressed).toHaveLength(1);
    fireEvent.click(pressed[0]);
    expect(actions.onSetUndecided).toHaveBeenCalledWith(undecided.key, false);
  });

  it('«Άλλο δείγμα» και κλείσιμο φτάνουν στον host', () => {
    const { container, q, actions } = renderPanel();
    fireEvent.click(q('shell-close') as HTMLElement);
    expect(actions.onClose).toHaveBeenCalledTimes(1);
    const resample = [...container.querySelectorAll('button')].find((b) => b.textContent === 'modelFromDrawing.sample.change');
    fireEvent.click(resample as HTMLButtonElement);
    expect(actions.onResample).toHaveBeenCalledTimes(1);
  });
});

describe('ModelFromDrawingPanel — υπόμνημα, κάλυψη, ειδοποιήσεις', () => {
  it('το υπόμνημα δείχνει κάθε κατάσταση με το μοτίβο γραμμής του καμβά και το πλήθος της', () => {
    const { q } = renderPanel();
    const rows = [...(q('mfd-legend') as HTMLElement).querySelectorAll('li')];
    expect(rows.map((r) => r.getAttribute('data-status'))).toEqual([...ASSISTANT_STATUS_ORDER]);
    rows.forEach((row) => {
      const style = PREVIEW_ZONE_STYLE[ASSISTANT_STATUS_TONE[row.getAttribute('data-status') as keyof typeof ASSISTANT_STATUS_TONE]];
      const line = row.querySelector('line');
      expect(line?.getAttribute('stroke')).toBe(style.stroke);
      expect(line?.getAttribute('stroke-dasharray')).toBe(style.dash);
    });
    expect(rows.map((r) => r.querySelector('span:last-child')?.textContent)).toEqual(['38', '2', '0', '0']);
  });

  it('η αναφορά κάλυψης γράφει τους τρεις αριθμούς· προειδοποιεί ΜΟΝΟ όταν μένουν ανεξήγητες γραμμές', () => {
    const clean = renderPanel().q('mfd-coverage') as HTMLElement;
    expect(clean.textContent).toContain('{"explained":160,"unexplained":0,"ignored":362}');
    expect(clean.querySelector('[role="status"]')).toBeNull();

    const orphaned: WallProposal = { ...UNCONFIRMED, coverage: { ...UNCONFIRMED.coverage, unexplainedIds: ['line_1'] } };
    const warned = renderPanel({ proposal: orphaned }).q('mfd-coverage') as HTMLElement;
    expect(warned.querySelector('[role="status"]')?.textContent).toBe('modelFromDrawing.coverage.unexplainedHint');
  });

  const NOTICES: readonly (readonly [ModelFromDrawingNotice, string])[] = [
    [{ kind: 'no-scene' }, 'modelFromDrawing.notice.no-scene'],
    [{ kind: 'no-color' }, 'modelFromDrawing.notice.no-color'],
    [{ kind: 'stale' }, 'modelFromDrawing.notice.stale'],
    [{ kind: 'unconfirmed' }, 'modelFromDrawing.notice.unconfirmed'],
    [{ kind: 'written', count: 38, retrimmed: 0 }, 'modelFromDrawing.notice.written{"count":38}'],
    [{ kind: 'refused', refusal: 'overlap', blocked: 3 }, 'modelFromDrawing.notice.refused.overlap{"blocked":3}'],
    [{ kind: 'refused', refusal: 'nothing-to-write', blocked: 0 }, 'modelFromDrawing.notice.refused.nothing-to-write'],
    [{ kind: 'refused', refusal: 'no-active-scene', blocked: 0 }, 'modelFromDrawing.notice.refused.no-active-scene'],
  ];

  it.each(NOTICES)('ειδοποίηση %j έχει το δικό της κείμενο', (notice, expected) => {
    const node = renderPanel({ notice }).q('mfd-notice');
    expect(node?.textContent).toBe(expected);
    expect(node?.getAttribute('data-kind')).toBe(notice.kind);
  });
});
