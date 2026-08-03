/**
 * ADR-750 Φάση 3 — **το dropdown περιγραμμάτων μέσα στο mini toolbar**: APG και συμπεριφορά.
 *
 * Δοκιμάζεται μέσα από το **πραγματικό** `TableFormatToolbar`, όχι μεμονωμένα: το πάνελ ζει
 * σκόπιμα **μέσα** στο δοχείο της γραμμής (εκεί όπου ο φύλακας `keepOpenOnToolbar` του γονέα το
 * αναγνωρίζει ως «δικό του»), οπότε ένα test που το απομόνωνε θα επαλήθευε άλλη τοπολογία από
 * αυτή που τρέχει.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import { TableFormatToolbar } from '../TableFormatToolbar';
import { tableBorderMenuItems } from '../table-border-menu-items';
import type { TableAxisFormatSnapshot, TableToggleFormatState } from '../TableFormatToolbar';

// Ίδιο μοτίβο με το αδελφό `table-format-toolbar.test.tsx`: πραγματικό i18next με το **ίδιο**
// locale αρχείο που φορτώνει η παραγωγή. Τα ονόματα των 13 εντολών είναι το αντικείμενο του
// test — ένα ωμό κλειδί θα έκανε κάθε `getByRole(name)` ψευδώς πράσινο ή ψευδώς κόκκινο.
jest.mock('@/i18n/lazy-config', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
  CRITICAL_NAMESPACES: [],
}));

const i18nInstance = i18next.createInstance();

beforeAll(async () => {
  await i18nInstance.use(initReactI18next).use(ICU).init({
    lng: 'el',
    fallbackLng: 'el',
    resources: {},
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });
  i18nInstance.addResourceBundle('el', 'dxf-viewer', elDxfViewer, true, true);
});

function I18nWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
}

const wrapper = { wrapper: I18nWrapper };

const NO_FORMAT: TableToggleFormatState = { active: false, mixed: false, explicit: false };
/**
 * ADR-739 Φ.Ε/Φ4 + Φ4β — τα δύο χρώματα **πρέπει** να δηλωθούν, ακόμη κι εδώ που το θέμα είναι
 * τα περιγράμματα: η γραμμή τα αποδίδει πάντα, και ένα `undefined` state θα έσκαγε στο
 * `resolveColorMenuSelection`. Κληρονομούμενα και τα δύο — το ουδέτερο σημείο εκκίνησης.
 */
const NO_COLOR = {
  current: undefined, mixed: false, explicit: false,
  inheritedColor: undefined, drawingColors: [],
} as const;
const FORMAT: TableAxisFormatSnapshot = {
  bold: NO_FORMAT,
  italic: NO_FORMAT,
  underline: NO_FORMAT,
  textColor: { ...NO_COLOR, current: '#111111', inheritedColor: '#111111' },
  fillColor: NO_COLOR,
  canReset: false,
};

function renderToolbar(borders?: {
  canReset?: boolean;
  onApply?: jest.Mock;
  onReset?: jest.Mock;
}) {
  const onApply = borders?.onApply ?? jest.fn();
  const onReset = borders?.onReset ?? jest.fn();
  const surfaceRef = React.createRef<HTMLDivElement>();
  const noop = (): void => {};

  render(
    <TableFormatToolbar
      anchorX={10}
      anchorY={10}
      axis="column"
      label="B"
      format={FORMAT}
      surfaceRef={surfaceRef}
      onToggle={noop}
      onStepSize={noop}
      onReset={noop}
      onSetTextColor={noop}
      onSetFillColor={noop}
      borders={{ canReset: borders?.canReset ?? true, onApply, onReset }}
    />,
    wrapper,
  );
  return { onApply, onReset };
}

/** Ανοίγει το πάνελ πατώντας τον trigger. */
function openPanel(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Περιγράμματα' }));
  return screen.getByRole('menu', { name: 'Περιγράμματα κελιών' });
}

