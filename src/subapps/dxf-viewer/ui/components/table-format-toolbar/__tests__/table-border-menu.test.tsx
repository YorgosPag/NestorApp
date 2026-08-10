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
import { TABLE_DIAGONAL_COMMANDS } from '@/subapps/dxf-viewer/bim/table/table-cell-diagonal-ops';
import {
  resetTableBorderPencilForTest,
} from '@/subapps/dxf-viewer/state/table-border-pencil-store';
import {
  tableBorderPencilChoice,
} from '@/subapps/dxf-viewer/state/table-border-pencil-store';
import { resolveTableBorderPencil } from '@/subapps/dxf-viewer/bim/table/table-border-pencil';
import {
  BUILTIN_TABLE_STYLES,
  BUILTIN_TABLE_STYLE_IDS,
} from '@/subapps/dxf-viewer/bim/table/table-style-presets';
import { tableBorderLinetypeNames, tableBorderWeightsMm } from '../table-border-pencil-options';
import type { TableFormatSnapshot, TableToggleFormatState } from '../TableFormatToolbar';
import type { TableBorderSpec } from '@/subapps/dxf-viewer/types/table-edges';

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
  inheritedColor: undefined, inheritedMixed: false, drawingColors: [],
} as const;
const FORMAT: TableFormatSnapshot = {
  bold: NO_FORMAT,
  italic: NO_FORMAT,
  underline: NO_FORMAT,
  textColor: { ...NO_COLOR, current: '#111111', inheritedColor: '#111111' },
  fillColor: NO_COLOR,
  canReset: false,
};

/**
 * 🔴 ADR-750 Φ5 — η προεπισκόπηση περνά από την **αληθινή** αλυσίδα, όχι από σταθερά.
 *
 * Ένα σταθερό μολύβι εδώ θα ήταν πράσινο ό,τι κι αν έκανε ο χρήστης: η γραμμή «Πάχος γραμμής»
 * θα έδειχνε την ίδια τιμή πριν και μετά την επιλογή, και το test θα επαλήθευε **τον εαυτό
 * του**. Με τη ζωντανή `resolveTableBorderPencil` πάνω στο πραγματικό store, ο δεσμός
 * «επιλογή → προεπισκόπηση» είναι αυτό που πράγματι δοκιμάζεται.
 */
const PREVIEW_STYLE = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

const resolvePreviewPencil = (): TableBorderSpec =>
  resolveTableBorderPencil(PREVIEW_STYLE, tableBorderPencilChoice());

