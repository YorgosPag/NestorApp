/**
 * ADR-677 Φάση 2β — ΕΛΕΓΧΟΣ ΠΛΗΡΟΤΗΤΑΣ: κάθε αριθμητικό ribbon combobox δηλώνει τι
 * ποσότητα κρατά.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η μονάδα εμφάνισης εφαρμόζεται opt-in ανά πεδίο (`quantityKind:
 * 'model-length'`). Ένα πεδίο που ξεχάστηκε δεν σκάει και δεν χαλάει σχέδιο — απλώς μένει
 * σιωπηλά σε χιλιοστά ενώ όλα τα διπλανά του δείχνουν μέτρα. Αυτό είναι ακριβώς το είδος
 * κενού που δεν το βρίσκει κανείς με το μάτι σε ~190 πεδία, και που μεγαλώνει κάθε φορά
 * που προστίθεται νέο tab. Το gate είναι εδώ ώστε η παράλειψη να γίνεται κόκκινο test
 * αντί για παράπονο χρήστη (ίδιο σκεπτικό με τα capability anchors του ADR-587 §6.1:
 * «anchor χωρίς gate δεν είναι anchor — είναι σχόλιο»).
 *
 * ΑΝ ΣΕ ΕΚΟΨΕ ΑΥΤΟ ΤΟ TEST: πρόσθεσες αριθμητικό combobox χωρίς δήλωση. Δήλωσε το
 * `numericInput: { quantityKind: … }` — 'model-length' αν είναι φυσικό μέγεθος του
 * κτιρίου σε mm, αλλιώς η κατηγορία που ταιριάζει ('count', 'angle', 'percent',
 * 'paper-length', 'nominal-diameter', …). ΜΗΝ «διορθώσεις» το test.
 *
 * @see ../../types/ribbon-types.ts — ο τύπος `RibbonQuantityKind` + το σκεπτικό
 * @see ../../units/ribbon-display-unit.ts — το σύνορο μετατροπής
 */

// Το `contextual-stair-tab` τραβά τον stair bridge → `services/firestore` → `firebase/auth`,
// που στο περιβάλλον του jest απαιτεί global `fetch` κατά το import και σκάει πριν καν
// τρέξει test. Καμία σχέση με τις δηλώσεις μονάδας — τα tabs είναι σκέτα δεδομένα εδώ.
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  connectAuthEmulator: jest.fn(),
}));

import { RAW_RIBBON_CONTEXTUAL_TABS } from '../contextual-tabs-registry';
import { DEFAULT_RIBBON_TABS } from '../ribbon-default-tabs';
import { isNumericOptionList } from '../../components/buttons/ribbon-combobox-numeric';
import { isLineGeometryKey } from '../../hooks/useRibbonLineToolBridge.helpers';
import { LINE_PROPERTY_GROUPS } from '../../../line-advanced-panel/line-property-fields';
import type { RibbonCommand, RibbonTab } from '../../types/ribbon-types';
import elShell from '@/i18n/locales/el/dxf-viewer-shell.json';
import enShell from '@/i18n/locales/en/dxf-viewer-shell.json';

/** Κάθε command ενός tab, μαζί με variants και φωλιασμένα subVariants (ADR-419). */
function collectCommands(tabs: readonly RibbonTab[]): RibbonCommand[] {
  const out: RibbonCommand[] = [];
  const push = (cmd: RibbonCommand): void => {
    out.push(cmd);
    for (const sub of cmd.subVariants ?? []) push(sub);
  };
  for (const tab of tabs) {
    for (const panel of tab.panels) {
      for (const row of panel.rows) {
        for (const button of row.buttons) {
          push(button.command);
          for (const variant of button.variants ?? []) push(variant);
        }
      }
    }
  }
  return out;
}

const ALL_TABS: readonly RibbonTab[] = [...RAW_RIBBON_CONTEXTUAL_TABS, ...DEFAULT_RIBBON_TABS];

