/**
 * 🔴 ADR-739 §55 — **Η ΔΙΑΤΑΞΗ ΕΙΝΑΙ ΤΟ ΠΑΡΑΔΟΤΕΟ**: δύο σειρές, με τις εντολές στις θέσεις του
 * Excel, και **μία** γραμμική σειρά roving πάνω τους.
 *
 * ## Γιατί δεν αρκούσε το υπάρχον `table-format-toolbar.test.tsx`
 * Εκείνο ρωτά «τι κάνει αυτό το κουμπί» και βρίσκει τα κουμπιά **με το όνομά τους**. Η
 * απαίτηση του §55 είναι άλλη και δεν την πιάνει κανένα από τα 56 test του: «η θέση 3 της
 * σειράς 1 είναι το `A↑`». Ένα toolbar με όλα τα σωστά κουμπιά σε **λάθος σειρά** τα περνά όλα.
 *
 * ⚠️ Τα ονόματα εδώ **δεν** χρησιμοποιούνται επίτηδες: τα κλειδιά i18n του §55 γράφονται
 * παράλληλα, οπότε ένα test που τα διαβάζει θα κοκκίνιζε για λόγο άσχετο με τη διάταξη. Ο
 * έλεγχος γίνεται σε **δομή** (σειρές, πλήθη, `tabindex`), που είναι ακριβώς το ζητούμενο.
 *
 * 🔴 **ΜΙΑ ΡΗΤΗ ΕΞΑΙΡΕΣΗ (§58 Γ2)**: ο έλεγχος «ποιο κουμπί είναι σε ποια θέση» διαβάζει
 * `aria-label`. Εκεί η ερώτηση **είναι** η ταυτότητα του κουμπιού — μια δομική μέτρηση θα
 * περνούσε πράσινη με την αναδίπλωση και τη σμίκρυνση ανεστραμμένες, δηλαδή με τη δική μας
 * προσθήκη να έχει καταλάβει τη θέση που το Excel δίνει στην αναδίπλωση.
 *
 * @see ui/components/table-format-toolbar/table-format-toolbar-slots.ts — η αρίθμηση θέσεων
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import {
  TableFormatToolbar,
  type TableFormatSnapshot,
  type TableFontControlsState,
  type TableNumberFormatState,
  type TableFormatToolbarProps,
} from '../TableFormatToolbar';
import type { TableAxisColorState } from '../table-color-menu-selection';
import { planTableToolbarSlots } from '../table-format-toolbar-slots';

// Ίδιο μοτίβο με το αδελφό `table-format-toolbar.test.tsx`: ο πραγματικός `loadNamespace` κάνει
// δυναμικό import αρχείων που δεν χρειάζονται εδώ — το bundle δίνεται έτοιμο παρακάτω.
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

const NO_TOGGLE = { active: false, mixed: false, explicit: false };

const COLOR: TableAxisColorState = {
  current: '#111111',
  mixed: false,
  explicit: false,
  inheritedColor: '#111111',
  inheritedMixed: false,
  drawingColors: [],
};

const FORMAT: TableFormatSnapshot = {
  bold: NO_TOGGLE,
  italic: NO_TOGGLE,
  underline: NO_TOGGLE,
  textColor: COLOR,
  fillColor: COLOR,
  canReset: true,
};

const FONTS: TableFontControlsState = {
  family: { current: 'Arial', mixed: false },
  size: { current: 2.5, mixed: false },
};

const NUMBERS: TableNumberFormatState = { current: { kind: 'general' }, explicit: false };

const noop = (): void => {};

/** Οι έξι παρουσίες + η έβδομη του §58 Γ2 — μία δήλωση, τρεις καλούντες. */
const ALL_PRESENT = {
  fonts: true,
  format: true,
  numberFormat: true,
  align: true,
  borders: true,
  merge: true,
  overflow: true,
} as const;

function renderFullToolbar(): { readonly rows: readonly HTMLElement[] } {
  const surfaceRef = React.createRef<HTMLDivElement>();
  const props: TableFormatToolbarProps = {
    anchorX: 300,
    anchorY: 400,
    scope: 'range',
    label: 'B2:D4',
    surfaceRef,
    format: {
      format: FORMAT,
      onToggle: noop,
      onStepSize: noop,
      onReset: noop,
      onSetTextColor: noop,
      onSetFillColor: noop,
    },
    fonts: {
      state: FONTS,
      fonts: ['Arial', 'ISOCPEUR'],
      onSetFontFamily: noop,
      onSetTextHeightMm: noop,
    },
    numberFormat: { state: NUMBERS, onSetNumberFormat: noop },
    align: { current: 'ML', onSetAlign: noop },
    // 🔴 §58 Γ2 — το τέταρτο τμήμα: αναδίπλωση + σμίκρυνση, στο τέλος της σειράς 1.
    overflow: { current: 'clip', onSetOverflow: noop },
    merge: { state: { merged: false, canMerge: true }, onApply: noop },
  };

  render(<TableFormatToolbar {...props} />, { wrapper: I18nWrapper });
  const toolbar = screen.getByRole('toolbar');
  return { rows: Array.from(toolbar.children) as HTMLElement[] };
}

