/**
 * ADR-755 — **το split button συγχώνευσης μέσα στο mini toolbar**: το toggle, οι τέσσερις
 * εντολές, και η υποδοχή **περιοχής** (mini toolbar χωρίς τμήμα άξονα).
 *
 * Δοκιμάζεται μέσα από το **πραγματικό** `TableFormatToolbar`, όχι μεμονωμένα: το πάνελ ζει
 * σκόπιμα **μέσα** στο δοχείο της γραμμής (εκεί όπου ο φύλακας `keepOpenOnSurface` του γονέα το
 * αναγνωρίζει ως «δικό του»), οπότε ένα test που το απομόνωνε θα επαλήθευε άλλη τοπολογία από
 * αυτή που τρέχει.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import { TableFormatToolbar } from '../TableFormatToolbar';
import { isTableMergeCommandDisabled } from '../TableMergeMenu';
import { TABLE_MERGE_COMMANDS } from '@/subapps/dxf-viewer/bim/table/table-range-merge-ops';
import type { TableMergeState } from '@/subapps/dxf-viewer/bim/table/table-range-merge-ops';
import type { TableFormatSnapshot, TableToggleFormatState } from '../TableFormatToolbar';

// Ίδιο μοτίβο με τα αδελφά: πραγματικό i18next με το **ίδιο** locale αρχείο που φορτώνει η
// παραγωγή. Τα ονόματα των τεσσάρων εντολών είναι το αντικείμενο του test — ένα ωμό κλειδί θα
// έκανε κάθε `getByRole(name)` ψευδώς πράσινο ή ψευδώς κόκκινο.
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

const FREE: TableMergeState = { merged: false, canMerge: true };
const MERGED: TableMergeState = { merged: true, canMerge: true };
const SINGLE_CELL: TableMergeState = { merged: false, canMerge: false };

/**
 * Η γραμμή **χωρίς** τμήμα μορφοποίησης — απομονώνει τη συγχώνευση.
 *
 * ⚠️ Έγραφε «ακριβώς ό,τι τρέχει στα κελιά». Μετά το **ADR-739 §52** αυτό δεν ισχύει: η
 * υποδοχή της περιοχής δείχνει πλέον **και** τα εννιά χειριστήρια μορφοποίησης (ο γραφέας
 * `TableCell.styleOverride` γράφτηκε). Το σχήμα εδώ μένει ως έχει επίτηδες — ελέγχει ότι το
 * split button δουλεύει **μόνο** του, χωρίς να εξαρτάται από γείτονες.
 */
function renderRangeToolbar(state: TableMergeState = FREE) {
  const onApply = jest.fn();
  const surfaceRef = React.createRef<HTMLDivElement>();
  render(
    <TableFormatToolbar
      anchorX={10}
      anchorY={10}
      scope="range"
      label="B2:D4"
      surfaceRef={surfaceRef}
      merge={{ state, onApply }}
    />,
    wrapper,
  );
  return { onApply };
}

/** Η υποδοχή **άξονα**: με τμήμα μορφοποίησης από πάνω. */
function renderAxisToolbar(state: TableMergeState = FREE) {
  const onApply = jest.fn();
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
      merge={{ state, onApply }}
    />,
    wrapper,
  );
  return { onApply };
}

function openPanel(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Συγχώνευση κελιών' }));
  return screen.getByRole('menu', { name: 'Συγχώνευση κελιών' });
}

// ── Το toggle ───────────────────────────────────────────────────────────────