/**
 * Τα commands που ΦΤΑΝΟΥΝ στο σύνορο μονάδας: στατική λίστα options όπου κάθε entry είναι
 * αριθμητικό literal — το ίδιο κριτήριο με το `resolveNumericConfig` του dispatcher, όχι
 * ανεξάρτητη επανυλοποίηση.
 *
 * ⚠️ ΓΝΩΣΤΟ ΟΡΙΟ (δηλωμένο, όχι κρυμμένο): πεδία που παίρνουν τη λίστα τους ΔΥΝΑΜΙΚΑ από
 * bridge (`options: []` + `getComboboxState`) δεν φαίνονται εδώ — δεν υπάρχει στατική λίστα
 * να επιθεωρηθεί. Σήμερα κανένα τέτοιο δεν είναι διαστατικό· αν προστεθεί, θα χρειαστεί
 * χωριστό anchor στο bridge.
 */
const NUMERIC_COMMANDS = collectCommands(ALL_TABS).filter((cmd) =>
  isNumericOptionList(cmd.options ?? []),
);

describe('ADR-677 Φάση 2β — κάλυψη quantityKind', () => {
  it('σαρώνει ουσιώδη αριθμό αριθμητικών comboboxes', () => {
    // Δίχτυ ασφαλείας για τον ΙΔΙΟ τον walker: αν ένα refactor σπάσει τη διάσχιση, το
    // test από κάτω θα περνούσε θριαμβευτικά πάνω σε άδεια λίστα.
    expect(NUMERIC_COMMANDS.length).toBeGreaterThan(150);
  });

  it('ΚΑΝΕΝΑ αριθμητικό combobox δεν έμεινε αταξινόμητο', () => {
    const undeclared = NUMERIC_COMMANDS
      .filter((cmd) => cmd.numericInput?.quantityKind === undefined)
      .map((cmd) => `${cmd.id} (${cmd.commandKey})`);
    expect(undeclared).toEqual([]);
  });
});

describe('ADR-677 Φάση 2β — η παγίδα: μη-διαστατικά πεδία', () => {
  const kindOf = (id: string): string | undefined =>
    NUMERIC_COMMANDS.find((cmd) => cmd.id === id)?.numericInput?.quantityKind;

  it('τα πλήθη ΔΕΝ είναι μήκη — «16 βαθμίδες» δεν γίνεται ποτέ «0.016»', () => {
    expect(kindOf('stair.stepCount')).toBe('count');
    expect(kindOf('stair.storyCount')).toBe('count');
    expect(kindOf('stair.winderCount')).toBe('count');
    expect(kindOf('array.rows')).toBe('count');
    expect(kindOf('column.sides')).toBe('count');
  });

  it('οι μοίρες μένουν μοίρες', () => {
    expect(kindOf('wall.tiltAngle')).toBe('angle');
    expect(kindOf('column.rotation')).toBe('angle');
    expect(kindOf('slab.slopeDirection')).toBe('angle');
  });

  it('τα χιλιοστά ΧΑΡΤΙΟΥ δεν ακολουθούν τη μονάδα του μοντέλου', () => {
    // Ύψος κειμένου ISO 2.5 mm: μένει 2.5 mm στην εκτύπωση όποια κι αν είναι η μονάδα
    // του έργου — όπως τα annotation μεγέθη στο Revit.
    expect(kindOf('dim.text.height')).toBe('paper-length');
    expect(kindOf('dim.override.arrowSize')).toBe('paper-length');
    expect(kindOf('text.font.height')).toBe('paper-length');
  });

  it('οι ονομαστικές διάμετροι καταλόγου (DN) μένουν ονομαστικές', () => {
    expect(kindOf('mepSegment.diameter')).toBe('nominal-diameter');
    expect(kindOf('mepBoiler.flueDiameter')).toBe('nominal-diameter');
  });

  it('τα ποσοστά μένουν ποσοστά', () => {
    expect(kindOf('mepBoiler.efficiency')).toBe('percent');
    expect(kindOf('slab.slopeAngle')).toBe('percent');
  });
});

