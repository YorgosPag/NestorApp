/**
 * 🔴 ADR-739 §52 — **οι δύο contextual καρτέλες πίνακα ως δεδομένα**.
 *
 * Τρεις μηχανισμοί εδώ αποτυγχάνουν **σιωπηλά**, και το test υπάρχει ακριβώς γι' αυτούς:
 *
 *  1. **`keepsTableCellSession`** — αν λείψει από ένα panel, τα κουμπιά του κλείνουν τον
 *     δρομέα ⇒ η καρτέλα εξαφανίζεται τη στιγμή που την πατάς. Κανένα σφάλμα, καμία εξαίρεση.
 *  2. **`autoActivateOnAppear`** — αν λείψει από τη «Μορφοποίηση», η καρτέλα εμφανίζεται αλλά
 *     **δεν γίνεται ποτέ ενεργή** (ο κοινός κανόνας του `RibbonRoot` σιωπά όταν η ενεργή είναι
 *     ήδη contextual). Αν μπει και στην «Ιδιότητες Πίνακα», οι δύο θα πάλευαν.
 *  3. **`action` σε κουμπί** — χωρίς αυτό, το `RibbonButton` δεν δρομολογεί ποτέ· το κουμπί
 *     απλώς δεν κάνει τίποτα.
 *
 *  4. **`widgetId`** — το `renderRibbonWidget` επιστρέφει `null` σε άγνωστο id: ένα
 *     ορθογραφικό λάθος είναι **αόρατο κουμπί, χωρίς κανένα σφάλμα**. Τα τέσσερα σύνθετα
 *     χειριστήρια της «Μορφοποίησης» ελέγχονται απέναντι στο **πραγματικό** μητρώο.
 *
 * ⚠️ Ο έλεγχος #4 είχε μείνει έξω με την αιτιολογία «το μητρώο τραβά `jspdf` και δεν
 * αναλύεται στο jest». **Επαληθεύτηκε 2026-08-06 ότι αυτό δεν ισχύει**: το
 * `insert-tab-table-button.test.ts` φορτώνει το ίδιο μητρώο και είναι πράσινο. Η υπόθεση
 * ήταν λάθος, όχι το περιβάλλον — γι' αυτό ο έλεγχος μπήκε αντί να χαρακτηριστεί.
 *
 * @see ui/ribbon/data/contextual-table-tab.ts · contextual-table-format-tab.ts
 */

import { CONTEXTUAL_TABLE_TAB, TABLE_CONTEXTUAL_TRIGGER } from '../contextual-table-tab';
import {
  CONTEXTUAL_TABLE_FORMAT_TAB,
  TABLE_FORMAT_CONTEXTUAL_TRIGGER,
} from '../contextual-table-format-tab';
import { withStandardLeadPanel } from '../contextual-lead-panel';
import {
  TABLE_FORMAT_RIBBON_KEYS,
  TABLE_PROPERTIES_RIBBON_KEYS,
  isTableFormatActionKey,
  isTableFormatAlignKey,
  isTableFormatNumberKey,
  isTableFormatOverflowKey,
  isTableFormatToggleKey,
  isTablePropertiesActionKey,
} from '../../hooks/bridge/table-format-command-keys';
import { TABLE_TEXT_HEIGHT_SCALE_MM } from '../../../../bim/table/table-text-height-scale';
import { loadContextualTabs, loadWidgetRenderer } from './ribbon-registry-test-loader';
import type { RibbonButton, RibbonTab } from '../../types/ribbon-types';

const allButtons = (tab: RibbonTab): RibbonButton[] =>
  tab.panels.flatMap((panel) => panel.rows.flatMap((row) => row.buttons));

// Και τα δύο μητρώα φορτώνονται δυναμικά μέσω του κοινού loader — δες την κεφαλίδα του.

