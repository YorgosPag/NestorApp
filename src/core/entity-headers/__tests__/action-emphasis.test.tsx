/**
 * Υ7 — **ΕΝΑ ΚΥΡΙΟ, ΟΙ ΚΑΤΑΣΤΡΟΦΙΚΕΣ ΣΤΟ ΜΕΝΟΥ, ΚΑΙ ΣΤΟ ΚΙΝΗΤΟ Η ΚΑΤΩ ΜΠΑΡΑ** (ADR-912 §12.13 · ADR-777 §8.87.11).
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390×844)**: στη σελίδα ακινήτου τέσσερα κουμπιά σε τέσσερα χρώματα,
 * όλα με το ίδιο βάρος, και ο κάδος κόκκινος δίπλα στην «Επεξεργασία». Πρακτική Material 3 / Apple HIG / Polaris:
 * ΕΝΑ γεμάτο κουμπί, τα υπόλοιπα ουδέτερα, οι καταστροφικές μόνο στο «⋯».
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ αποδεικνύεται **πού** αποδίδεται κάθε ενέργεια, όχι πώς φαίνεται.
 */

/* global describe, it, expect, jest, afterEach */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home } from 'lucide-react';

import { RecordActionBarProvider } from '@/core/layouts/record-action-bar';
import { mockViewport } from '@/test-utils/viewport';
import { createEntityAction, presentEntityActions } from '../entity-action-presets';
import { EntityDetailsHeader } from '../UnifiedEntityHeaderSystem';
import type { EntityHeaderAction } from '../UnifiedEntityHeaderSystem';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const noop = () => undefined;
const EDIT = createEntityAction('edit', 'Επεξεργασία', noop);
const SAVE = createEntityAction('save', 'Αποθήκευση', noop);
const SHOWCASE = createEntityAction('showcase', 'Επίδειξη', noop);
const TRASH = createEntityAction('trash', 'Κάδος', noop);

describe('Υ7α — `presentEntityActions`: ο ΕΝΑΣ κανόνας', () => {
  it('🔴 δύο κύριες ⇒ μένει κύρια ΜΟΝΟ η πρώτη· η σειρά δεν αλλάζει', () => {
    const { inline } = presentEntityActions([SAVE, EDIT, SHOWCASE]);
    expect(inline.map((action) => action.label)).toEqual(['Αποθήκευση', 'Επεξεργασία', 'Επίδειξη']);
    expect(inline.map((action) => action.emphasis)).toEqual(['primary', 'secondary', 'secondary']);
  });

  it('🔴 καταστροφική ⇒ ΠΟΤΕ στη γραμμή, μόνο στο μενού', () => {
    const { inline, menuOnly } = presentEntityActions([EDIT, TRASH, SHOWCASE]);
    expect(inline.map((action) => action.label)).toEqual(['Επεξεργασία', 'Επίδειξη']);
    expect(menuOnly.map((action) => action.label)).toEqual(['Κάδος']);
  });

  it('✅ χειροποίητη ενέργεια χωρίς έμφαση ⇒ δευτερεύουσα, όχι κύρια', () => {
    const handBuilt: EntityHeaderAction = { label: 'Χειροποίητη', onClick: noop };
    const { inline } = presentEntityActions([handBuilt, EDIT]);
    expect(inline[0].emphasis).toBeUndefined();
    expect(inline[1].emphasis).toBe('primary');
  });

  it('✅ ο τύπος ορίζει την έμφαση· ρητή τιμή υπερισχύει', () => {
    expect(EDIT.emphasis).toBe('primary');
    expect(SHOWCASE.emphasis).toBe('secondary');
    expect(TRASH.emphasis).toBe('destructive');
    expect(createEntityAction('view', 'Δες', noop, { emphasis: 'primary' }).emphasis).toBe('primary');
  });
});

describe('Υ7β — η γραμμή ενεργειών της κεφαλίδας', () => {
  it('🔴 γεμάτο ΜΟΝΟ το κύριο· ο κάδος στο «⋯» με χρώμα κινδύνου', async () => {
    render(<EntityDetailsHeader icon={Home} title="Ακίνητο" actions={[EDIT, SHOWCASE, TRASH]} />);

    // Γέμισμα = `ENTITY_ACTION_PRIMARY_FILL`, ΟΧΙ `bg-primary` (στο σκοτεινό θέμα `--primary` ≡ `--card`, ADR-770).
    expect(screen.getByRole('button', { name: 'Επεξεργασία' }).className).toContain('text-white');
    expect(screen.getByRole('button', { name: 'Επίδειξη' }).className).not.toContain('text-white');
    expect(screen.queryByRole('button', { name: 'Κάδος' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'actions.more' }));
    expect(screen.getByRole('menuitem', { name: 'Κάδος' }).className).toContain('text-destructive');
  });
});

describe('Υ7γ — σελίδα εγγραφής (`media`): κάτω μπάρα σε στενή οθόνη', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia');
  });

  function mountRecordPage() {
    return render(
      <RecordActionBarProvider>
        <EntityDetailsHeader
          icon={Home}
          title="Ακίνητο"
          media={<figure data-testid="media" />}
          actions={[EDIT, SHOWCASE, TRASH]}
        />
      </RecordActionBarProvider>,
    );
  }

  it('🔴 στενή ⇒ οι ενέργειες ζουν ΜΟΝΟ στην μπάρα, ΕΝΑ αντίτυπο', async () => {
    mockViewport(true);
    const { container } = mountRecordPage();

    const bar = container.querySelector<HTMLElement>('[data-record-action-bar]');
    expect(bar).not.toBeNull();
    expect(await within(bar as HTMLElement).findByRole('button', { name: 'Επεξεργασία' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Επεξεργασία' })).toHaveLength(1);
  });

  it('✅ φαρδιά ⇒ επιτόπου στην κεφαλίδα, η μπάρα μένει άδεια', async () => {
    mockViewport(false);
    const { container } = mountRecordPage();

    expect(await screen.findByRole('button', { name: 'Επεξεργασία' })).toBeInTheDocument();
    expect(container.querySelector('[data-record-action-bar-record]')?.childElementCount).toBe(0);
    expect(container.querySelector('[data-record-action-bar-lead]')?.childElementCount).toBe(0);
    expect(screen.queryByRole('button', { name: 'Κάδος' })).toBeNull();
  });

  it('✅ χωρίς πάροχο μπάρας ⇒ επιτόπου, χωρίς καν να ρωτηθεί το παράθυρο', () => {
    render(<EntityDetailsHeader icon={Home} title="Ακίνητο" media={<figure />} actions={[EDIT]} />);
    expect(screen.getByRole('button', { name: 'Επεξεργασία' })).toBeInTheDocument();
  });
});