describe('ADR-677 Φάση 2β — τα πραγματικά μήκη ΔΗΛΩΝΟΝΤΑΙ ως μήκη', () => {
  it('οι βασικές διαστάσεις κτιρίου ακολουθούν τη μονάδα', () => {
    const kindOf = (id: string): string | undefined =>
      NUMERIC_COMMANDS.find((cmd) => cmd.id === id)?.numericInput?.quantityKind;
    expect(kindOf('opening.width')).toBe('model-length');
    expect(kindOf('opening.height')).toBe('model-length');
    expect(kindOf('column.width')).toBe('model-length');
    expect(kindOf('beam.depth')).toBe('model-length');
    expect(kindOf('slab.thickness')).toBe('model-length');
    expect(kindOf('stair.rise')).toBe('model-length');
  });

  it('τα preset arrays παραμένουν γραμμένα σε ΧΙΛΙΟΣΤΑ (δρόμος Β)', () => {
    // Η καρδιά της απόφασης του §7.1: το σύνορο μετατρέπει, τα δεδομένα δεν αγγίζονται.
    // Αν κάποιος «βοηθήσει» μετατρέποντας τα data σε μέτρα, η διπλή μετατροπή θα έδινε
    // 0.0009 m και αυτό το test το πιάνει πριν φτάσει στην οθόνη.
    const width = NUMERIC_COMMANDS.find((cmd) => cmd.id === 'opening.width');
    expect(width?.options?.map((o) => o.value)).toContain('900');
  });
});

