/**
 * ADR-759 Φ2 — anchor for widening `FieldProvenance` with `'survey'`.
 *
 * WHY THIS FILE EXISTS. Before ADR-759, `FieldProvenance` was `'zone' | 'user'` and
 * two places consumed it in a way that could not survive a third member:
 *
 *   1. `ProvenanceBadge` branched `if (zone) … else <userOverride/>`. A `'survey'`
 *      value would render the label **"manual override"** — wrong text, no type
 *      error, no failing test. The user would be told a surveyor's adopted number
 *      was typed by hand.
 *   2. `canResetField` asked `=== 'user'`. An adopted value would therefore offer
 *      no reset affordance at all — a silently missing control.
 *
 * Neither had a single test before this file. That is the point: the widening was
 * safe to *compile* and unsafe to *ship*, and nothing in the repo could tell the
 * difference. These cases fail if either regression is reintroduced.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ProvenanceBadge } from '../ProvenanceBadge';
import { canResetField } from '@/hooks/useProjectBuildingCode.helpers';
import type {
  FieldProvenance,
  ProjectBuildingCodePhase2,
} from '@/types/project-building-code';

/** Every member of the union, listed exhaustively on purpose. */
const ALL_PROVENANCES: readonly FieldProvenance[] = ['zone', 'user', 'survey'];

function draftWith(
  provenance: FieldProvenance,
  zoneId: string | null = 'Β2',
): ProjectBuildingCodePhase2 {
  return {
    plotType: 'mesaio',
    frontagesCount: 1,
    zoneId,
    sd: 1.2,
    coveragePct: 60,
    maxHeight: 11,
    provenance: { sd: provenance, coveragePct: provenance, maxHeight: provenance },
    enabled: true,
    lastUpdated: '2026-08-05T00:00:00.000Z',
  } as ProjectBuildingCodePhase2;
}

describe('ProvenanceBadge — one distinct label per provenance', () => {
  it.each(ALL_PROVENANCES)('renders a dedicated label for %s', (provenance) => {
    const { container } = render(
      <ProvenanceBadge provenance={provenance} zoneId="Β2" />,
    );
    expect(container.textContent).toBeTruthy();
  });

  it('does not label a survey-adopted value as a manual override', () => {
    render(<ProvenanceBadge provenance="survey" zoneId="Β2" />);
    expect(screen.queryByText('provenance.userOverride')).not.toBeInTheDocument();
    expect(screen.getByText('provenance.fromSurvey')).toBeInTheDocument();
  });

  it('gives every provenance a label nobody else uses', () => {
    const labels = ALL_PROVENANCES.map((provenance) => {
      const { container, unmount } = render(
        <ProvenanceBadge provenance={provenance} zoneId="Β2" />,
      );
      const text = container.textContent ?? '';
      unmount();
      return text;
    });
    expect(new Set(labels).size).toBe(ALL_PROVENANCES.length);
  });

  it('still shows the no-zone label regardless of provenance', () => {
    for (const provenance of ALL_PROVENANCES) {
      const { container, unmount } = render(
        <ProvenanceBadge provenance={provenance} zoneId={null} />,
      );
      expect(container.textContent).toContain('provenance.default');
      unmount();
    }
  });
});

describe('canResetField — reset is offered for any deviation from the zone', () => {
  it('offers reset for a manual override', () => {
    expect(canResetField(draftWith('user'), 'sd')).toBe(true);
  });

  it('offers reset for a survey-adopted value', () => {
    // The regression this guards: `=== 'user'` returns false here, so the reset
    // button quietly disappears for every adopted field.
    expect(canResetField(draftWith('survey'), 'sd')).toBe(true);
  });

  it('does not offer reset when the value already is the zone default', () => {
    expect(canResetField(draftWith('zone'), 'sd')).toBe(false);
  });

  it('never offers reset without a selected zone', () => {
    for (const provenance of ALL_PROVENANCES) {
      expect(canResetField(draftWith(provenance, null), 'sd')).toBe(false);
    }
  });
});
