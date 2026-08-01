/**
 * ADR-505 §11 — **ΤΟ ΑΓΚΙΣΤΡΟ ΤΗΣ ΕΞΑΓΩΓΗΣ**: μία εντολή, τρία σημεία
 * εισόδου, και **κανένα** από τα τρία δεν επιτρέπεται να δείχνει στο πουθενά.
 *
 * ## Τι έπιασε (μετρημένο ζωντανά, 2026-08-01)
 * Το κουμπί «Εξαγωγή» της καρτέλας «Εισαγωγή» δήλωνε `action: 'export'` — συμβολοσειρά
 * **χωρίς κανέναν χειριστή**. Έπεφτε στο `default:` του `handleAction` και τύπωνε
 * `Unknown action: export`· πατήθηκε τρεις φορές, τρία μηνύματα στην κονσόλα, μηδέν
 * διάλογος. Την **ίδια** νεκρή συμβολοσειρά διαφήμιζε και το `Ctrl+E`, δηλωμένο στο SSoT
 * συντομεύσεων και ορατό στην επικάλυψη βοήθειας. Δίπλα του, στην καρτέλα «Ανάλυση»,
 * ζούσε ένα **byte-ταυτόσημα ονομασμένο** κουμπί που δούλευε μια χαρά.
 *
 * ## Γιατί ΚΑΝΕΝΑ στατικό εργαλείο δεν το είδε
 * Το `'export'` είναι έγκυρο `string` σε πεδίο τύπου `string`. Ο compiler είναι
 * ικανοποιημένος, ο linter επίσης, το knip το βλέπει ως δεδομένο και όχι ως export. Η μόνη
 * απόδειξη ότι μια **ενέργεια** υπάρχει είναι να **εκτελεστεί ο πραγματικός dispatcher**
 * και να απαντήσει «την ανέλαβα». Γι' αυτό αυτό το test καλεί τον αληθινό
 * {@link dispatchDxfSpecialAction} με τα αληθινά δεδομένα κορδέλας — δεν συγκρίνει
 * συμβολοσειρές με άλλες συμβολοσειρές (ADR-587: «ένα anchor χωρίς εκτέλεση είναι σχόλιο»).
 *
 * ## Ο κανόνας που φυλάει
 * Όποιος προσθέσει τέταρτο σημείο εισόδου, ή μετονομάσει την εντολή σε ένα μόνο από τα
 * τρία, γίνεται κόκκινος **εδώ** και όχι στην κονσόλα του Giorgio.
 *
 * @see app/dxf-special-actions.ts — ο dispatcher που εκτελείται πραγματικά
 * @see docs/centralized-systems/reference/adrs/ADR-505-unified-export-system.md §11
 */

import { INSERT_TAB } from '../../ui/ribbon/data/insert-tab';
import { EXPORT_PANEL } from '../../ui/ribbon/data/analyze-tab';
import { DXF_CTRL_SHORTCUTS } from '../../config/keyboard-shortcuts';
import type { RibbonCommand, RibbonPanelDef } from '../../ui/ribbon/types/ribbon-types';
import { EventBus } from '../../systems/events/EventBus';
import { dispatchDxfSpecialAction, type DxfSpecialActionDeps } from '../dxf-special-actions';

/**
 * Ο dispatcher εισάγει τους χειριστές κίνησης, που εισάγουν Firestore, που εισάγει
 * `@firebase/auth` — και αυτό αποτυγχάνει **στον χρόνο εισαγωγής** σε jsdom χωρίς `fetch`.
 * Ο κλάδος της εξαγωγής δεν τους αγγίζει· το mock κρατά το anchor στο **δικό του** ερώτημα
 * («αναλαμβάνεται η ενέργεια;») αντί να το κάνει όμηρο μιας άσχετης αλυσίδας εξαρτήσεων.
 */
jest.mock('../../bim-3d/animation/animation-action-handlers', () => ({
  handleAnimationExport: jest.fn(),
  handleAnimationSave: jest.fn(),
}));

/** Κάθε εντολή ενός πίνακα κορδέλας, ισοπεδωμένη — γραμμές × κουμπιά. */
function commandsOf(panel: RibbonPanelDef): readonly RibbonCommand[] {
  return panel.rows.flatMap((row) => row.buttons.map((button) => button.command));
}

/** Η **μία** εντολή με αυτή την ταυτότητα, ή αποτυχία με το τι βρέθηκε αντ' αυτής. */
function commandById(commands: readonly RibbonCommand[], id: string): RibbonCommand {
  const found = commands.filter((c) => c.id === id);
  expect(found.map((c) => c.id)).toEqual([id]);
  return found[0];
}

const INSERT_EXPORT_PANEL = INSERT_TAB.panels.find((p) => p.id === 'exportPanel');

/**
 * Ελάχιστες εξαρτήσεις: ο κλάδος της εξαγωγής είναι ένα σκέτο `EventBus.emit` και δεν
 * αγγίζει τίποτα άλλο. Ό,τι δεν χρησιμοποιεί δηλώνεται ρητά ως μη-κλητέο, ώστε ένας
 * μελλοντικός κλάδος που **θα** τα χρειαστεί να σπάσει φωναχτά αντί να διαβάσει `undefined`.
 */