describe('Καταχώριση — και οι δύο καρτέλες φτάνουν στην κορδέλα', () => {
  it('υπάρχουν στο SSoT μητρώο (παράλειψη ⇒ η καρτέλα δεν εμφανίζεται ΚΑΘΟΛΟΥ)', async () => {
    const registry = await loadContextualTabs();
    expect(registry).toContain(CONTEXTUAL_TABLE_TAB);
    expect(registry).toContain(CONTEXTUAL_TABLE_FORMAT_TAB);
  });

  it('τα δύο tokens είναι ΔΙΑΦΟΡΕΤΙΚΑ και μοναδικά σε ολόκληρο το μητρώο', async () => {
    const registry = await loadContextualTabs();
    // Δύο καρτέλες με το ίδιο trigger θα εμφανίζονταν πάντα μαζί — δηλαδή το σύνθετο trigger
    // θα ήταν διακοσμητικό και η «Μορφοποίηση» θα υπήρχε και χωρίς δρομέα.
    expect(TABLE_CONTEXTUAL_TRIGGER).not.toBe(TABLE_FORMAT_CONTEXTUAL_TRIGGER);
    const owners = registry.filter(
      (tab) => tab.contextualTrigger === TABLE_CONTEXTUAL_TRIGGER
        || tab.contextualTrigger === TABLE_FORMAT_CONTEXTUAL_TRIGGER,
    );
    expect(owners).toHaveLength(2);
  });
});

describe('🔴 keepsTableCellSession — το κλικ στην κορδέλα δεν σκοτώνει τον δρομέα', () => {
  it('ΚΑΘΕ panel και των δύο καρτελών το δηλώνει', () => {
    const missing = [...CONTEXTUAL_TABLE_TAB.panels, ...CONTEXTUAL_TABLE_FORMAT_TAB.panels]
      .filter((panel) => panel.keepsTableCellSession !== true)
      .map((panel) => panel.id);
    expect(missing).toEqual([]);
  });

  it('🔴 το lead panel («Κλείσιμο» + σύριγγα) ΔΕΝ το δηλώνει — και σωστά', () => {
    // Το «Κλείσιμο» αδειάζει την επιλογή και επιστρέφει στο «Αρχική»: ο χρήστης **φεύγει** από
    // τον πίνακα. Ένα keep-alive εκεί θα κρατούσε ζωντανό δρομέα σε πίνακα που δεν είναι πια
    // επιλεγμένος — η χειρότερη εκδοχή του «κόλλησε».
    const normalised = withStandardLeadPanel(CONTEXTUAL_TABLE_FORMAT_TAB);
    expect(normalised.panels[0].keepsTableCellSession).toBeUndefined();
  });

  it('καμία ΑΛΛΗ contextual καρτέλα δεν το δηλώνει (opt-in, ποτέ καθολικό)', async () => {
    const leaked = (await loadContextualTabs())
      .filter((tab) => tab !== CONTEXTUAL_TABLE_TAB && tab !== CONTEXTUAL_TABLE_FORMAT_TAB)
      .flatMap((tab) => tab.panels)
      .filter((panel) => panel.keepsTableCellSession)
      .map((panel) => panel.id);
    expect(leaked).toEqual([]);
  });
});

describe('🔴 autoActivateOnAppear — ΜΟΝΟ η «Μορφοποίηση»', () => {
  it('η «Μορφοποίηση» το δηλώνει· η «Ιδιότητες Πίνακα» ΟΧΙ', () => {
    expect(CONTEXTUAL_TABLE_FORMAT_TAB.autoActivateOnAppear).toBe(true);
    expect(CONTEXTUAL_TABLE_TAB.autoActivateOnAppear).toBeUndefined();
  });

  it('καμία από τις ~50 άλλες contextual καρτέλες δεν το δηλώνει', async () => {
    const registry = await loadContextualTabs();
    // Μηδενική αλλαγή συμπεριφοράς για ό,τι υπήρχε: η σημαία είναι opt-in εξαίρεση, όχι νέος
    // κοινός κανόνας. Αν διέρρεε αλλού, δύο καρτέλες θα πάλευαν για την ίδια εστίαση.
    const leaked = registry
      .filter((tab) => tab.autoActivateOnAppear && tab !== CONTEXTUAL_TABLE_FORMAT_TAB)
      .map((tab) => tab.id);
    expect(leaked).toEqual([]);
  });
});

