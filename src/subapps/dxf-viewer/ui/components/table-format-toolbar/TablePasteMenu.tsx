'use client';

/**
 * 🔴 ADR-739 §57 — **Η «ΕΠΙΚΟΛΛΗΣΗ» ΩΣ SPLIT BUTTON**: το κύριο μισό επικολλά, το βελάκι ανοίγει
 * την «Επικόλληση Ειδική».
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ `type: 'split'` ΤΗΣ ΚΟΡΔΕΛΑΣ — μετρημένο, όχι προτίμηση
 * Η κορδέλα **έχει** δικό της split button (`RibbonSplitButton` + `RibbonSplitDropdown`, ADR-345
 * §4.3) και θα ήταν η προφανής επιλογή. Είναι **αδύνατη** εδώ:
 *
 * ```
 *   RibbonSplitDropdown → createPortal(…, document.body)
 *   φύλακας συνεδρίας   → document.activeElement.closest('[data-table-session-keepalive]')
 * ```
 * Ένα item σε portal **δεν έχει** τον πρόγονο που φέρει το σημάδι ⇒ ο φύλακας του
 * `useTableCellSessionBlur` βλέπει «η εστίαση έφυγε έξω» ⇒ `onClose()` ⇒ ο δρομέας κλείνει, το
 * `port.bounds()` γίνεται `null`, **και η καρτέλα εξαφανίζεται τη στιγμή που διαλέγεις**. Και
 * επειδή το `rAF` του φύλακα μπορεί να τρέξει **πριν** από το `click`, καμία διόρθωση μέσα στον
 * χειριστή δεν προλαβαίνει — είναι η ίδια δομική αδυναμία που τεκμηριώνει το §52.
 *
 * Γι' αυτό **όλα** τα σύνθετα χειριστήρια αυτής της καρτέλας (περιγράμματα, δύο χρώματα,
 * συγχώνευση, πινέλο) είναι ήδη `type: 'widget'` γύρω από components του mini toolbar. Η
 * «Επικόλληση» γίνεται το **έκτο**, με το ίδιο ακριβώς μοτίβο — {@link ToolbarSplitButton} +
 * {@link useToolbarPanel} + πάνελ **μέσα** στο δοχείο.
 *
 * ## Η δομή του πτυσσόμενου είναι του Excel, με μία προσθήκη που το Excel δεν έχει
 * ```
 *   Επικόλληση            → τύποι + ΟΛΗ η μορφή          (η προεπιλογή· ίδιο με το κύριο μισό)
 *   Τιμές                 → το αποτέλεσμα, καμία μορφή
 *   Τύποι                 → οι τύποι, καμία μορφή
 *   Μορφοποίηση           → ΟΛΗ η μορφή, κανένα περιεχόμενο
 *   ─────────────────────────────────────────────────────────────
 *   🏆 Μόνο επιλεγμένες όψεις → checklist 5 όψεων + «Επικόλληση επιλεγμένων»
 * ```
 * Η τελευταία ενότητα είναι το idiom του **AutoCAD MATCHPROP** (*Property Settings*): «θέλω μόνο
 * τα περιγράμματα, όχι τη γραμματοσειρά» είναι καθημερινό αίτημα σε πίνακα ποσοτήτων, και το
 * Excel **δεν μπορεί να το εκφράσει** — είναι όλα ή τίποτα.
 *
 * ## Η επιλογή όψεων είναι κατάσταση ΤΗΣ ΔΙΕΠΑΦΗΣ, όχι του μοντέλου
 * Ζει σε `useState` εδώ και **δεν** μπαίνει σε store: δεν σειριοποιείται, δεν αναιρείται, δεν την
 * βλέπει κανένας άλλος. Ένα store θα ήταν τέταρτη «αλήθεια» δίπλα στο μοντέλο για μια προτίμηση
 * που ζει όσο ένα άνοιγμα μενού.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TablePasteMenu
 * @see bim/table/table-clipboard-paste.ts — τι σημαίνει κάθε επιλογή (οι δύο ορθογώνιοι άξονες)
 * @see ui/components/table-format-toolbar/TableMergeMenu.tsx — το ίδιο μοτίβο, τρίτος αδελφός
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §57
 */

