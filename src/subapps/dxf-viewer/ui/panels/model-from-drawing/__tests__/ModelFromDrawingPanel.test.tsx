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
import { decisionAnchorsForKeys } from '../../../../bim/model-from-drawing/decision-anchors';
import fixture from '../../../../bim/model-from-drawing/__tests__/fixtures/floor-plan-lines.json';
import { PREVIEW_ZONE_STYLE } from '../../../../systems/region-preview/preview-zone-style';
import { ASSISTANT_STATUS_ORDER, ASSISTANT_STATUS_TONE } from '../../../../systems/model-from-drawing/assistant-status-tone';
import type {
  ModelFromDrawingNotice,
  ModelFromDrawingState,
} from '../../../../systems/model-from-drawing/model-from-drawing-store';
import { ModelFromDrawingPanel, type ModelFromDrawingPanelActions } from '../ModelFromDrawingPanel';
import type { ImageSourceView } from '../PlanRecognitionSections';
import { SCENE_LINE_SOURCE } from '../../../../systems/model-from-drawing/proposal-line-source';

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
    sampleRole: 'wall',
    pendingSample: null,
    lineSource: SCENE_LINE_SOURCE,
    wallColorHex: '#003fff',
    acceptedDecisions: [],
    categoryByThicknessMm: new Map(),
    proposal: UNCONFIRMED,
    preview: null,
    openingColorHex: null,
    openingChoices: new Map(),
    openingProposal: null,
    openingPreview: null,
    focusedKey: null,
    notice: null,
    ...patch,
  };
}

function actionsMock(): jest.Mocked<ModelFromDrawingPanelActions> {
  return {
    onClose: jest.fn(), onResample: jest.fn(), onConfirmGroup: jest.fn(),
    onSetUndecided: jest.fn(), onDiscardOrphanedDecisions: jest.fn(), onFocus: jest.fn(), onApprove: jest.fn(),
    onStartOpenings: jest.fn(), onChooseOpening: jest.fn(), onApproveOpenings: jest.fn(),
    onRecognizeImage: jest.fn(),
    reading: {
      onBegin: jest.fn(), onEnd: jest.fn(), onToggleAddRegion: jest.fn(),
      onReset: jest.fn(), onUndoReadingDrop: jest.fn(), onPrepare: jest.fn(), onSend: jest.fn(),
    },
    scale: { onApply: jest.fn(), onManual: jest.fn(), onHover: jest.fn() },
  };
}

/** ADR-929 Φ5.4β — τίποτα εκτός τοίχων. */
const NO_EXCLUSIONS: ImageSourceView['excludedFromWalls'] = { byRole: { dimension: 0, annotation: 0 }, lowConfidence: 0 };

/** Η πηγή «εικόνα» όπως τη δίνει ο host — προεπιλογή: όροφος χωρίς υπόβαθρο, πηγή το σχέδιο. */
const NO_IMAGE: ImageSourceView = {
  available: false, phase: 'idle', failure: null, active: false, countsByTier: null, excludedFromWalls: NO_EXCLUSIONS, calibrated: false,
  readingAvailable: false, readingAdopted: false, review: null, scale: { card: null, applying: false, stale: false },
};

