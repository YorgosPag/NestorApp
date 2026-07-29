/**
 * ADR-724 Φ2/Φ3 — Η **γραμμή τίτλου** της κύριας παλέτας.
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ ──
 *
 * Το ADR-724 §8 προδιέγραφε «δεξί κλικ **επικεφαλίδας**» — αλλά επικεφαλίδα δεν υπήρχε. Σε
 * Revit / ArchiCAD / C4D **κάθε** παλέτα έχει γραμμή τίτλου, και είναι η επιφάνεια που κάνει
 * τρία πράγματα ταυτόχρονα: λέει τι είναι η παλέτα, δέχεται το δεξί κλικ, και είναι η **λαβή**
 * με την οποία τη σέρνεις για να αιωρηθεί.
 *
 * ── ΓΙΑΤΙ ΔΥΟ ΕΠΙΦΑΝΕΙΕΣ ΓΙΑ ΤΟ ΙΔΙΟ ΜΕΝΟΥ ──
 *
 * Δεξί κλικ = ταχύτητα για τον έμπειρο· ορατό «⋮» = **ανακαλυψιμότητα** για τον καινούριο. Ένα
 * μενού που υπάρχει μόνο σε δεξί κλικ βρίσκεται κατά τύχη. Οι εντολές γράφονται **μία** φορά
 * (`workspace-dock-menu.tsx`) και δανείζονται σε αμφότερα.
 *
 * ── Φ3: ΕΝΑΣ ΤΙΤΛΟΣ ΓΙΑ ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ ──
 *
 * Η ίδια επικεφαλίδα αποδίδεται **και** αγκυρωμένη **και** μέσα σε `FloatingPanel`. Δεν είναι
 * αισθητική επιλογή: μια δεύτερη «floating επικεφαλίδα» θα ήταν sibling clone (τίτλος + μενού +
 * δεξί κλικ, ξανά) — ακριβώς ό,τι πιάνει το CHECK 3.28 (N.18). Η διαφορά μεταξύ των δύο
 * καταστάσεων είναι **μόνο** το αν η επικεφαλίδα σέρνει, και την απαντά το context του ADR-723
 * μέσω {@link useFloatingPanelContextOptional} — hook που καλείται **πάντα** και επιστρέφει
 * `null` όταν δεν αιωρούμαστε (υπό συνθήκη κλήση hook θα ήταν παραβίαση των rules-of-hooks).
 *
 * ⚠️ Η επικεφαλίδα **δεν** ξέρει τι σημαίνει «αριστερά/δεξιά» — μόνο ότι υπάρχει μενού και ότι
 * το διπλό κλικ εναλλάσσει. Η γνώση της πλευράς ζει στο store και στο `WorkspaceSplitLayout`.
 */

'use client';

import React, { useCallback, useId } from 'react';
import { MoreVertical } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useFloatingPanelContextOptional } from '@/components/ui/floating';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { toggleDockFloat } from '../systems/workspace/workspace-dock-store';
import { DockMenuItems, useWorkspaceDockMenu } from './workspace-dock-menu';

const HEADER_CLASS = 'flex-shrink-0 flex items-center justify-between gap-2 h-8 px-2 select-none';
const TITLE_CLASS = 'text-xs font-medium truncate';
const TRIGGER_CLASS = 'inline-flex items-center justify-center w-6 h-6 rounded hover:bg-accent';
const ICON_CLASS = 'w-4 h-4';