describe('ADR-750 Φ3 — το dropdown στο toolbar', () => {
  it('χωρίς το prop `borders`, η γραμμή ΔΕΝ δείχνει καθόλου περιγράμματα', () => {
    const surfaceRef = React.createRef<HTMLDivElement>();
    const noop = (): void => {};
    render(
      <TableFormatToolbar
        anchorX={10} anchorY={10} axis="column" label="B" format={FORMAT}
        surfaceRef={surfaceRef} onToggle={noop} onStepSize={noop} onReset={noop}
        onSetTextColor={noop} onSetFillColor={noop}
      />,
      wrapper,
    );
    expect(screen.queryByRole('button', { name: 'Περιγράμματα' })).toBeNull();
  });

  it('το πάνελ είναι κλειστό αρχικά και ο trigger το δηλώνει με `aria-expanded`', () => {
    renderToolbar();
    const trigger = screen.getByRole('button', { name: 'Περιγράμματα' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('ανοίγει με κλικ και δείχνει τις 11 διαθέσιμες εντολές + την επαναφορά', () => {
    renderToolbar();
    const panel = openPanel();
    const items = panel.querySelectorAll('[role="menuitem"]');
    expect(items).toHaveLength(tableBorderMenuItems().length + 1);
    expect(screen.getByRole('button', { name: 'Περιγράμματα' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('🔴 κάθε εντολή έχει ΟΡΑΤΟ κείμενο — όχι μόνο εικονίδιο και tooltip (§9.2)', () => {
    renderToolbar();
    openPanel();
    // Δείγμα και από τις τρεις ομάδες του μενού.
    for (const label of ['Κάτω περίγραμμα', 'Όλα τα περιγράμματα', 'Παχύ κάτω περίγραμμα']) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('✅ Φ5 — οι δύο ΔΙΠΛΕΣ γραμμές προσφέρονται πλέον (Α17 → Α24)', () => {
    // Μέχρι τη Φ4 αυτό το test απαιτούσε την **απουσία** τους: ο μηχανισμός δεν υπήρχε και ένα
    // κουμπί που φαίνεται ενεργό χωρίς να κάνει τίποτα είναι χειρότερο από ένα που λείπει.
    // Η αντιστροφή του είναι το ρητό ίχνος που ζήτησε η Α17 — όχι σιωπηλή προσθήκη.
    renderToolbar();
    openPanel();
    expect(screen.getByRole('menuitem', { name: 'Κάτω διπλό περίγραμμα' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /διπλό κάτω/ })).toBeInTheDocument();
  });

  it('κλικ σε εντολή: καλεί `onApply` με τη ΣΩΣΤΗ ταυτότητα και κλείνει το πάνελ', () => {
    const { onApply } = renderToolbar();
    openPanel();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Όλα τα περιγράμματα' }));
    expect(onApply).toHaveBeenCalledWith('all');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('«Επαναφορά περιγραμμάτων»: ενεργή με canReset, καλεί `onReset`', () => {
    const { onReset } = renderToolbar({ canReset: true });
    openPanel();
    const reset = screen.getByRole('menuitem', { name: 'Επαναφορά περιγραμμάτων' });
    expect(reset).not.toHaveAttribute('aria-disabled');
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('🔴 χωρίς ρητή ακμή: ανενεργή αλλά ΕΣΤΙΑΣΙΜΗ, και το κλικ είναι no-op', () => {
    // `aria-disabled` και όχι `disabled`: ο δείκτης του roving δεν επιτρέπεται να πέσει σε τρύπα
    // — το APG ορίζει ότι τα χειριστήρια μένουν προσπελάσιμα ώστε ο χρήστης να μαθαίνει τι υπάρχει.
    const { onReset } = renderToolbar({ canReset: false });
    openPanel();
    const reset = screen.getByRole('menuitem', { name: 'Επαναφορά περιγραμμάτων' });
    expect(reset).toHaveAttribute('aria-disabled', 'true');
    expect(reset).not.toHaveAttribute('disabled');
    fireEvent.click(reset);
    expect(onReset).not.toHaveBeenCalled();
  });

  it('τα διαχωριστικά είναι `role="separator"` — δύο, όσες και οι αλλαγές ομάδας + 1', () => {
    renderToolbar();
    const panel = openPanel();
    // 2 από τις ομάδες του μητρώου + 1 πριν την επαναφορά (άλλο επίπεδο πράξης).
    expect(panel.querySelectorAll('[role="separator"]')).toHaveLength(3);
  });

  it('🔴 `Escape` κλείνει ΜΟΝΟ το πάνελ — ένα Escape, ένα επίπεδο', () => {
    renderToolbar();
    const panel = openPanel();
    act(() => { fireEvent.keyDown(panel, { key: 'Escape' }); });
    expect(screen.queryByRole('menu')).toBeNull();
    // Η γραμμή εργαλείων ΜΕΝΕΙ — δεν έφυγε μαζί με το πάνελ.
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('τα βέλη μέσα στο πάνελ είναι ΚΑΤΑΚΟΡΥΦΑ (η διάταξη του Excel είναι λίστα)', () => {
    renderToolbar();
    const panel = openPanel();
    const items = Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    act(() => { items[0].focus(); });
    act(() => { fireEvent.keyDown(items[0], { key: 'ArrowDown' }); });
    expect(document.activeElement).toBe(items[1]);
  });

  it('το εικονίδιο κάθε στοιχείου είναι `aria-hidden` — το όνομα το δίνει το κείμενο', () => {
    renderToolbar();
    const panel = openPanel();
    for (const svg of Array.from(panel.querySelectorAll('svg'))) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
