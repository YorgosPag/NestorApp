'use client';

/**
 * 🔴 ADR-739 §55 — **οι δύο πρώτες θέσεις της σειράς 1 του Excel**: γραμματοσειρά και μέγεθος.
 *
 * ## Γιατί ΟΧΙ το υπάρχον `FontFamilyCombobox` (μετρημένο, όχι γούστο)
 * Υπάρχει ήδη combobox γραμματοσειρών (`ui/text-toolbar/controls/FontFamilyCombobox.tsx`) και η
 * πρώτη σκέψη ήταν να καταναλωθεί αυτούσιο. **Δεν γίνεται**, για τρεις ανεξάρτητους λόγους —
 * και ο πρώτος είναι θανάσιμος:
 *
 * 1. **Ζει σε Radix `Popover`, δηλαδή σε δικό του portal.** Για τον φύλακα
 *    `useKeepOpenOnSurface` κάθε κλικ εκεί μέσα είναι «έξω από τη γραμμή» ⇒ το μενού από κάτω
 *    κλείνει **πριν** τρέξει το `onSelect`. Είναι ακριβώς ο λόγος που το `TableMergeMenu`
 *    κρατά το πάνελ του **μέσα** στο δοχείο (δες την κεφαλίδα του).
 * 2. **Γράφει `style={{ fontFamily: font }}`** στην προεπισκόπηση — inline style, απαγορευμένο
 *    (N.3). Δεν είναι μεταφέρσιμο εδώ χωρίς να ξαναγραφεί.
 * 3. **Δεν έχει roving tabindex**: μπαίνοντας σε `role="toolbar"` θα ήταν ένα χειριστήριο που
 *    δεν συμμετέχει στα βέλη — δηλαδή μια τρύπα στη μία στάση `Tab` της γραμμής.
 *
 * ⚠️ Συνέπεια που δηλώνεται ρητά: **δεν υπάρχει προεπισκόπηση της γραμματοσειράς** στη λίστα
 * (το όνομα δεν ζωγραφίζεται με την ίδια τη γραμματοσειρά). Ένα CSS module δεν μπορεί να ξέρει
 * ονόματα που έρχονται από τη σκηνή, και το inline style είναι απαγορευμένο. Το όνομα μένει —
 * η προεπισκόπηση είναι διακόσμηση, ο κανόνας δεν είναι.
 *
 * ## Από πού έρχονται οι τιμές
 * · **Γραμματοσειρές**: από τον ξενιστή ({@link TableFontControlsProps.fonts}) — στην πράξη το
 *   `useTextPanelFonts()`, που ενώνει το `FontCache` με τις οικογένειες της σκηνής. Καμία λίστα
 *   δεν γεννιέται εδώ: θα ήταν δεύτερη απάντηση στο «ποιες γραμματοσειρές υπάρχουν».
 * · **Μεγέθη**: η {@link TABLE_TEXT_HEIGHT_SCALE_MM}, **η ίδια** σκάλα που πατούν τα `A↑`/`A↓`.
 *   Δύο λίστες θα σήμαιναν ότι το κουμπί και το μενού διαφωνούν για το επόμενο σκαλί.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableFontControls
 * @see bim/table/table-text-height-scale.ts — η σκάλα μεγεθών (SSoT)
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_TEXT_HEIGHT_SCALE_MM } from '../../../bim/table/table-text-height-scale';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarListItem, ToolbarListPanel } from './ToolbarListPanel';
import { useToolbarPanel } from './use-toolbar-panel';
import { useRovingToolbar, type RovingItemProps } from './use-roving-toolbar';
import panel from './table-toolbar-panel.module.css';
import styles from './TableFormatToolbar.module.css';

/**
 * Τι ισχύει **τώρα** στον στόχο, για ένα πεδίο με πολλές τιμές.
 *
 * Ίδιο σχήμα με το {@link TableAxisColorState} και όχι με το {@link TableToggleFormatState}:
 * η ερώτηση δεν είναι «πατημένο ή όχι» αλλά «**ποια** τιμή» — και «ανάμεικτο» είναι τρίτη
 * απάντηση, όχι ενδιάμεση.
 */
export interface TableFontValueState<T> {
  /** Η τιμή που ισχύει· `undefined` ⇒ κληρονομιά (η «Αυτόματη» της λίστας). */
  readonly current: T | undefined;
  /** Ο στόχος δεν έχει **μία** τιμή — το combobox δείχνει κενό, όπως στο Excel. */
  readonly mixed: boolean;
}

export interface TableFontControlsState {
  readonly family: TableFontValueState<string>;
  /** Σε **sheet-mm** (DXF group code 140), όχι px — δες `table-text-height-scale.ts`. */
  readonly size: TableFontValueState<number>;
}

export interface TableFontControlsProps {
  readonly state: TableFontControlsState;
  /** Ό,τι μπορεί να διαλέξει ο χρήστης· κενή λίστα ⇒ μόνο η «Αυτόματη». */
  readonly fonts: readonly string[];
  /**
   * Γράφει `fontFamily`. Η υπογραφή είναι **ολόκληρο** το λεξιλόγιο του μοντέλου ώστε ο ξενιστής
   * να δένει σκέτο `setField(target, 'fontFamily', value)` χωρίς μεταφραστή στη μέση.
   *
   * ⚠️ Η λίστα παράγει σήμερα μόνο `string` (ρητή) και `undefined` (Αυτόματη). Το `null`
   * («ρητά η προεπιλογή του μετρητή») είναι εκφράσιμο στο μοντέλο αλλά **δεν έχει ακόμη
   * χειριστήριο** — δηλωμένο ρητά αντί να λείπει σιωπηλά από τον τύπο.
   */
  readonly onSetFontFamily: (value: string | null | undefined) => void;
  /** Γράφει `textHeightMm`. Πάντα ρητή τιμή: «αυτόματο ύψος» δεν υπάρχει στη σκάλα. */
  readonly onSetTextHeightMm: (value: number) => void;
  readonly rovingOf: (index: number) => RovingItemProps;
}

