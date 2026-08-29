'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-739 §70 — η **μία** δήλωση που καλύπτει κάθε χειριστήριο αυτής της μπάρας.
import { NON_ACTIVATING_SURFACE } from '@/lib/a11y/non-activating-surface';
import type { RibbonMinimizeState, RibbonTab } from '../types/ribbon-types';
import type { TabDragHandlers } from '../hooks/useRibbonTabDrag';
import { RibbonTabItem } from './RibbonTabItem';
import { RibbonMinimizeButton } from './RibbonMinimizeButton';
import { RibbonHeaderToggleButton } from './RibbonHeaderToggleButton';
import { RibbonUndoRedoButtons } from './RibbonUndoRedoButtons';
// ADR-748 Φάση 2 — ο ορατός διακόπτης ειδικότητας + ο δείκτης «Χ κρυμμένες».
import { RibbonSpecialtySwitch } from './RibbonSpecialtySwitch';
import type { RibbonSpecialtySelection } from '../data/ribbon-tab-specialties';

interface RibbonTabBarProps {
  tabs: RibbonTab[];
  activeTabId: string;
  minimizeState: RibbonMinimizeState;
  onTabActivate: (id: string) => void;
  onTabDoubleClick: () => void;
  onTabContextMenu: (e: React.MouseEvent) => void;
  onCycleMinimize: () => void;
  drag: TabDragHandlers;
  activeSpecialty: RibbonSpecialtySelection;
  onSpecialtyChange: (specialty: RibbonSpecialtySelection) => void;
}

export const RibbonTabBar: React.FC<RibbonTabBarProps> = ({
  tabs,
  activeTabId,
  minimizeState,
  onTabActivate,
  onTabDoubleClick,
  onTabContextMenu,
  onCycleMinimize,
  drag,
  activeSpecialty,
  onSpecialtyChange,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <div
      className="dxf-ribbon-tab-bar"
      role="tablist"
      aria-label={t('ribbon.ariaLabels.tabBar')}
      /**
       * 🔴 ADR-739 §70 — **Η ΜΠΑΡΑ ΚΑΡΤΕΛΩΝ ΕΙΝΑΙ ΧΡΩΜΙΟ, ΚΑΙ ΤΟ ΔΗΛΩΝΕΙ ΕΔΩ, ΜΙΑ ΦΟΡΑ.**
       *
       * Κανένα από τα χειριστήριά της δεν σημαίνει «φεύγω από τον πίνακα»: αναίρεση,
       * επανάληψη, σύμπτυξη κορδέλας, εναλλαγή ειδικότητας, επιλογή καρτέλας. Όλα δρουν
       * **πάνω** στη συνεδρία ή στο κέλυφος — άρα κανένα δεν δικαιούται να πάρει το
       * πληκτρολόγιο από πεδίο που γράφεται.
       *
       * Το ελάττωμα που κλείνει: το βελάκι ↶ έκανε την αναίρεση **και** έβγαζε τον πίνακα
       * από τη συνεδρία, ενώ το `Ctrl+Z` έκανε μόνο την αναίρεση. Η αιτία δεν ήταν στο
       * `onClick` — ήταν η **προεπιλεγμένη ενέργεια του `mousedown`**, που είχε ήδη
       * μετακινήσει την εστίαση πριν καν εκδοθεί το `click`.
       *
       * ⚠️ Μπαίνει **εδώ** και όχι στη ρίζα της κορδέλας: τα panels εντολών περιέχουν
       * εργαλεία σχεδίασης, όπου το κλείσιμο της συνεδρίας είναι η **προδιαγραφή**.
       * ⚠️ Οι καρτέλες είναι `draggable` (αναδιάταξη) — ο κανόνας τις εξαιρεί ρητά, γιατί
       * το `preventDefault` στο `mousedown` είναι ο κατά πρότυπο τρόπος ακύρωσης της
       * εγγενούς σύρσης. Δες τον κλάδο (3) του `pressMayMoveKeyboard`.
       */
      {...NON_ACTIVATING_SURFACE}
    >
      <RibbonHeaderToggleButton />
      <RibbonUndoRedoButtons />
      <div className="dxf-ribbon-tab-list">
        {tabs.map((tab) => (
          <RibbonTabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => onTabActivate(tab.id)}
            onDoubleClick={onTabDoubleClick}
            onContextMenu={onTabContextMenu}
            drag={drag}
          />
        ))}
      </div>
      <RibbonSpecialtySwitch
        activeSpecialty={activeSpecialty}
        onSpecialtyChange={onSpecialtyChange}
      />
      <RibbonMinimizeButton
        minimizeState={minimizeState}
        onCycle={onCycleMinimize}
      />
    </div>
  );
};
