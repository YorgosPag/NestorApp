/**
 * Διάταξη των επεξεργαστών υπεργολαβίας (ADR-928 §5.23): ενότητες ως καρτέλες με το hash ως κάτοχο · αίτημα κύλισης
 * της προεπισκόπησης μόνο από τη φόρμα · σελίδα Α4 με ζουμ «προσαρμογή στο πλάτος» · ύψος που γεμίζει το παράθυρο.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { fillHeightOf, measureFillHeight } from '@/hooks/useFillViewportHeight';
import { revealSectionWhenPresent } from '../preview-section-sync';
import { PAPER_A4_WIDTH_PX, PAPER_MAX_ZOOM, paperFitOf } from '../../document/paper-fit';
import { AGREEMENT_SECTION_MAP, TEMPLATE_SECTION_MAP, sectionHash, sectionOfHash } from '../editor-sections';
import { EditorSectionTabs } from '../EditorSectionTabs';
import { useEditorSection } from '../useEditorSection';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
    i18n: { language: 'el' },
  }),
}));

const issue = (path: string): SubcontractIssue => ({ code: 'parameterKeyInvalid', path });

beforeEach(() => window.history.replaceState(null, '', '/agreement'));

describe('editor-sections — το hash μιας ενότητας', () => {
  it('ενότητα ↔ hash, ίδιο με το id της επικεφαλίδας', () => {
    expect(sectionHash('plan')).toBe('#editor-plan');
    expect(sectionOfHash('#editor-plan')).toBe('plan');
  });

  it('άγνωστο ή ξένο hash ⇒ null· ενότητα που ο επεξεργαστής δεν έχει ⇒ null', () => {
    expect(sectionOfHash('#editor-nope')).toBeNull();
    expect(sectionOfHash('#lines')).toBeNull();
    expect(sectionOfHash('#editor-parties', TEMPLATE_SECTION_MAP)).toBeNull();
    expect(sectionOfHash('#editor-parties', AGREEMENT_SECTION_MAP)).toBe('parties');
  });
});

describe('useEditorSection — ένας κάτοχος για καρτέλες και προεπισκόπηση', () => {
  it('ξεκινά από το hash της διεύθυνσης· αλλιώς από την πρώτη ενότητα', () => {
    window.history.replaceState(null, '', '/agreement#editor-lines');
    expect(renderHook(() => useEditorSection(AGREEMENT_SECTION_MAP)).result.current.section).toBe('lines');
    window.history.replaceState(null, '', '/agreement#editor-parties');
    expect(renderHook(() => useEditorSection(TEMPLATE_SECTION_MAP)).result.current.section).toBe('identity');
  });

  it('επιλογή από τη φόρμα: γράφει hash (χωρίς νέα εγγραφή ιστορικού) και ζητά κύλιση της προεπισκόπησης', () => {
    const before = window.history.length;
    const { result } = renderHook(() => useEditorSection(AGREEMENT_SECTION_MAP));
    act(() => result.current.select('terms'));
    expect(window.location.hash).toBe('#editor-terms');
    expect(window.history.length).toBe(before);
    expect(result.current.previewRequest).toEqual({ section: 'terms', seq: 1 });
    act(() => result.current.select('terms'));
    expect(result.current.previewRequest).toEqual({ section: 'terms', seq: 2 });
  });

  it('το hash γράφεται από το SSoT: query και `history.state` του App Router μένουν αυτούσια', () => {
    window.history.replaceState({ __NA: true }, '', '/agreement?tab=x');
    const { result } = renderHook(() => useEditorSection(AGREEMENT_SECTION_MAP));
    act(() => result.current.select('lines'));
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/agreement?tab=x#editor-lines');
    expect(window.history.state).toEqual({ __NA: true });
  });

  it('επιλογή από το μολύβι του εγγράφου: αλλάζει καρτέλα, ΔΕΝ κυλά την προεπισκόπηση', () => {
    const { result } = renderHook(() => useEditorSection(AGREEMENT_SECTION_MAP));
    act(() => result.current.select('clauses', 'document'));
    expect(result.current.section).toBe('clauses');
    expect(result.current.previewRequest).toBeNull();
  });

  it('καρτέλα από τη διεύθυνση (ανανέωση) ⇒ και η προεπισκόπηση ζητείται εκεί· η πρώτη ενότητα ⇒ κανένα αίτημα', () => {
    window.history.replaceState(null, '', '/agreement#editor-clauses');
    expect(renderHook(() => useEditorSection(AGREEMENT_SECTION_MAP)).result.current.previewRequest).toEqual({ section: 'clauses', seq: 1 });
    window.history.replaceState(null, '', '/agreement#editor-identity');
    expect(renderHook(() => useEditorSection(AGREEMENT_SECTION_MAP)).result.current.previewRequest).toBeNull();
  });

  it('σύνδεσμος μέσα στη φόρμα (`#editor-plan`) ⇒ αλλάζει καρτέλα', () => {
    const { result } = renderHook(() => useEditorSection(AGREEMENT_SECTION_MAP));
    act(() => {
      window.history.replaceState(null, '', '/agreement#editor-plan');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.section).toBe('plan');
  });
});

function Harness({ issues }: { readonly issues: readonly SubcontractIssue[] }) {
  const state = useEditorSection(AGREEMENT_SECTION_MAP);
  const panels = Object.fromEntries(AGREEMENT_SECTION_MAP.sections.map((section) => [section, <p key={section}>panel-{section}</p>]));
  return <EditorSectionTabs map={AGREEMENT_SECTION_MAP} issues={issues} state={state} panels={panels} />;
}

describe('EditorSectionTabs — καρτέλες χωρίς κρυμμένο λάθος', () => {
  it('κάθε καρτέλα λέει πόσα ευρήματα έχει, με λέξη και αριθμό', () => {
    render(<Harness issues={[issue('lines.0.unitPrice'), issue('lines.1.unit'), issue('terms.vat.rate')]} />);
    expect(screen.getByRole('tab', { name: /subcontracts\.sections\.nav\.lines.*"count":2/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /subcontracts\.sections\.nav\.terms.*"count":1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'subcontracts.sections.nav.identity' })).toBeInTheDocument();
  });

  it('όλες οι ενότητες μένουν προσαρτημένες· φαίνεται μόνο η ενεργή', () => {
    render(<Harness issues={[]} />);
    expect(screen.getByText('panel-identity')).toBeVisible();
    expect(screen.getByText('panel-clauses')).toBeInTheDocument();
    expect(screen.getByText('panel-clauses').closest('[role="tabpanel"]')).toHaveClass('data-[state=inactive]:hidden');
    expect(screen.getByText('panel-clauses').closest('[role="tabpanel"]')).toHaveAttribute('data-state', 'inactive');
  });

  it('κλικ σε καρτέλα ⇒ ενεργή ενότητα και hash', () => {
    render(<Harness issues={[]} />);
    const tab = screen.getByRole('tab', { name: 'subcontracts.sections.nav.plan' });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    expect(tab).toHaveAttribute('data-state', 'active');
    expect(window.location.hash).toBe('#editor-plan');
  });
});

describe('paperFitOf — σελίδα Α4, ζουμ «προσαρμογή στο πλάτος»', () => {
  it('στήλη στενότερη ή ίση με Α4 ⇒ ρευστό πλάτος, χωρίς σμίκρυνση', () => {
    expect(paperFitOf(600)).toEqual({ widthPx: null, zoom: 1 });
    expect(paperFitOf(PAPER_A4_WIDTH_PX)).toEqual({ widthPx: null, zoom: 1 });
    expect(paperFitOf(Number.NaN)).toEqual({ widthPx: null, zoom: 1 });
  });

  it('φαρδύτερη στήλη ⇒ πλάτος Α4 και ζουμ που ΔΕΝ ξεπερνά τη στήλη', () => {
    const fit = paperFitOf(1191);
    expect(fit.widthPx).toBe(PAPER_A4_WIDTH_PX);
    expect(fit.zoom).toBe(1.5);
    expect(PAPER_A4_WIDTH_PX * paperFitOf(1000).zoom).toBeLessThanOrEqual(1000);
  });

  it('ταβάνι ×2 — όπως ο προβολέας PDF', () => {
    expect(paperFitOf(5000).zoom).toBe(PAPER_MAX_ZOOM);
  });
});

describe('fillHeightOf — ό,τι μένει από το παράθυρο', () => {
  it('παράθυρο − απόσταση από την κορυφή − κενό βάσης, ακέραια px', () => {
    expect(fillHeightOf(1000, 400.6, { minPx: 480, bottomGapPx: 16 })).toBe(583);
  });

  it('χαμηλό παράθυρο ⇒ το ελάχιστο (κυλά η σελίδα, δεν γίνεται λωρίδα)', () => {
    expect(fillHeightOf(700, 400, { minPx: 480, bottomGapPx: 16 })).toBe(480);
  });
});

const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

/**
 * Όριο (κόβει, padding βάσης 24, κυλισμένο κατά `scrolled`) ⊃ περιτύλιγμα ⊃ [στοιχείο, αδελφό 40 px από κάτω].
 * Το jsdom δεν έχει διάταξη ούτε `overflow-y` στο inline style: τα rect και η υπολογισμένη μορφή του ορίου δίνονται.
 */
