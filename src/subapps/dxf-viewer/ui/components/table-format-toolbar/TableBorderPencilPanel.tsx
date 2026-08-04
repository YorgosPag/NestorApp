'use client';

/**
 * ADR-750 Φ5 (Α23) — **η ζώνη «Σχεδίαση περιγραμμάτων»**: χρώμα · στυλ · πάχος · διπλή.
 *
 * ## 🔑 Πού ξεπερνάμε τους μεγάλους, και είναι μετρήσιμο
 * ```
 *   Excel   →  Στυλ γραμμής + Χρώμα σε **modal** (`Ctrl+1` → Περίγραμμα). Πάχος: δεν υπάρχει
 *              χωριστά — είναι μπλεγμένο μέσα στο πλέγμα των 13 «στυλ».
 *   AutoCAD →  Lineweight + Linetype + Color + «Double line»/Spacing, αλλά επίσης σε **modal**
 *              (*Cell Border Properties*).
 *   εδώ     →  τα τέσσερα **μέσα** στο ίδιο dropdown με τις εντολές, ένα κλικ μακριά, χωρίς
 *              να χαθεί το συμφραζόμενο της επιλογής.
 * ```
 * Η **θέση** είναι του Excel (το dropdown του έχει ήδη «Χρώμα γραμμής» / «Στυλ γραμμής» στο
 * τέλος)· το **περιεχόμενο** είναι του AutoCAD (πάχος + διπλή, που το Excel δεν εκθέτει καθόλου).
 * Δεν εφευρίσκουμε τρίτη διάταξη — παίρνουμε από τον καθένα ό,τι έχει λύσει.
 *
 * ## Γιατί `menuitemradio` / `menuitemcheckbox` και ΟΧΙ `menuitem` (και γιατί αυτό δεν σπάει την Α21)
 * Η Α21 λέει ότι οι 13 είναι **εντολές** («Κάτω περίγραμμα» δεν είναι κάτι που *είσαι*), άρα
 * `role="menuitem"` χωρίς `aria-pressed`. Εδώ ισχύει το αντίστροφο και για τον ίδιο λόγο: το
 * πάχος **είναι** κατάσταση — μένει επιλεγμένο μέχρι να το αλλάξεις — και τα πάχη είναι
 * **αμοιβαία αποκλειόμενα**. Το APG ονομάζει ακριβώς αυτό `menuitemradio`. Ίδιο κριτήριο, δύο
 * διαφορετικές απαντήσεις, επειδή τα δύο χειριστήρια απαντούν διαφορετική ερώτηση.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableBorderPencilPanel
 * @see state/table-border-pencil-store.ts — πού ζει η επιλογή (και γιατί ανά πεδίο)
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §19
 */

import React, { useCallback, useState, useSyncExternalStore } from 'react';
import { ChevronRight, Palette } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import { getRecentColorsStore } from '../../color/RecentColorsStore';
import { normalizeHexColor } from '../../../config/color-math';
import { colorGridFor } from '../../color/aci-color-grid';
import { resolveLinetypePatternMm } from '../../../rendering/linetype-dash-resolver';
import { TableLinePreview } from './TableLinePreview';
import {
  getTableBorderPencil,
  setTableBorderPencilField,
  subscribeTableBorderPencil,
  AUTOMATIC_TABLE_BORDER_PENCIL,
} from '../../../state/table-border-pencil-store';
import type { TableBorderSpec } from '../../../types/table-edges';
import { TableColorSwatchGrid } from './TableColorSwatchGrid';
import { TableColorDialog } from './TableColorDialog';
import { tableBorderLinetypeNames, tableBorderWeightsMm } from './table-border-pencil-options';
import type { RovingItemProps } from './use-roving-toolbar';
import panel from './TableBorderMenu.module.css';

/** Πόσες εστιάσιμες γραμμές καταλαμβάνει η ζώνη — ο γονέας το χρειάζεται για το roving. */
export const TABLE_PENCIL_ROW_COUNT = 4;

export interface TableBorderPencilPanelProps {
  /** Τα roving props της `index`-οστής **γραμμής της ζώνης** (0…3). */
  readonly rovingOf: (index: number) => RovingItemProps;
  /**
   * Το μολύβι **που θα εφαρμοστεί τώρα** — επιλογή χρήστη πάνω στο στυλ (Α23), υπολογισμένο
   * από την ίδια συνάρτηση που θα εκτελέσει η εντολή. `null` σε μπαγιάτικο μενού.
   */
  readonly resolvePencil: () => TableBorderSpec | null;
}

