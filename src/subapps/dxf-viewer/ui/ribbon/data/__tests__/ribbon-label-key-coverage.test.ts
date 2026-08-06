/**
 * 🔴 ADR-739 §52.2 — **ΚΑΘΕ ετικέτα της κορδέλας ΟΝΤΩΣ μεταφράζεται**.
 *
 * ## ΓΙΑΤΙ ΥΠΑΡΧΕΙ — «0 παραβιάσεις» σήμαινε «κανείς δεν κοίταξε»
 * Οι ετικέτες της κορδέλας είναι **δεδομένα** (`labelKey: 'ribbon.commands.…'`), όχι κλήσεις
 * `t('…')`. Το **CHECK 3.8** ψάχνει ακριβώς κλήσεις `t()` ⇒ και οι **1.287** στατικές
 * ετικέτες των ~60 καρτελών ήταν, από την πρώτη μέρα, **αόρατες σε κάθε πύλη**. Το
 * `validate:i18n` μετρά κλειδιά **ανά locale**, όχι κλειδιά **που ζητά ο κώδικας**.
 *
 * Μια σάρωση με το χέρι (2026-08-06, αφορμή το ωμό «Στυλ πίνακα») βρήκε **τρία** ζωντανά
 * ελαττώματα σε παραγωγή:
 *
 * | ετικέτα | πού φαινόταν | κατάσταση |
 * |---|---|---|
 * | `ribbon.panels.select` | τίτλος panel σε **3** contextual καρτέλες (εικόνα, mesh, τοπογραφία) | ✅ προστέθηκε σε el+en |
 * | `ribbon.commands.openCredits` | κουμπί «Άδειες & Αναφορές» στις **Ρυθμίσεις** (μόνιμη καρτέλα) | ✅ δείχνει πλέον στο υπαρκτό `tools.openCredits` |
 * | `animation.*` (21 κλειδιά) | ολόκληρη η καρτέλα «Κίνηση» | ⏳ **χαρακτηρισμένο** — βλ. παρακάτω |
 *
 * ## Ο κανόνας είναι ΑΚΡΙΒΗΣ, όχι ευρετικός
 * Το `RibbonCombobox.resolveLabel` κάνει `isLiteralLabel ? labelKey : t(labelKey)`. Άρα:
 * **κάθε** `labelKey` που δεν δηλώνει `isLiteralLabel: true` περνά από `t()` και **οφείλει**
 * να υπάρχει στο `dxf-viewer-shell` — το namespace με το οποίο μεταφράζουν το `RibbonPanel`
 * και το `RibbonCombobox`. Καμία εικασία για το «τι μοιάζει με κλειδί».
 *
 * ⚠️ Δεν υπάρχει `fallbackNS` στο `i18n/config.ts`: κλειδί άλλου namespace **δεν** βρίσκεται,
 * τυπώνεται ωμό. Γι' αυτό τα `animation.*` (ζουν στο `bim3d.json`) είναι πραγματικό ελάττωμα
 * και όχι λεπτομέρεια οργάνωσης.
 *
 * ## ΑΝ ΣΕ ΕΚΟΨΕ ΑΥΤΟ ΤΟ TEST
 * Πρόσθεσες ετικέτα κορδέλας χωρίς κλειδί σε `el` **και** `en`. Πρόσθεσε το κλειδί (N.11) και
 * τρέξε `npm run generate:i18n-types`. **ΜΗΝ** μεγαλώσεις το `CHARACTERISED` και **ΜΗΝ**
 * βάλεις `isLiteralLabel: true` για να σωπάσει — αυτό ακριβώς το ψέμα έβγαλε το
 * `ribbon.commands.tableStyleNames.standard` στην οθόνη (§52.2).
 *
 * @see ../../components/buttons/RibbonCombobox.tsx — `resolveLabel`
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §52.2
 */

// Το `contextual-stair-tab` τραβά τον stair bridge → `services/firestore` → `firebase/auth`,
// που στο jest απαιτεί global `fetch` κατά το import. Τα tabs είναι σκέτα δεδομένα εδώ.
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  connectAuthEmulator: jest.fn(),
}));

import { RAW_RIBBON_CONTEXTUAL_TABS } from '../contextual-tabs-registry';
import { DEFAULT_RIBBON_TABS } from '../ribbon-default-tabs';
import { collectRibbonCommands } from './ribbon-registry-test-loader';
import type { RibbonTab } from '../../types/ribbon-types';
import elShell from '@/i18n/locales/el/dxf-viewer-shell.json';
import enShell from '@/i18n/locales/en/dxf-viewer-shell.json';

type LocaleTree = { readonly [key: string]: string | LocaleTree };

/** Το ίδιο ερώτημα με το `t()`, σε επίπεδο δεδομένων: υπάρχει συμβολοσειρά σε αυτό το path; */
function has(tree: LocaleTree, key: string): boolean {
  let node: string | LocaleTree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = node[part];
  }
  return typeof node === 'string';
}

const EL = elShell as unknown as LocaleTree;
const EN = enShell as unknown as LocaleTree;

