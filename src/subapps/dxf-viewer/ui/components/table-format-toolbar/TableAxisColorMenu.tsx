'use client';

/**
 * ADR-739 Φ.Ε/Φ4 + Φ4β — **το χρώμα του mini toolbar**: split button + οι ζώνες του μενού.
 * **Ένα** component, **δύο** ρόλοι — χρώμα κειμένου (`A`) και χρώμα γεμίσματος (κουβαδάκι).
 *
 * ## Οι ζώνες, και από πού προκύπτει καθεμία
 * | ζώνη | τι είναι | ποιος το κάνει έτσι |
 * |---|---|---|
 * | «Αυτόματο» | το πεδίο **λείπει** ⇒ κληρονομιά από το στυλ | Excel «Αυτόματο» · AutoCAD `ByLayer` · Revit «By Category» |
 * | «Κανένα γέμισμα» | ρητό `null` ⇒ **διαφανές**, ακόμη κι αν το στυλ βάφει | Excel «Χωρίς γέμισμα» · InDesign `[None]` · ArchiCAD Pen 0 |
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
 * @see ui/components/table-format-toolbar/TableColorSwatchGrid.tsx — το πλέγμα
 * @see bim/table/table-drawing-colors.ts — από πού βγαίνουν τα «χρώματα του σχεδίου»
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §28.14, §35
 */