function makeDeps(): DxfSpecialActionDeps {
  const unreachable = (name: string) => () => {
    throw new Error(`Ο κλάδος της εξαγωγής δεν επιτρέπεται να αγγίξει το «${name}»`);
  };
  return {
    selectedEntityIds: [],
    notifications: {
      success: unreachable('notifications.success'),
      error: unreachable('notifications.error'),
      info: unreachable('notifications.info'),
      warning: unreachable('notifications.warning'),
    },
    t: unreachable('t'),
    user: null,
    fullscreen: { toggle: unreachable('fullscreen.toggle') },
    levelManager: { getLevelScene: unreachable('levelManager.getLevelScene') },
    floatingRef: { current: null },
    setTestsModalOpen: unreachable('setTestsModalOpen'),
    setCreditsModalOpen: unreachable('setCreditsModalOpen'),
    setPdfPanelOpen: unreachable('setPdfPanelOpen'),
    setAiChatOpen: unreachable('setAiChatOpen'),
    setShowEnhancedImport: unreachable('setShowEnhancedImport'),
    setShowImportWizard: unreachable('setShowImportWizard'),
    setShowLegacyImport: unreachable('setShowLegacyImport'),
  } as unknown as DxfSpecialActionDeps;
}

describe('ADR-505 — η εντολή εξαγωγής έχει ΕΝΑ όνομα σε ΟΛΑ τα σημεία εισόδου', () => {
  it('η καρτέλα «Εισαγωγή» δηλώνει πίνακα εξαγωγής', () => {
    expect(INSERT_EXPORT_PANEL).toBeDefined();
  });

  it('τα δύο κουμπιά της κορδέλας ονομάζουν την ΙΔΙΑ ενέργεια', () => {
    const insert = commandById(commandsOf(INSERT_EXPORT_PANEL!), 'insert.export');
    const analyze = commandById(commandsOf(EXPORT_PANEL), 'analyze.export');
    expect(insert.action).toBe(analyze.action);
    // Ρητά, ώστε μια μετονομασία **και των δύο** μαζί να μη μείνει αόρατη.
    expect(insert.action).toBe('open-export-dialog');
    // Η εντολή που εκτελεί ο bridge πρέπει να είναι η ίδια με την ενέργεια — αλλιώς το
    // κουμπί ζητά άλλο πράγμα από αυτό που διαφημίζει.
    expect(insert.commandKey).toBe(insert.action);
  });

  it('το Ctrl+E του SSoT συντομεύσεων δείχνει στην ΙΔΙΑ ενέργεια', () => {
    const shortcut = DXF_CTRL_SHORTCUTS.export;
    expect({ key: shortcut.key, modifier: shortcut.modifier }).toEqual({
      key: 'E',
      modifier: 'ctrl',
    });
    // Το πρόθεμα `action:` είναι η σύμβαση του πίνακα συντομεύσεων· ό,τι μένει είναι η
    // ενέργεια που φτάνει στον dispatcher (`useDxfToolbarShortcuts`).
    expect(shortcut.action).toBe('action:open-export-dialog');
  });

  it('και τα δύο κουμπιά διαφημίζουν τη συντόμευση — μία εντολή, ένα Ctrl+E', () => {
    const insert = commandById(commandsOf(INSERT_EXPORT_PANEL!), 'insert.export');
    const analyze = commandById(commandsOf(EXPORT_PANEL), 'analyze.export');
    expect([insert.shortcut, analyze.shortcut]).toEqual(['Ctrl+E', 'Ctrl+E']);
  });

  it('🔴 ΤΟ ΖΩΝΤΑΝΟ ΚΑΡΦΙ: ο ΠΡΑΓΜΑΤΙΚΟΣ dispatcher αναλαμβάνει την ενέργεια', () => {
    const insert = commandById(commandsOf(INSERT_EXPORT_PANEL!), 'insert.export');
    const emit = jest.spyOn(EventBus, 'emit').mockImplementation(() => undefined);
    try {
      const handled = dispatchDxfSpecialAction(insert.action!, makeDeps());
      // `false` σημαίνει «δεν είναι δική μου» ⇒ πέφτει στο `default:` του `handleAction`
      // ⇒ `Unknown action` στην κονσόλα. Αυτή ΑΚΡΙΒΩΣ ήταν η ζημιά.
      expect(handled).toBe(true);
      expect(emit).toHaveBeenCalledWith('dxf:export-dialog-requested', {});
    } finally {
      emit.mockRestore();
    }
  });

  it('🔴 ΑΝΤΙΣΤΡΟΦΟ ΚΑΡΦΙ: η παλιά νεκρή συμβολοσειρά ΔΕΝ αναλαμβάνεται από κανέναν', () => {
    const emit = jest.spyOn(EventBus, 'emit').mockImplementation(() => undefined);
    try {
      // Χωρίς αυτό, το προηγούμενο test θα περνούσε ακόμα κι αν ο dispatcher επέστρεφε
      // `true` για τα πάντα. Το ζεύγος «αναλαμβάνεται / δεν αναλαμβάνεται» είναι η
      // απόδειξη ότι το `true` σημαίνει κάτι.
      expect(dispatchDxfSpecialAction('export', makeDeps())).toBe(false);
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
  });
});