import React, { useState } from 'react';
import { Check, ClipboardPaste } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import {
  ALL_TABLE_FORMAT_FACETS,
  TABLE_FORMAT_FACETS,
  type TableFormatFacet,
} from '../../../bim/table/table-format-payload';
import {
  FULL_TABLE_PASTE,
  type TablePasteRequest,
} from '../../../bim/table/table-clipboard-paste';
import { ToolbarSplitButton } from './ToolbarSplitButton';
import { useToolbarPanel } from './use-toolbar-panel';
import { type RovingItemProps } from './use-roving-toolbar';
import styles from './TablePasteMenu.module.css';

export interface TablePasteMenuProps {
  /** Roving του **κύριου** μισού (επικολλά χωρίς μενού). */
  readonly rovingApply: RovingItemProps;
  /** Roving του **βελακιού** (ανοίγει την «Επικόλληση Ειδική»). */
  readonly rovingMenu: RovingItemProps;
  /**
   * Έχει νόημα να επιχειρηθεί επικόλληση; Δες `TableMenuClipboardActions.canPaste` — λέει
   * «μπορεί να **επιχειρηθεί**», ποτέ «υπάρχει κάτι μέσα».
   */
  readonly canPaste: boolean;
  readonly onPaste: (request: TablePasteRequest) => void;
}

/**
 * Οι τέσσερις **σταθερές** εντολές, δηλωτικά.
 *
 * Πίνακας και όχι τέσσερα αντιγραμμένα `<button>`: διαφέρουν σε **δύο** αλφαριθμητικά και τίποτε
 * άλλο, και γραμμένες με το χέρι θα ήταν ο κλασικός sibling clone μέσα στο ίδιο diff (N.18).
 */
const PASTE_COMMANDS: readonly {
  readonly id: string;
  readonly labelKey: string;
  readonly request: TablePasteRequest;
}[] = [
  { id: 'all', labelKey: 'table.clipboard.menu.all', request: FULL_TABLE_PASTE },
  { id: 'values', labelKey: 'table.clipboard.menu.values', request: { content: 'values', facets: new Set() } },
  { id: 'formulas', labelKey: 'table.clipboard.menu.formulas', request: { content: 'formulas', facets: new Set() } },
  { id: 'formats', labelKey: 'table.clipboard.menu.formats', request: { content: 'none', facets: ALL_TABLE_FORMAT_FACETS } },
];

/**
 * 🔴 Η ετικέτα κάθε όψης, **κυριολεκτικά** — ποτέ `t(\`…${facet}\`)`.
 *
 * Δύο ανεξάρτητοι λόγοι, και ο καθένας αρκεί: (α) η CHECK 3.8 δεν μπορεί να επαληθεύσει κλειδί
 * που δεν βλέπει, και (β) ο generator του i18n shell slice (ADR-744 / CHECK 3.34) **αρνείται** να
 * παράγει όταν συναντήσει ανεπίλυτη δυναμική κλήση. Η ίδια προειδοποίηση είναι ήδη γραμμένη στο
 * `RibbonTableFormatWidgets.tsx`.
 *
 * `Record<TableFormatFacet, string>` και όχι χαλαρό αντικείμενο: την ημέρα που το ADR-768
 * αποκτήσει **έκτη** όψη, αυτό εδώ δεν μεταγλωττίζεται μέχρι κάποιος να της δώσει όνομα — αντί να
 * εμφανιστεί ωμό κλειδί στην οθόνη.
 */
const FACET_LABEL_KEY: Readonly<Record<TableFormatFacet, string>> = {
  text: 'table.clipboard.facets.text',
  alignment: 'table.clipboard.facets.alignment',
  fill: 'table.clipboard.facets.fill',
  numberFormat: 'table.clipboard.facets.numberFormat',
  borders: 'table.clipboard.facets.borders',
};

