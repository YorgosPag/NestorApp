/**
 * ADR-759 Φ2β — anchor for the ONE list renderer.
 *
 * The config anchors prove the data model. They cannot prove any of this:
 *
 * 1. **An empty list is on screen.** ADR-759 §4.2 rule 3 — the engineer has to see
 *    *what is missing*. A section that collapsed to nothing when it had no rows would
 *    pass every config test ever written.
 * 2. **Rows have unique DOM ids.** Three approvals all render the label key
 *    `approvals.authority`. Before `idScope`, all three inputs shared one `id`, so
 *    every `<Label htmlFor>` pointed at the first one — clicking the label of row 2
 *    focused row 1, and a screen reader read the wrong field. Nothing looks broken.
 * 3. **Add and remove reach the record.** The buttons must produce a NEW record with
 *    one more (or one fewer) row, not mutate in place.
 * 4. **Read-only mode withholds the affordances but not the information.**
 * 5. **The linked-contact control stays behind a lazy boundary.** This suite is that
 *    gate, and it works the way ADR-759 §4.5.1's did: a static import of
 *    `SurveyLinkedContactField` pulls `ContactsService → services/realtime →
 *    firebase/auth` in, and the suite stops loading entirely (`fetch is not
 *    defined`). A test asks the same question a bundler does.
 */
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/services/enterprise-id.service', () => {
  let counter = 0;
  return {
    generateSurveyRecordId: () => 'srv_test_fixed',
    generateSurveyActId: () => `svact_${++counter}`,
    generateSurveyApprovalId: () => `svapr_${++counter}`,
    generateSurveyTitleDeedId: () => `svdeed_${++counter}`,
  };
});

import { SurveyListSection } from '../SurveyListSection';
import {
  SURVEY_ACT_SECTIONS,
  SURVEY_APPROVALS_SECTION,
  SURVEY_REMARKS_SECTION,
} from '@/config/survey-list-config';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { SurveyRecord } from '@/types/project-survey-record';

/**
 * Ο `ConditionalAppShell` τυλίγει **ΟΛΗ** την εφαρμογή σε `TooltipProvider`, οπότε ο
 * κώδικας παραγωγής δεν φέρνει δικό του — ό,τι αποδίδεται μέσα στο κέλυφος έχει το
 * context. Ένα render test όμως ξεκινά από γυμνή ρίζα, άρα το φέρνει εδώ: αλλιώς ο
 * πρώτος `Tooltip` πετάει «must be used within TooltipProvider» και το test μοιάζει
 * να αναφέρει ελάττωμα του component ενώ αναφέρει έλλειψη της **σκαλωσιάς** του.
 */
function Wrapper({ children }: { readonly children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

/** Ένα σημείο τύλιξης για **όλες** τις αποδόσεις — όχι εννιά `{ wrapper }` (N.18). */
function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper });
}

function blank(): SurveyRecord {
  return createEmptySurveyRecord({
    companyId: 'company-a',
    projectId: 'proj_1',
    createdBy: 'usr_1',
    now: '2026-08-05T10:00:00.000Z',
  });
}

