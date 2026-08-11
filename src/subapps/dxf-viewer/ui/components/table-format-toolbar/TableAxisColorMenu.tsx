'use client';

/**
 * ADR-739 Φ.Ε/Φ4 + Φ4β — **το χρώμα του mini toolbar**: split button + οι ζώνες του μενού.
 * **Ένα** component, **δύο** ρόλοι — χρώμα κειμένου (`A`) και χρώμα γεμίσματος (κουβαδάκι).
 *
 * ## Οι ζώνες, και από πού προκύπτει καθεμία
 * | ζώνη | τι είναι | ποιος το κάνει έτσι |
 * |---|---|---|
 * | «Από το στυλ» | το πεδίο **λείπει** ⇒ κληρονομιά από το στυλ | Excel «Αυτόματο» · AutoCAD `ByLayer` · Revit «By Category» |
 * | «Αυτόματο» *(μόνο μελάνι)* | ρητό `'auto'` ⇒ λευκό ή μαύρο κατά το φόντο | AutoCAD ACI 7 · Word/Excel «Automatic» |
 * | «Κανένα γέμισμα» *(μόνο γέμισμα)* | ρητό `null` ⇒ **διαφανές**, ακόμη κι αν το στυλ βάφει | Excel «Χωρίς γέμισμα» · InDesign `[None]` · ArchiCAD Pen 0 |
 * | «Χρώματα του σχεδίου» | τα χρώματα που **υπάρχουν** στο έγγραφο, επίπεδα | Figma «On this page» · C4D `SWATCH_CATEGORY::DOCUMENT` · ArchiCAD Pen Set |
 * | «Βασικά χρώματα» | το πλέγμα 13×6 της παλέτας | σχήμα Excel, περιεχόμενο AutoCAD |
 * | «Περισσότερα χρώματα…» | ο **υπάρχων** διάλογος του έργου | Excel · AutoCAD «Select Color…» |
 *
 * ## 🔴 ΓΙΑΤΙ ΕΝΑ COMPONENT ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΟ ΑΝΤΙΓΡΑΦΟ — εντολή ιδιοκτήτη
 * «Με το **ίδιο** μενού παραμετροποιημένο, ρητά **όχι** δεύτερο αντίγραφο.» Ένα
 * `TableFillColorMenu.tsx` δίπλα σε αυτό θα ήταν ακριβώς το sibling clone που πιάνει το
 * CHECK 3.28 (N.18) — και, χειρότερα, δύο επιφάνειες που θα μάθαιναν κάποτε διαφορετική
 * συμπεριφορά για την ίδια χειρονομία.
 *
 * ## 🔴 Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ — το πρώτο τέτοιο χειριστήριο της εφαρμογής
 * Το γέμισμα έχει **τρεις** απαντήσεις (`undefined` κληρονομιά · `null` ρητά κανένα · hex), και
 * οι **δύο πρώτες ζωγραφίζουν ολόιδια** όταν το στυλ δεν βάφει: άδειο κελί και στις δύο.
 *
 * Η έρευνα βρήκε ότι το Excel **δεν έχει απάντηση** — δεν έχει «Αυτόματο» για γέμισμα καθόλου.
 * Απαντούν όμως άλλοι, και συμφωνούν: το InDesign κρατά **δύο ξεχωριστά** δείγματα, `[None]`
 * (διαφανές) και `[Paper]` (αδιαφανές λευκό), ακριβώς επειδή σε λευκό χαρτί δείχνουν ίδια και
 * σημαίνουν άλλα· και το `[None]` είναι **λευκό τετράγωνο με κόκκινη διαγώνιο**, το ίδιο
 * εικονίδιο που δείχνει και το Office στο «No Fill». Το ArchiCAD απαντά με το **Pen 0**, που
 * εμφανίζεται ως σύμβολο κενού συνόλου (ø) αντί για αριθμό.
 *
 * Εδώ:
 * - **δύο γραμμές** στη ζώνη 0 («Αυτόματο» + «Κανένα γέμισμα»), και οι δύο `menuitemradio` στην
 *   **ίδια** ομάδα με τα δείγματα ⇒ ακριβώς μία φοράει `aria-checked`, και η τρίτη κατάσταση
 *   υπάρχει για τον αναγνώστη οθόνης χωρίς να εφευρεθεί widget·
 * - το γλυφό «κανένα» είναι **λευκό + κόκκινη διαγώνιος**. ΟΧΙ σκακιέρα: σε κάθε εργαλείο που
 *   τη χρησιμοποιεί (Photoshop, Figma, GIMP) σημαίνει **κανάλι άλφα**, δηλαδή θα υποσχόταν
 *   διαφάνεια που το μοντέλο **δεν έχει**. ΟΧΙ ø: εκείνο είναι πεδίο **αριθμού πένας**, και
 *   μέσα σε πλέγμα δειγμάτων θα διαβαζόταν ως ένα ακόμη χρώμα·
 * - 🔑 **η υπόδειξη λέει τι κληρονομείς**, όχι απλώς ότι κληρονομείς. Όταν τα δύο δείγματα
 *   ζωγραφίζουν ίδια, η διάκριση ζει στη **δομή και στα λόγια** — και εκεί ακριβώς όπου το
 *   Excel δεν έχει τίποτα να δείξει, εμείς έχουμε ήδη γραμμένο το χειριστήριο που το ξέρει.
 *
 * ## 🔴 ΜΙΑ εντολή εγγραφής, τρία ορίσματα — όχι τρεις εντολές
 * Το `onSet` δέχεται `string | null | undefined` και είναι **ένα** prop. Η δοκτρίνα δεν είναι
 * δική μας: το `types/table.ts` την γράφει ήδη για το μοντέλο — DXF group 62 λύνει το ίδιο
 * πρόβλημα με «**ένα** πεδίο, τρεις απαντήσεις· ποτέ δεύτερο παράλληλο boolean, που θα ήταν
 * δεύτερη πηγή αλήθειας και θα μπορούσε να αντιφάσκει με την πρώτη». Τρία props
 * (`onPick`/`onNone`/`onAutomatic`) θα ήταν τρεις δρόμοι προς την **ίδια** εγγραφή, και ο ένας
 * τους θα ξεχνούσε κάποτε το no-op by-reference που κρατά καθαρό το ιστορικό αναιρέσεων.
 *
 * ## 🔴 Το split button — και γιατί το «τελευταίο» δεν είναι τα «πρόσφατα»
 * Κλικ στο κύριο μισό = εφάρμοσε ξανά **χωρίς μενού**· κλικ στο βελάκι = άνοιξε την παλέτα. Το
 * χρώμα της μπάρας έρχεται από το {@link toolbarColorStoreFor}, **όχι** από το
 * `RecentColorsStore`: εκείνο είναι καθολικό LRU όλου του subapp, άρα μια επιλογή χρώματος
 * layer θα άλλαζε μόνη της τι κάνει αυτό το κουμπί. Γράφουμε **και** στα δύο, διαβάζουμε από
 * το πρώτο.
 *
 * ## 🔴 Ο διάλογος ΔΕΝ εφαρμόζει ζωντανά — και αυτό είναι απόκλιση, όχι παράλειψη
 * Ο `ColorPickerPopover` της γραμμής κειμένου εφαρμόζει σε κάθε κίνηση του δρομέα (WYSIWYG) και
 * επαναφέρει στην «Ακύρωση». Εδώ κάθε εφαρμογή είναι **εντολή στο ιστορικό**: το ίδιο θα
 * γέμιζε το `Ctrl+Z` με δεκάδες βήματα ανά επιλογή. Κρατάμε πρόχειρο και δεσμεύουμε **μία**
 * φορά στην «Εφαρμογή» — ένα χρώμα, ένα βήμα undo, όπως κάθε άλλη εντολή της γραμμής.
 *
 * ## Γιατί σκέτα `<button>` και πάνελ ΜΕΣΑ στο δοχείο
 * Ίδιοι δύο λόγοι με το {@link TableBorderMenu}: το `DxfMenuItem` δουλεύει μόνο μέσα σε
 * `Menu.Content`, και ένα δεύτερο portal θα μετρούσε ως «κλικ έξω» για τον φύλακα
 * `keepOpenOnToolbar` — δηλαδή το `onClick` δεν θα έτρεχε ποτέ.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableAxisColorMenu
 * @see table-color-menu-selection.ts — ποια γραμμή είναι η ενεργή (καθαρό, δοκιμάσιμο)
 * @see table-color-menu-rows.tsx — οι δύο σειρές (N.7.1: εξήχθησαν στις 505/500 γραμμές)
 * @see bim/table/table-ink.ts — τι σημαίνει «Αυτόματο» και πού επιλύεται (§38)
 * @see ui/components/table-format-toolbar/TableColorSwatchGrid.tsx — το πλέγμα
 * @see bim/table/table-drawing-colors.ts — από πού βγαίνουν τα «χρώματα του σχεδίου»
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §28.14, §35
 */