export function TablePasteMenu(props: TablePasteMenuProps): React.ReactElement {
  const { rovingApply, rovingMenu, canPaste, onPaste } = props;
  const { t } = useTranslation('dxf-viewer');
  const panel = useToolbarPanel();
  // Προεπιλογή **όλες**: ο χρήστης αφαιρεί ό,τι δεν θέλει, όπως στο *Property Settings* του
  // AutoCAD. Ξεκινώντας από κενό, το «Επικόλληση επιλεγμένων» θα ήταν ανενεργό στο άνοιγμα και
  // η ενότητα θα φαινόταν χαλασμένη.
  const [facets, setFacets] = useState<ReadonlySet<TableFormatFacet>>(ALL_TABLE_FORMAT_FACETS);

  const toggleFacet = (facet: TableFormatFacet): void => {
    const next = new Set(facets);
    if (!next.delete(facet)) next.add(facet);
    setFacets(next);
  };

  return (
    <span className={styles.anchor}>
      <ToolbarSplitButton
        rovingApply={rovingApply}
        rovingMenu={rovingMenu}
        mainLabel={t('table.clipboard.menu.trigger')}
        menuLabel={t('table.clipboard.menu.label')}
        mainDisabled={!canPaste}
        onMainClick={() => onPaste(FULL_TABLE_PASTE)}
        isOpen={panel.isOpen}
        panelId={panel.panelId}
        onToggleMenu={panel.toggle}
        triggerRef={panel.triggerRef}
      >
        <ClipboardPaste size={15} aria-hidden="true" />
      </ToolbarSplitButton>

      {panel.isOpen ? (
        <div
          id={panel.panelId}
          role="menu"
          aria-label={t('table.clipboard.menu.label')}
          onKeyDown={panel.onPanelKeyDown}
          className={cn(
            styles.panel,
            'border border-border rounded-lg bg-popover text-popover-foreground shadow-md',
          )}
          {...TABLE_CELL_SESSION_MARKER}
        >
          {PASTE_COMMANDS.map((command, index) => (
            <button
              key={command.id}
              type="button"
              role="menuitem"
              className={styles.item}
              aria-disabled={!canPaste || undefined}
              autoFocus={index === 0}
              onClick={() => {
                if (canPaste) panel.runAndClose(() => onPaste(command.request));
              }}
              {...TABLE_CELL_SESSION_MARKER}
            >
              {t(command.labelKey)}
            </button>
          ))}

          <span className={styles.separator} role="separator" />
          <span className={styles.heading} role="presentation">
            {t('table.clipboard.menu.facetsHeading')}
          </span>

          {TABLE_FORMAT_FACETS.map((facet) => (
            <FacetCheckItem
              key={facet}
              facet={facet}
              checked={facets.has(facet)}
              label={t(FACET_LABEL_KEY[facet])}
              onToggle={toggleFacet}
            />
          ))}

          <button
            type="button"
            role="menuitem"
            className={styles.item}
            // Καμία όψη ⇒ η εντολή δεν έχει τι να κάνει. Ανενεργό και **όχι** κρυμμένο: ο χρήστης
            // μόλις ξεμάρκαρε την τελευταία και πρέπει να δει γιατί δεν προχωρά.
            aria-disabled={!canPaste || facets.size === 0 || undefined}
            onClick={() => {
              if (canPaste && facets.size > 0) {
                panel.runAndClose(() => onPaste({ content: 'none', facets }));
              }
            }}
            {...TABLE_CELL_SESSION_MARKER}
          >
            {t('table.clipboard.menu.applyFacets')}
          </button>
        </div>
      ) : null}
    </span>
  );
}

/**
 * Μία όψη του checklist.
 *
 * `role="menuitemcheckbox"` και όχι `<input type="checkbox">`: το στοιχείο ζει **μέσα** σε
 * `role="menu"`, όπου το APG ορίζει ρητά αυτόν τον ρόλο για δίτιμη επιλογή — και όπου ένα ωμό
 * input θα έσπαγε την πλοήγηση με βέλη που δίνει δωρεάν ο browser στο μενού.
 */
function FacetCheckItem(props: {
  readonly facet: TableFormatFacet;
  readonly checked: boolean;
  readonly label: string;
  readonly onToggle: (facet: TableFormatFacet) => void;
}): React.ReactElement {
  const { facet, checked, label, onToggle } = props;
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className={styles.item}
      // ⚠️ **Δεν** κλείνει το πάνελ: το νόημα της ενότητας είναι να μαρκάρεις **πολλές** όψεις
      // πριν εφαρμόσεις. Ένα `runAndClose` εδώ θα έκανε τον συνδυασμό αδύνατο — δηλαδή θα
      // ακύρωνε ακριβώς το πράγμα που το Excel δεν μπορεί να κάνει.
      onClick={() => onToggle(facet)}
      {...TABLE_CELL_SESSION_MARKER}
    >
      <span className={styles.itemIcon} aria-hidden="true">
        {checked ? <Check size={14} /> : null}
      </span>
      {label}
    </button>
  );
}
