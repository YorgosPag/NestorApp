/**
 * ADR-598 G11 — axe + πληκτρολόγιο στα primitives **επιλογής** της ρίζας του `ui/`:
 * `SegmentedControl` (ένα από Ν) · `ToggleButton` (on/off) · `StepRail` (βήματα οδηγού) · `ChoiceCards` (κάρτες πράξης).
 *
 * Δεν αρκεί «mount χωρίς εύρημα». Κάθε primitive υπόσχεται στην κεφαλίδα του μια **σημασιολογία** — και αυτή κρίνεται:
 * - `SegmentedControl`: radio (`aria-checked`), **μία** στάση Tab (roving tabindex), βελάκια μετακινούν εστίαση, Space
 *   επιλέγει, και **ποτέ κενό** (το ξαναπάτημα του επιλεγμένου δεν το αποεπιλέγει). WAI-ARIA APG «Radio Group».
 * - `ToggleButton`: **ένα** χαρακτηριστικό κατάστασης ανά ρόλο (`aria-pressed` | `aria-selected` | `aria-checked`) —
 *   ποτέ `aria-pressed` σε `tab`/`radio` (WAI-ARIA 1.2). Space/Enter εναλλάσσουν (APG «Button», toggle).
 * - `StepRail`: `nav` με όνομα + `ol` + `aria-current="step"`, κατάσταση **σε κείμενο** (όχι μόνο χρώμα, WCAG 1.4.1).
 * - `ChoiceCards`: λίστα με όνομα, κάθε κάρτα κουμπί με όνομα· ανενεργή = εγγενώς `disabled`, εκτός Tab.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText, Upload, Wand2 } from 'lucide-react';

import { expectNoA11yViolations } from '@/test-utils/a11y';

import { ChoiceCards, type ChoiceCardOption } from '../choice-cards';
import { SegmentedControl, SegmentedControlItem } from '../segmented-control';
import { StepRail, type StepRailStatus } from '../step-rail';
import { ToggleButton } from '../toggle-button';

// =============================================================================
// SegmentedControl
// =============================================================================

type View = 'cards' | 'table' | 'map';

function ViewSwitch({ onChange = jest.fn(), orientation }: {
  readonly onChange?: (value: View) => void;
  readonly orientation?: 'horizontal' | 'vertical';
}) {
  const [value, setValue] = React.useState<View>('table');
  return (
    <SegmentedControl<View>
      aria-label="Προβολή"
      value={value}
      orientation={orientation}
      onValueChange={(next) => { onChange(next); setValue(next); }}
    >
      <SegmentedControlItem value="cards">Κάρτες</SegmentedControlItem>
      <SegmentedControlItem value="table">Πίνακας</SegmentedControlItem>
      <SegmentedControlItem value="map" disabled>Χάρτης</SegmentedControlItem>
    </SegmentedControl>
  );
}

describe('SegmentedControl a11y', () => {
  it.each(['horizontal', 'vertical'] as const)('ομάδα με όνομα, radio με aria-checked (%s)', async (orientation) => {
    const { container } = render(<ViewSwitch orientation={orientation} />);
    expect(screen.getByRole('group', { name: 'Προβολή' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Πίνακας' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Κάρτες' })).toHaveAttribute('aria-checked', 'false');
    // Η κατάσταση ζει σε ΕΝΑ χαρακτηριστικό — ποτέ και `aria-pressed` σε radio.
    screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toHaveAttribute('aria-pressed'));
    await expectNoA11yViolations(container);
  });

  it('μία στάση Tab: η εστίαση μπαίνει στο επιλεγμένο, το επόμενο Tab βγαίνει από την ομάδα', async () => {
    const user = userEvent.setup();
    render(<><ViewSwitch /><button type="button">μετά</button></>);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Πίνακας' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'μετά' })).toHaveFocus();
  });

  it('βελάκι μετακινεί την εστίαση (παρακάμπτει το disabled), Space επιλέγει', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ViewSwitch onChange={onChange} />);
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Κάρτες' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith('cards');
    expect(screen.getByRole('radio', { name: 'Κάρτες' })).toHaveAttribute('aria-checked', 'true');
    // Από το πρώτο, προς τα πίσω: τυλίγεται — και ΔΕΝ σταματά στο ανενεργό «Χάρτης».
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Πίνακας' })).toHaveFocus();
  });

  it('ποτέ κενό: το ξαναπάτημα του επιλεγμένου δεν καλεί onValueChange και η επιλογή μένει', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ViewSwitch onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Πίνακας' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Πίνακας' })).toHaveAttribute('aria-checked', 'true');
  });
});

// =============================================================================
// ToggleButton
// =============================================================================

function BoldToggle() {
  const [pressed, setPressed] = React.useState(false);
  return <ToggleButton pressed={pressed} onClick={() => setPressed((p) => !p)}>Έντονα</ToggleButton>;
}

describe('ToggleButton a11y', () => {
  it.each([false, true])('εναλλαγή: aria-pressed=%s', async (pressed) => {
    const { container } = render(<ToggleButton pressed={pressed}>Πλέγμα</ToggleButton>);
    expect(screen.getByRole('button', { name: 'Πλέγμα', pressed })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('semantics="selected" σε tab: aria-selected, ΚΑΝΕΝΑ aria-pressed', async () => {
    const { container } = render(
      <div role="tablist" aria-label="Ενότητες">
        <ToggleButton role="tab" semantics="selected" pressed>Γενικά</ToggleButton>
        <ToggleButton role="tab" semantics="selected" pressed={false}>Τιμές</ToggleButton>
      </div>,
    );
    const tab = screen.getByRole('tab', { name: 'Γενικά', selected: true });
    expect(tab).not.toHaveAttribute('aria-pressed');
    await expectNoA11yViolations(container);
  });

  it('semantics="checked" σε radio: aria-checked, ΚΑΝΕΝΑ aria-pressed', async () => {
    const { container } = render(
      <div role="radiogroup" aria-label="Μονάδα">
        <ToggleButton role="radio" semantics="checked" pressed>m²</ToggleButton>
        <ToggleButton role="radio" semantics="checked" pressed={false}>ft²</ToggleButton>
      </div>,
    );
    expect(screen.getByRole('radio', { name: 'm²', checked: true })).not.toHaveAttribute('aria-pressed');
    await expectNoA11yViolations(container);
  });

  it('disabled: εκτός Tab, καθαρό', async () => {
    const { container } = render(<ToggleButton pressed disabled>Κλείδωμα</ToggleButton>);
    expect(screen.getByRole('button', { name: 'Κλείδωμα' })).toBeDisabled();
    await expectNoA11yViolations(container);
  });

  it('πληκτρολόγιο: Space και Enter εναλλάσσουν την κατάσταση', async () => {
    const user = userEvent.setup();
    render(<BoldToggle />);
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Έντονα' })).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Έντονα' })).toHaveAttribute('aria-pressed', 'false');
  });
});

// =============================================================================
// StepRail
// =============================================================================

type Step = 'scale' | 'walls' | 'rooms';

const STATUS_WORD: Readonly<Record<StepRailStatus, string>> = {
  done: 'ολοκληρώθηκε',
  attention: 'θέλει προσοχή',
  pending: 'δεν ξεκίνησε',
};

const STEPS = [
  { id: 'scale', label: 'Κλίμακα', status: 'done' },
  { id: 'walls', label: 'Τοίχοι', status: 'attention' },
  { id: 'rooms', label: 'Χώροι', status: 'pending' },
].map((step) => ({ ...step, statusLabel: STATUS_WORD[step.status as StepRailStatus] })) as readonly {
  readonly id: Step; readonly label: string; readonly status: StepRailStatus; readonly statusLabel: string;
}[];

describe('StepRail a11y', () => {
  it.each(['scale', 'walls', 'rooms'] as const)('nav + ol + aria-current="step" (τρέχον: %s)', async (currentId) => {
    const { container } = render(
      <StepRail<Step> steps={STEPS} currentId={currentId} onSelect={jest.fn()} ariaLabel="Βήματα κάτοψης" />,
    );
    const nav = screen.getByRole('navigation', { name: 'Βήματα κάτοψης' });
    expect(nav.querySelector('ol')).not.toBeNull();
    const current = screen.getAllByRole('button').filter((button) => button.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('data-step', currentId);
    await expectNoA11yViolations(container);
  });

  it('η κατάσταση ακούγεται ως κείμενο, όχι μόνο ως χρώμα/σχήμα (WCAG 1.4.1)', () => {
    render(<StepRail<Step> steps={STEPS} currentId="scale" onSelect={jest.fn()} ariaLabel="Βήματα" />);
    expect(screen.getByRole('button', { name: 'Κλίμακα ολοκληρώθηκε' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Τοίχοι θέλει προσοχή' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Χώροι δεν ξεκίνησε' })).toBeInTheDocument();
  });

  it('πληκτρολόγιο: κάθε βήμα είναι στάση Tab, Enter επιλέγει (ελεύθερη μετάβαση, NN/g)', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<StepRail<Step> steps={STEPS} currentId="scale" onSelect={onSelect} ariaLabel="Βήματα" />);
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Χώροι/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('rooms');
  });
});

// =============================================================================
// ChoiceCards
// =============================================================================

type Source = 'upload' | 'draw' | 'auto';

const OPTIONS: readonly ChoiceCardOption<Source>[] = [
  { id: 'upload', icon: Upload, title: 'Μεταφόρτωση', description: 'DXF, PDF ή εικόνα' },
  { id: 'draw', icon: FileText, title: 'Σχεδίαση' },
  { id: 'auto', icon: Wand2, title: 'Αυτόματα', disabled: true, disabledReason: 'Χρειάζεται πρώτα κάτοψη' },
];

describe('ChoiceCards a11y', () => {
  it.each(['md', 'lg'] as const)('λίστα με όνομα, κάρτες-κουμπιά με όνομα (μέγεθος %s)', async (size) => {
    const { container } = render(<ChoiceCards<Source> options={OPTIONS} onSelect={jest.fn()} ariaLabel="Πηγή κάτοψης" size={size} />);
    expect(screen.getByRole('list', { name: 'Πηγή κάτοψης' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^Μεταφόρτωση/ })).toBeEnabled();
    await expectNoA11yViolations(container);
  });

  it('ανενεργή κάρτα: εγγενώς disabled, ο λόγος στη θέση της περιγραφής', () => {
    render(<ChoiceCards<Source> options={OPTIONS} onSelect={jest.fn()} ariaLabel="Πηγή" />);
    const auto = screen.getByRole('button', { name: /^Αυτόματα/ });
    expect(auto).toBeDisabled();
    expect(auto).toHaveTextContent('Χρειάζεται πρώτα κάτοψη');
  });

  it('πληκτρολόγιο: Tab περνά τις ενεργές, παρακάμπτει την ανενεργή· Enter επιλέγει', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<><ChoiceCards<Source> options={OPTIONS} onSelect={onSelect} ariaLabel="Πηγή" /><button type="button">μετά</button></>);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Σχεδίαση/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('draw');
    await user.tab();
    expect(screen.getByRole('button', { name: 'μετά' })).toHaveFocus();
  });
});
