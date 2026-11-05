/**
 * Διάταξη των επεξεργαστών υπεργολαβίας (ADR-928 §5.23): ενότητες ως καρτέλες με το hash ως κάτοχο · αίτημα κύλισης
 * της προεπισκόπησης μόνο από τη φόρμα · σελίδα Α4 με ζουμ «προσαρμογή στο πλάτος» · ύψος που γεμίζει το παράθυρο.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { fillHeightOf } from '@/hooks/useFillViewportHeight';
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
