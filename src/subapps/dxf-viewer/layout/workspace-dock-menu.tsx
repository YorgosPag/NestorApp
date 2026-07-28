/**
 * ADR-724 Φ2 — Το **μοντέλο** του μενού αγκύρωσης + ο **ένας** renderer του.
 *
 * ── ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΗΝ ΕΠΙΚΕΦΑΛΙΔΑ ──
 *
 * Οι εντολές εμφανίζονται σε **δύο** επιφάνειες: κουμπί «⋮» (`DropdownMenu`) και δεξί κλικ
 * (`ContextMenu`) — έτσι τις έχουν Revit / ArchiCAD / C4D. Τα δύο primitives του Radix έχουν
 * **διαφορετικά** components για τα ίδια νοήματα (`DropdownMenuItem` vs `ContextMenuItem`),
 * οπότε ο αφελής δρόμος είναι να γραφτεί η λίστα δύο φορές — δηλαδή ένα sibling clone, ακριβώς
 * αυτό που πιάνει το CHECK 3.28 (N.18).
 *
 * Εδώ γράφεται **μία** φορά: το μοντέλο ({@link useWorkspaceDockMenu}) δεν ξέρει από Radix, και
 * ο renderer ({@link DockMenuItems}) δέχεται τα primitives ως props. Μία νέα εντολή προστίθεται
 * σε **έναν** πίνακα και εμφανίζεται αυτόματα και στις δύο επιφάνειες.
 *
 * ── ΓΙΑΤΙ ΟΧΙ `RadioGroup` ──
 *
 * Η πλευρά *είναι* λογικά radio, αλλά τα Revit/AutoCAD τη δείχνουν ως **σημάδι επιλογής δίπλα
 * στην ενεργή εντολή**, σε ενιαία λίστα με τις υπόλοιπες. Με απλά `Item` + δείκτη ενεργού, η
 * απαιτούμενη επιφάνεια API είναι `Item` + `Separator` — τα μόνα δύο components που τα δύο
 * primitives εγγυημένα μοιράζονται.
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import { Check, PanelLeft, PanelRight, RotateCcw, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useDockMode } from '../systems/workspace/useWorkspaceDock';
import { setDockMode, resetDockLayout } from '../systems/workspace/workspace-dock-store';
import { DOCK_MODES } from '../systems/workspace/workspace-dock-mode';

/** Μία εντολή του μενού, ανεξάρτητη από το primitive που θα τη ζωγραφίσει. */
export interface DockMenuEntry {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Δείχνει σημάδι επιλογής. `undefined` ⇒ εντολή, όχι επιλογή κατάστασης. */
  readonly active?: boolean;
  /** Οπτικός διαχωρισμός ΠΡΙΝ από αυτή την εντολή (χωρίζει «κατάσταση» από «ενέργεια»). */
  readonly separatorBefore?: boolean;
  readonly onSelect: () => void;
}

/** Τα i18n κλειδιά κάθε πλευράς, δίπλα στην τιμή που περιγράφουν — μηδέν `switch` αλλού. */
const MODE_PRESENTATION = {
  'docked-left': { labelKey: 'workspaceDock.dockLeft', icon: PanelLeft },
  'docked-right': { labelKey: 'workspaceDock.dockRight', icon: PanelRight },
} as const;

/**
 * Το μοντέλο του μενού: η **μία** πηγή για το τι εντολές υπάρχουν, με ποια σειρά, και ποια
 * είναι ενεργή. Οι πλευρές παράγονται από το `DOCK_MODES` — μια μελλοντική τιμή (Φ3
 * `'floating'`) εμφανίζεται μόνη της, χωρίς να το θυμηθεί κανείς εδώ.
 */
export function useWorkspaceDockMenu(): readonly DockMenuEntry[] {
  const { t } = useTranslation('dxf-viewer-shell');
  const mode = useDockMode();

  const handleReset = useCallback((): void => { resetDockLayout(); }, []);

  return useMemo(() => [
    ...DOCK_MODES.map((value): DockMenuEntry => ({
      id: value,
      label: t(MODE_PRESENTATION[value].labelKey),
      icon: MODE_PRESENTATION[value].icon,
      active: value === mode,
      onSelect: () => setDockMode(value),
    })),
    {
      id: 'reset',
      label: t('workspaceDock.resetLayout'),
      icon: RotateCcw,
      separatorBefore: true,
      onSelect: handleReset,
    },
  ], [t, mode, handleReset]);
}

/**
 * Τα primitives που δανείζει ο καλών. Και τα δύο μενού του Radix τα ικανοποιούν δομικά — οι
 * δικές τους props είναι υπερσύνολο αυτών εδώ.
 */
export interface DockMenuPrimitives {
  readonly Item: React.ComponentType<{
    onSelect: () => void;
    className?: string;
    children: React.ReactNode;
  }>;
  readonly Separator: React.ComponentType;
}

const ITEM_CLASS = 'flex items-center gap-2';
/** Κρατά τη στοίχιση όταν η εντολή δεν είναι επιλογή κατάστασης (κενή θέση σημαδιού). */
const CHECK_SLOT_CLASS = 'w-4 h-4 shrink-0';

/**
 * Ζωγραφίζει το μοντέλο με τα primitives που του δόθηκαν. Καμία γνώση Radix, καμία γνώση
 * αγκύρωσης — μόνο «λίστα εντολών σε μενού».
 */
export function DockMenuItems({
  entries,
  Item,
  Separator,
}: { readonly entries: readonly DockMenuEntry[] } & DockMenuPrimitives): React.ReactElement {
  return (
    <>
      {entries.map((entry) => (
        <React.Fragment key={entry.id}>
          {entry.separatorBefore && <Separator />}
          <Item onSelect={entry.onSelect} className={ITEM_CLASS}>
            {entry.active ? <Check className={CHECK_SLOT_CLASS} aria-hidden /> : <span className={CHECK_SLOT_CLASS} />}
            <entry.icon className={CHECK_SLOT_CLASS} aria-hidden />
            {entry.label}
          </Item>
        </React.Fragment>
      ))}
    </>
  );
}