/** Το κείμενο ενός κλειδιού μέσα στο namespace `dxf-viewer-shell` (undefined αν λείπει). */
function labelText(
  bundle: Record<string, unknown>,
  labelKey: string,
): string | undefined {
  let node: unknown = bundle;
  for (const part of labelKey.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const MODEL_LENGTH_COMMANDS = NUMERIC_COMMANDS.filter(
  (cmd) => cmd.numericInput?.quantityKind === 'model-length',
);

describe('ADR-677 Φάση 2γ — καμία ετικέτα δεν λέει ψέματα για τη μονάδα', () => {
  // ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η Φάση 2β έκανε τα πεδία να δείχνουν μέτρα και άφησε 13 ετικέτες να
  // γράφουν «(mm)» — «Πάχος Πλάκας (mm)» πάνω από ένα πεδίο που έδειχνε 0.200. Η διόρθωση
  // των 13 είναι διόρθωση· ΑΥΤΟ είναι η εγγύηση ότι δεν θα ξανασυμβεί σιωπηλά όταν κάποιος
  // αντιγράψει μια παλιά ετικέτα σε νέο πεδίο. Η μονάδα ΔΕΝ ανήκει στην ετικέτα — τη
  // ζωγραφίζει το ίδιο το πεδίο (`unitSuffixFor`), γι' αυτό ακολουθεί την επιλογή του χρήστη.
  const UNIT_IN_LABEL = /\((?:mm|χιλ\.|cm|εκ\.|m|μ\.)\)/i;

  it('σαρώνει ουσιώδη αριθμό διαστατικών πεδίων', () => {
    expect(MODEL_LENGTH_COMMANDS.length).toBeGreaterThan(50);
  });

  it.each([
    ['el', elShell as unknown as Record<string, unknown>],
    ['en', enShell as unknown as Record<string, unknown>],
  ])('κανένα διαστατικό πεδίο δεν κουβαλά μονάδα στην ετικέτα του (%s)', (_loc, bundle) => {
    const offenders = MODEL_LENGTH_COMMANDS.filter((cmd) => {
      const text = labelText(bundle, cmd.labelKey);
      return text !== undefined && UNIT_IN_LABEL.test(text);
    }).map((cmd) => `${cmd.id} → "${labelText(bundle, cmd.labelKey)}"`);
    expect(offenders).toEqual([]);
  });

  it('τα πεδία ΧΑΡΤΙΟΥ και τα DN κρατούν το «(mm)» τους — δεν παρασύρονται', () => {
    // Ο πειρασμός σε ένα μαζικό search&replace: αυτά τα τρία ΔΕΝ μετατρέπονται ποτέ, άρα η
    // ετικέτα τους λέει αλήθεια και πρέπει να μείνει.
    const keeps = ['mepUnderfloor.connectorDiameter', 'scaleBar.barHeight', 'scaleBar.labelHeight'];
    for (const id of keeps) {
      const cmd = NUMERIC_COMMANDS.find((c) => c.id === id);
      expect(cmd?.numericInput?.quantityKind).not.toBe('model-length');
      expect(labelText(elShell as unknown as Record<string, unknown>, cmd!.labelKey)).toMatch(/\(mm\)/);
    }
  });
});

describe('ADR-677 Φάση 2γ — η μετατροπή γίνεται ΜΙΑ φορά', () => {
  // Ο ΚΙΝΔΥΝΟΣ: ο `useRibbonLineToolBridge` μετατρέπει ΜΟΝΟΣ ΤΟΥ τα 8 Geometry πεδία
  // (`toDisp`/`fromDisp`, γρ. ~273-280 / ~426). Είναι ο ιδιοκτήτης της μετατροπής γι' αυτά.
  // Ένα δεύτερο `quantityKind: 'model-length'` πάνω τους δεν σκάει — ή μετατρέπει ΔΕΥΤΕΡΗ φορά
  // (900mm → 0.9 → 0.0009), ή αγνοείται σιωπηλά· και στις δύο περιπτώσεις ο κώδικας δείχνει
  // σωστός και στα δύο σημεία. Ίδιο σχήμα με το ιστορικό «PreviewCanvas = ΔΥΟ ιδιοκτήτες».

  it('τα 8 Geometry πεδία ΔΕΝ ζουν στο ribbon — άρα δεν περνούν από το σύνορο μονάδας', () => {
    // ADR-510 Φ2E #5: μετακόμισαν στην αριστερή παλέτα Ιδιοτήτων (AutoCAD: geometry = Ctrl+1,
    // ποτέ ribbon). ΑΝ ΣΕ ΕΚΟΨΕ: κάποιος τα ξαναέφερε στο ribbon. Πριν το κάνεις πράσινο,
    // βεβαιώσου ότι ΔΕΝ δηλώνουν `quantityKind` — ο bridge μετατρέπει ήδη.
    const inRibbon = collectCommands(ALL_TABS)
      .filter((cmd) => isLineGeometryKey(cmd.commandKey))
      .map((cmd) => `${cmd.id} (${cmd.commandKey})`);
    expect(inRibbon).toEqual([]);
  });

  it('κανένα Geometry πεδίο της παλέτας δεν δηλώνει quantityKind', () => {
    // Εδώ ζουν σήμερα, και ο τύπος τους δέχεται `quantityKind` — δηλαδή η δήλωση είναι
    // συντακτικά δυνατή και σημασιολογικά λάθος. Η παλέτα ΔΕΝ εφαρμόζει το σύνορο, οπότε μια
    // τέτοια δήλωση θα ήταν ψέμα που δεν κάνει τίποτα: ο επόμενος που θα καλωδιώσει τη μονάδα
    // στην παλέτα θα την εμπιστευόταν και θα διπλασίαζε τη μετατροπή.
    const geometryGroup = LINE_PROPERTY_GROUPS.find((g) => g.id === 'geometry');
    expect(geometryGroup?.fields).toHaveLength(8);
    const declared = (geometryGroup?.fields ?? [])
      .filter((f) => f.numericInput?.quantityKind !== undefined)
      .map((f) => f.commandKey);
    expect(declared).toEqual([]);
  });

  it('κανένα διαστατικό πεδίο δεν είναι editable:false', () => {
    // Ένα `editable: false` στέλνει το πεδίο στον κλάδο Radix Select, που ΔΕΝ έχει θέση για
    // την ένδειξη μονάδας — ο χρήστης θα έβλεπε «0.9» χωρίς να μάθει ποτέ τι είναι.
    const selectBranch = MODEL_LENGTH_COMMANDS
      .filter((cmd) => cmd.numericInput?.editable === false)
      .map((cmd) => cmd.id);
    expect(selectBranch).toEqual([]);
  });
});
