/**
 * @jest-environment jsdom
 *
 * ADR-911 Φ4-3β — τα τμήματα ανοιγμάτων του πάνελ, πάνω στην ΠΡΑΓΜΑΤΙΚΗ πρόταση του σχεδίου
 * δοκιμής (12 σύμβολα + 2 κενά με ζωγραφισμένη κολώνα μέσα).
 *
 *   · η ουρά «προς απόφαση» δουλεύεται με το πληκτρολόγιο, ανεξάρτητα από διάταξη (event.code)·
 *   · κάθε απάντηση φεύγει προς τα πάνω — το πάνελ δεν γράφει τίποτα μόνο του·
 *   · ό,τι κρατά ζωγραφισμένες γραμμές το ΛΕΕΙ, και η υπόδειξη γι' αυτό είναι «τίποτα»·
 *   · τα αναποφάσιστα δεν κλειδώνουν την έγκριση· η άρνηση του σχεδίου εγγραφής την κλειδώνει.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { shouldGlobalShortcutYield } from '@/lib/a11y/keyboard-scope';
import type { OpeningProposal } from '../../../../bim/model-from-drawing/opening-proposal';
import { buildOpeningPreview, type OpeningPreview } from '../../../../bim/model-from-drawing/opening-preview';
import type { OpeningReviewChoice } from '../../../../bim/model-from-drawing/opening-review';
import { LEVEL, propose, sceneOf, writtenWalls } from '../../../../bim/model-from-drawing/__tests__/opening-fixture';
import {
  OpeningsSection,
  OpeningsStart,
  type OpeningReviewActions,
} from '../ModelFromDrawingOpeningSections';

const t = (key: string, params?: Record<string, unknown>): string => (params ? `${key}${JSON.stringify(params)}` : key);

const ENTITIES = sceneOf(writtenWalls(true));
const PROPOSAL = propose(ENTITIES);
const GAPS = PROPOSAL.items.filter((i) => i.symbol === 'none').map((i) => i.key);
const previewOf = (proposal: OpeningProposal, choices = new Map<string, OpeningReviewChoice>()): OpeningPreview =>
  buildOpeningPreview({ proposal, entities: ENTITIES, levelId: LEVEL, sceneUnits: 'mm', choices });

interface Options {
  readonly proposal?: OpeningProposal;
  readonly preview?: OpeningPreview | null;
  readonly choices?: ReadonlyMap<string, OpeningReviewChoice>;
  readonly focusedKey?: string | null;
}

function renderSection(options: Options = {}) {
  const proposal = options.proposal ?? PROPOSAL;
  const actions: jest.Mocked<OpeningReviewActions> = {
    onStartOpenings: jest.fn(), onChooseOpening: jest.fn(), onFocus: jest.fn(), onApproveOpenings: jest.fn(),
  };
  const view = render(
    <OpeningsSection
      proposal={proposal} preview={options.preview === undefined ? previewOf(proposal) : options.preview}
      choices={options.choices ?? new Map()} colorHex="#00cccc" focusedKey={options.focusedKey ?? null}
      actions={actions} t={t}
    />,
  );
  const q = (testId: string) => view.container.querySelector(`[data-testid="${testId}"]`);
  const rows = () => [...view.container.querySelectorAll<HTMLLIElement>('[data-testid="mfd-opening-item"]')];
  const list = () => q('mfd-openings-review') as HTMLUListElement;
  const press = (code: string, shiftKey = false) => fireEvent.keyDown(list(), { code, shiftKey });
  return { ...view, actions, q, rows, list, press };
}

describe('OpeningsStart', () => {
  it('ένα κουμπί που οπλίζει το δείγμα «κούφωμα»', () => {
    const onStart = jest.fn();
    const { container } = render(<OpeningsStart onStart={onStart} t={t} />);
    fireEvent.click(container.querySelector('[data-testid="mfd-openings-arm"]')!);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('OpeningsSection — πλήθη και ουρά', () => {
  it('το υπόμνημα γράφει 6 πόρτες, 6 παράθυρα, 2 προς απόφαση, 0 υπάρχοντα', () => {
    const { q } = renderSection();
    const counts = [...q('mfd-openings-legend')!.querySelectorAll('li')].map((li) =>
      [li.getAttribute('data-status'), li.querySelector('span.font-mono')!.textContent]);
    expect(counts).toEqual([['door', '6'], ['window', '6'], ['needs-decision', '2'], ['existing', '0']]);
  });

  it('η ουρά έχει ΜΟΝΟ τα δύο κενά, το καθένα με τον λόγο και το πλάτος του', () => {
    const { rows } = renderSection();
    expect(rows().map((r) => r.getAttribute('data-key'))).toEqual(GAPS);
    for (const row of rows()) {
      expect(row.textContent).toContain('modelFromDrawing.openings.reason.no-symbol');
      expect(row.textContent).toMatch(/review\.width\{"widthMm":(500|1900)\}/);
    }
  });

  it('κενό με ζωγραφισμένες γραμμές μέσα το ΛΕΕΙ, και η υπόδειξη είναι «τίποτα» — καμία προεπιλεγμένη απάντηση', () => {
    const { rows } = renderSection();
    for (const row of rows()) {
      expect(row.querySelector('[data-testid="mfd-opening-occupied"]')).not.toBeNull();
      const suggested = [...row.querySelectorAll('button[data-suggested="true"]')].map((b) => b.getAttribute('data-choice'));
      expect(suggested).toEqual(['none']);
      expect(row.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0);
    }
  });

  it('στοιχείο χωρίς ξενιστή δεν έχει κουμπιά — γράφει ότι δεν μπορεί να γραφτεί', () => {
    const blocked: OpeningProposal = {
      ...PROPOSAL,
      items: PROPOSAL.items.map((i) => (i.key === GAPS[0] ? { ...i, host: undefined } : i)),
    };
    const { rows } = renderSection({ proposal: blocked, preview: null });
    expect(rows()[0].getAttribute('data-choosable')).toBe('false');
    expect(rows()[0].querySelectorAll('button')).toHaveLength(0);
    expect(rows()[0].textContent).toContain('modelFromDrawing.openings.review.notWritable');
  });

  it('χωρίς τίποτα προς απόφαση δεν υπάρχει ουρά', () => {
    const settled: OpeningProposal = { ...PROPOSAL, items: PROPOSAL.items.filter((i) => i.symbol !== 'none') };
    expect(renderSection({ proposal: settled, preview: null }).q('mfd-openings-review')).toBeNull();
  });
});

describe('OpeningsSection — απαντήσεις με το ποντίκι', () => {
  it('κλικ σε απάντηση τη στέλνει για ΑΥΤΟ το στοιχείο· δεύτερο κλικ στην ίδια = αναποφάσιστο ξανά', () => {
    const first = renderSection();
    fireEvent.click(first.rows()[0].querySelector('button[data-choice="door"]')!);
    expect(first.actions.onChooseOpening).toHaveBeenCalledWith([GAPS[0]], 'door');
    first.unmount();

    const again = renderSection({ choices: new Map([[GAPS[0], 'door']]) });
    const pressed = again.rows()[0].querySelector('button[aria-pressed="true"]')!;
    expect(pressed.getAttribute('data-choice')).toBe('door');
    fireEvent.click(pressed);
    expect(again.actions.onChooseOpening).toHaveBeenCalledWith([GAPS[0]], null);
  });

  it('«και στα όμοια» εμφανίζεται ΜΟΝΟ αφού απαντηθεί το στοιχείο, και στέλνει την ίδια απάντηση σε όλα', () => {
    expect(renderSection().q('mfd-opening-similar')).toBeNull();

    const { rows, actions } = renderSection({ choices: new Map([[GAPS[0], 'none']]) });
    const similar = rows()[0].querySelector('[data-testid="mfd-opening-similar"]')!;
    expect(similar.textContent).toBe('modelFromDrawing.openings.review.similar{"count":1}');
    expect(rows()[1].querySelector('[data-testid="mfd-opening-similar"]')).toBeNull();

    fireEvent.click(similar);
    expect(actions.onChooseOpening).toHaveBeenCalledWith(GAPS, 'none');
  });
});

describe('OpeningsSection — η ουρά με το πληκτρολόγιο', () => {
  it('1 · 2 · 3 · 0 απαντούν για το ΕΣΤΙΑΣΜΕΝΟ στοιχείο, από τη θέση του πλήκτρου', () => {
    const { press, actions } = renderSection({ focusedKey: GAPS[1] });
    press('Digit1'); press('Numpad2'); press('Digit3'); press('Digit0');
    expect(actions.onChooseOpening.mock.calls).toEqual([
      [[GAPS[1]], 'door'], [[GAPS[1]], 'window'], [[GAPS[1]], 'none'], [[GAPS[1]], null],
    ]);
  });

  it('χωρίς εστίαση τα πλήκτρα αφορούν το πρώτο στοιχείο', () => {
    const { press, actions } = renderSection();
    press('Digit3');
    expect(actions.onChooseOpening).toHaveBeenCalledWith([GAPS[0]], 'none');
  });

  it('Shift + ψηφίο ⇒ η ίδια απάντηση σε ΟΛΑ τα όμοια', () => {
    const { press, actions } = renderSection({ focusedKey: GAPS[0] });
    press('Digit3', true);
    expect(actions.onChooseOpening).toHaveBeenCalledWith(GAPS, 'none');
  });

  it('↓ / ↑ μετακινούν την εστίαση, και η γραμμή που την παίρνει ζητά την όψη', () => {
    const { press, rows, actions } = renderSection({ focusedKey: GAPS[0] });
    press('ArrowDown');
    expect(document.activeElement).toBe(rows()[1]);
    expect(actions.onFocus).toHaveBeenCalledWith(GAPS[1]);
  });

  it('στα άκρα της ουράς τα βέλη δεν τυλίγουν', () => {
    const { press, rows } = renderSection({ focusedKey: GAPS[0] });
    press('ArrowUp');
    expect(document.activeElement).toBe(rows()[0]);
  });

  it('ΕΝΑ στοιχείο της ουράς είναι στο Tab· η εστιασμένη γραμμή δεν ξαναζητά την όψη της', () => {
    const { rows, actions } = renderSection({ focusedKey: GAPS[1] });
    expect(rows().map((r) => r.tabIndex)).toEqual([-1, 0]);
    fireEvent.focus(rows()[1]);
    expect(actions.onFocus).not.toHaveBeenCalled();
  });

  it('ADR-711: με εστίαση σε γραμμή οι καθολικοί accelerators ΥΠΟΧΩΡΟΥΝ — και για ψηφία και για βέλη', () => {
    const { rows, list } = renderSection();
    // Κριτής το ίδιο το SSoT που ρωτούν οι global listeners του viewer, όχι το όνομα ενός ρόλου.
    for (const key of ['1', '2', '3', '0', 'ArrowDown', 'ArrowUp']) {
      expect(shouldGlobalShortcutYield({ target: rows()[0], key })).toBe(true);
    }
    expect(list().getAttribute('role')).toBe('listbox');
  });

  it('το κλικ σε απάντηση επιστρέφει την εστίαση στη ΓΡΑΜΜΗ — τον ιδιοκτήτη των πλήκτρων', () => {
    const { rows } = renderSection();
    const button = rows()[1].querySelector<HTMLButtonElement>('button[data-choice="window"]')!;
    button.focus();
    fireEvent.click(button);
    expect(document.activeElement).toBe(rows()[1]);
    expect(button.tabIndex).toBe(-1);
  });

  it('συνδυασμοί με Ctrl / Alt / Meta και άσχετα πλήκτρα δεν είναι της ουράς', () => {
    const { list, actions } = renderSection();
    fireEvent.keyDown(list(), { code: 'Digit1', ctrlKey: true });
    fireEvent.keyDown(list(), { code: 'Digit1', altKey: true });
    fireEvent.keyDown(list(), { code: 'Digit1', metaKey: true });
    fireEvent.keyDown(list(), { code: 'Digit4' });
    fireEvent.keyDown(list(), { code: 'KeyD' });
    expect(actions.onChooseOpening).not.toHaveBeenCalled();
  });
});

describe('OpeningsSection — η ΜΙΑ έγκριση', () => {
  it('τα αναποφάσιστα ΔΕΝ κλειδώνουν: το κουμπί γράφει 12 και λέει ότι 2 μένουν έξω', () => {
    const { q, actions } = renderSection();
    const approve = q('mfd-openings-approve') as HTMLButtonElement;
    expect(approve.disabled).toBe(false);
    expect(approve.textContent).toBe('modelFromDrawing.openings.approve{"count":12}');
    expect(q('mfd-openings-left-out')!.textContent).toBe('modelFromDrawing.openings.leftOut{"count":2}');

    fireEvent.click(approve);
    expect(actions.onApproveOpenings).toHaveBeenCalledTimes(1);
  });

  it('«τίποτα» δεν είναι αναποφάσιστο: όταν όλα απαντηθούν, τίποτα δεν «μένει έξω»', () => {
    const choices = new Map<string, OpeningReviewChoice>(GAPS.map((k) => [k, 'none']));
    const { q } = renderSection({ choices });
    expect(q('mfd-openings-left-out')).toBeNull();
    expect(q('mfd-openings-progress')!.textContent).toBe(
      'modelFromDrawing.openings.review.progress{"undecided":0,"dismissed":2,"blocked":0}');
  });

  it('απόφαση «πόρτα» σε κενό ⇒ το κουμπί γράφει 13', () => {
    const choices = new Map<string, OpeningReviewChoice>([[GAPS[0], 'door']]);
    const decided = propose(ENTITIES, new Map([[GAPS[0], 'door']]));
    const { q } = renderSection({ proposal: decided, choices, preview: null });
    expect(q('mfd-openings-approve')!.textContent).toBe('modelFromDrawing.openings.approve{"count":13}');
  });

  it('άρνηση του σχεδίου εγγραφής φαίνεται ΠΡΙΝ από την έγκριση και την κλειδώνει', () => {
    const { q } = renderSection({ preview: { ...previewOf(PROPOSAL), refusal: 'overlap' } });
    expect(q('mfd-openings-plan-refusal')!.textContent).toBe('modelFromDrawing.openings.planRefusal.overlap');
    expect((q('mfd-openings-approve') as HTMLButtonElement).disabled).toBe(true);
  });

  it('τίποτα εγγράψιμο ⇒ κλειδωμένη', () => {
    const none: OpeningProposal = { ...PROPOSAL, items: PROPOSAL.items.filter((i) => i.symbol === 'none') };
    expect((renderSection({ proposal: none, preview: null }).q('mfd-openings-approve') as HTMLButtonElement).disabled).toBe(true);
  });

  it('ανεξήγητες γραμμές του ρόλου ⇒ ρητή προειδοποίηση με τον αριθμό τους', () => {
    expect(renderSection().q('mfd-openings-unexplained')).toBeNull();
    const orphaned: OpeningProposal = { ...PROPOSAL, unexplainedIds: ['line_1', 'line_2'] };
    expect(renderSection({ proposal: orphaned, preview: null }).q('mfd-openings-unexplained')!.textContent)
      .toBe('modelFromDrawing.openings.unexplained{"count":2}');
  });
});