import React, {
  useCallback, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent,
} from 'react';
import { Baseline, ChevronDown, PaintBucket, Palette } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import { getRecentColorsStore } from '../../color/RecentColorsStore';
import { normalizeHexColor } from '../../../config/color-math';
import { toolbarColorStoreFor } from '../../../state/table-toolbar-color-store';
import { colorGridFor } from '../../color/aci-color-grid';
import {
  resolveColorMenuSelection,
  selectedSwatchHex,
  type TableAxisColorState,
} from './table-color-menu-selection';
import { automaticHintKey, colorMenuKeys } from './table-color-menu-roles';
import { TableColorSwatchGrid } from './TableColorSwatchGrid';
import { useRovingToolbar, type RovingItemProps } from './use-roving-toolbar';
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
  const [isOpen, setIsOpen] = useState(false);
  const [dialogDraft, setDialogDraft] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const keys = colorMenuKeys(role);
  const isFill = role === 'fill';
  const store = toolbarColorStoreFor(role);

  // Χαμηλής συχνότητας (μία γραφή ανά επιλογή χρώματος) και σε **φύλλο**, όχι σε orchestrator —
  // ο ADR-040 απαγορεύει το δεύτερο, όχι το πρώτο.
  const lastColor = useSyncExternalStore(store.subscribe, store.get, () => store.fallback);

  const selection = resolveColorMenuSelection(state);
  const selectedHex = selectedSwatchHex(selection);

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
    setIsOpen(false);
  }, [store, onSet]);

  /**
   * «Αυτόματο» — δεν περνά από το {@link pick} και δεν γράφει στη μνήμη: το «τελευταίο χρώμα»
   * του split button πρέπει να παραμείνει **χρώμα**, αλλιώς το κύριο μισό του κουμπιού δεν θα
   * είχε τι να εφαρμόσει στο επόμενο πάτημα.
   */
  const chooseAutomatic = useCallback(() => {
    onSet(undefined);
    setIsOpen(false);
  }, [onSet]);

  /**
   * «Κανένα γέμισμα» — ίδιο σκεπτικό, αλλά ο έλεγχος του ρόλου **δεν είναι αμυντικός**: είναι
   * ο τρόπος που ο μεταγλωττιστής στενεύει τη διακριτή ένωση ώστε το `null` να είναι νόμιμο
   * όρισμα. Στον ρόλο `'ink'` η γραμμή δεν αποδίδεται καν, οπότε ο κλάδος είναι απρόσιτος —
   * και η υπογραφή το εγγυάται αντί να το ελπίζει.
   */
  const chooseNone = useCallback(() => {
    if (props.role !== 'fill') return;
    props.onSet(null);
    setIsOpen(false);
  }, [props]);

  // Το `Escape` κλείνει **το πάνελ**, όχι όλη τη γραμμή: ένα `Escape` = ένα επίπεδο.
  const onPanelKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || dialogDraft !== null) return;
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [dialogDraft]);

  const TriggerIcon = isFill ? PaintBucket : Baseline;

  return (
    <span className={styles.anchor}>
      <span className={styles.split}>
        <button
          type="button"
          ref={rovingApply.ref}
          tabIndex={rovingApply.tabIndex}
          onKeyDown={rovingApply.onKeyDown}
          onFocus={rovingApply.onFocus}
          className={cn(toolbar.button, styles.applyButton)}
          aria-label={t(keys.trigger)}
          onClick={() => pick(lastColor)}
          {...TABLE_CELL_SESSION_MARKER}
        >
          <TriggerIcon size={15} aria-hidden="true" />
          {/* Η έγχρωμη μπάρα ΕΙΝΑΙ η πληροφορία «τι θα εφαρμόσει αυτό το κλικ». */}
          <span
            className={styles.colorBar}
            style={{ backgroundColor: lastColor }}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          ref={(node) => {
            triggerRef.current = node;
            rovingMenu.ref(node);
          }}
          tabIndex={rovingMenu.tabIndex}
          onKeyDown={rovingMenu.onKeyDown}
          onFocus={rovingMenu.onFocus}
          className={cn(toolbar.button, styles.arrowButton, isOpen && toolbar.buttonActive)}
          aria-label={t(keys.openMenu)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onClick={() => setIsOpen((open) => !open)}
          {...TABLE_CELL_SESSION_MARKER}
        >
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </span>

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
          {...TABLE_CELL_SESSION_MARKER}
        >
          {/*
            🔑 Η υπόδειξη λέει **τι** κληρονομείς. Όταν το γέμισμα κληρονομεί κενό, οι δύο
            γραμμές ζωγραφίζουν ολόιδια — και αυτή η φράση είναι η διάκριση.

            🔴 Και όταν η κληρονομιά **δεν είναι μία** (μεικτός άξονας), δεν δηλώνεται τίποτα:
            το ελάττωμα που βρήκε η οθόνη ήταν ακριβώς μια θετική δήλωση βγαλμένη από fallback.
            Δες `table-header-format-snapshot.ts` για τη μέτρηση.
          */}
          <CommandRow
            swatch={
              state.inheritedMixed ? 'varies' : (state.inheritedColor ?? 'none')
            }
            active={selection.kind === 'automatic'}
            label={t(keys.automatic)}
            hint={t(automaticHintKey(state, keys))}
            onActivate={chooseAutomatic}
          />

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

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

interface CommandRowProps {
  /**
   * Τι δείχνει το δείγμα — **τρία** πράγματα, όχι δύο:
   * `hex` το χρώμα · `'none'` το γλυφό «κανένα» (λευκό + κόκκινη διαγώνιος) · `'varies'` η
   * **μη-δήλωση** για μεικτή κληρονομιά (`<varies>` του Revit).
   *
   * 🔴 Το `'varies'` δεν είναι καλλωπισμός: το γλυφό «κανένα» είναι **θετικός ισχυρισμός**
   * («δεν θα βαφτεί τίποτα»), και σε μεικτό άξονα αυτός ο ισχυρισμός είναι ψευδής.
   */
  readonly swatch: string | 'none' | 'varies';
  readonly active: boolean;
  readonly label: string;
  readonly hint: string;
  readonly onActivate: () => void;
}

/**
 * Μια άχρωμη εντολή της ζώνης 0 — «Αυτόματο» ή «Κανένα γέμισμα».
 *
 * ## Το δείγμα του «Αυτόματο» δείχνει το **πραγματικό** χρώμα που θα ισχύσει
 * Το Excel δείχνει εκεί ένα μόνιμα μαύρο τετράγωνο, που είναι ψέμα όποτε το στυλ λέει άλλο
 * χρώμα. Αφού το επιλυμένο χρώμα το ξέρουμε ούτως ή άλλως (το χρειάζεται ο ζωγράφος), το
 * δείχνουμε: ο χρήστης βλέπει *σε τι* επιστρέφει, όχι απλώς ότι επιστρέφει.
 *
 * ## 🔴 Μία γραμμή για δύο εντολές, και όχι δύο components
 * Οι δύο γραμμές διαφέρουν **μόνο** σε ετικέτα, υπόδειξη και δείγμα. Δύο components θα ήταν
 * δύο σημεία που μπορούν να αποκτήσουν διαφορετική συμπεριφορά εστίασης ή διαφορετικό
 * `role` — δηλαδή δύο διαφορετικές απαντήσεις στον αναγνώστη οθόνης για την ίδια ομάδα radio.
 */
function CommandRow({
  swatch, active, label, hint, onActivate,
}: CommandRowProps): React.ReactElement {
  const glyph = swatch === 'none' ? styles.swatchNone
    : swatch === 'varies' ? styles.swatchVaries
      : undefined;

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      className={styles.command}
      onClick={onActivate}
      {...TABLE_CELL_SESSION_MARKER}
    >
      <span
        className={cn(styles.swatch, styles.commandSwatch, glyph)}
        style={glyph ? undefined : { backgroundColor: swatch }}
        aria-hidden="true"
      />
      <span className={styles.commandText}>
        {label}
        <span className={styles.commandHint}>{hint}</span>
      </span>
    </button>
  );
}

interface DrawingColorsRowProps {
  readonly colors: readonly string[];
  readonly selected: string | undefined;
  readonly onPick: (hex: string) => void;
  readonly nameOf: (hex: string) => string;
}

/**
 * Η ζώνη εγγράφου — **επίπεδη**, χωρίς παραγόμενες αποχρώσεις.
 *
 * Τρεις από τους τέσσερις μεγάλους (Figma, Cinema 4D, ArchiCAD) τη δείχνουν έτσι· μόνο το Excel
 * φτιάχνει ράμπα, και τη φτιάχνει από θέμα εγγράφου **που το DXF δεν έχει**. Οριζόντιο roving:
 * είναι μία σειρά, όχι πλέγμα — τα `↑/↓` δεν έχουν πού να πάνε.
 */
function DrawingColorsRow({
  colors, selected, onPick, nameOf,
}: DrawingColorsRowProps): React.ReactElement {
  const roving = useRovingToolbar(colors.length);
  return (
    <div className={styles.gridRow} role="group">
      {colors.map((hex, index) => {
        const item = roving.itemProps(index);
        return (
          <button
            key={hex}
            type="button"
            ref={item.ref}
            tabIndex={item.tabIndex}
            onKeyDown={item.onKeyDown}
            onFocus={item.onFocus}
            className={cn(styles.swatch, selected === hex && styles.swatchSelected)}
            style={{ backgroundColor: hex }}
            aria-label={nameOf(hex)}
            aria-pressed={selected === hex}
            onClick={() => onPick(hex)}
            {...TABLE_CELL_SESSION_MARKER}
          />
        );
      })}
    </div>
  );
}