import React, {
  useCallback, useState, useSyncExternalStore, type KeyboardEvent,
} from 'react';
import { Baseline, PaintBucket, Palette } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import { TABLE_CELL_PANEL_SURFACE } from '../../table-cell-editor/table-cell-keyboard-ownership';
import { getRecentColorsStore } from '../../color/RecentColorsStore';
import { useToolbarPanel } from './use-toolbar-panel';
import { normalizeHexColor } from '../../../config/color-math';
import { toolbarColorStoreFor } from '../../../state/table-toolbar-color-store';
import { colorGridFor } from '../../color/aci-color-grid';
import {
  AUTOMATIC_TABLE_INK,
  liveTableSurfaceHex,
  resolveTableInk,
} from '../../../bim/table/table-ink';
import {
  resolveColorMenuSelection,
  selectedSwatchHex,
  type TableAxisColorState,
} from './table-color-menu-selection';
import { automaticHintKey, colorMenuKeys } from './table-color-menu-roles';
import { CommandRow, DrawingColorsRow } from './table-color-menu-rows';
import { TableColorSwatchGrid } from './TableColorSwatchGrid';
import { ToolbarSplitButton } from './ToolbarSplitButton';
import { type RovingItemProps } from './use-roving-toolbar';
import { TableColorDialog } from './TableColorDialog';
import styles from './TableAxisColorMenu.module.css';
import toolbar from './TableFormatToolbar.module.css';