describe('Καλωδίωση εντολών — καμία εντολή χωρίς παραλήπτη', () => {
  it('κάθε κουμπί ενέργειας δηλώνει `action` ΚΑΙ ανήκει σε φύλακα του bridge', () => {
    const orphans = [...allButtons(CONTEXTUAL_TABLE_TAB), ...allButtons(CONTEXTUAL_TABLE_FORMAT_TAB)]
      .filter((b) => b.type === 'simple')
      .filter((b) => {
        const { action } = b.command;
        // Χωρίς `action` το κουμπί δεν δρομολογεί ΠΟΤΕ· με άγνωστο `action` πέφτει στο
        // generic fallback και «δεν κάνει τίποτα» — και τα δύο σιωπηλά.
        return !action || !(isTableFormatActionKey(action) || isTablePropertiesActionKey(action));
      })
      .map((b) => b.command.id);
    expect(orphans).toEqual([]);
  });

  /**
   * 🔴 **ΤΡΕΙΣ** οικογένειες toggle, όχι μία — και η επέκταση δεν είναι χαλάρωση.
   *
   * ⚠️ **Η άγκυρα ήταν ΚΟΚΚΙΝΗ από το §56 και κανείς δεν το είδε** (μετρήθηκε 2026-08-07):
   * εκείνο πρόσθεσε **έξι** κουμπιά στοίχισης και **τρία** μορφής αριθμού ως `type: 'toggle'`,
   * με **δικούς τους** φύλακες (`isTableFormatAlignKey` / `isTableFormatNumberKey`) — ρητή και
   * σωστή σχεδίαση, τεκμηριωμένη στο `table-format-command-keys.ts`. Αυτό εδώ όμως ρωτούσε μόνο
   * τον **έναν** από τους τρεις, οπότε και τα εννέα έβγαιναν «ορφανά».
   *
   * 🔑 Δεν το έπιασε κανείς επειδή η απόδειξη του §56 έτρεξε **άλλους τρεις φακέλους**
   * (`table-format-toolbar`, `table-cell-editor/__tests__`, `bim/table/__tests__`) — αυτό το
   * suite ζει στο `ui/ribbon/data/__tests__` και δεν το άγγιξε καμία εντολή. Είναι ακριβώς το
   * σχήμα που το ADR-587 §6.1 ονομάζει «anchor χωρίς gate»: το δίχτυ υπήρχε, απλώς δεν το
   * τράβηξε κανείς.
   *
   * Η ερώτηση που κάνει το test μένει **η ίδια** («κάθε toggle έχει παραλήπτη στον bridge») —
   * αυτό που διορθώνεται είναι ότι ρωτούσε **λάθος** τους δύο από τους τρεις παραλήπτες.
   */
  it('κάθε toggle ανήκει σε ΕΝΑΝ από τους τέσσερις φύλακες μορφοποίησης', () => {
    const orphans = allButtons(CONTEXTUAL_TABLE_FORMAT_TAB)
      .filter((b) => b.type === 'toggle')
      .filter((b) => {
        const { commandKey } = b.command;
        return !(
          isTableFormatToggleKey(commandKey)
          || isTableFormatAlignKey(commandKey)
          || isTableFormatNumberKey(commandKey)
          // §58 Γ2 — **τέταρτη** οικογένεια: αναδίπλωση / σμίκρυνση. Δικός της φύλακας, γιατί
          // ρωτά άλλο πεδίο του μοντέλου με άλλη αλυσίδα κληρονομιάς (κελί ▸ στήλη, ποτέ στυλ).
          || isTableFormatOverflowKey(commandKey)
        );
      })
      .map((b) => b.command.id);
    expect(orphans).toEqual([]);
  });

  it('οι έξι δομικές + η επιλογή όλων είναι ΟΛΕΣ παρούσες (καμία δηλωμένη-αλλά-αόρατη)', () => {
    const declared = new Set(Object.values(TABLE_PROPERTIES_RIBBON_KEYS.actions));
    const wired = new Set(
      allButtons(CONTEXTUAL_TABLE_TAB).map((b) => b.command.action).filter(Boolean),
    );
    expect([...declared].filter((k) => !wired.has(k))).toEqual([]);
  });

  it('τα ids των κουμπιών είναι μοναδικά — το `id` είναι React `key`', () => {
    const ids = [...allButtons(CONTEXTUAL_TABLE_TAB), ...allButtons(CONTEXTUAL_TABLE_FORMAT_TAB)]
      .map((b) => b.command.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('🔴 ΚΑΘΕ `widgetId` υπάρχει στο ΠΡΑΓΜΑΤΙΚΟ μητρώο — άγνωστο id = αόρατο κουμπί', async () => {
    const renderRibbonWidget = await loadWidgetRenderer();
    const widgetIds = [...allButtons(CONTEXTUAL_TABLE_TAB), ...allButtons(CONTEXTUAL_TABLE_FORMAT_TAB)]
      .filter((b) => b.type === 'widget')
      .map((b) => b.widgetId);

    // Τα **έξι** σύνθετα χειριστήρια: δύο χρώματα, συγχώνευση, περιγράμματα, το **πινέλο
    // μορφοποίησης** (ADR-768 Βήμα 5) και η **«Επικόλληση»** (ADR-739 §57). Αν αυτό γίνει 0, το
    // test θα περνούσε κενό ενώ η καρτέλα θα είχε χάσει τα widgets της.
    //
    // ⚠️ Το πινέλο μπήκε ως `widget` και **όχι** ως `type: 'toggle'` της κορδέλας, παρότι είναι
    // δίτιμο κουμπί: το `RibbonToggleState` είναι `boolean | null` (`null` = μεικτό) και δεν
    // χωρά την **τρίτη** κατάσταση («κλειδωμένο»), ούτε έχει πού να δείξει λουκέτο. Το widget
    // τυλίγει το **ίδιο** component με το mini toolbar, ποτέ αντίγραφό του.
    //
    // ⚠️ §57 — η «Επικόλληση» μπήκε ως `widget` και **όχι** ως `type: 'split'` της κορδέλας για
    // **δομικό** λόγο: το `RibbonSplitDropdown` ζωγραφίζει σε portal, που ο φύλακας συνεδρίας
    // κελιού δεν αναγνωρίζει ⇒ το κλικ σε item θα εξαφάνιζε την ίδια την καρτέλα.
    expect(widgetIds).toHaveLength(6);

    const unknown = widgetIds.filter((id) => renderRibbonWidget(id) === null);
    expect(unknown).toEqual([]);
  });
});

describe('Ύψος κειμένου — η λίστα ΠΑΡΑΓΕΤΑΙ από τη σκάλα', () => {
  const heightCombo = allButtons(CONTEXTUAL_TABLE_FORMAT_TAB)
    .find((b) => b.command.commandKey === TABLE_FORMAT_RIBBON_KEYS.textHeight);

  it('🔴 οι επιλογές είναι ΑΚΡΙΒΩΣ τα σκαλιά που κινούν τα A↑/A↓', () => {
    // Δεύτερη, χειρόγραφη λίστα θα σήμαινε ότι το βήμα προσγειώνεται σε τιμή που το dropdown
    // δεν προσφέρει — και αντίστροφα· δύο απαντήσεις στο «ποια μεγέθη υπάρχουν».
    expect(heightCombo?.command.options?.map((o) => Number(o.value)))
      .toEqual([...TABLE_TEXT_HEIGHT_SCALE_MM]);
  });

  it('🔴 δηλώνει `paper-length` — το ύψος είναι mm ΧΑΡΤΙΟΥ, ποτέ μοντέλου', () => {
    // Με `model-length` το «2.5 mm» θα ξαναγραφόταν στη μονάδα του έργου (ADR-677 §7.1):
    // σε έργο σε μέτρα θα εμφανιζόταν «0.0025» και θα δεσμευόταν λάθος.
    expect(heightCombo?.command.numericInput?.quantityKind).toBe('paper-length');
  });
});