describe('🔑 το κύριο μισό είναι TOGGLE — εκεί ζει η κατάργηση', () => {
  it('ελεύθερη περιοχή: δηλώνει μη πατημένο και εφαρμόζει τη ΣΥΓΧΩΝΕΥΣΗ με κεντράρισμα', () => {
    const { onApply } = renderRangeToolbar(FREE);
    const button = screen.getByRole('button', { name: 'Συγχώνευση και κεντράρισμα' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(onApply).toHaveBeenCalledWith('mergeCenter');
  });

  it('🔴 συγχωνευμένη περιοχή: δηλώνει ΠΑΤΗΜΕΝΟ και το ίδιο κλικ ΚΑΤΑΡΓΕΙ', () => {
    // Είναι η ακριβής συμπεριφορά του Excel: ο χρήστης δεν ανοίγει ποτέ μενού για να ξηλώσει
    // κάτι που μόλις έφτιαξε — η αντίστροφη πράξη κάθεται στο ίδιο πλήκτρο, όπως τα Β/Ι/Υ.
    const { onApply } = renderRangeToolbar(MERGED);
    const button = screen.getByRole('button', { name: 'Συγχώνευση και κεντράρισμα' });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(onApply).toHaveBeenCalledWith('unmerge');
  });

  it('μεμονωμένο ελεύθερο κελί: ανενεργό αλλά ΕΣΤΙΑΣΙΜΟ, και το κλικ είναι no-op', () => {
    const { onApply } = renderRangeToolbar(SINGLE_CELL);
    const button = screen.getByRole('button', { name: 'Συγχώνευση και κεντράρισμα' });
    // `aria-disabled`, ποτέ `disabled`: ο δείκτης του roving δεν επιτρέπεται να πέσει σε τρύπα.
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onApply).not.toHaveBeenCalled();
  });
});

// ── Το πάνελ ────────────────────────────────────────────────────────────────

describe('οι τέσσερις εντολές του πτυσσόμενου', () => {
  it('το πάνελ είναι κλειστό αρχικά και ο trigger το δηλώνει με `aria-expanded`', () => {
    renderRangeToolbar();
    const trigger = screen.getByRole('button', { name: 'Συγχώνευση κελιών' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('🔑 δείχνει ΚΑΙ ΤΙΣ ΤΕΣΣΕΡΙΣ, με τη σειρά και τα ονόματα του μητρώου', () => {
    // Καμία χειρόγραφη λίστα: αν προστεθεί πέμπτη εντολή, το test τη ζητά αυτόματα.
    renderRangeToolbar();
    const panel = openPanel();
    const names = Array.from(panel.querySelectorAll('[role="menuitem"]'))
      .map((item) => item.textContent);
    expect(names).toEqual(TABLE_MERGE_COMMANDS.map((c) => elDxfViewer.table.merge.commands[c.id]));
  });

  it('κλικ σε εντολή: καλεί `onApply` με τη ΣΩΣΤΗ ταυτότητα και κλείνει το πάνελ', () => {
    const { onApply } = renderRangeToolbar();
    openPanel();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Συγχώνευση κατά γραμμές' }));
    expect(onApply).toHaveBeenCalledWith('mergeAcross');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('🔴 η ΚΑΤΑΡΓΗΣΗ είναι ανενεργή χωρίς συγχώνευση — αλλά εστιάσιμη, και no-op', () => {
    const { onApply } = renderRangeToolbar(FREE);
    openPanel();
    const unmerge = screen.getByRole('menuitem', { name: 'Κατάργηση συγχώνευσης κελιών' });
    expect(unmerge).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(unmerge);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('🔴 συμμετρικά: με υπάρχουσα συγχώνευση ενεργή είναι ΜΟΝΟ η κατάργηση όταν λείπει χώρος', () => {
    // Ένα κελί μέσα σε συγχώνευση: `canMerge` ψευδές (1×1), `merged` αληθές.
    renderRangeToolbar({ merged: true, canMerge: false });
    openPanel();
    expect(screen.getByRole('menuitem', { name: 'Κατάργηση συγχώνευσης κελιών' }))
      .not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('menuitem', { name: 'Συγχώνευση κελιών' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  it('`Escape` κλείνει ΜΟΝΟ το πάνελ — ένα Escape, ένα επίπεδο', () => {
    renderRangeToolbar();
    const panel = openPanel();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});

// ── Ο κανόνας του ανενεργού, ως καθαρή συνάρτηση ────────────────────────────

describe('ο κανόνας «ποια εντολή είναι γκρίζα» ζει σε ΕΝΑ σημείο', () => {
  it('η κατάργηση θέλει συγχώνευση· οι τρεις συγχωνεύσεις θέλουν ≥ 2 κελιά', () => {
    // Καθαρή συνάρτηση επειδή τη ρωτούν **δύο** υποδοχές (toolbar + δεξί κλικ): δύο αντίγραφα
    // θα ήταν δύο ευκαιρίες να διαφωνήσουν για το ποιο item είναι γκρίζο.
    expect(isTableMergeCommandDisabled('unmerge', FREE)).toBe(true);
    expect(isTableMergeCommandDisabled('unmerge', MERGED)).toBe(false);
    for (const id of ['mergeCenter', 'mergeAcross', 'merge'] as const) {
      expect(isTableMergeCommandDisabled(id, SINGLE_CELL)).toBe(true);
      expect(isTableMergeCommandDisabled(id, FREE)).toBe(false);
    }
  });
});

// ── Η υποδοχή περιοχής ──────────────────────────────────────────────────────

describe('🔑 ADR-755 — η γραμμή πάνω από το μενού ΚΕΛΙΩΝ', () => {
  it('🔴 ΔΕΝ δείχνει καθόλου μορφοποίηση άξονα: δεν υπάρχει άξονας να γράψει', () => {
    // Εννιά μονίμως γκρίζα κουμπιά θα ήταν υπόσχεση που δεν τηρείται — απόν, όχι ανενεργό.
    renderRangeToolbar();
    expect(screen.queryByRole('button', { name: 'Έντονα' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Αύξηση μεγέθους γραμματοσειράς' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Επαναφορά μορφοποίησης' })).toBeNull();
  });

  it('το προσβάσιμο όνομα λέει ΠΕΡΙΟΧΗ, με το εύρος που θα αλλάξει', () => {
    renderRangeToolbar();
    expect(screen.getByRole('toolbar')).toHaveAccessibleName('Μορφοποίηση περιοχής B2:D4');
  });

  it('🔴 δεν ξεκινά με διαχωριστή: η συγχώνευση είναι το ΠΡΩΤΟ χειριστήριο', () => {
    // Μια γραμμή που ξεκινά με διαχωριστή θα δήλωνε ένα κενό τμήμα που δεν υπάρχει.
    renderRangeToolbar();
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.firstElementChild?.getAttribute('aria-hidden')).not.toBe('true');
  });

  it('η υποδοχή ΑΞΟΝΑ δείχνει και τα δύο τμήματα, με διαχωριστή ανάμεσα', () => {
    renderAxisToolbar();
    expect(screen.getByRole('button', { name: 'Έντονα' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Συγχώνευση και κεντράρισμα' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar')).toHaveAccessibleName('Μορφοποίηση στήλης B');
  });

  it('🔑 οι θέσεις roving ΠΑΡΑΓΟΝΤΑΙ: μία μόνο στάση `Tab` σε κάθε υποδοχή', () => {
    // Με σταθερό μέγεθος, ο δείκτης θα έδειχνε σε κουμπί που δεν υπάρχει στην υποδοχή περιοχής
    // και η γραμμή θα έμενε χωρίς στάση `Tab` — δηλαδή απροσπέλαστη με πληκτρολόγιο.
    renderRangeToolbar();
    const focusable = Array.from(
      screen.getByRole('toolbar').querySelectorAll('button[tabindex="0"]'),
    );
    expect(focusable).toHaveLength(1);
  });
});