describe('🔴 §55 — δύο σειρές, θέσεις του Excel', () => {
  it('το δοχείο έχει ΑΚΡΙΒΩΣ δύο σειρές', () => {
    const { rows } = renderFullToolbar();
    expect(rows).toHaveLength(2);
  });

  /**
   * Σειρά 1: `[Γραμματοσειρά ▾][Μέγεθος ▾] A↑ A↓ │ λογιστική % 000 │ αναδίπλωση σμίκρυνση` = **9**.
   *
   * Οι **οκτώ** θέσεις του Excel, μία προς μία, **συν** τη σμίκρυνση — που το Excel κρύβει στον
   * διάλογο «Μορφοποίηση κελιών» (§58 Γ2). Μπαίνει **τελευταία** ακριβώς ώστε να μη μετακινηθεί
   * καμία από τις οκτώ· το επόμενο test το κλειδώνει ονομαστικά.
   */
  it('σειρά 1 = 9 κουμπιά (οι 8 θέσεις του Excel + η σμίκρυνση του ΝΕΣΤΟΡΑ)', () => {
    const { rows } = renderFullToolbar();
    expect(within(rows[0]).getAllByRole('button')).toHaveLength(9);
  });

  /**
   * 🔴 §58 Γ2 — **η αναδίπλωση κρατά τη θέση 8, η σμίκρυνση μπαίνει 9η.**
   *
   * Δες την κεφαλίδα για το γιατί **αυτός** ο έλεγχος διαβάζει ονόματα ενώ οι υπόλοιποι όχι.
   */
  it('🔴 η ΑΝΑΔΙΠΛΩΣΗ είναι η θέση 8 και η ΣΜΙΚΡΥΝΣΗ η 9η — ποτέ ανάποδα', () => {
    const { rows } = renderFullToolbar();
    const rowOne = within(rows[0]).getAllByRole('button');
    expect(rowOne[7]).toHaveAttribute('aria-label', 'Αναδίπλωση κειμένου');
    expect(rowOne[8]).toHaveAttribute('aria-label', 'Σμίκρυνση ώστε να χωρά');
  });

  /**
   * Σειρά 2: B I ≡ (3) + γέμισμα/μελάνι ως split buttons (4) + δεκαδικά (2) + πινέλο (1)
   * = οι **9** θέσεις του Excel σε 10 κουμπιά· συν το τρίτο τμήμα του ΝΕΣΤΟΡΑ: Υ (1) +
   * συγχώνευση ως split button (2) + επαναφορά (1). Τα περιγράμματα λείπουν επίτηδες εδώ (το
   * prop τους απαιτεί ολόκληρο το μολύβι — έχει δική του σουίτα).
   */
  it('σειρά 2 = 14 κουμπιά (9 θέσεις Excel + το τρίτο τμήμα, χωρίς περιγράμματα)', () => {
    const { rows } = renderFullToolbar();
    expect(within(rows[1]).getAllByRole('button')).toHaveLength(14);
  });

  /**
   * 🔴 **ΤΟ ΝΟΥΜΕΡΟ ΕΠΕΣΕ ΑΠΟ 2 ΣΕ 1 — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΠΑΡΑΔΟΤΕΟ.**
   *
   * Το §55 κράτησε **δύο** placeholders «όψη 1:1 τώρα, λειτουργία σταδιακά»: αναδίπλωση και
   * πινέλο. Το ADR-768 έδωσε μηχανή στο πινέλο (μένει σβηστό μόνο **χωρίς οπλισμένη πηγή**,
   * δηλαδή κατάσταση και όχι έλλειψη)· το §58 Γ2 έδωσε μηχανή στην αναδίπλωση.
   *
   * ⚠️ Ο έλεγχος μένει **ακριβής** και δεν χαλαρώνει σε «≤ 2»: αν κάποιος ξαναπροσθέσει κουμπί
   * χωρίς πράξη, αυτό εδώ κοκκινίζει. Μια ανισότητα θα ήταν άδεια για ακριβώς αυτό.
   */
  it('🔴 δεν έμεινε ΚΑΝΕΝΑ κουμπί «χωρίς πράξη» — το τελευταίο σβηστό είναι κατάσταση', () => {
    const { rows } = renderFullToolbar();
    const all = [
      ...within(rows[0]).getAllByRole('button'),
      ...within(rows[1]).getAllByRole('button'),
    ];
    const disabled = all.filter((button) => button.getAttribute('aria-disabled') === 'true');
    expect(disabled).toHaveLength(1);
    expect(disabled[0]).toHaveAttribute('aria-label', 'Πινέλο μορφοποίησης');
  });
});