interface TableAxisColorMenuBase {
  /** Roving του **κύριου** μισού (εφαρμόζει το τελευταίο χρώμα). */
  readonly rovingApply: RovingItemProps;
  /** Roving του **βελακιού** (ανοίγει την παλέτα). */
  readonly rovingMenu: RovingItemProps;
  /** Η κατάσταση του πεδίου κατά μήκος του άξονα — δες {@link TableAxisColorState}. */
  readonly state: TableAxisColorState;
}

/**
 * 🔴 Ο ρόλος **περιορίζει τον τύπο της εγγραφής** — δεν είναι απλώς ετικέτα.
 *
 * Το μοντέλο επιτρέπει `null` **ακριβώς** στα πεδία που το επιλυμένο `TableCellStyle` δηλώνει
 * προαιρετικά (`types/table.ts`: «μηχανικός κανόνας, όχι κρίση»). Το `textColorHex` δεν είναι
 * ένα από αυτά. Μια ενιαία υπογραφή `(string | null | undefined)` και για τους δύο ρόλους θα
 * επέτρεπε στον μεταγλωττιστή να δεχτεί χειριστή κειμένου που δέχεται `null` — δηλαδή θα
 * μετέφερε τον κανόνα από τον τύπο σε ένα σχόλιο.
 *
 * Με διακριτή ένωση, «κανένα χρώμα κειμένου» **δεν μεταγλωττίζεται**.
 */
export type TableAxisColorMenuProps =
  | (TableAxisColorMenuBase & {
    readonly role: 'ink';
    /** `hex` ρητό χρώμα · `undefined` «Αυτόματο». Το `null` δεν είναι εκφράσιμο, εξ ορισμού. */
    readonly onSet: (value: string | undefined) => void;
  })
  | (TableAxisColorMenuBase & {
    readonly role: 'fill';
    /** `hex` ρητό · `null` **ρητά κανένα** · `undefined` «Αυτόματο». Δες την κεφαλίδα. */
    readonly onSet: (value: string | null | undefined) => void;
  });