function renderPanel(patch: Partial<ModelFromDrawingState> = {}, imageSource: ImageSourceView = NO_IMAGE) {
  const actions = actionsMock();
  const view = render(<ModelFromDrawingPanel state={stateOf(patch)} actions={actions} imageSource={imageSource} />);
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
  it('καμία επιβεβαίωση ⇒ κανένας τοίχος να γραφτεί: κλειδωμένη, και λέει πόσοι μένουν έξω', () => {
    const { q, actions } = renderPanel();
    const approve = q('mfd-approve') as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(approve.textContent).toBe('modelFromDrawing.approve{"count":0}');
    expect(q('mfd-left-out')?.textContent).toBe('modelFromDrawing.leftOut{"count":38}');
    fireEvent.click(approve);
    expect(actions.onApprove).not.toHaveBeenCalled();
  });

  it('ADR-929 Φ5.2ε — μία επιβεβαιωμένη ομάδα ⇒ ξεκλειδώνει, γράφει ΜΟΝΟ αυτή, οι υπόλοιποι ρητά έξω', () => {
    const [first] = UNCONFIRMED.groups;
    const partial = propose(new Map([[first.thicknessMm, first.suggestedCategory]]));
    const { q } = renderPanel({ proposal: partial });
    expect((q('mfd-approve') as HTMLButtonElement).disabled).toBe(partial.walls.length === 0);
    expect(q('mfd-approve')?.textContent).toBe(`modelFromDrawing.approve{"count":${partial.walls.length}}`);
    const left = partial.items.filter((i) => i.status === 'unconfirmed').length;
    expect(left).toBeGreaterThan(0);
    expect(q('mfd-left-out')?.textContent).toBe(`modelFromDrawing.leftOut{"count":${left}}`);
  });

  it('ξεκλειδώνει όταν επιβεβαιωθούν ΟΛΕΣ οι ομάδες, και καλεί την έγκριση — χωρίς γραμμή «έξω»', () => {
    const { q, actions } = renderPanel({ proposal: ALL_CONFIRMED });
    const approve = q('mfd-approve') as HTMLButtonElement;
    expect(approve.disabled).toBe(false);
    expect(q('mfd-left-out')).toBeNull();
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
    const accepted = decisionAnchorsForKeys(UNCONFIRMED.decisions, [undecided.key]);
    const proposal = computeWallProposal({
      entities: ENTITIES, wallColorHex: '#003fff', colorOf, sceneUnits: 'mm', levelId: 'lvl', acceptedDecisions: accepted,
    });
    const { all, actions } = renderPanel({ proposal, acceptedDecisions: accepted });
    expect(all('mfd-decision')).toHaveLength(2);
    const pressed = all('mfd-decision').flatMap((r) => [...r.querySelectorAll('button[aria-pressed="true"]')]);
    expect(pressed).toHaveLength(1);
    fireEvent.click(pressed[0]);
    expect(actions.onSetUndecided).toHaveBeenCalledWith(undecided.key, false);
  });

  it('ADR-929 §6.11 — αποφάσεις χωρίς ορθογώνιο φαίνονται, και φεύγουν ΜΟΝΟ με ρητή απόρριψη', () => {
    expect(renderPanel().q('mfd-orphaned')).toBeNull();
    const anchor = [...UNCONFIRMED.decisions.anchorByKey.values()][0];
    const proposal: WallProposal = { ...UNCONFIRMED, decisions: { ...UNCONFIRMED.decisions, orphaned: [anchor, anchor] } };
    const { q, actions } = renderPanel({ proposal });
    const note = q('mfd-orphaned') as HTMLElement;
    expect(note.textContent).toContain('modelFromDrawing.decisions.orphaned{"count":2}');
    fireEvent.click(note.querySelector('button') as HTMLButtonElement);
    expect(actions.onDiscardOrphanedDecisions).toHaveBeenCalledTimes(1);
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
    expect(rows.map((r) => r.querySelector('span:last-child')?.textContent)).toEqual(['0', '38', '2', '0', '0']);
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

describe('ModelFromDrawingPanel — πηγή «εικόνα υποβάθρου» (ADR-929 Φ5)', () => {
  const RASTER = { kind: 'raster', recognitionId: 'rec1.1', floorId: 'flr_1', segments: [] } as const;
  const COUNTS = { high: 12, medium: 3, low: 1 } as const;
  const IMAGE_READY: ImageSourceView = {
    available: true, phase: 'ready', failure: null, active: true, countsByTier: COUNTS, excludedFromWalls: { byRole: { dimension: 0, annotation: 0 }, lowConfidence: 1 }, calibrated: true,
    readingAvailable: true, readingAdopted: false, review: null, scale: NO_IMAGE.scale,
  };

  it('Φ5.2ε — οι γραμμές χαμηλής βεβαιότητας λέγονται ρητά «όχι τοίχοι», και η γραμμή φεύγει όταν δεν υπάρχουν', () => {
    const shown = renderPanel({ lineSource: RASTER, proposal: ALL_CONFIRMED }, IMAGE_READY);
    expect(shown.q('mfd-image-excluded')?.textContent).toBe('modelFromDrawing.image.lowExcluded{"count":1}');
    shown.unmount();
    const none = renderPanel({ lineSource: RASTER, proposal: ALL_CONFIRMED }, { ...IMAGE_READY, excludedFromWalls: NO_EXCLUSIONS });
    expect(none.q('mfd-image-excluded')).toBeNull();
  });

  it('Φ5.4β — τα τμήματα εκτός τοίχων λόγω ρόλου: γραμμή ανά σημάδι με πλήθος· όχι μέσα στο «χαμηλής βεβαιότητας»', () => {
    const view: ImageSourceView = {
      ...IMAGE_READY, excludedFromWalls: { byRole: { dimension: 97, annotation: 0 }, lowConfidence: 715 },
    };
    const { q, container } = renderPanel({ lineSource: RASTER, proposal: ALL_CONFIRMED }, view);
    const rows = [...(q('mfd-image-role-legend')?.querySelectorAll('li') ?? [])];
    expect(rows.map((li) => li.getAttribute('data-role'))).toEqual(['dimension']);
    expect(rows[0].textContent).toBe('modelFromDrawing.image.role.dimension{"count":97}');
    expect(rows[0].querySelector('svg line')).not.toBeNull();
    expect(q('mfd-image-excluded')?.textContent).toBe('modelFromDrawing.image.lowExcluded{"count":715}');
    expect(container.querySelector('[data-role="annotation"]')).toBeNull();
  });

  it('Φ5.4β — χωρίς τμήματα εκτός τοίχων λόγω ρόλου: κανένα υπόμνημα ρόλων', () => {
    const { q } = renderPanel({ lineSource: RASTER, proposal: ALL_CONFIRMED }, IMAGE_READY);
    expect(q('mfd-image-role-legend')).toBeNull();
  });

  it('οπλισμένος: το κουμπί υπάρχει, κλειδωμένο όσο ο όροφος δεν έχει υπόβαθρο, και το λέει', () => {
    const { q } = renderPanel({ phase: 'picking', proposal: null });
    expect((q('mfd-image-recognize') as HTMLButtonElement).disabled).toBe(true);
    expect(q('mfd-image-source')?.textContent).toContain('modelFromDrawing.image.unavailable');
  });

  it('με υπόβαθρο: το κλικ ζητά αναγνώριση· όσο τρέχει, κλειδώνει', () => {
    const idle = renderPanel({ phase: 'picking', proposal: null }, { ...NO_IMAGE, available: true });
    fireEvent.click(idle.q('mfd-image-recognize') as HTMLElement);
    expect(idle.actions.onRecognizeImage).toHaveBeenCalledTimes(1);
    idle.unmount();
    const running = renderPanel({ phase: 'picking', proposal: null }, { ...NO_IMAGE, available: true, phase: 'running' });
    expect((running.q('mfd-image-recognize') as HTMLButtonElement).disabled).toBe(true);
  });

  it('αποτυχία με όνομα, όχι σιωπή', () => {
    const { q } = renderPanel({ phase: 'picking', proposal: null }, { ...NO_IMAGE, available: true, failure: 'no-segments' });
    expect(q('mfd-image-source')?.textContent).toContain('modelFromDrawing.image.failure.no-segments');
  });

  it('έλεγχος από εικόνα: η σύνοψη αντικαθιστά το χρώμα-δείγμα, με πλήθη ανά βεβαιότητα', () => {
    const { q, all } = renderPanel({ lineSource: RASTER, proposal: ALL_CONFIRMED }, IMAGE_READY);
    expect(q('mfd-image-summary')).not.toBeNull();
    const rows = all('mfd-image-legend').flatMap((ul) => [...ul.querySelectorAll('li')]);
    expect(rows.map((r) => [r.getAttribute('data-tier'), r.querySelector('span:last-child')?.textContent]))
      .toEqual([['high', '12'], ['medium', '3'], ['low', '1']]);
  });

  it('χωρίς βαθμονόμηση: η έγκριση κλειδώνει και ο λόγος φαίνεται· με βαθμονόμηση ξεκλειδώνει', () => {
    const blocked = renderPanel({ lineSource: RASTER, proposal: ALL_CONFIRMED }, { ...IMAGE_READY, calibrated: false });
    expect((blocked.q('mfd-approve') as HTMLButtonElement).disabled).toBe(true);
    expect(blocked.q('mfd-image-uncalibrated')).not.toBeNull();
    blocked.unmount();
    const open = renderPanel({ lineSource: RASTER, proposal: ALL_CONFIRMED }, IMAGE_READY);
    expect((open.q('mfd-approve') as HTMLButtonElement).disabled).toBe(false);
  });

  it('η ειδοποίηση «αβαθμονόμητη» έχει το δικό της κείμενο', () => {
    expect(renderPanel({ notice: { kind: 'uncalibrated' } }).q('mfd-notice')?.textContent)
      .toBe('modelFromDrawing.notice.uncalibrated');
  });
});