describe('🔴 §55 — ΕΝΑ γραμμικό roving πάνω από ΔΥΟ σειρές', () => {
  it('μία μόνο στάση `Tab` σε όλη τη γραμμή, και είναι το πρώτο κουμπί της σειράς 1', () => {
    const { rows } = renderFullToolbar();
    const toolbar = screen.getByRole('toolbar');
    const focusable = Array.from(toolbar.querySelectorAll('button[tabindex="0"]'));

    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(within(rows[0]).getAllByRole('button')[0]);
  });

  /**
   * 🔴 Η απόδειξη ότι το roving **δεν** σταματά στο τέλος της σειράς 1.
   *
   * Αν κάποιος βάλει δεύτερο `useRovingToolbar` ανά σειρά (η «προφανής» αλλαγή όταν οι σειρές
   * γίνουν δύο), αυτό το test κοκκινίζει: το `→` στο τελευταίο κουμπί της σειράς 1 θα κύκλωνε
   * στο **πρώτο της ίδιας σειράς** αντί να περάσει στη σειρά 2.
   */
  it('το `→` στο τελευταίο κουμπί της σειράς 1 περνά στο ΠΡΩΤΟ της σειράς 2', () => {
    const { rows } = renderFullToolbar();
    const rowOne = within(rows[0]).getAllByRole('button');
    const rowTwo = within(rows[1]).getAllByRole('button');
    const last = rowOne[rowOne.length - 1];

    act(() => { last.focus(); });
    fireEvent.keyDown(last, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(rowTwo[0]);
  });
});

describe('🔴 §55 — η αρίθμηση θέσεων παράγεται από την ΠΑΡΟΥΣΙΑ', () => {
  it('απόν τμήμα δεν καταναλώνει θέσεις — το σύνολο μικραίνει ακριβώς κατά το πλήθος του', () => {
    const all = planTableToolbarSlots(ALL_PRESENT);
    const withoutFonts = planTableToolbarSlots({ ...ALL_PRESENT, fonts: false });

    expect(all.total - withoutFonts.total).toBe(2);
  });

  /**
   * 🔴 §58 Γ2 — **το ξεχείλισμα είναι δικό του σκέλος παρουσίας, όχι μέρος του `format`.**
   *
   * Μέχρι το §58 η θέση της αναδίπλωσης διαβαζόταν από το `format`, γιατί το κουμπί ήταν
   * ανενεργό placeholder μέσα στο `TableFormatSection`. Χωρίς αυτόν τον έλεγχο, μια υποδοχή που
   * δίνει `format` **χωρίς** `overflow` θα δέσμευε **δύο** θέσεις roving για κουμπιά που δεν
   * αποδίδονται — δηλαδή δύο «τρύπες» στη σειρά των βελών, που καμία οπτική επιθεώρηση δεν πιάνει.
   */
  it('🔴 το `overflow` δεσμεύει ΔΥΟ θέσεις, και μόνο όταν είναι παρόν', () => {
    const all = planTableToolbarSlots(ALL_PRESENT);
    const withoutOverflow = planTableToolbarSlots({ ...ALL_PRESENT, overflow: false });

    expect(all.total - withoutOverflow.total).toBe(2);
  });

  it('🔴 καμία θέση δεν δίνεται δύο φορές: η σειρά είναι αυστηρά αύξουσα', () => {
    const slots = planTableToolbarSlots(ALL_PRESENT);
    const order = [
      slots.fontControls, slots.sizeSteps, slots.numberKinds, slots.overflow,
      slots.toggles, slots.align, slots.colors, slots.borders, slots.decimals,
      slots.formatPainter, slots.underline, slots.merge, slots.reset,
    ];

    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
    expect(order[order.length - 1]).toBeLessThan(slots.total);
  });
});