/**
 * Στοιχεία που **δεν** ξεκινούν σύρσιμο ούτε εναλλάσσουν κατάσταση, όσο κι αν ζουν μέσα στη λαβή.
 *
 * ⚠️ Ο φύλακας είναι εδώ και **όχι** στο `useDraggable`, παρότι εκείνο έχει ήδη δικό του
 * «smart interaction exclusion». Ο λόγος είναι συγκεκριμένος: το `useDraggable` θεωρεί
 * **λαβή** οτιδήποτε ταιριάζει σε `.cursor-grab` και τότε **παρακάμπτει** τον δικό του
 * αποκλεισμό κουμπιών. Η επικεφαλίδα φέρει `cursor-grab` (σωστή ένδειξη πρόθεσης για ΟΛΟ το
 * πλάτος της), άρα ένα `mousedown` πάνω στο «⋮» θα περνούσε ως σύρσιμο και το μενού δεν θα
 * άνοιγε ποτέ με το ποντίκι. Φιλτράρουμε **πριν** την ανάθεση: ο μόνος τρόπος να έχουμε και
 * σωστό δείκτη και λειτουργικό κουμπί.
 */
const NON_DRAG_SELECTOR = 'button, a, input, select, textarea, [role="button"], [role="menuitem"]';

function isNonDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NON_DRAG_SELECTOR) !== null;
}

/**
 * Γραμμή τίτλου + μενού αγκύρωσης + (όταν αιωρείται) λαβή μετακίνησης.
 *
 * `<header>` σκόπιμα, όχι `<div>` (N.4): είναι η επικεφαλίδα του `<section>` της παλέτας και
 * τα βοηθήματα προσβασιμότητας τη διαβάζουν ως τέτοια.
 */
export const WorkspacePaletteHeader = React.memo((): React.ReactElement => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const entries = useWorkspaceDockMenu();
  const floating = useFloatingPanelContextOptional();
  const hintId = useId();

  const handlePointerDown = useCallback((event: React.MouseEvent): void => {
    if (!floating || isNonDragTarget(event.target)) return;
    floating.handleMouseDown(event);
  }, [floating]);

  /**
   * Διπλό κλικ = dock ⇄ float (§8, χειρονομία Revit).
   *
   * Ζει και στις **δύο** καταστάσεις: αγκυρωμένη ⇒ αιωρεί, αιωρούμενη ⇒ επιστρέφει στην
   * τελευταία πλευρά. Μία χειρονομία, ένας handler — η ασυμμετρία («πού επιστρέφει;»)
   * απαντιέται στο store, όχι εδώ.
   */
  const handleDoubleClick = useCallback((event: React.MouseEvent): void => {
    if (isNonDragTarget(event.target)) return;
    toggleDockFloat();
  }, []);

  const cursorClass = floating
    ? (floating.isDragging ? 'cursor-grabbing' : 'cursor-grab')
    : 'cursor-default';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <header
          className={`${HEADER_CLASS} ${cursorClass} ${colors.bg.card}`}
          onMouseDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          aria-describedby={hintId}
        >
          <h2 className={`${TITLE_CLASS} ${colors.text.muted}`}>{t('workspaceDock.title')}</h2>

          {/*
            Η χειρονομία του διπλού κλικ είναι **αόρατη** — το ίδιο παράπονο που έχουν οι
            χρήστες του Revit. Ένα `title=` θα ήταν η εύκολη απάντηση, αλλά είναι ratchet
            (CHECK 3.23) και δεν το διαβάζει αναγνώστης οθόνης. Μια περιγραφή στο δέντρο
            προσβασιμότητας την ανακοινώνει σε όποιον δεν μπορεί να την ανακαλύψει με το ποντίκι.
          */}
          <span id={hintId} className="sr-only">
            {floating ? t('workspaceDock.dragHandleHint') : t('workspaceDock.dockHandleHint')}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={TRIGGER_CLASS}
              aria-label={t('workspaceDock.menuLabel')}
            >
              <MoreVertical className={ICON_CLASS} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DockMenuItems
                entries={entries}
                Item={DropdownMenuItem}
                Separator={DropdownMenuSeparator}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <DockMenuItems
          entries={entries}
          Item={ContextMenuItem}
          Separator={ContextMenuSeparator}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
});

WorkspacePaletteHeader.displayName = 'WorkspacePaletteHeader';
