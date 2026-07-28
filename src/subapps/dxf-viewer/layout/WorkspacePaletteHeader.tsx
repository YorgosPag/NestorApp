/**
 * ADR-724 Φ2 — Η **γραμμή τίτλου** της κύριας παλέτας.
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ ──
 *
 * Το ADR-724 §8 προδιέγραφε «δεξί κλικ **επικεφαλίδας**» — αλλά επικεφαλίδα δεν υπήρχε. Σε
 * Revit / ArchiCAD / C4D **κάθε** παλέτα έχει γραμμή τίτλου, και είναι η επιφάνεια που κάνει
 * τρία πράγματα ταυτόχρονα: λέει τι είναι η παλέτα, δέχεται το δεξί κλικ, και είναι η **λαβή**
 * με την οποία τη σέρνεις για να αιωρηθεί. Το τρίτο είναι η Φ3 — γι' αυτό χτίζεται τώρα μία
 * φορά αντί να μπει προσωρινό κουμπί κάπου αλλού και να ξηλωθεί μετά.
 *
 * ── ΓΙΑΤΙ ΔΥΟ ΕΠΙΦΑΝΕΙΕΣ ΓΙΑ ΤΟ ΙΔΙΟ ΜΕΝΟΥ ──
 *
 * Δεξί κλικ = ταχύτητα για τον έμπειρο· ορατό «⋮» = **ανακαλυψιμότητα** για τον καινούριο. Ένα
 * μενού που υπάρχει μόνο σε δεξί κλικ βρίσκεται κατά τύχη. Οι εντολές γράφονται **μία** φορά
 * (`workspace-dock-menu.tsx`) και δανείζονται σε αμφότερα.
 *
 * ⚠️ Η επικεφαλίδα **δεν** ξέρει τι σημαίνει «αριστερά/δεξιά» — μόνο ότι υπάρχει μενού. Η
 * γνώση της πλευράς ζει στο store και στο `WorkspaceSplitLayout`.
 */

'use client';

import React from 'react';
import { MoreVertical } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
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
import { DockMenuItems, useWorkspaceDockMenu } from './workspace-dock-menu';

const HEADER_CLASS = 'flex-shrink-0 flex items-center justify-between gap-2 h-8 px-2 select-none';
const TITLE_CLASS = 'text-xs font-medium truncate';
const TRIGGER_CLASS = 'inline-flex items-center justify-center w-6 h-6 rounded hover:bg-accent';
const ICON_CLASS = 'w-4 h-4';

/**
 * Γραμμή τίτλου + μενού αγκύρωσης.
 *
 * `<header>` σκόπιμα, όχι `<div>` (N.4): είναι η επικεφαλίδα του `<section>` της παλέτας και
 * τα βοηθήματα προσβασιμότητας τη διαβάζουν ως τέτοια.
 */
export const WorkspacePaletteHeader = React.memo((): React.ReactElement => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const entries = useWorkspaceDockMenu();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <header className={`${HEADER_CLASS} ${colors.bg.card}`}>
          <h2 className={`${TITLE_CLASS} ${colors.text.muted}`}>{t('workspaceDock.title')}</h2>

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