const ALL_TABS: readonly RibbonTab[] = [...RAW_RIBBON_CONTEXTUAL_TABS, ...DEFAULT_RIBBON_TABS];

/**
 * ⏳ **ΤΟ ΜΟΝΟ ΧΑΡΑΚΤΗΡΙΣΜΕΝΟ ΧΡΕΟΣ** — η καρτέλα «Κίνηση» (3D turntable / waypoints).
 *
 * Οι **21** ετικέτες της (`animation.panels.*`, `animation.toolbar.*`, …) υπάρχουν σε
 * `bim3d.json`, **όχι** στο `dxf-viewer-shell`. Η καρτέλα είναι καταχωρημένη στο
 * `RAW_RIBBON_CONTEXTUAL_TABS` και το `RibbonPanel` μεταφράζει με `dxf-viewer-shell` ⇒ όποτε
 * εμφανίζεται, τυπώνει **ωμά κλειδιά**.
 *
 * Δεν διορθώνεται εδώ επειδή η λύση είναι **απόφαση**, όχι μηχανική κίνηση: ή μετακομίζουν τα
 * κλειδιά (και ακολουθούν οι καταναλωτές τους στο `bim-3d`), ή η κορδέλα αποκτά τρόπο να
 * δηλώσει namespace ανά καρτέλα. Καταγράφηκε στο `.claude-rules/pending-ratchet-work.md`.
 *
 * ⚠️ Είναι **λίστα ενός** και μένει έτσι: κάθε νέα εγγραφή εδώ σημαίνει νέο ωμό κλειδί σε
 * παραγωγή. Το test από κάτω απαιτεί ρητά ότι δεν μεγάλωσε.
 */
const CHARACTERISED_TAB_IDS: readonly string[] = ['animation'];

interface LabelRef {
  readonly key: string;
  readonly where: string;
}

/** Κάθε ετικέτα που θα περάσει από `t()`: καρτέλα, panel, εντολή, στατική επιλογή combobox. */
function collectTranslatedLabels(tabs: readonly RibbonTab[]): LabelRef[] {
  const out: LabelRef[] = [];
  for (const tab of tabs) {
    out.push({ key: tab.labelKey, where: `tab:${tab.id}` });
    for (const panel of tab.panels) {
      out.push({ key: panel.labelKey, where: `panel:${panel.id}` });
    }
  }
  for (const cmd of collectRibbonCommands(tabs)) {
    out.push({ key: cmd.labelKey, where: `command:${cmd.id}` });
    for (const option of cmd.options ?? []) {
      // `isLiteralLabel: true` ⇒ η επιφάνεια το τυπώνει αυτούσιο, καμία μετάφραση να λείψει.
      if (option.isLiteralLabel) continue;
      out.push({ key: option.labelKey, where: `option:${cmd.id}/${option.value}` });
    }
  }
  return out;
}

const TABS_UNDER_TEST = ALL_TABS.filter((tab) => !CHARACTERISED_TAB_IDS.includes(tab.id));
const LABELS = collectTranslatedLabels(TABS_UNDER_TEST);

describe('🔴 Κάλυψη ετικετών κορδέλας — καμία ετικέτα χωρίς μετάφραση', () => {
  it('σαρώνει ουσιώδη αριθμό ετικετών (δίχτυ για τον ΙΔΙΟ τον walker)', () => {
    // Χωρίς αυτό, ένα refactor που σπάει τη διάσχιση θα έκανε το επόμενο test να περνά
    // θριαμβευτικά πάνω σε άδεια λίστα — το κλασικό «πράσινο επειδή κανείς δεν κοίταξε».
    expect(LABELS.length).toBeGreaterThan(1000);
  });

  it('ΚΑΘΕ ετικέτα υπάρχει στο ελληνικό `dxf-viewer-shell`', () => {
    const missing = LABELS.filter((l) => !has(EL, l.key)).map((l) => `${l.where} → ${l.key}`);
    expect(missing).toEqual([]);
  });

  it('ΚΑΘΕ ετικέτα υπάρχει και στο αγγλικό — αλλιώς το en τρέχει ωμά κλειδιά', () => {
    const missing = LABELS.filter((l) => !has(EN, l.key)).map((l) => `${l.where} → ${l.key}`);
    expect(missing).toEqual([]);
  });
});

describe('⏳ Το χαρακτηρισμένο χρέος δεν μεγαλώνει', () => {
  it('η λίστα εξαιρέσεων παραμένει ΑΚΡΙΒΩΣ η καρτέλα «Κίνηση»', () => {
    expect(CHARACTERISED_TAB_IDS).toEqual(['animation']);
  });

  it('η εξαιρεμένη καρτέλα ΥΠΑΡΧΕΙ — αλλιώς η εξαίρεση είναι νεκρό γράμμα', () => {
    // Αν η καρτέλα μετονομαστεί ή φύγει, η εξαίρεση θα σιωπούσε για πάντα και το test θα
    // έδειχνε πράσινο για δουλειά που κανείς δεν έκανε.
    const ids = ALL_TABS.map((tab) => tab.id);
    for (const id of CHARACTERISED_TAB_IDS) expect(ids).toContain(id);
  });
});