export function TableAxisColorMenu(props: TableAxisColorMenuProps): React.ReactElement {
  const { role, rovingApply, rovingMenu, state } = props;
  const { t } = useTranslation('dxf-viewer');
  /*
   * 🔴 ADR-753 §26.8 — **ο ΤΕΤΑΡΤΟΣ κύκλος ζωής πάνελ έγινε ο ίδιος με τους τρεις άλλους.**
   *
   * Ήταν χειρόγραφος (`useState` + `useId` + `useRef` + δικό του `Escape`) και είχε ήδη
   * αποκλίνει σε **δύο** σημεία που το §25.6 είχε διορθώσει παντού αλλού: το `Escape` έκανε
   * ωμό `triggerRef.current?.focus()` (κλοπή, όταν το πληκτρολόγιο το κρατά το κελί), και το
   * κλείσιμο μετά την επιλογή χρώματος **δεν επέστρεφε ποτέ** την εστίαση, ούτε καν στον
   * χρήστη πληκτρολογίου που της την είχε δώσει. Δύο αντίθετα λάθη από την ίδια αιτία: τέταρτο
   * αντίγραφο μιας απόφασης που ζει κεντρικά (N.18 / CHECK 3.28).
   */
  const panel = useToolbarPanel();
  const { isOpen, panelId, triggerRef, close } = panel;
  const [dialogDraft, setDialogDraft] = useState<string | null>(null);

  const keys = colorMenuKeys(role);
  const isFill = role === 'fill';
  const store = toolbarColorStoreFor(role);

  // Χαμηλής συχνότητας (μία γραφή ανά επιλογή χρώματος) και σε **φύλλο**, όχι σε orchestrator —
  // ο ADR-040 απαγορεύει το δεύτερο, όχι το πρώτο.
  const lastColor = useSyncExternalStore(store.subscribe, store.get, () => store.fallback);

  const selection = resolveColorMenuSelection(state);
  const selectedHex = selectedSwatchHex(selection);

  /**
   * 🔴 ADR-739 §38 — η επιφάνεια πάνω στην οποία θα προσγειωθεί το μελάνι, για να δείξουν τα
   * **δείγματα** την αλήθεια.
   *
   * Χωρίς αυτό, ένα κληρονομούμενο `AUTOMATIC_TABLE_INK` θα έφτανε στο `backgroundColor` του
   * δείγματος ως `'auto'` — **έγκυρη** CSS τιμή που απλώς δεν βάφει, δηλαδή κενό τετράγωνο σε
   * γραμμή που υπόσχεται να δείξει χρώμα. Δεν σπάει τίποτα, και γι' αυτό ακριβώς είναι το
   * επικίνδυνο σχήμα (δες `table-ink.ts`).
   *
   * ⚠️ Μη-αντιδραστική ανάγνωση, εσκεμμένα: το μενού είναι εφήμερο (κλείνει με κλικ έξω), οπότε
   * μια αλλαγή θέματος **με το μενού ανοιχτό** είναι κατάσταση που δεν συμβαίνει — και μια
   * συνδρομή εδώ θα ήταν ο ADR-040 σπασμένος για μηδέν κέρδος.
   */
  const surfaceHex = liveTableSurfaceHex();
  const inheritedSwatch = state.inheritedMixed
    ? 'varies'
    : state.inheritedColor === undefined
      ? 'none'
      : resolveTableInk(state.inheritedColor, surfaceHex);

  /**
   * Η μία διαδρομή κάθε **χρώματος**: θυμήσου → τροφοδότησε τα πρόσφατα → εφάρμοσε → κλείσε.
   *
   * Το «θυμήσου» γίνεται **πριν** την εφαρμογή ώστε η μπάρα να έχει ήδη το νέο χρώμα όταν ο
   * γονέας ξαναποδώσει τη γραμμή — αλλιώς το κουμπί θα έδειχνε το προηγούμενο για ένα καρέ.
   */
  const { onSet } = props;
  const pick = useCallback((rawHex: string) => {
    const hex = normalizeHexColor(rawHex);
    store.set(hex);
    getRecentColorsStore().addColor(hex);
    onSet(hex);
    close();
  }, [store, onSet, close]);

  /**
   * «Αυτόματο» — δεν περνά από το {@link pick} και δεν γράφει στη μνήμη: το «τελευταίο χρώμα»
   * του split button πρέπει να παραμείνει **χρώμα**, αλλιώς το κύριο μισό του κουμπιού δεν θα
   * είχε τι να εφαρμόσει στο επόμενο πάτημα.
   */
  const chooseAutomatic = useCallback(() => {
    onSet(undefined);
    close();
  }, [onSet, close]);

  /**
   * 🔴 ADR-739 §38 — «Αυτόματο»: **ρητή** επιλογή του χρήστη, όχι απουσία επιλογής. Γράφει το
   * σεντινέλι στο πεδίο, ενώ το {@link chooseAutomatic} γράφει `undefined` (= σβήνει το πεδίο).
   *
   * Ίδιος λόγος με το «Αυτόματο» να μην περνά από το {@link pick}: το «τελευταίο χρώμα» του
   * split button πρέπει να παραμείνει **χρώμα** — ένα κύριο μισό που θα εφάρμοζε `'auto'` θα
   * ήταν κουμπί που δεν ξέρει τι κάνει μέχρι να πατηθεί.
   */
  const chooseAutoContrast = useCallback(() => {
    onSet(AUTOMATIC_TABLE_INK);
    close();
  }, [onSet, close]);

  /**
   * «Κανένα γέμισμα» — ίδιο σκεπτικό, αλλά ο έλεγχος του ρόλου **δεν είναι αμυντικός**: είναι
   * ο τρόπος που ο μεταγλωττιστής στενεύει τη διακριτή ένωση ώστε το `null` να είναι νόμιμο
   * όρισμα. Στον ρόλο `'ink'` η γραμμή δεν αποδίδεται καν, οπότε ο κλάδος είναι απρόσιτος —
   * και η υπογραφή το εγγυάται αντί να το ελπίζει.
   */
  const chooseNone = useCallback(() => {
    if (props.role !== 'fill') return;
    props.onSet(null);
    close();
  }, [props, close]);

  /**
   * Το `Escape` κλείνει **το πάνελ**, όχι όλη τη γραμμή: ένα `Escape` = ένα επίπεδο — και αυτό
   * το ξέρει ήδη το {@link useToolbarPanel}. Εδώ μένει **μόνο** ό,τι είναι δικό του: όσο ο
   * διάλογος «Περισσότερα χρώματα…» είναι μπροστά, το `Escape` **ανήκει σε εκείνον**.
   *
   * Περιτύλιγμα και όχι αντίγραφο: αν ο κεντρικός κύκλος ζωής μάθει κάτι καινούργιο για το
   * κλείσιμο, το μαθαίνει και αυτό το πάνελ — που είναι ακριβώς αυτό που **δεν** έγινε όσο ήταν
   * γραμμένο με το χέρι.
   */
  const onPanelKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (dialogDraft !== null) return;
    panel.onPanelKeyDown(event);
  }, [dialogDraft, panel]);

  const TriggerIcon = isFill ? PaintBucket : Baseline;

  return (
    <span className={styles.anchor}>
      {/*
        ADR-755 — ο σκελετός των δύο μισών είναι **κοινός** με το split button συγχώνευσης
        (CHECK 3.28 τον μέτρησε ως δίδυμο). Εδώ μένει μόνο ό,τι είναι δικό του: το εικονίδιο
        ρόλου και η έγχρωμη μπάρα.
      */}
      <ToolbarSplitButton
        rovingApply={rovingApply}
        rovingMenu={rovingMenu}
        mainLabel={t(keys.trigger)}
        menuLabel={t(keys.openMenu)}
        mainClassName={styles.applyButton}
        onMainClick={() => pick(lastColor)}
        isOpen={isOpen}
        panelId={panelId}
        onToggleMenu={panel.toggle}
        triggerRef={triggerRef}
      >
        <TriggerIcon size={15} aria-hidden="true" />
        {/* Η έγχρωμη μπάρα ΕΙΝΑΙ η πληροφορία «τι θα εφαρμόσει αυτό το κλικ». */}
        <span
          className={styles.colorBar}
          style={{ backgroundColor: lastColor }}
          aria-hidden="true"
        />
      </ToolbarSplitButton>

      {isOpen ? (
        <div
          id={panelId}
          role="menu"
          aria-label={t(keys.menuLabel)}
          onKeyDown={onPanelKeyDown}
          className={cn(
            styles.panel,
            'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
          )}
          // 🔴 ADR-753 §26.8 — ένας φρουρός για **όλο** το χρωματολόγιο: τις γραμμές εντολών,
          // τα χρώματα του σχεδίου, τα **78** δείγματα του πλέγματος και το «Περισσότερα
          // χρώματα…». Το `mousedown` αναδύεται — δεν χρειάζεται κανένα από αυτά να το ξέρει.
          {...TABLE_CELL_PANEL_SURFACE}
        >
          {/*
            🔑 Η υπόδειξη λέει **τι** κληρονομείς. Όταν το γέμισμα κληρονομεί κενό, οι δύο
            γραμμές ζωγραφίζουν ολόιδια — και αυτή η φράση είναι η διάκριση.

            🔴 Και όταν η κληρονομιά **δεν είναι μία** (μεικτός άξονας), δεν δηλώνεται τίποτα:
            το ελάττωμα που βρήκε η οθόνη ήταν ακριβώς μια θετική δήλωση βγαλμένη από fallback.
            Δες `table-header-format-snapshot.ts` για τη μέτρηση.
          */}
          <CommandRow
            swatch={inheritedSwatch}
            active={selection.kind === 'automatic'}
            label={t(keys.automatic)}
            hint={t(automaticHintKey(state, keys))}
            onActivate={chooseAutomatic}
          />

          {/*
            🔴 ADR-739 §38 — «**Αυτόματο**»: λευκό ή μαύρο, ό,τι ξεχωρίζει από το φόντο. Είναι το
            ACI 7 του AutoCAD και το «Automatic» του Word/Excel — και **μόνο** για μελάνι: ένα
            γέμισμα δεν παίρνει αντίθεση με τον εαυτό του, οπότε η γραμμή δεν υπάρχει για τον
            ρόλο `'fill'` (ίδιος κανόνας με το «Κανένα γέμισμα», ανάποδα).

            ⚠️ Η ετικέτα **δεν** λέει «Λευκό» μιμούμενη τον AutoCAD: εκεί το ACI 7 λέγεται
            «White» ενώ σχεδιάζεται **μαύρο** σε λευκό φόντο. Είναι το ένα σημείο όπου ο AutoCAD
            κάνει λάθος και το Office κάνει σωστά — και ο χρήστης πινάκων φέρνει τη διαίσθησή
            του από το Office.

            Το δείγμα δείχνει το χρώμα που **θα ισχύσει τώρα** στον τρέχοντα καμβά, με την ίδια
            αρχή που ήδη διέπει τη γραμμή από πάνω: ο χρήστης βλέπει *σε τι* πάει, όχι απλώς ότι
            πάει κάπου.
          */}
          {isFill ? null : (
            <CommandRow
              swatch={resolveTableInk(AUTOMATIC_TABLE_INK, surfaceHex)}
              active={selection.kind === 'autoContrast'}
              label={t('table.textColor.autoContrast')}
              hint={t('table.textColor.autoContrastHint')}
              onActivate={chooseAutoContrast}
            />
          )}

          {/*
            Η γραμμή «Κανένα» υπάρχει **μόνο** για γέμισμα, και όχι από γούστο: το
            `TableAxisStyleOverride` επιτρέπει `null` **ακριβώς** στα πεδία που το επιλυμένο
            `TableCellStyle` δηλώνει προαιρετικά. Το `textColorHex` δεν είναι ένα από αυτά —
            ένα κείμενο χωρίς χρώμα δεν είναι κατάσταση που μπορεί να αποδώσει κανείς. Η
            διεπαφή προσφέρει ακριβώς ό,τι το μοντέλο μπορεί να εκφράσει.
          */}
          {isFill ? (
            <CommandRow
              swatch="none"
              active={selection.kind === 'none'}
              label={t('table.fillColor.none')}
              hint={t('table.fillColor.noneHint')}
              onActivate={chooseNone}
            />
          ) : null}

          {state.drawingColors.length > 0 ? (
            <>
              <span className={styles.separator} role="separator" />
              <h4 className={styles.sectionLabel}>{t('table.colorMenu.drawingColors')}</h4>
              <DrawingColorsRow
                colors={state.drawingColors}
                selected={selectedHex}
                onPick={pick}
                nameOf={(hex) => t('table.colorMenu.swatchHex', { color: hex })}
              />
            </>
          ) : null}

          <span className={styles.separator} role="separator" />
          <h4 className={styles.sectionLabel}>{t('table.colorMenu.basicColors')}</h4>
          <TableColorSwatchGrid
            grid={colorGridFor(role)}
            selected={selectedHex}
            onPick={pick}
            label={t('table.colorMenu.basicColors')}
          />

          <span className={styles.separator} role="separator" />
          <button
            type="button"
            role="menuitem"
            className={styles.command}
            onClick={() => setDialogDraft(selectedHex ?? lastColor)}
            {...TABLE_CELL_SESSION_MARKER}
          >
            <Palette size={15} aria-hidden="true" />
            {t('table.colorMenu.moreColors')}
          </button>
        </div>
      ) : null}

      <TableColorDialog
        draft={dialogDraft}
        title={t(keys.dialogTitle)}
        onDraftChange={setDialogDraft}
        onCancel={() => setDialogDraft(null)}
        onApply={(chosen) => {
          setDialogDraft(null);
          pick(chosen);
        }}
      />
    </span>
  );
}

