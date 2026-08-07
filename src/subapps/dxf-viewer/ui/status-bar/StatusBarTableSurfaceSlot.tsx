'use client';

/**
 * 🔴 ADR-771 Φ.2 — **Ο ΜΟΝΙΜΑ ΟΡΑΤΟΣ ΔΕΙΚΤΗΣ ΕΠΙΦΑΝΕΙΑΣ** (ΚΑΜΒΑΣ / ΦΥΛΛΟ / ΧΑΡΤΙ).
 *
 * ## 🔑 Γιατί στη γραμμή κατάστασης, και όχι σε διάλογο ρυθμίσεων
 * Δεν είναι θέμα βολικότητας — είναι **η ίδια η ορθότητα της φάσης**, και το επέβαλε η μέτρηση.
 * Κάθε ουδέτερο ανοιχτό γκρι απέχει **1,09–1,23:1** από το λευκό χαρτί, δηλαδή οι καταστάσεις
 * «Φύλλο» και «Χαρτί» είναι **οπτικά αδιάκριτες** πάνω στον ίδιο τον πίνακα. Αν ο διακόπτης
 * ήταν θαμμένος σε dialog, ο χρήστης δεν θα είχε **καμία** ένδειξη για το ποια ισχύει — WCAG
 * 1.4.1 («ξέρω ποιο είναι ποιο χωρίς χρώμα;») σε κλίμακα εφαρμογής, ακριβώς το ελάττωμα που
 * λύθηκε στη Φ.1 για τα σήματα κελιού.
 *
 * Είναι και η λύση του **AutoCAD**: το `MODEL`/`PAPER` κάθεται στη γραμμή κατάστασης, ορατό
 * πάντα. Δίπλα στα OSNAP/GRID/ORTHO, δηλαδή στη γειτονιά όπου ο χρήστης CAD ήδη ψάχνει «σε
 * ποια λειτουργία είμαι;».
 *
 * ## Ξεχωριστό αρχείο επίτηδες (N.7.1)
 * Το `CadStatusBar.tsx` είναι **483 γραμμές** σε όριο 500. Η προσθήκη έγινε ως slot component
 * — **extract, ποτέ trim** — όπως ήδη κάνει το `StatusBarXLineModeSlot`, του οποίου το σχήμα
 * ακολουθείται πιστά (Popover + `useSyncExternalStore` πάνω στο store SSoT).
 *
 * @module subapps/dxf-viewer/ui/status-bar/StatusBarTableSurfaceSlot
 * @see systems/table-surface/table-surface-mode.ts — το store SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-771-table-surface-doctrine.md §4
 */

import React, { useCallback, useSyncExternalStore } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  getTableSurfaceMode,
  setTableSurfaceMode,
  subscribeTableSurfaceMode,
  type TableSurfaceMode,
} from '../../systems/table-surface/table-surface-mode';

interface StatusBarTableSurfaceSlotProps {
  readonly className?: string;
}

/**
 * Η σειρά είναι **σχεδίου → ανάγνωσης → παραδοτέου**, δηλαδή αυξανόμενης απόστασης από τον
 * καμβά. Ίδια σειρά με τα tabs Model → Layout του AutoCAD· ο χρήστης «απομακρύνεται» από το
 * σχέδιο προς το τυπωμένο φύλλο.
 */
const ALL_MODES: ReadonlyArray<TableSurfaceMode> = ['canvas', 'sheet', 'paper'];

/** Ό,τι διαβάζει ο χρήστης για μία κατάσταση: το όνομά της και τι υπόσχεται. */
interface SurfaceCopy {
  readonly label: string;
  readonly description: string;
}