export function TableBorderPencilPanel({
  rovingOf, resolvePencil,
}: TableBorderPencilPanelProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer');
  const [openRow, setOpenRow] = useState<'color' | 'style' | 'weight' | null>(null);
  const [dialogDraft, setDialogDraft] = useState<string | null>(null);

  // Χαμηλής συχνότητας (μία γραφή ανά επιλογή) και σε **φύλλο**, όχι σε orchestrator — ο
  // ADR-040 απαγορεύει το δεύτερο, όχι το πρώτο.
  const selection = useSyncExternalStore(
    subscribeTableBorderPencil,
    getTableBorderPencil,
    () => AUTOMATIC_TABLE_BORDER_PENCIL,
  );

  /**
   * 🔑 Η προεπισκόπηση δείχνει το **πραγματικό** μολύβι, όχι την επιλογή.
   *
   * Δηλαδή περνά από την ίδια `resolveTableBorderPencil` που θα εκτελέσει η εντολή: όποιο
   * πεδίο λέει «Αυτόματο» παίρνει εδώ την τιμή του στυλ, ακριβώς όπως θα την πάρει και στο
   * χαρτί. Μια προεπισκόπηση που ζωγράφιζε την *επιλογή* θα έδειχνε κενό για κάθε «Αυτόματο»
   * — δηλαδή θα σιωπούσε ακριβώς εκεί που ο χρήστης ρωτά «και τι θα βγει, τελικά;».
   */
  const pencil = resolvePencil();

  const toggleRow = useCallback((row: 'color' | 'style' | 'weight') => {
    setOpenRow((current) => (current === row ? null : row));
  }, []);

  const pickColor = useCallback((rawHex: string | undefined) => {
    if (rawHex !== undefined) {
      const hex = normalizeHexColor(rawHex);
      setTableBorderPencilField('colorHex', hex);
      getRecentColorsStore().addColor(hex);
    } else {
      setTableBorderPencilField('colorHex', undefined);
    }
    setOpenRow(null);
  }, []);

  // Χωρίς ζωντανό πίνακα δεν υπάρχει «Αυτόματο» να δείξουμε — και μια ζώνη σχεδίασης που
  // δείχνει εφευρημένο μολύβι είναι χειρότερη από ζώνη που λείπει (Α19: κάθε ένδειξη
  // ονομάζει κάτι υπαρκτό).
  if (!pencil) return null;

  return (
    <>
      <h4 className={panel.sectionLabel}>{t('table.borders.pencil.section')}</h4>

      <PencilRow
        roving={rovingOf(0)}
        label={t('table.borders.pencil.color')}
        expanded={openRow === 'color'}
        onToggle={() => toggleRow('color')}
        preview={<Swatch colorHex={pencil.colorHex} />}
      >
        <div className={cn(panel.flyout, panel.flyoutWide, FLYOUT_SKIN)} role="none">
          <AutomaticRow
            label={t('table.borders.pencil.automatic')}
            active={selection.colorHex === undefined}
            onActivate={() => pickColor(undefined)}
          />
          <span className={panel.separator} role="separator" />
          <TableColorSwatchGrid
            grid={colorGridFor('ink')}
            selected={selection.colorHex}
            onPick={pickColor}
            label={t('table.borders.pencil.basicColors')}
          />
          <span className={panel.separator} role="separator" />
          <button
            type="button"
            role="menuitem"
            className={panel.item}
            onClick={() => setDialogDraft(selection.colorHex ?? pencil.colorHex)}
            {...TABLE_CELL_SESSION_MARKER}
          >
            <Palette size={15} aria-hidden="true" />
            {t('table.borders.pencil.moreColors')}
          </button>
        </div>
      </PencilRow>

      <PencilRow
        roving={rovingOf(1)}
        label={t('table.borders.pencil.style')}
        expanded={openRow === 'style'}
        onToggle={() => toggleRow('style')}
        preview={<PenPreview pencil={pencil} />}
      >
        <div
          className={cn(panel.flyout, FLYOUT_SKIN)}
          role="radiogroup"
          aria-label={t('table.borders.pencil.styleMenuLabel')}
        >
          <AutomaticRow
            label={t('table.borders.pencil.automatic')}
            active={selection.linetypeName === undefined}
            onActivate={() => {
              setTableBorderPencilField('linetypeName', undefined);
              setOpenRow(null);
            }}
          />
          {tableBorderLinetypeNames().map((name) => (
            <RadioRow
              key={name}
              label={name}
              active={selection.linetypeName === name}
              onActivate={() => {
                setTableBorderPencilField('linetypeName', name);
                setOpenRow(null);
              }}
            >
              <DashPreview patternMm={resolveLinetypePatternMm(name)} widthMm={pencil.widthMm} />
            </RadioRow>
          ))}
        </div>
      </PencilRow>

      <PencilRow
        roving={rovingOf(2)}
        label={t('table.borders.pencil.weight')}
        expanded={openRow === 'weight'}
        onToggle={() => toggleRow('weight')}
        preview={<span className={panel.rowValue}>{t('table.borders.pencil.weightValue', {
          mm: pencil.widthMm.toFixed(2),
        })}</span>}
      >
        <div
          className={cn(panel.flyout, FLYOUT_SKIN)}
          role="radiogroup"
          aria-label={t('table.borders.pencil.weightMenuLabel')}
        >
          <AutomaticRow
            label={t('table.borders.pencil.automatic')}
            active={selection.widthMm === undefined}
            onActivate={() => {
              setTableBorderPencilField('widthMm', undefined);
              setOpenRow(null);
            }}
          />
          {tableBorderWeightsMm().map((mm) => (
            <RadioRow
              key={mm}
              label={t('table.borders.pencil.weightValue', { mm: mm.toFixed(2) })}
              active={selection.widthMm === mm}
              onActivate={() => {
                setTableBorderPencilField('widthMm', mm);
                setOpenRow(null);
              }}
            >
              <DashPreview patternMm={[]} widthMm={mm} />
            </RadioRow>
          ))}
        </div>
      </PencilRow>

      {/*
        Το «Διπλή γραμμή» είναι **διακόπτης**, όχι υπο-μενού: δύο καταστάσεις, καμία λίστα. Το
        `menuitemcheckbox` του APG λέει ακριβώς αυτό — και είναι ό,τι κάνει και το AutoCAD, που
        το εκθέτει ως checkbox δίπλα στο «Spacing».
      */}
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={selection.double === true}
        ref={rovingOf(3).ref}
        tabIndex={rovingOf(3).tabIndex}
        onKeyDown={rovingOf(3).onKeyDown}
        onFocus={rovingOf(3).onFocus}
        className={panel.item}
        onClick={() => setTableBorderPencilField('double', selection.double ? undefined : true)}
        {...TABLE_CELL_SESSION_MARKER}
      >
        <span className={panel.itemIcon}><DoubleGlyph /></span>
        <span className={panel.rowLabel}>{t('table.borders.pencil.double')}</span>
      </button>

      <TableColorDialog
        draft={dialogDraft}
        title={t('table.borders.pencil.colorDialogTitle')}
        onDraftChange={setDialogDraft}
        onCancel={() => setDialogDraft(null)}
        onApply={(chosen) => {
          setDialogDraft(null);
          pickColor(chosen);
        }}
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/** Το κοινό «δέρμα» κάθε πτυσσόμενου — ίδιο με του πάνελ που το φιλοξενεί. */
const FLYOUT_SKIN = 'border border-border rounded-lg bg-popover text-popover-foreground shadow-md';

interface PencilRowProps {
  readonly roving: RovingItemProps;
  readonly label: string;
  readonly preview: React.ReactNode;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}

/**
 * Μία γραμμή της ζώνης: ετικέτα, **προεπισκόπηση της τρέχουσας τιμής**, βελάκι.
 *
 * Η προεπισκόπηση δεν είναι διακόσμηση — είναι ο λόγος που ο χρήστης δεν χρειάζεται να ανοίξει
 * το υπο-μενού για να δει τι ισχύει. Το Excel δείχνει την τρέχουσα τιμή μόνο **μέσα** στον
 * modal διάλογο, δηλαδή μόνο αφού έχεις ήδη χάσει το συμφραζόμενο.
 */
function PencilRow({
  roving, label, preview, expanded, onToggle, children,
}: PencilRowProps): React.ReactElement {
  return (
    <span className={panel.anchor} role="none">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={expanded}
        /*
         * 🔑 Το **όνομα** είναι σκέτη η ετικέτα, όχι «Πάχος γραμμής 0,25 mm».
         *
         * Η τρέχουσα τιμή ταξιδεύει ήδη στον αναγνώστη οθόνης με τον σωστό μηχανισμό: το
         * ανοιγμένο υπο-μενού έχει **ένα** `menuitemradio` με `aria-checked`. Χωμένη στο όνομα
         * θα ανακοινωνόταν **δύο** φορές (μία στη γραμμή, μία στο πτυσσόμενο) και θα άλλαζε
         * κάθε φορά που ο χρήστης διαλέγει — δηλαδή το ίδιο χειριστήριο θα άλλαζε όνομα.
         * Ίδιο σκεπτικό με το `aria-label` του `ToolbarButton` της γραμμής (Α19).
         */
        aria-label={label}
        ref={roving.ref}
        tabIndex={roving.tabIndex}
        onKeyDown={roving.onKeyDown}
        onFocus={roving.onFocus}
        className={panel.item}
        onClick={onToggle}
        {...TABLE_CELL_SESSION_MARKER}
      >
        <span className={panel.rowLabel}>{label}</span>
        {preview}
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      {expanded ? children : null}
    </span>
  );
}

/** Η γραμμή «Αυτόματο» — κληρονομιά από το στυλ του πίνακα (Α20/Α23). */
function AutomaticRow({
  label, active, onActivate,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onActivate: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      className={panel.item}
      onClick={onActivate}
      {...TABLE_CELL_SESSION_MARKER}
    >
      <span className={panel.rowLabel}>{label}</span>
    </button>
  );
}

/** Μία επιλογή αμοιβαία αποκλειόμενης λίστας (τύπος γραμμής / πάχος). */
function RadioRow({
  label, active, onActivate, children,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onActivate: () => void;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      aria-label={label}
      className={panel.item}
      onClick={onActivate}
      {...TABLE_CELL_SESSION_MARKER}
    >
      {children}
    </button>
  );
}

/** Το δείγμα χρώματος. Το `style` είναι αναγκαίο: το χρώμα είναι **δεδομένο**, όχι θέμα. */
function Swatch({ colorHex }: { readonly colorHex: string }): React.ReactElement {
  return (
    <span className={cn(panel.rowValue, panel.swatch)} style={{ backgroundColor: colorHex }} aria-hidden="true" />
  );
}

/**
 * Η προεπισκόπηση **ολόκληρου** του μολυβιού: χρώμα + μοτίβο + πάχος, σε μία γραμμή.
 *
 * Χρησιμοποιεί το πραγματικό `dashMm` και `widthMm` του επιλυμένου μολυβιού — δηλαδή ό,τι θα
 * γραφτεί. Μια προεπισκόπηση που έδειχνε μόνο το μοτίβο (όπως το thumbnail του ribbon) θα
 * απαντούσε τη μισή ερώτηση.
 */
function PenPreview({ pencil }: { readonly pencil: TableBorderSpec }): React.ReactElement {
  return (
    <span className={panel.rowValue}>
      <DashPreview patternMm={pencil.dashMm ?? []} widthMm={pencil.widthMm} colorHex={pencil.colorHex} />
    </span>
  );
}

/**
 * Μία γραμμή προεπισκόπησης — **η κοινή** {@link TableLinePreview} με το δέρμα αυτού του πάνελ.
 *
 * Το σώμα της μετακόμισε (ADR-750 Φ6, N.18): η Φ6 τη ρωτά σε δύο ακόμη σημεία, οπότε ένα
 * ιδιωτικό αντίγραφο εδώ θα ήταν sibling clone. Μένει αυτό το λεπτό περιτύλιγμα ώστε καμία από
 * τις τέσσερις κλήσεις παρακάτω να μη χρειάζεται να ξέρει το όνομα της κλάσης.
 */
function DashPreview({
  patternMm, widthMm, colorHex,
}: {
  readonly patternMm: readonly number[];
  readonly widthMm: number;
  readonly colorHex?: string;
}): React.ReactElement {
  return (
    <TableLinePreview
      patternMm={patternMm}
      widthMm={widthMm}
      colorHex={colorHex}
      className={panel.linePreview}
    />
  );
}

/** Δύο παράλληλες — το ίδιο σχήμα με το εικονίδιο των διπλών εντολών, στο μέγεθος του κειμένου. */
function DoubleGlyph(): React.ReactElement {
  return (
    <svg width={15} height={15} viewBox="0 0 15 15" aria-hidden="true" focusable="false">
      <line x1={1} y1={6} x2={14} y2={6} stroke="currentColor" strokeWidth={1.2} />
      <line x1={1} y1={9} x2={14} y2={9} stroke="currentColor" strokeWidth={1.2} />
    </svg>
  );
}