function boundaryFixture(scrolled = 0) {
  const boundary = document.createElement('section');
  boundary.style.paddingBottom = '24px';
  Object.defineProperty(boundary, 'clientHeight', { value: 1000 });
  Object.defineProperty(boundary, 'scrollTop', { value: scrolled });
  const wrapper = document.createElement('section');
  const element = document.createElement('section');
  wrapper.append(element, document.createElement('footer'));
  boundary.append(wrapper);
  document.body.append(boundary);
  const realStyle = window.getComputedStyle.bind(window);
  // Ό,τι θα έδινε ο browser: `visible` αντί για το `''` του jsdom, και `hidden` στο όριο.
  const styled = (style: CSSStyleDeclaration, overrides: Readonly<Record<string, string>>) =>
    new Proxy(style, { get: (target, prop) => (typeof prop === 'string' && prop in overrides ? overrides[prop] : Reflect.get(target, prop, target)) });
  jest.spyOn(window, 'getComputedStyle').mockImplementation((node: Element) => {
    const style = realStyle(node);
    return node === boundary ? styled(style, { overflowY: 'hidden' }) : styled(style, { overflowY: style.overflowY || 'visible' });
  });
  jest.spyOn(boundary, 'getBoundingClientRect').mockReturnValue(rect(0, 1000));
  jest.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(rect(100 - scrolled, 340 - scrolled));
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(100 - scrolled, 300 - scrolled));
  return { element };
}