function renderToolbar(borders?: {
  canReset?: boolean;
  canClearDiagonals?: boolean;
  onApply?: jest.Mock;
  onReset?: jest.Mock;
  onApplyDiagonal?: jest.Mock;
}) {
  const onApply = borders?.onApply ?? jest.fn();
  const onReset = borders?.onReset ?? jest.fn();
  const onApplyDiagonal = borders?.onApplyDiagonal ?? jest.fn();
  const surfaceRef = React.createRef<HTMLDivElement>();
  const noop = (): void => {};

  render(
    <TableFormatToolbar
      anchorX={10}
      anchorY={10}
      scope="column"
      label="B"
      surfaceRef={surfaceRef}
      format={{
        format: FORMAT,
        showUnderline: true,
        showFormatPainter: true,
        onToggle: noop,
        onStepSize: noop,
        onReset: noop,
        onSetTextColor: noop,
        onSetFillColor: noop,
      }}
      borders={{
        canReset: borders?.canReset ?? true,
        onApply,
        onReset,
        onApplyDiagonal,
        canClearDiagonals: borders?.canClearDiagonals ?? true,
        resolvePencil: resolvePreviewPencil,
      }}
    />,
    wrapper,
  );
  return { onApply, onReset, onApplyDiagonal };
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
        anchorX={10} anchorY={10} scope="column" label="B" surfaceRef={surfaceRef}
        format={{
          showUnderline: true, showFormatPainter: true, format: FORMAT, onToggle: noop, onStepSize: noop, onReset: noop,
          onSetTextColor: noop, onSetFillColor: noop,
        }}
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

  it('ανοίγει με κλικ και δείχνει ΟΛΕΣ τις γραμμές του πάνελ, παραγόμενες από τα μητρώα', () => {
    renderToolbar();
    const panel = openPanel();
    // 13 εντολές + «Επαναφορά» + 4 διαγώνιοι + 3 γραμμές μολυβιού (η «Διπλή» είναι checkbox).
    const expected = tableBorderMenuItems().length + 1 + TABLE_DIAGONAL_COMMANDS.length + 3;
    expect(panel.querySelectorAll('[role="menuitem"]')).toHaveLength(expected);
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
    // 2 αλλαγές ομάδας στις 13 + πριν την «Επαναφορά» + πριν τις διαγωνίους + πριν το μολύβι.
    expect(panel.querySelectorAll('[role="separator"]')).toHaveLength(5);
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

// ── ADR-750 Φ5 ──────────────────────────────────────────────────────────────

describe('✅ Φ5 (Α2) — οι διαγώνιοι είναι δική τους ομάδα, όχι 14η εντολή', () => {
  it('δείχνει και τις τέσσερις, με τα ονόματά τους', () => {
    renderToolbar();
    openPanel();
    for (const name of [
      'Διαγώνιος προς τα κάτω',
      'Διαγώνιος προς τα επάνω',
      'Διαγώνιος σταυρός',
      'Χωρίς διαγώνιες',
    ]) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('κλικ σε διαγώνιο: καλεί `onApplyDiagonal` με τη ΣΩΣΤΗ ταυτότητα και κλείνει', () => {
    const { onApplyDiagonal } = renderToolbar();
    openPanel();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Διαγώνιος σταυρός' }));
    expect(onApplyDiagonal).toHaveBeenCalledWith('cross');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('🔴 ΜΟΝΟ η αφαίρεση μπορεί να είναι ανενεργή — οι τρεις άλλες γράφουν πάντα', () => {
    renderToolbar({ canClearDiagonals: false });
    openPanel();
    expect(screen.getByRole('menuitem', { name: 'Χωρίς διαγώνιες' }))
      .toHaveAttribute('aria-disabled', 'true');
    for (const name of ['Διαγώνιος προς τα κάτω', 'Διαγώνιος σταυρός']) {
      expect(screen.getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled');
    }
  });

  it('η ανενεργή αφαίρεση είναι ΕΣΤΙΑΣΙΜΗ και το κλικ της είναι no-op', () => {
    const { onApplyDiagonal } = renderToolbar({ canClearDiagonals: false });
    openPanel();
    const clear = screen.getByRole('menuitem', { name: 'Χωρίς διαγώνιες' });
    fireEvent.click(clear);
    expect(onApplyDiagonal).not.toHaveBeenCalled();
    expect(clear).not.toHaveAttribute('disabled');
  });
});

describe('✅ Φ5 (Α23) — η ζώνη «Σχεδίαση περιγραμμάτων»', () => {
  beforeEach(() => {
    // Το μολύβι είναι **store με persistence**: χωρίς καθάρισμα, το πρώτο test που διαλέγει
    // πάχος θα άλλαζε σιωπηλά την αφετηρία κάθε επόμενου.
    resetTableBorderPencilForTest();
  });

  it('δείχνει τις τέσσερις γραμμές του μολυβιού, με τη «Διπλή» ως διακόπτη', () => {
    renderToolbar();
    openPanel();
    for (const name of ['Χρώμα γραμμής', 'Στυλ γραμμής', 'Πάχος γραμμής']) {
      expect(screen.getByRole('menuitem', { name })).toHaveAttribute('aria-haspopup', 'true');
    }
    // 🔑 Η «Διπλή γραμμή» ΔΕΝ είναι `menuitem`: είναι κατάσταση δύο τιμών, όχι εντολή (Α21).
    expect(screen.getByRole('menuitemcheckbox', { name: 'Διπλή γραμμή' }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('🔑 τα πτυσσόμενα είναι ΚΛΕΙΣΤΑ αρχικά — το πάνελ δεν ξεκινά ξεδιπλωμένο', () => {
    renderToolbar();
    openPanel();
    expect(screen.getByRole('menuitem', { name: 'Πάχος γραμμής' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('🔑 «Πάχος γραμμής» ανοίγει `radiogroup` με ΟΛΕΣ τις πένες ISO + «Αυτόματο»', () => {
    // Αμοιβαία αποκλειόμενα ⇒ `menuitemradio`, όχι `menuitem` (§9.2). Και η λίστα είναι η
    // **ίδια** που βλέπει κάθε άλλο χειριστήριο πάχους του subapp — καμία δεύτερη κλίμακα.
    renderToolbar();
    openPanel();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Πάχος γραμμής' }));

    const group = screen.getByRole('radiogroup', { name: 'Πάχος γραμμής περιγράμματος' });
    expect(group.querySelectorAll('[role="menuitemradio"]'))
      .toHaveLength(tableBorderWeightsMm().length + 1);
    expect(screen.getByRole('menuitemradio', { name: 'Από το στυλ' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('🔑 «Στυλ γραμμής» καταναλώνει το μητρώο τύπων — καμία χειρόγραφη λίστα', () => {
    renderToolbar();
    openPanel();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Στυλ γραμμής' }));

    const group = screen.getByRole('radiogroup', { name: 'Στυλ γραμμής περιγράμματος' });
    expect(group.querySelectorAll('[role="menuitemradio"]'))
      .toHaveLength(tableBorderLinetypeNames().length + 1);
    // Το `ByLayer` **δεν** προσφέρεται: η κληρονομιά λέγεται ήδη «Αυτόματο» (Α19).
    expect(screen.queryByRole('menuitemradio', { name: 'ByLayer' })).toBeNull();
  });

  it('🔑 επιλογή πάχους γράφεται στο store και φαίνεται ως `aria-checked`', () => {
    renderToolbar();
    openPanel();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Πάχος γραμμής' }));
    const pen = tableBorderWeightsMm()[3];
    act(() => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: `${pen.toFixed(2)} mm` }));
    });

    // Το πτυσσόμενο κλείνει με την επιλογή· η γραμμή δείχνει πλέον τη νέα τιμή.
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Πάχος γραμμής' }))
      .toHaveTextContent(`${pen.toFixed(2)} mm`);
  });

  it('🔑 η «Διπλή γραμμή» εναλλάσσεται και ΔΕΝ κλείνει το πάνελ', () => {
    // Είναι ρύθμιση του μολυβιού, όχι εντολή: κλείσιμο εδώ θα ανάγκαζε τον χρήστη να
    // ξανανοίξει το μενού για να εφαρμόσει το περίγραμμα που μόλις ρύθμισε.
    renderToolbar();
    openPanel();
    const toggle = screen.getByRole('menuitemcheckbox', { name: 'Διπλή γραμμή' });
    act(() => { fireEvent.click(toggle); });

    expect(screen.getByRole('menuitemcheckbox', { name: 'Διπλή γραμμή' }))
      .toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menu', { name: 'Περιγράμματα κελιών' })).toBeInTheDocument();
  });

  /**
   * 🔴 ΠΑΛΙΝΔΡΟΜΗΣΗ (2026-08-05) — η γραμμή «Χρώμα γραμμής» **έσκαγε όταν άνοιγε**.
   *
   * Το `TableColorSwatchGrid` απαιτεί `grid` (υποχρεωτικό) και κάνει `grid.map(...)`· η Φ5 το
   * καλούσε **χωρίς αυτό** ⇒ `TypeError` τη στιγμή του ξεδιπλώματος. Έζησε με **145 πράσινα
   * tests** επειδή κάθε test της ζώνης άνοιγε «Πάχος» ή «Στυλ» — **κανένα** δεν άνοιξε το
   * «Χρώμα». Η γραμμή ελεγχόταν μόνο ως *υπαρκτή* (`aria-haspopup`), ποτέ ως *λειτουργική*.
   *
   * 🔑 Το μάθημα δεν είναι «γράψε κι άλλα tests»: είναι ότι ένα χειριστήριο που **ανοίγει**
   * χρειάζεται test που **το ανοίγει**. Η ύπαρξη του trigger δεν λέει τίποτα για το πάνελ.
   * Ο τύπος δεν το έπιασε επειδή το subapp είναι εκτός του root `tsconfig` (CHECK 3.29).
   */
  it('🔴 «Χρώμα γραμμής» ανοίγει το πλέγμα χρωμάτων χωρίς να σκάσει', () => {
    renderToolbar();
    openPanel();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Χρώμα γραμμής' }));

    // Το πλέγμα αποδίδεται πραγματικά — δηλαδή το `grid` έφτασε γεμάτο.
    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });
    expect(grid.querySelectorAll('[role="gridcell"]').length).toBeGreaterThan(0);
    // Και η κληρονομιά συνυπάρχει ως **επιλογή**, όχι ως απουσία (Α19/Α23). Το ορατό της
    // όνομα είναι «Από το στυλ» — το «Αυτόματο» είναι η έννοια, όχι η ετικέτα.
    expect(screen.getByRole('menuitemradio', { name: 'Από το στυλ' }))
      .toHaveAttribute('aria-checked', 'true');
  });
});