describe('an empty repeating section', () => {
  it('shows the empty line instead of disappearing', () => {
    render(
      <SurveyListSection
        record={blank()}
        section={SURVEY_APPROVALS_SECTION}
        isEditing={false}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('approvals.empty')).toBeInTheDocument();
    expect(screen.getByText('sections.th')).toBeInTheDocument();
  });

  it('still shows the empty line while editing, next to the add button', () => {
    render(
      <SurveyListSection
        record={blank()}
        section={SURVEY_APPROVALS_SECTION}
        isEditing
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('approvals.empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'approvals.add' })).toBeInTheDocument();
  });
});

describe('adding and removing rows', () => {
  it('hands back a new record with one more row', async () => {
    const onChange = jest.fn();
    render(
      <SurveyListSection
        record={blank()}
        section={SURVEY_APPROVALS_SECTION}
        isEditing
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'approvals.add' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0] as SurveyRecord;
    expect(next.approvals).toHaveLength(1);
    expect(next.approvals[0]?.id).toMatch(/^svapr_/);
  });

  it('removes the row the button belongs to, not the first one', async () => {
    const twoRows = SURVEY_APPROVALS_SECTION.appendRow(
      SURVEY_APPROVALS_SECTION.appendRow(blank())
    );
    const firstId = twoRows.approvals[0]?.id;
    const onChange = jest.fn();

    render(
      <SurveyListSection
        record={twoRows}
        section={SURVEY_APPROVALS_SECTION}
        isEditing
        onChange={onChange}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: 'approvals.remove' });
    expect(removeButtons).toHaveLength(2);
    await userEvent.click(removeButtons[1]!);

    const next = onChange.mock.calls[0]?.[0] as SurveyRecord;
    expect(next.approvals).toHaveLength(1);
    expect(next.approvals[0]?.id).toBe(firstId);
  });
});

describe('row inputs are addressable one by one', () => {
  it('gives every row its own input id, so each label points at its own field', () => {
    // 🔴 The `idScope` regression. Without it all three rows render `id`
    // `survey-approvals-authority`, `htmlFor` resolves to the first input for all of
    // them, and label clicks plus screen readers land on the wrong row — silently.
    const threeRows = [0, 1, 2].reduce(
      (record) => SURVEY_APPROVALS_SECTION.appendRow(record),
      blank()
    );

    const { container } = render(
      <SurveyListSection
        record={threeRows}
        section={SURVEY_APPROVALS_SECTION}
        isEditing
        onChange={jest.fn()}
      />
    );

    const ids = [...container.querySelectorAll('input[id]')].map((node) => node.id);
    expect(ids.length).toBeGreaterThanOrEqual(9); // 3 rows × 3 fields
    expect(new Set(ids).size).toBe(ids.length);

    // And each label actually resolves to an input that exists.
    for (const label of container.querySelectorAll('label[for]')) {
      const target = label.getAttribute('for');
      expect(container.querySelector(`#${CSS.escape(target ?? '')}`)).not.toBeNull();
    }
  });
});

describe('read-only mode', () => {
  it('withholds add and remove but keeps the rows visible', () => {
    const oneRow = SURVEY_APPROVALS_SECTION.appendRow(blank());
    render(
      <SurveyListSection
        record={oneRow}
        section={SURVEY_APPROVALS_SECTION}
        isEditing={false}
        onChange={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'approvals.add' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'approvals.remove' })).toBeNull();
    expect(screen.getByText('approvals.authority')).toBeInTheDocument();
    // Empty values read as an explicit statement, never as a blank cell.
    expect(screen.getAllByText('provenance.empty').length).toBeGreaterThan(0);
  });
});

describe('the nested ΦΕΚ list', () => {
  it('appears inside an act and starts empty and visible', () => {
    const section = SURVEY_ACT_SECTIONS[0]!;
    const oneAct = section.appendRow(blank());

    render(
      <SurveyListSection
        record={oneAct}
        section={section}
        isEditing
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText('gazette.title')).toBeInTheDocument();
    expect(screen.getByText('gazette.empty')).toBeInTheDocument();
  });

  it('adds the ΦΕΚ to the act it was clicked in', async () => {
    const section = SURVEY_ACT_SECTIONS[0]!;
    const twoActs = section.appendRow(section.appendRow(blank()));
    const onChange = jest.fn();

    render(
      <SurveyListSection record={twoActs} section={section} isEditing onChange={onChange} />
    );

    const addButtons = screen.getAllByRole('button', { name: 'gazette.add' });
    expect(addButtons).toHaveLength(2);
    await userEvent.click(addButtons[1]!);

    const next = onChange.mock.calls[0]?.[0] as SurveyRecord;
    expect(next.institutionalActs.urbanPlanDecree[0]?.gazettes).toHaveLength(0);
    expect(next.institutionalActs.urbanPlanDecree[1]?.gazettes).toHaveLength(1);
    // Verbatim text is the required part; the structured triple starts unparsed.
    expect(next.institutionalActs.urbanPlanDecree[1]?.gazettes[0]?.rawText).toBe('');
    expect(next.institutionalActs.urbanPlanDecree[1]?.gazettes[0]?.relation).toBeNull();
  });
});

describe('the remarks section', () => {
  it('renders one editor per remark and keeps them independent', async () => {
    const twoRemarks = SURVEY_REMARKS_SECTION.appendRow(
      SURVEY_REMARKS_SECTION.appendRow(blank())
    );
    const onChange = jest.fn();

    const { container } = render(
      <SurveyListSection
        record={twoRemarks}
        section={SURVEY_REMARKS_SECTION}
        isEditing
        onChange={onChange}
      />
    );

    const editors = [...container.querySelectorAll('textarea')];
    expect(editors).toHaveLength(2);
    expect(new Set(editors.map((node) => node.id)).size).toBe(2);

    await userEvent.type(editors[1]!, 'x');
    const next = onChange.mock.calls[0]?.[0] as SurveyRecord;
    expect(next.remarks[0]?.value).toBeNull();
    expect(next.remarks[1]?.value).toBe('x');
  });
});