describe('measureFillHeight — το όριο και ό,τι ακολουθεί, μετρημένα (ζωντανός έλεγχος §5.23)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('όριο = ο πρόγονος που κόβει (όχι το παράθυρο)· αφαιρούνται αδέλφια + padding βάσης, όχι σταθερό κενό', () => {
    const { element } = boundaryFixture();
    // 1000 (κάτω άκρο ορίου) − 100 (κορυφή) − 40 (αδελφό) − 24 (padding) = 836 — η πρώτη εκδοχή έδινε innerHeight − 100 − 16.
    expect(measureFillHeight(element, { minPx: 480, bottomGapPx: 0 })).toBe(836);
  });

  it('η κύλιση του ορίου δεν αλλάζει το αποτέλεσμα (κορυφή και όριο μετρώνται στην ίδια θέση κύλισης 0)', () => {
    const { element } = boundaryFixture(356);
    expect(measureFillHeight(element, { minPx: 480, bottomGapPx: 0 })).toBe(836);
  });
});

describe('revealSectionWhenPresent — το αίτημα κύλισης δεν χάνεται', () => {
  const scrollIntoView = jest.fn();
  beforeAll(() => { Element.prototype.scrollIntoView = scrollIntoView; });
  beforeEach(() => scrollIntoView.mockClear());

  it('ο στόχος υπάρχει ⇒ κύλιση αμέσως', () => {
    const scroller = document.createElement('div');
    const node = document.createElement('section');
    node.dataset.docSection = 'clauses';
    scroller.append(node);
    revealSectionWhenPresent(scroller, 'clauses');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('ο στόχος αποδίδεται αργότερα ⇒ η κύλιση γίνεται τότε· μετά την ακύρωση ⇒ καμία', async () => {
    const scroller = document.createElement('div');
    revealSectionWhenPresent(scroller, 'clauses');
    expect(scrollIntoView).not.toHaveBeenCalled();
    const late = document.createElement('section');
    late.dataset.docSection = 'clauses';
    scroller.append(late);
    await Promise.resolve();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    const other = document.createElement('div');
    const cancel = revealSectionWhenPresent(other, 'plan');
    cancel();
    const plan = document.createElement('section');
    plan.dataset.docSection = 'plan';
    other.append(plan);
    await Promise.resolve();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