/** Δύο θέσεις: ένα combobox = **ένα** εστιάσιμο κουμπί (το πάνελ έχει δικό του roving). */
export const TABLE_FONT_CONTROL_SLOTS = 2;

export function TableFontControls(props: TableFontControlsProps): React.ReactElement {
  const { state, fonts, onSetFontFamily, onSetTextHeightMm, rovingOf } = props;
  const { t } = useTranslation('dxf-viewer');

  const automatic = t('table.formatToolbar.automaticFont');

  return (
    <>
      <ToolbarCombobox
        roving={rovingOf(0)}
        label={t('table.formatToolbar.fontFamily')}
        menuLabel={t('table.formatToolbar.fontFamilyMenuLabel')}
        hint={state.family.mixed ? t('table.formatToolbar.mixedHint') : undefined}
        value={state.family.mixed ? '' : state.family.current ?? automatic}
        className={styles.comboWide}
        options={[
          {
            key: '',
            label: automatic,
            selected: !state.family.mixed && state.family.current === undefined,
            onSelect: () => onSetFontFamily(undefined),
          },
          ...fonts.map((font) => ({
            key: font,
            label: font,
            selected: state.family.current === font,
            onSelect: () => onSetFontFamily(font),
          })),
        ]}
      />

      <ToolbarCombobox
        roving={rovingOf(1)}
        label={t('table.formatToolbar.fontSize')}
        menuLabel={t('table.formatToolbar.fontSizeMenuLabel')}
        hint={state.size.mixed ? t('table.formatToolbar.mixedHint') : undefined}
        value={state.size.mixed || state.size.current === undefined ? '' : sizeLabel(state.size.current)}
        options={TABLE_TEXT_HEIGHT_SCALE_MM.map((mm) => ({
          key: sizeLabel(mm),
          label: sizeLabel(mm),
          selected: state.size.current === mm,
          onSelect: () => onSetTextHeightMm(mm),
        }))}
      />
    </>
  );
}

/**
 * Το ύψος ως κείμενο.
 *
 * ⚠️ **Χωρίς `Intl`, επίτηδες.** Η υποδιαστολή εδώ δεν είναι «γλώσσα του χρήστη» αλλά η ίδια
 * γραφή με τη σκάλα και με το ribbon (`2.5`, `2.8`), και ένας μορφοποιητής locale θα έδειχνε
 * `2,5` σε έναν χρήστη και `2.5` σε άλλον για **το ίδιο σχέδιο** — ακριβώς αυτό που το
 * `TableFormatLocale` υπάρχει για να αποκλείσει στα **δεδομένα** του εγγράφου.
 */
function sizeLabel(mm: number): string {
  return String(mm);
}

// ──────────────────────────────────────────────────────────────────────────────
// Το κοινό combobox — ΕΝΑ, όχι δύο
// ──────────────────────────────────────────────────────────────────────────────

interface ToolbarComboboxOption {
  readonly key: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

interface ToolbarComboboxProps {
  readonly roving: RovingItemProps;
  /** Το προσβάσιμο **όνομα** του χειριστηρίου· η τιμή είναι το περιεχόμενό του. */
  readonly label: string;
  readonly menuLabel: string;
  readonly hint?: string;
  /** Ό,τι δείχνει το κουμπί· κενό ⇒ ανάμεικτος στόχος (η συμπεριφορά του Excel). */
  readonly value: string;
  readonly className?: string;
  readonly options: readonly ToolbarComboboxOption[];
}

/**
 * Trigger + λίστα τιμών. Γραμμένο **μία** φορά για τα δύο combobox: η γραμματοσειρά και το
 * μέγεθος διαφέρουν μόνο στο **από πού** έρχονται οι τιμές, όχι στο πώς επιλέγονται — και δύο
 * αντίγραφα θα ήταν ο κλασικός sibling clone μέσα στο ίδιο diff (N.18).
 */
function ToolbarCombobox(props: ToolbarComboboxProps): React.ReactElement {
  const { roving, label, menuLabel, hint, value, className, options } = props;
  const control = useToolbarPanel();
  // Κατακόρυφο roving **μέσα** στη λίστα: ένα `Tab` για τη λίστα, τα βέλη μέσα της (APG).
  const listRoving = useRovingToolbar(options.length, 'vertical');

  return (
    <span className={panel.anchor}>
      <ToolbarButton
        roving={roving}
        title={label}
        hint={hint}
        className={cn(styles.combo, className)}
        popup={{
          isOpen: control.isOpen,
          panelId: control.panelId,
          kind: 'listbox',
          triggerRef: control.triggerRef,
        }}
        onActivate={control.toggle}
      >
        <span className={styles.comboValue}>{value}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </ToolbarButton>

      {control.isOpen ? (
        <ToolbarListPanel
          panelId={control.panelId}
          label={menuLabel}
          role="listbox"
          onKeyDown={control.onPanelKeyDown}
          className={styles.comboPanel}
        >
          {options.map((option, index) => (
            <ToolbarListItem
              key={option.key}
              role="option"
              label={option.label}
              selected={option.selected}
              autoFocus={index === 0}
              roving={listRoving.itemProps(index)}
              onSelect={() => control.runAndClose(option.onSelect)}
            />
          ))}
        </ToolbarListPanel>
      ) : null}
    </span>
  );
}