/**
 * 🔴 **ΚΥΡΙΟΛΕΚΤΙΚΑ κλειδιά, ποτέ `t(\`…${mode}\`)`.**
 *
 * Μια παρεμβολή θα ήταν συντομότερη κατά τρεις γραμμές και θα κόστιζε δύο πράγματα: καμία
 * στατική ανάλυση δεν μπορεί πια να απαντήσει «υπάρχει αυτό το κλειδί;» (CHECK 3.8 / 3.13),
 * και ο generator του shell slice (CHECK 3.34) **αρνείται** να παράξει σε ανεπίλυτη `t()`.
 * Το `switch` πάνω σε ένωση κάνει επιπλέον τον **μεταγλωττιστή** φρουρό της πληρότητας: μια
 * τέταρτη κατάσταση δεν μπορεί να προσγειωθεί χωρίς ετικέτα και περιγραφή.
 */
function copyFor(mode: TableSurfaceMode, t: (key: string) => string): SurfaceCopy {
  switch (mode) {
    case 'canvas':
      return {
        label: t('cadDock.statusBar.tableSurfaceCanvas'),
        description: t('cadDock.statusBar.tableSurfaceCanvasDesc'),
      };
    case 'sheet':
      return {
        label: t('cadDock.statusBar.tableSurfaceSheet'),
        description: t('cadDock.statusBar.tableSurfaceSheetDesc'),
      };
    case 'paper':
      return {
        label: t('cadDock.statusBar.tableSurfacePaper'),
        description: t('cadDock.statusBar.tableSurfacePaperDesc'),
      };
  }
}

export function StatusBarTableSurfaceSlot({ className }: StatusBarTableSurfaceSlotProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const mode = useSyncExternalStore(
    subscribeTableSurfaceMode,
    getTableSurfaceMode,
    getTableSurfaceMode,
  );

  const handleSelect = useCallback((next: TableSurfaceMode) => {
    setTableSurfaceMode(next);
  }, []);

  return (
    <Popover>
      {/* 🔴 CHECK 3.23 — το κεντρικό Tooltip, ΠΟΤΕ native `title=`. Δεν είναι στυλιστική
          προτίμηση: το `title` δεν εμφανίζεται σε πληκτρολόγιο ούτε σε αφή, έχει ~1s
          καθυστέρηση που δεν ρυθμίζεται, και δεν διαβάζεται συνεπώς από τους αναγνώστες
          οθόνης. Ο `TooltipProvider` ζει ήδη στο `CadStatusBar` που μας φιλοξενεί, οπότε
          δεύτερος εδώ θα ήταν διπλό context. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs',
                'hover:bg-white/10 transition-colors cursor-pointer select-none',
                'text-muted-foreground hover:text-foreground',
                className,
              )}
            >
              <span className="opacity-70">{t('cadDock.statusBar.tableSurface')}</span>
              {/* Η ενεργή κατάσταση είναι η ΜΟΝΗ αιτία ύπαρξης του slot — γι' αυτό σε πλήρη
                  αντίθεση, ενώ η ετικέτα «ΕΠΙΦΑΝΕΙΑ» υποχωρεί. */}
              <span className="font-medium text-foreground">{copyFor(mode, t).label}</span>
              <ChevronDown size={12} className="opacity-50" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t('cadDock.statusBar.tableSurfaceDesc')}</TooltipContent>
      </Tooltip>

      <PopoverContent side="top" align="start" className="w-72 p-1">
        {ALL_MODES.map((candidate) => {
          const copy = copyFor(candidate, t);
          return (
            <button
              key={candidate}
              type="button"
              onClick={() => handleSelect(candidate)}
              aria-current={candidate === mode}
              className={cn(
                'flex w-full flex-col items-start gap-0.5 rounded px-3 py-1.5 text-left',
                'transition-colors cursor-pointer',
                candidate === mode
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'hover:bg-accent/60',
              )}
            >
              <span className="text-sm">{copy.label}</span>
              {/* Η περιγραφή δεν είναι διακοσμητική: είναι ο λόγος που ο χρήστης ξέρει ΤΙ
                  αλλάζει, τη στιγμή που το χρώμα δεν μπορεί να του το πει. */}
              <span className="text-xs opacity-60">{copy.description}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
