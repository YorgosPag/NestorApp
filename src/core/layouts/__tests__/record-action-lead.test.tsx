/**
 * Υ8 — **Η ΚΥΡΙΑ ΕΝΕΡΓΕΙΑ ΑΝΗΚΕΙ ΣΤΗΝ ΚΑΡΤΕΛΑ ΠΟΥ ΒΛΕΠΕΙΣ** (ADR-912 §12.14).
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390×844)**: στα «Έγγραφα» η κάτω μπάρα έλεγε «Επεξεργασία» και το
 * «+ Προσθήκη Αρχείων» ζούσε ψηλά, σε τέταρτη γραμμή εργαλείων. Material 3: docked toolbar με *ενσωματωμένη κύρια
 * ενέργεια αντί για FAB* — ΕΝΑ σημείο ενεργειών, η κύρια της καρτέλας δεξιά, της εγγραφής στο «⋯».
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ αποδεικνύεται **πού** αποδίδεται κάθε ενέργεια, όχι πώς φαίνεται.
 */

/* global describe, it, expect, jest, afterEach */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home } from 'lucide-react';

import { createEntityAction } from '@/core/entity-headers/entity-action-presets';
import { EntityDetailsHeader } from '@/core/entity-headers/UnifiedEntityHeaderSystem';
import type { EntityHeaderAction } from '@/core/entity-headers/UnifiedEntityHeaderSystem';
import { RecordActionBarProvider, RecordActionLead } from '../record-action-bar';
import { TabActivityProvider } from '../tab-activity';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const noop = () => undefined;
const EDIT = createEntityAction('edit', 'Επεξεργασία', noop);
const TRASH = createEntityAction('trash', 'Κάδος', noop);
const SAVE = createEntityAction('save', 'Αποθήκευση', noop);
const CANCEL = createEntityAction('cancel', 'Ακύρωση', noop);

function mockViewport(narrow: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: narrow, media: query, addEventListener: noop, removeEventListener: noop }),
  });
}

interface PageProps {
  readonly actions?: readonly EntityHeaderAction[];
  readonly tabActive?: boolean;
}

/** Σελίδα εγγραφής: κεφαλίδα με `media` + μία καρτέλα που συνεισφέρει «+ Προσθήκη». */
function RecordPage({ actions = [EDIT, TRASH], tabActive = true }: PageProps) {
  return (
    <RecordActionBarProvider>
      <EntityDetailsHeader icon={Home} title="Ακίνητο" media={<figure />} actions={[...actions]} />
      <TabActivityProvider value={tabActive}>
        <section data-testid="tab">
          <RecordActionLead>
            <button type="button">Προσθήκη</button>
          </RecordActionLead>
        </section>
      </TabActivityProvider>
    </RecordActionBarProvider>
  );
}

const bar = () => document.querySelector<HTMLElement>('[data-record-action-bar]') as HTMLElement;
const leadSlot = () => document.querySelector<HTMLElement>('[data-record-action-bar-lead]') as HTMLElement;

describe('Υ8 — συνεισφορά καρτέλας στην κάτω μπάρα', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('🔴 στενή + ενεργή καρτέλα ⇒ η κύρια της καρτέλας στη μπάρα, η «Επεξεργασία» ΜΟΝΟ στο «⋯»', async () => {
    mockViewport(true);
    render(<RecordPage />);

    expect(await within(leadSlot()).findByRole('button', { name: 'Προσθήκη' })).toBeInTheDocument();
    expect(within(screen.getByTestId('tab')).queryByRole('button', { name: 'Προσθήκη' })).toBeNull();
    expect(within(bar()).queryByRole('button', { name: 'Επεξεργασία' })).toBeNull();

    await userEvent.click(within(bar()).getByRole('button', { name: 'actions.more' }));
    expect(screen.getByRole('menuitem', { name: 'Επεξεργασία' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Κάδος' }).className).toContain('text-destructive');
  });

  it('🔴 κρυμμένη (προσαρτημένη) καρτέλα ⇒ τίποτα στη μπάρα· η «Επεξεργασία» ξαναγίνεται κύρια', async () => {
    mockViewport(true);
    render(<RecordPage tabActive={false} />);

    expect(await within(bar()).findByRole('button', { name: 'Επεξεργασία' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Προσθήκη' })).toBeNull();
    expect(leadSlot().childElementCount).toBe(0);
  });

  it('🔴 ανοιχτή επεξεργασία ⇒ η «Αποθήκευση» ΔΕΝ κρύβεται· η καρτέλα αποδίδει επιτόπου', async () => {
    mockViewport(true);
    render(<RecordPage actions={[SAVE, CANCEL]} />);

    expect(await within(bar()).findByRole('button', { name: 'Αποθήκευση' })).toBeInTheDocument();
    expect(within(screen.getByTestId('tab')).getByRole('button', { name: 'Προσθήκη' })).toBeInTheDocument();
    expect(leadSlot().childElementCount).toBe(0);
  });

  it('✅ φαρδιά ⇒ η καρτέλα αποδίδει επιτόπου, η μπάρα μένει άδεια', async () => {
    mockViewport(false);
    render(<RecordPage />);

    expect(await within(screen.getByTestId('tab')).findByRole('button', { name: 'Προσθήκη' })).toBeInTheDocument();
    expect(leadSlot().childElementCount).toBe(0);
  });

  it('✅ χωρίς πάροχο μπάρας ⇒ επιτόπου, χωρίς να ρωτηθεί το παράθυρο', () => {
    render(
      <RecordActionLead>
        <button type="button">Προσθήκη</button>
      </RecordActionLead>,
    );
    expect(screen.getByRole('button', { name: 'Προσθήκη' })).toBeInTheDocument();
  });

  it('✅ η καρτέλα φεύγει ⇒ η διεκδίκηση αποδεσμεύεται και επιστρέφει η «Επεξεργασία»', async () => {
    mockViewport(true);
    const { rerender } = render(<RecordPage />);
    await within(leadSlot()).findByRole('button', { name: 'Προσθήκη' });

    rerender(<RecordPage tabActive={false} />);
    expect(await within(bar()).findByRole('button', { name: 'Επεξεργασία' })).toBeInTheDocument();
  });
});
